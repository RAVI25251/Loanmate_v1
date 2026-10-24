import { useMemo, useState } from 'react'
import { Card, Empty, Field, Pill } from '../components/ui.jsx'
import { currentPeriod, ddmmyyyy, rupees, toPaise, todayIso } from '../lib/format.js'
import { describeError, rpc } from '../lib/api.js'
import { byId, latestDue, latestEntry, nextInterest } from '../lib/selectors.js'
import { downloadText } from '../lib/download.js'
import { paymentsCsv } from '../lib/report.js'
import { APP_NAME } from '../lib/config.js'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const METHODS = ['cash', 'upi', 'bank_transfer', 'other']

function openReceipt(t, payment, person, what) {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(t('receipt'))}</title>
  <style>body{font-family:system-ui,Segoe UI,sans-serif;padding:32px;color:#162f44}h1{color:#0a2742;margin:0 0 4px}table{border-collapse:collapse;margin-top:18px;width:100%}td{padding:10px;border-bottom:1px solid #dde5ec}td:first-child{color:#637587;width:40%}.big{font-size:26px;color:#0b7a4b;font-weight:700}small{color:#758493}</style></head><body>
  <h1>${esc(APP_NAME)} — ${esc(t('receipt'))}</h1><small>${esc(t('receiptNote'))}</small>
  <p class="big">${esc(rupees(payment.amount_paise))}</p>
  <table>
  <tr><td>${esc(t('date'))}</td><td>${esc(ddmmyyyy(payment.payment_date))}</td></tr>
  <tr><td>${esc(t('person'))}</td><td>${esc(person?.name)}</td></tr>
  <tr><td>${esc(t('details'))}</td><td>${esc(what)}</td></tr>
  <tr><td>${esc(t('method'))}</td><td>${esc(t(`method_${payment.method}`))}</td></tr>
  <tr><td>${esc(t('reference'))}</td><td>${esc(payment.reference ?? '')}</td></tr>
  <tr><td>${esc(t('notes'))}</td><td>${esc(payment.notes ?? '')}</td></tr>
  ${payment.voided_at ? `<tr><td>${esc(t('status'))}</td><td><strong>${esc(t('voided'))}</strong> — ${esc(payment.void_reason)}</td></tr>` : ''}
  </table></body></html>`)
  w.document.close()
  setTimeout(() => w.print(), 300)
}

export default function Payments({ t, data, reload, notify, nav }) {
  const [mode, setMode] = useState(nav.tenancyId ? 'rent' : 'loan')
  const [loanId, setLoanId] = useState(nav.loanId || '')
  const [tenancyId, setTenancyId] = useState(nav.tenancyId || '')
  const [date, setDate] = useState(todayIso())
  const [interest, setInterest] = useState('')
  const [principal, setPrincipal] = useState('')
  const [amount, setAmount] = useState('')
  const [appliesTo, setAppliesTo] = useState(currentPeriod())
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('all')

  const people = useMemo(() => byId(data.people), [data.people])
  const properties = useMemo(() => byId(data.properties), [data.properties])
  const loans = useMemo(() => byId(data.loans), [data.loans])
  const tenancies = useMemo(() => byId(data.tenancies), [data.tenancies])
  const loan = loans.get(loanId)
  const tenancy = tenancies.get(tenancyId)
  const entry = loan ? latestEntry(data.entries, loan.id) : null
  const next = nextInterest(entry)
  const due = tenancy ? latestDue(data.dues, tenancy.id, currentPeriod()) : null

  function reset() {
    setInterest('')
    setPrincipal('')
    setAmount('')
    setReference('')
    setNotes('')
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'loan') {
        if (!loanId) throw new Error(t('chooseLoan'))
        const i = interest === '' ? 0 : toPaise(interest)
        const p = principal === '' ? 0 : toPaise(principal)
        if (i === null || p === null) throw new Error(t('badAmount'))
        await rpc('record_loan_payment', { p_loan: loanId, p_date: date, p_interest: i, p_principal: p, p_method: method, p_reference: reference || null, p_notes: notes || null })
      } else {
        if (!tenancyId) throw new Error(t('chooseTenant'))
        const a = toPaise(amount)
        if (a === null || a <= 0) throw new Error(t('badAmount'))
        await rpc('record_rent_payment', { p_tenancy: tenancyId, p_date: date, p_amount: a, p_applies_to: appliesTo, p_method: method, p_reference: reference || null, p_notes: notes || null })
      }
      notify('success', t('paymentSaved'))
      reset()
      await reload()
    } catch (err) {
      notify('error', describeError(err))
    }
    setBusy(false)
  }

  async function voidPayment(p) {
    const reason = window.prompt(t('voidPrompt'))
    if (reason === null) return
    try {
      await rpc('void_payment', { p_payment: p.id, p_reason: reason })
      notify('success', t('paymentVoided'))
      await reload()
    } catch (err) {
      notify('error', describeError(err))
    }
  }

  function describe(p) {
    if (p.loan_id) {
      const l = loans.get(p.loan_id)
      return `${t(p.payment_type === 'interest' ? 'interest' : 'principalRepaid')} · ${l ? t({ lent: 'kindLent', borrowed: 'kindBorrowed', bank: 'kindBank' }[l.kind]) : ''}`
    }
    const tn = tenancies.get(p.tenancy_id)
    const pr = properties.get(tn?.property_id)
    return `${t('rent')} · ${pr?.name ?? ''} · ${p.applies_to_period ?? ''}`
  }

  const shown = data.payments.filter((p) => filter === 'all' || p.person_id === filter)

  return (
    <>
      <Card title={t('recordPayment')}>
        <div className="subtabs">
          <button type="button" className={mode === 'loan' ? 'tab active' : 'tab'} onClick={() => setMode('loan')}>{t('loanPayment')}</button>
          <button type="button" className={mode === 'rent' ? 'tab active' : 'tab'} onClick={() => setMode('rent')}>{t('rentPayment')}</button>
        </div>
        <form className="grid-form" onSubmit={save}>
          {mode === 'loan' ? (
            <>
              <Field label={t('loans')} full>
                <select value={loanId} onChange={(e) => setLoanId(e.target.value)}>
                  <option value="">{t('choose')}</option>
                  {data.loans.map((l) => <option key={l.id} value={l.id}>{people.get(l.person_id)?.name} · {t({ lent: 'kindLent', borrowed: 'kindBorrowed', bank: 'kindBank' }[l.kind])} · {rupees(l.outstanding_principal_paise)}</option>)}
                </select>
                {entry && (
                  <small className="hint-text">
                    {t('interestRemaining')}: {rupees(entry.closing_pending_paise)} · {t('principalOutstanding')}: {rupees(loan.outstanding_principal_paise)}
                    {next && next.amount > 0 ? ` · ${t('nextInterestOn')} ${ddmmyyyy(next.date)} (+${rupees(next.amount)})` : ''}
                  </small>
                )}
              </Field>
              <Field label={t('interestPortion')}><input value={interest} onChange={(e) => setInterest(e.target.value)} inputMode="decimal" placeholder="0" /></Field>
              <Field label={t('principalPortion')}><input value={principal} onChange={(e) => setPrincipal(e.target.value)} inputMode="decimal" placeholder="0" /></Field>
            </>
          ) : (
            <>
              <Field label={t('tenant')} full>
                <select value={tenancyId} onChange={(e) => setTenancyId(e.target.value)}>
                  <option value="">{t('choose')}</option>
                  {data.tenancies.map((tn) => <option key={tn.id} value={tn.id}>{people.get(tn.person_id)?.name} · {properties.get(tn.property_id)?.name}{tn.active ? '' : ` (${t('movedOutLabel')})`}</option>)}
                </select>
                {due && <small className="hint-text">{t('closingArrears')}: {rupees(due.closing_arrears_paise)}</small>}
              </Field>
              <Field label={t('amount')}><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" /></Field>
              <Field label={t('appliesToMonth')}><input type="month" value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)} /></Field>
            </>
          )}
          <Field label={t('paymentDate')}><input type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
          <Field label={t('method')}>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => <option key={m} value={m}>{t(`method_${m}`)}</option>)}
            </select>
          </Field>
          <Field label={t('reference')}><input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
          <Field label={t('notes')}><input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <div className="field full">
            <button type="submit" className="btn primary" disabled={busy}>{busy ? t('saving') : t('savePayment')}</button>
            <small className="hint-text">{t('paymentRule')}</small>
          </div>
        </form>
      </Card>

      <Card
        title={t('paymentHistory')}
        right={
          <div className="button-row no-print">
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">{t('allPeople')}</option>
              {data.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="button" className="btn small" onClick={() => downloadText('payments.csv', paymentsCsv(shown, (id) => people.get(id)?.name ?? ''))}>{t('downloadCsv')}</button>
          </div>
        }
      >
        {shown.length === 0 ? (
          <Empty>{t('noPayments')}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>{t('date')}</th><th>{t('person')}</th><th>{t('details')}</th><th className="num">{t('amount')}</th><th>{t('method')}</th><th>{t('reference')}</th><th>{t('status')}</th><th className="no-print">{t('actions')}</th></tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id} className={p.voided_at ? 'voided' : ''}>
                    <td>{ddmmyyyy(p.payment_date)}</td>
                    <td>{people.get(p.person_id)?.name}</td>
                    <td>{describe(p)}</td>
                    <td className="num green">{rupees(p.amount_paise)}</td>
                    <td>{t(`method_${p.method}`)}</td>
                    <td>{p.reference}</td>
                    <td>{p.voided_at ? <Pill tone="red">{t('voided')}</Pill> : <Pill tone="green">{t('recorded')}</Pill>}{p.void_reason ? <><br /><small>{p.void_reason}</small></> : null}</td>
                    <td className="no-print">
                      <div className="button-row">
                        <button type="button" className="btn small" onClick={() => openReceipt(t, p, people.get(p.person_id), describe(p))}>{t('receipt')}</button>
                        {!p.voided_at && <button type="button" className="btn small danger" onClick={() => voidPayment(p)}>{t('void')}</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
