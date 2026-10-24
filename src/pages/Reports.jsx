import { useMemo, useState } from 'react'
import { Card, Empty, Notice, Pill } from '../components/ui.jsx'
import { ddmmyyyy, rupees, todayIso } from '../lib/format.js'
import { downloadText } from '../lib/download.js'
import { emailHistoryCsv, interestLedgerCsv, liabilitiesCsv, paymentsCsv, rentCsv, smsHistoryCsv, toCsv, weeklyReportCsv } from '../lib/report.js'
import { byId, interestPosition, latestEntry } from '../lib/selectors.js'
import { supabase } from '../lib/supabase.js'
import { describeError } from '../lib/api.js'
import { makeX } from '../lib/textV4.js'
import { APP_NAME } from '../lib/config.js'

function Table({ head, rows, empty }) {
  if (!rows.length) return <Empty>{empty}</Empty>
  return (
    <div className="table-wrap">
      <table className="compact">
        <thead><tr>{head.map((h, i) => <th key={i} className={i === head.length - 1 ? 'num' : ''}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j === r.length - 1 ? 'num' : ''}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

export function ReportView({ t, x, r }) {
  const cat = { interest: t('catInterest'), emi: t('catEmi'), rent: t('catRent') }
  const rentRows = (list) => list.map((e) => [`${e.property} ${e.unit ?? ''}`.trim(), e.tenant, rupees(e.monthly_total)])
  const pendRows = (list) => list.map((e) => [`${e.property} ${e.unit ?? ''}`.trim(), e.tenant, rupees(e.previous_arrears), `${e.months_overdue}`, rupees(e.closing_arrears)])
  const nextOf = (b) => (b.next_interest_date && b.next_interest_amount > 0 ? `${ddmmyyyy(b.next_interest_date)} (+${rupees(b.next_interest_amount)})` : '—')
  return (
    <div className="report">
      <h3>{t('weeklyReport')} — {ddmmyyyy(r.week_start)} → {ddmmyyyy(r.week_end)}</h3>

      <h4>1. {t('s_lent')}</h4>
      <Table head={[t('principalLent'), t('principalOutstanding')]} rows={[[rupees(r.lent.total_principal_lent), rupees(r.lent.principal_outstanding)]]} />

      <h4>2. {t('s_borrowers')}</h4>
      <Table
        head={[t('person'), t('principalOutstanding'), x('interestDue'), t('overdueInterest'), x('accruedShort'), x('totalOutstandingInterest'), t('nextInterest'), t('totalReceivable')]}
        rows={r.borrowers.map((b) => [b.person, rupees(b.principal_outstanding), rupees(b.interest_pending), rupees(b.overdue_interest), `${rupees(b.accrued_interest)} (${b.accrued_days} ${x('days')})`, rupees(b.total_outstanding_interest), nextOf(b), rupees(b.total_receivable)])}
        empty={t('none')}
      />

      <h4>3. {t('s_interest')}</h4>
      <Table head={[x('interestAddedTotal'), x('interestReceivedTotal'), x('interestDue'), x('accruedShort'), x('totalOutstandingInterest')]} rows={[[rupees(r.interest.added_total), rupees(r.interest.received_total), rupees(r.interest.outstanding), rupees(r.interest.accrued), rupees(r.interest.total_outstanding)]]} />
      <Table head={[t('previousPending'), t('currentInterest'), t('interestReceived'), t('interestRemaining')]} rows={[[rupees(r.interest.previous_pending), rupees(r.interest.current_interest), rupees(r.interest.received), rupees(r.interest.outstanding)]]} />
      <p className="hint">{x('accruedNote')}</p>

      <h4>4. {t('s_borrowed')}</h4>
      <Table head={[t('borrowed'), t('bankLoans'), t('interestPayable'), x('accruedShort')]} rows={[[rupees(r.borrowed.borrowed_principal), rupees(r.borrowed.bank_principal), rupees(r.borrowed.interest_payable), rupees(r.borrowed.accrued_interest)]]} />
      <Table head={[t('person'), t('type'), t('principalOutstanding'), t('interestPayable'), x('accruedShort')]} rows={r.borrowed.items.map((e) => [e.person, t({ borrowed: 'kindBorrowed', bank: 'kindBank' }[e.kind]), rupees(e.principal_outstanding), rupees(e.interest_payable), rupees(e.accrued_interest)])} />

      <h4>5. {t('s_emis')}</h4>
      <Table head={[t('upcomingEmis'), t('dueDate'), t('amount')]} rows={r.emis.upcoming.map((e) => [`${e.person} (${e.direction === 'pay' ? t('toPay') : t('toCollect')})`, ddmmyyyy(e.due_date), rupees(e.amount)])} empty={t('none')} />
      <Table head={[t('overdueEmis'), t('dueDate'), t('amount')]} rows={r.emis.overdue.map((e) => [`${e.person} (${e.direction === 'pay' ? t('toPay') : t('toCollect')})`, ddmmyyyy(e.due_date), rupees(e.amount)])} empty={t('none')} />

      <h4>6. {t('s_rent_expected')}</h4>
      <Table head={[`${t('houseRent')} — ${t('property')}`, t('tenant'), t('amount')]} rows={rentRows(r.rent_expected.house)} empty={t('none')} />
      <Table head={[`${t('shopRent')} — ${t('property')}`, t('tenant'), t('amount')]} rows={rentRows(r.rent_expected.shop)} empty={t('none')} />

      <h4>7. {t('s_rent_collected')}</h4>
      <Table head={[t('tenant'), t('property'), t('date'), t('amount')]} rows={r.rent_collected.items.map((e) => [e.tenant, e.property, ddmmyyyy(e.date), rupees(e.amount)])} empty={t('none')} />

      <h4>8. {t('s_rent_pending')}</h4>
      <Table head={[`${t('houseRent')} — ${t('property')}`, t('tenant'), t('previousArrears'), t('months'), t('closingArrears')]} rows={pendRows(r.rent_pending.house)} empty={t('none')} />
      <Table head={[`${t('shopRent')} — ${t('property')}`, t('tenant'), t('previousArrears'), t('months'), t('closingArrears')]} rows={pendRows(r.rent_pending.shop)} empty={t('none')} />

      <h4>9. {t('s_payments_week')}</h4>
      <Table head={[t('paymentsReceived'), t('type'), t('date'), t('amount')]} rows={r.payments_week.received.map((e) => [e.person, e.type, ddmmyyyy(e.date), rupees(e.amount)])} empty={t('none')} />
      <Table head={[t('repaymentsMade'), t('type'), t('date'), t('amount')]} rows={r.payments_week.made.map((e) => [e.person, e.type, ddmmyyyy(e.date), rupees(e.amount)])} empty={t('none')} />

      <h4>10. {t('s_upcoming')}</h4>
      <Table head={[t('upcomingCollections'), t('type'), t('dueDate'), t('amount')]} rows={r.upcoming.collections.map((e) => [e.person, cat[e.category], ddmmyyyy(e.due_date), rupees(e.amount)])} empty={t('none')} />
      <Table head={[t('upcomingPayments'), t('type'), t('dueDate'), t('amount')]} rows={r.upcoming.payments.map((e) => [e.person, cat[e.category], ddmmyyyy(e.due_date), rupees(e.amount)])} empty={t('none')} />

      <h4>11. {t('s_monthly')} ({r.monthly.period})</h4>
      <Table head={[t('monthlyIncome'), t('monthlyExpenses'), t('monthlyCollections'), t('netIncome')]} rows={[[rupees(r.monthly.income), rupees(r.monthly.expenses), rupees(r.monthly.principal_collected), rupees(r.monthly.net_income)]]} />

      <h4>12. {t('s_overdue')}</h4>
      <Table head={[t('overdueInterest'), 'EMI', t('rent'), t('overdueTotal')]} rows={[[rupees(r.overdue.interest), rupees(r.overdue.emi), rupees(r.overdue.rent), rupees(r.overdue.total)]]} />
    </div>
  )
}

export default function Reports({ t, lang, data, notify, reload }) {
  const x = useMemo(() => makeX(lang), [lang])
  const [person, setPerson] = useState('')
  const [busy, setBusy] = useState(false)
  const people = useMemo(() => byId(data.people), [data.people])
  const properties = useMemo(() => byId(data.properties), [data.properties])
  const nameOf = (id) => people.get(id)?.name ?? ''
  const r = data.report
  const settings = data.settings
  const lastEmail = data.emailHistory[0]

  async function emailNow() {
    setBusy(true)
    try {
      const { data: res, error } = await supabase.functions.invoke('weekly-report', { body: { mode: 'test' } })
      if (error) {
        let detail = error.message
        try { detail = (await error.context.json()).error || detail } catch { /* keep the original message */ }
        throw new Error(detail)
      }
      if (!res?.ok) throw new Error(res?.error || t('emailFailed'))
      notify('success', t('emailAccepted'))
      reload()
    } catch (err) {
      notify('error', `${t('emailNotSent')}: ${describeError(err)}. ${t('emailSetupHelp')}`)
    }
    setBusy(false)
  }

  function rentRows(kind) {
    return data.dues
      .map((d) => {
        const tn = data.tenancies.find((e) => e.id === d.tenancy_id)
        const pr = properties.get(tn?.property_id)
        return pr?.kind === kind ? { kind, property: pr.name, unit: pr.unit_number, tenant: nameOf(tn.person_id), ...d } : null
      })
      .filter(Boolean)
  }

  function arrearsCsv() {
    const rows = data.tenancies.map((tn) => {
      const due = data.dues.filter((d) => d.tenancy_id === tn.id).sort((a, b) => b.period_key.localeCompare(a.period_key))[0]
      const pr = properties.get(tn.property_id)
      return [pr?.kind, pr?.name, nameOf(tn.person_id), tn.active ? 'active' : 'moved out', due ? (due.closing_arrears_paise / 100).toFixed(2) : '0.00']
    })
    const vac = data.properties.filter((p) => p.vacant).map((p) => [p.kind, p.name, '', 'VACANT', '0.00'])
    downloadText('rent-arrears-and-vacancy.csv', toCsv(['Type', 'Property', 'Tenant', 'Status', 'Arrears'], [...rows, ...vac]))
  }

  function statement() {
    if (!person) return notify('error', t('choosePerson'))
    const pay = data.payments.filter((p) => p.person_id === person)
    downloadText(`statement-${nameOf(person)}.csv`, paymentsCsv(pay, nameOf))
    return undefined
  }

  function printStatement() {
    if (!person) return notify('error', t('choosePerson'))
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
    const today = todayIso()
    const loans = data.loans.filter((l) => l.person_id === person)
    const tenancies = data.tenancies.filter((tn) => tn.person_id === person)
    const pay = data.payments.filter((p) => p.person_id === person && !p.voided_at)
    const w = window.open('', '_blank')
    if (!w) return undefined
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(nameOf(person))}</title>
    <style>body{font-family:system-ui,Segoe UI,sans-serif;padding:28px;color:#162f44}table{border-collapse:collapse;width:100%;margin:8px 0 22px}th,td{padding:8px;border-bottom:1px solid #dde5ec;text-align:left;font-size:13px}h1,h2{color:#0a2742}small{color:#637587}</style></head><body>
    <h1>${esc(APP_NAME)} — ${esc(t('statement'))}: ${esc(nameOf(person))}</h1><p>${esc(ddmmyyyy(today))}</p>
    <h2>${esc(t('loans'))}</h2><table><tr><th>${esc(t('type'))}</th><th>${esc(t('loanDate'))}</th><th>${esc(t('principalOutstanding'))}</th><th>${esc(x('interestDue'))}</th><th>${esc(x('accruedShort'))}</th><th>${esc(x('totalOutstandingInterest'))}</th><th>${esc(t('totalReceivable'))}</th></tr>
    ${loans.map((l) => { const pos = interestPosition(latestEntry(data.entries, l.id), today); return `<tr><td>${esc(l.kind)}</td><td>${esc(ddmmyyyy(l.start_date))}</td><td>${esc(rupees(l.outstanding_principal_paise))}</td><td>${esc(rupees(pos.pending))}</td><td>${esc(rupees(pos.accrued))} <small>(${pos.days} ${esc(x('days'))})</small></td><td>${esc(rupees(pos.total))}</td><td>${esc(rupees(l.outstanding_principal_paise + pos.pending))}</td></tr>` }).join('')}</table>
    <p><small>${esc(x('accruedNote'))}</small></p>
    <h2>${esc(t('rent'))}</h2><table><tr><th>${esc(t('property'))}</th><th>${esc(t('closingArrears'))}</th></tr>
    ${tenancies.map((tn) => { const d = data.dues.filter((e) => e.tenancy_id === tn.id).sort((a, b) => b.period_key.localeCompare(a.period_key))[0]; return `<tr><td>${esc(properties.get(tn.property_id)?.name)}</td><td>${esc(rupees(d?.closing_arrears_paise ?? 0))}</td></tr>` }).join('')}</table>
    <h2>${esc(t('paymentHistory'))}</h2><table><tr><th>${esc(t('date'))}</th><th>${esc(t('type'))}</th><th>${esc(t('amount'))}</th><th>${esc(t('method'))}</th><th>${esc(t('reference'))}</th></tr>
    ${pay.map((p) => `<tr><td>${esc(ddmmyyyy(p.payment_date))}</td><td>${esc(p.payment_type)}</td><td>${esc(rupees(p.amount_paise))}</td><td>${esc(p.method)}</td><td>${esc(p.reference)}</td></tr>`).join('')}</table></body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 300)
    return undefined
  }

  function backup() {
    const snapshot = { exported_at: new Date().toISOString(), people: data.people, loans: data.loans, interest_entries: data.entries, properties: data.properties, tenancies: data.tenancies, rent_dues: data.dues, payments: data.payments, reminders: data.reminders, sms_history: data.smsHistory, user_settings: data.settings }
    downloadText(`ravi-loanmate-backup-${todayIso()}.json`, JSON.stringify(snapshot, null, 2), 'application/json')
  }

  return (
    <>
      <Card
        title={t('weeklyReport')}
        right={
          <div className="button-row no-print">
            <button type="button" className="btn small" disabled={!r} onClick={() => downloadText(`ravi-loanmate-weekly-${todayIso()}.csv`, weeklyReportCsv(r))}>{t('downloadCsv')}</button>
            <button type="button" className="btn small" disabled={!r} onClick={() => window.print()}>{t('printPdf')}</button>
            <button type="button" className="btn small primary" disabled={busy} onClick={emailNow}>{busy ? t('sending') : t('emailMeNow')}</button>
          </div>
        }
      >
        <Notice tone="info">
          {settings?.weekly_report_enabled && settings.report_email
            ? `${t('weeklyOnFor')} ${settings.report_email}.`
            : t('weeklyNotSet')}
          {lastEmail && <> {t('lastEmail')}: <Pill tone={lastEmail.status === 'accepted' ? 'green' : lastEmail.status === 'failed' ? 'red' : 'gray'}>{t(`email_${lastEmail.status}`)}</Pill> {ddmmyyyy(lastEmail.created_at)}</>}
        </Notice>
        {r ? <ReportView t={t} x={x} r={r} /> : <Notice tone="warn">{t('dashboardUnavailable')}</Notice>}
      </Card>

      <Card title={t('moreReports')} className="no-print">
        <div className="report-buttons">
          <button type="button" className="btn" onClick={() => downloadText('payments.csv', paymentsCsv(data.payments, nameOf))}>{t('rep_payments')}</button>
          <button type="button" className="btn" onClick={() => downloadText('interest-ledger.csv', interestLedgerCsv(data.entries, (e) => nameOf(data.loans.find((l) => l.id === e.loan_id)?.person_id)))}>{t('rep_interest')}</button>
          <button type="button" className="btn" onClick={() => downloadText('house-rent.csv', rentCsv(rentRows('house')))}>{t('rep_house')}</button>
          <button type="button" className="btn" onClick={() => downloadText('shop-rent.csv', rentCsv(rentRows('shop')))}>{t('rep_shop')}</button>
          <button type="button" className="btn" onClick={arrearsCsv}>{t('rep_arrears')}</button>
          <button type="button" className="btn" onClick={() => downloadText('liabilities.csv', liabilitiesCsv(data.loans.filter((l) => l.kind !== 'lent'), nameOf, (id) => latestEntry(data.entries, id)))}>{t('rep_liabilities')}</button>
          <button type="button" className="btn" onClick={() => downloadText('sms-history.csv', smsHistoryCsv(data.smsHistory, nameOf))}>{t('rep_sms')}</button>
          <button type="button" className="btn" onClick={() => downloadText('email-history.csv', emailHistoryCsv(data.emailHistory))}>{t('rep_email')}</button>
          <button type="button" className="btn" onClick={backup}>{t('rep_backup')}</button>
        </div>
        <p className="hint">{t('csvExcelNote')}</p>
      </Card>

      <Card title={t('personStatement')} className="no-print">
        <div className="button-row">
          <select value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">{t('choose')}</option>
            {data.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button type="button" className="btn" onClick={statement}>{t('downloadCsv')}</button>
          <button type="button" className="btn" onClick={printStatement}>{t('printPdf')}</button>
        </div>
      </Card>
    </>
  )
}
