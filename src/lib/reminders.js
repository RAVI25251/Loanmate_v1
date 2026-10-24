// Works out which reminders are ready to send today, by SMS and by email.
//
// A reminder is offered only when ALL of these are ON:
//   * the master switch of that channel (SMS or email)
//   * the person's own switch for that channel (both start OFF: no consent yet)
//   * the reminder type for that person (upcoming / due / overdue)
//   * the switch of that loan or rent (reminders_enabled, ON unless you switched it OFF)
//
// Interest-only loans: interest is owed once a month has completed. If interest is pending, the reminder is for
// that amount (due on the day it was added, overdue after). If nothing is pending, the reminder is an early
// notice for the interest that will be added when the running month completes.
import { addDays, dueDateFor, isEmail, normalizeMobile, periodLabel } from './format.js'
import { buildLoanMessage, buildRentMessage, renderCustomMessage } from './messages.js'
import { buildEmailSubject } from './remindMail.js'
import { latestEntry, nextInterest } from './selectors.js'

export const REMINDER_TYPES = ['upcoming', 'due', 'overdue']
export const CHANNELS = ['sms', 'email']

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

// Which channels are switched ON for a person (master switch AND the person's own switch)
export function channelsFor(person, { smsGlobal = true, emailGlobal = true } = {}) {
  const out = []
  if (smsGlobal && person.sms_enabled) out.push('sms')
  if (emailGlobal && person.email_enabled === true) out.push('email')
  return out
}

export function buildReminderQueue({
  today, people, reminders, loans, entries, payments = [], tenancies, properties, dues, smsHistory,
  globalEnabled = true, // the SMS master switch (kept under its old name)
  emailGlobalEnabled = true,
}) {
  if (!globalEnabled && !emailGlobalEnabled) return []
  const globals = { smsGlobal: globalEnabled, emailGlobal: emailGlobalEnabled }
  const period = today.slice(0, 7)
  const personById = new Map(people.map((p) => [p.id, p]))
  const propertyById = new Map(properties.map((p) => [p.id, p]))
  const historyByKey = new Map(smsHistory.map((h) => [h.dedupe_key, h]))
  const out = []
  const months = { en: periodLabel(period, 'en'), te: periodLabel(period, 'te') }

  function push(person, base) {
    const channels = channelsFor(person, globals)
    if (!channels.length) return
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

    // one reminder per person, payment, due date, stage and channel (the SMS key is unchanged from earlier versions)
    const smsKey = `${person.id}|${base.category}|${base.sourceId}|${base.dueDate}|${stage}`
    const mobile = normalizeMobile(person.mobile)
    const email = person.email ? String(person.email).trim().toLowerCase() : ''

    for (const channel of channels) {
      const key = channel === 'sms' ? smsKey : `${smsKey}|email`
      const history = historyByKey.get(key)
      const emailOk = Boolean(email) && isEmail(email)
      out.push({
        key, channel, personId: person.id, personName: person.name,
        mobile, mobileOk: Boolean(mobile), email, emailOk,
        contactOk: channel === 'sms' ? Boolean(mobile) : emailOk,
        category: base.category, stage, lang, dueDate: base.dueDate, amount: base.amount, message,
        subject: channel === 'email' ? buildEmailSubject({ lang, category: base.category, amount: base.amount, dueDate: base.dueDate, overdue }) : null,
        status: history ? history.status : 'ready', historyId: history?.id ?? null,
      })
    }
  }

  // Money lent
  for (const loan of loans) {
    if (!loan.active || loan.kind !== 'lent') continue
    if (loan.reminders_enabled === false) continue
    const person = personById.get(loan.person_id)
    if (!person || !channelsFor(person, globals).length) continue
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
    if (tenancy.reminders_enabled === false) continue
    const person = personById.get(tenancy.person_id)
    const property = propertyById.get(tenancy.property_id)
    if (!person || !property || !channelsFor(person, globals).length) continue
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

  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.personName.localeCompare(b.personName) || a.channel.localeCompare(b.channel))
}
