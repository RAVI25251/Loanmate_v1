// Works out which SMS reminders are ready to send today.
// Rules: the global SMS switch must be ON, the person's own switch must be ON (default OFF = no consent yet),
// and the reminder type (upcoming / due / overdue) must be ON for that person.
import { addDays, dueDateFor, normalizeMobile, periodLabel } from './format.js'
import { buildLoanMessage, buildRentMessage, renderCustomMessage } from './messages.js'
import { latestEntry, nextInterest } from './selectors.js'

export const REMINDER_TYPES = ['upcoming', 'due', 'overdue']

export function getSetting(reminders, personId, type) {
  const row = reminders.find((r) => r.person_id === personId && r.reminder_type === type)
  return {
    enabled: row ? row.enabled : true,
    language: row?.language || null,
    daysBefore: row?.days_before ?? 3,
    time: row?.reminder_time ? String(row.reminder_time).slice(0, 5) : '09:00',
    custom: row?.custom_message || '',
  }
}

// Which stage a due date is in today: upcoming (N days before), due (the day), overdue (after)
export function stageFor(today, dueDate, daysBefore) {
  if (today > dueDate) return 'overdue'
  if (today === dueDate) return 'due'
  if (today >= addDays(dueDate, -Number(daysBefore))) return 'upcoming'
  return null
}

export function buildReminderQueue({ today, people, reminders, loans, entries, payments = [], tenancies, properties, dues, smsHistory, globalEnabled = true }) {
  if (!globalEnabled) return []
  const period = today.slice(0, 7)
  const personById = new Map(people.map((p) => [p.id, p]))
  const propertyById = new Map(properties.map((p) => [p.id, p]))
  const historyByKey = new Map(smsHistory.map((h) => [h.dedupe_key, h]))
  const out = []
  const months = { en: periodLabel(period, 'en'), te: periodLabel(period, 'te') }

  function push(person, base) {
    const upcomingSetting = getSetting(reminders, person.id, 'upcoming')
    const stage = stageFor(today, base.dueDate, upcomingSetting.daysBefore)
    if (!stage) return
    const setting = getSetting(reminders, person.id, stage)
    if (!setting.enabled) return
    const lang = person.sms_language || setting.language || 'en'
    const overdue = stage === 'overdue'
    const vars = { ...base, name: person.name, month: base.month?.[lang === 'te' ? 'te' : 'en'] }
    let message
    if (setting.custom.trim()) message = renderCustomMessage(setting.custom, vars)
    else if (base.category === 'house_rent' || base.category === 'shop_rent')
      message = buildRentMessage({ lang, shop: base.category === 'shop_rent', name: person.name, month: vars.month, amount: base.amount, dueDate: base.dueDate, arrears: base.arrears, total: base.total, overdue })
    else message = buildLoanMessage({ lang, name: person.name, amount: base.amount, dueDate: base.dueDate, principal: base.principal, interest: base.interest, overdue })
    // one reminder per person, payment, due date and stage
    const key = `${person.id}|${base.category}|${base.sourceId}|${base.dueDate}|${stage}`
    const history = historyByKey.get(key)
    const mobile = normalizeMobile(person.mobile)
    out.push({
      key, personId: person.id, personName: person.name, mobile, mobileOk: Boolean(mobile),
      category: base.category, stage, lang, dueDate: base.dueDate, amount: base.amount, message,
      status: history ? history.status : 'ready', historyId: history?.id ?? null,
    })
  }

  // Money lent
  for (const loan of loans) {
    if (!loan.active || loan.kind !== 'lent') continue
    const person = personById.get(loan.person_id)
    if (!person || !person.sms_enabled) continue
    const latest = latestEntry(entries, loan.id)
    if (!latest) continue
    const emi = Number(loan.emi_paise) || 0
    const pending = latest.closing_pending_paise

    if (emi > 0) {
      const paid = payments
        .filter((p) => p.loan_id === loan.id && !p.voided_at && (p.payment_type === 'interest' || p.payment_type === 'principal') && String(p.payment_date).slice(0, 7) === period)
        .reduce((s, p) => s + p.amount_paise, 0)
      const amount = Math.max(emi - paid, 0)
      if (amount <= 0) continue
      push(person, { category: 'loan', sourceId: loan.id, dueDate: dueDateFor(period, loan.due_day), amount, principal: latest.closing_principal_paise, interest: pending, month: months })
    } else if (pending > 0) {
      push(person, { category: 'interest', sourceId: loan.id, dueDate: latest.period_start, amount: pending, principal: latest.closing_principal_paise, interest: pending, month: months })
    } else if (latest.closing_principal_paise > 0) {
      const next = nextInterest(latest)
      if (next.amount <= 0) continue
      push(person, { category: 'interest', sourceId: loan.id, dueDate: next.date, amount: next.amount, principal: latest.closing_principal_paise, interest: next.amount, month: months })
    }
  }

  // Rent: house and shop reminders are separate
  for (const tenancy of tenancies) {
    if (!tenancy.active) continue
    const person = personById.get(tenancy.person_id)
    const property = propertyById.get(tenancy.property_id)
    if (!person || !property || !person.sms_enabled) continue
    const due = dues.find((d) => d.tenancy_id === tenancy.id && d.period_key === period)
    if (!due || due.closing_arrears_paise <= 0) continue
    push(person, {
      category: property.kind === 'shop' ? 'shop_rent' : 'house_rent',
      sourceId: tenancy.id,
      dueDate: due.due_date,
      amount: due.rent_paise + due.maintenance_paise,
      arrears: Math.max(due.previous_arrears_paise - due.paid_paise, 0),
      total: due.closing_arrears_paise,
      month: months,
    })
  }

  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.personName.localeCompare(b.personName))
}
