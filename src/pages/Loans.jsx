import { Fragment, useMemo, useState } from 'react'
import { Card, Empty, Field, Pill, Stat } from '../components/ui.jsx'
import { addMonthsToDate, ddmmyyyy, percentToBp, rupees, toPaise, todayIso } from '../lib/format.js'
import { monthlyInterest } from '../lib/finance.js'
import { describeError, rpc } from '../lib/api.js'
import { byId, hasPrincipalPayments, interestPosition, interestTotals, latestEntry, nextInterest, principalPlan } from '../lib/selectors.js'
import { downloadText } from '../lib/download.js'
import { interestLedgerCsv } from '../lib/report.js'
import { makeX } from '../lib/textV4.js'

const KIND_TONE = { lent: 'green', borrowed: 'orange', bank: 'blue' }
const KIND_KEY = { lent: 'kindLent', borrowed: 'kindBorrowed', bank: 'kindBank' }
const METHODS = ['cash', 'upi', 'bank_transfer', 'other']
const HIGH_RATE_BP = 6000 // more than 60% a year: probably a monthly rate typed by mistake

function emptyForm() {
  return { kind: 'lent', personId: 'new', name: '', mobile: '', principal: '', rate: '', startDate: todayIso(), dueDay: '', emi: '' }
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) && String(value) <= todayIso()
}

export function LedgerTable({ t, entries, today }) {
  return (
    <div className="table-wrap">
      <table className="compact">
        <thead>
          <tr>
            <th>{t('monthStarts')}</th>
            <th>{t('monthCompletes')}</th>
            <th className="num">{t('openingPrincipal')}</th>
            <th className="num">{t('previousPending')}</th>
            <th className="num">{t('interestAdded')}</th>
            <th className="num">{t('interestReceived')}</th>
            <th className="num">{t('interestRemaining')}</th>
            <th className="num">{t('principalRepaid')}</th>
            <th className="num">{t('closingPrincipal')}</th>
            <th className="num">{t('totalReceivable')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const running = e.period_end > today
            return (
              <tr key={e.id} className={running ? 'running' : ''}>
                <td>{ddmmyyyy(e.period_start)}</td>
                <td>{ddmmyyyy(e.period_end)} {running && <Pill tone="gray">{t('runningMonth')}</Pill>}<br /><small>{(e.annual_rate_bp / 100).toFixed(2)}% / {t('perYear')}</small></td>
                <td className="num">{rupees(e.opening_principal_paise)}</td>
                <td className="num">{rupees(e.previous_pending_paise)}</td>
                <td className="num">{running ? <small>{t('interestOnCompletion')}</small> : rupees(e.current_interest_paise)}</td>
                <td className="num green">{rupees(e.interest_received_paise)}</td>
                <td className="num orange">{rupees(e.closing_pending_paise)}</td>
                <td className="num green">{rupees(e.principal_repaid_paise)}</td>
                <td className="num">{rupees(e.closing_principal_paise)}</td>
                <td className="num"><strong>{rupees(e.closing_principal_paise + e.closing_pending_paise)}</strong></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Interest summary of one loan: added till today, received, due, running days, total outstanding
export function InterestSummary({ x, entries, loan, today }) {
  const latest = latestEntry(entries, loan.id)
  const pos = interestPosition(latest, today)
  const totals = interestTotals(entries, loan.id, today)
  return (
    <>
      <div className="stat-grid">
        <Stat label={x('interestAddedTotal')} value={rupees(totals.added)} sub={latest ? `${x('lastDueDate')}: ${ddmmyyyy(latest.period_start)}` : ''} />
        <Stat label={x('interestReceivedTotal')} value={rupees(totals.received)} tone="green" />
        <Stat label={x('interestDue')} value={rupees(pos.pending)} tone="orange" sub={`${rupees(totals.added)} − ${rupees(totals.received)}`} />
        <Stat label={x('accruedShort')} value={rupees(pos.accrued)} sub={`${pos.days} ${x('days')}`} />
        <Stat label={x('totalOutstandingInterest')} value={rupees(pos.total)} tone="red" sub={`${rupees(pos.pending)} + ${rupees(pos.accrued)}`} />
      </div>
      <p className="hint">{x('accruedNote')}</p>
    </>
  )
}

export function PayPrincipal({ t, x, loan, entries, pending, notify, onDone }) {
  const [mode, setMode] = useState('part') // 'part' = pay some or all of the principal; 'settle' = principal + interest due
  const [date, setDate] = useState(todayIso())
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const outstanding = loan.outstanding_principal_paise
  const plan = principalPlan({ mode, amountText: amount, outstanding, pending, date, entries })
  const { valid, principal: principalPaise, interest: interestPaise, after } = plan

  async function save(e) {
    e.preventDefault()
    if (!valid) return notify('error', x('badPrincipalPay'))
    if (!validDate(date) || date < loan.start_date) return notify('error', t('badDate'))
    setBusy(true)
    try {
      await rpc('record_loan_payment', {
        p_loan: loan.id, p_date: date, p_interest: interestPaise, p_principal: principalPaise,
        p_method: method, p_reference: reference || null, p_notes: notes || null,
      })
      notify('success', mode === 'settle' ? x('loanSettled') : x('principalPaid'))
      onDone()
    } catch (err) {
      notify('error', describeError(err))
    }
    setBusy(false)
    return undefined
  }

  if (outstanding <= 0) return <p className="hint">{x('noPrincipal')}</p>

  return (
    <form className="grid-form edit-panel" onSubmit={save}>
      <div className="field full">
        <label>{x('payPrincipalTitle')}</label>
        <div className="button-row">
          <button type="button" className={mode === 'part' ? 'tab active' : 'tab'} onClick={() => setMode('part')}>{x('principalOnly')}</button>
          <button type="button" className={mode === 'settle' ? 'tab active' : 'tab'} onClick={() => setMode('settle')}>{x('settleLoan')}</button>
        </div>
      </div>

      {mode === 'part' ? (
        <Field label={x('principalToPay')} hint={`${t('principalOutstanding')}: ${rupees(outstanding)}`}>
          <div className="button-row">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="10000" />
            <button type="button" className="btn small" onClick={() => setAmount((outstanding / 100).toFixed(2).replace(/\.00$/, ''))}>{x('fullPrincipal')}</button>
          </div>
        </Field>
      ) : (
        <>
          <Field label={x('principalToPay')}><input value={(outstanding / 100).toFixed(2)} disabled /></Field>
          <Field label={x('interestToPay')}><input value={(pending / 100).toFixed(2)} disabled /></Field>
        </>
      )}
      <Field label={t('paymentDate')}><input type="date" max={todayIso()} min={loan.start_date} value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
      <Field label={t('method')}>
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          {METHODS.map((m) => <option key={m} value={m}>{t(`method_${m}`)}</option>)}
        </select>
      </Field>
      <Field label={t('reference')}><input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
      <Field label={t('notes')}><input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>

      <div className="field full preview-box">
        {valid ? (
          <>
            <strong>{x('principalAfter')}: {rupees(after)}</strong>
            {mode === 'settle' && <small>{x('settleNote')}</small>}
            {plan.lowerFrom && <small>{x('lowerFrom')} {ddmmyyyy(plan.lowerFrom)}.</small>}
            {plan.staysOpenForInterest && <small>{x('loanStaysOpen')}</small>}
            {mode === 'part' && pending > 0 && <small>{x('interestStaysDue')} {rupees(pending)}</small>}
          </>
        ) : (
          <small>{x('badPrincipalPay')}</small>
        )}
      </div>

      <div className="field full">
        <button type="submit" className="btn primary" disabled={busy || !valid}>{busy ? t('saving') : mode === 'settle' ? x('settleLoan') : x('payPrincipal')}</button>
      </div>
    </form>
  )
}

export function EditTerms({ t, loan, locked, onDone, notify }) {
  const [rate, setRate] = useState((loan.annual_rate_bp / 100).toString())
  const [from, setFrom] = useState(todayIso())
  const [start, setStart] = useState(loan.start_date)
  const [dueDay, setDueDay] = useState(String(loan.due_day ?? ''))
  const [emi, setEmi] = useState(loan.emi_paise ? (loan.emi_paise / 100).toString() : '')
  const [opening, setOpening] = useState((loan.opening_principal_paise / 100).toString())
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault()
    const rateBp = percentToBp(rate)
    const emiPaise = emi === '' ? 0 : toPaise(emi)
    const openingPaise = toPaise(opening)
    const day = dueDay === '' ? null : Number(dueDay)
    if (rateBp === null) return notify('error', t('badRate'))
    if (rateBp > HIGH_RATE_BP && !window.confirm(t('highRateWarning'))) return undefined
    if (emiPaise === null) return notify('error', t('badEmi'))
    if (openingPaise === null || openingPaise <= 0) return notify('error', t('badPrincipal'))
    if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) return notify('error', t('badDueDay'))
    if (!validDate(from) || !validDate(start)) return notify('error', t('badDate'))
    setBusy(true)
    try {
      await rpc('update_loan_terms', {
        p_loan: loan.id,
        p_annual_rate_bp: rateBp,
        p_rate_from: from,
        p_due_day: day,
        p_emi: emiPaise,
        p_opening: locked ? null : openingPaise,
        p_start: start !== loan.start_date ? start : null,
      })
      notify('success', t('termsSaved'))
      onDone()
    } catch (err) {
      notify('error', describeError(err))
    }
    setBusy(false)
    return undefined
  }

  return (
    <form className="grid-form edit-panel" onSubmit={save}>
      <Field label={t('annualRate')}><input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" /></Field>
      <Field label={t('rateFrom')} hint={t('rateFromHint')}><input type="date" max={todayIso()} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
      <Field label={t(`loanDate_${loan.kind}`)} hint={t('loanDateEditHint')}><input type="date" max={todayIso()} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
      <Field label={t('dueDay')} hint={t('dueDayHint')}><input value={dueDay} onChange={(e) => setDueDay(e.target.value)} inputMode="numeric" /></Field>
      <Field label={t('emiAmount')}><input value={emi} onChange={(e) => setEmi(e.target.value)} inputMode="decimal" /></Field>
      <Field label={t('openingPrincipal')} hint={locked ? t('principalLocked') : t('principalEditHint')}>
        <input value={opening} onChange={(e) => setOpening(e.target.value)} inputMode="decimal" disabled={locked} />
      </Field>
      <div className="field full">
        <button type="submit" className="btn primary" disabled={busy}>{busy ? t('saving') : t('saveTerms')}</button>
        <small className="hint-text">{t('editAudited')}</small>
      </div>
    </form>
  )
}

export default function Loans({ t, lang, data, reload, notify, go }) {
  const x = useMemo(() => makeX(lang), [lang])
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [panel, setPanel] = useState(null) // { id, type: 'ledger' | 'edit' | 'principal' }
  const people = useMemo(() => byId(data.people), [data.people])
  const today = todayIso()

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))
  const principalPaise = toPaise(form.principal)
  const rateBp = percentToBp(form.rate)
  const monthly = principalPaise && rateBp !== null ? monthlyInterest(principalPaise, rateBp) : null
  const firstDate = validDate(form.startDate) ? addMonthsToDate(form.startDate, 1) : null
  const rateHint =
    monthly !== null && rateBp !== null
      ? `${(rateBp / 1200).toFixed(2)}% ${t('perMonthRate')} = ${rupees(monthly)}. ${firstDate ? `${t('firstInterestOn')} ${ddmmyyyy(firstDate)}.` : ''}`
      : t('annualRateHint')
  const toggle = (id, type) => setPanel(panel?.id === id && panel.type === type ? null : { id, type })

  async function save(e) {
    e.preventDefault()
    const emiPaise = form.emi === '' ? 0 : toPaise(form.emi)
    const day = form.dueDay === '' ? null : Number(form.dueDay)
    if (principalPaise === null || principalPaise <= 0) return notify('error', t('badPrincipal'))
    if (rateBp === null) return notify('error', t('badRate'))
    if (rateBp > HIGH_RATE_BP && !window.confirm(t('highRateWarning'))) return undefined
    if (emiPaise === null) return notify('error', t('badEmi'))
    if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) return notify('error', t('badDueDay'))
    if (!validDate(form.startDate)) return notify('error', t('badDate'))
    if (form.personId === 'new' && !form.name.trim()) return notify('error', t('nameRequired'))
    setSaving(true)
    try {
      await rpc('add_loan', {
        p_person_id: form.personId === 'new' ? null : form.personId,
        p_name: form.name,
        p_mobile: form.mobile,
        p_kind: form.kind,
        p_principal: principalPaise,
        p_annual_rate_bp: rateBp,
        p_start: form.startDate,
        p_due_day: day,
        p_emi: emiPaise,
      })
      notify('success', t('loanSaved'))
      setForm(emptyForm())
      await reload()
    } catch (err) {
      notify('error', describeError(err))
    }
    setSaving(false)
    return undefined
  }

  function csv(loan) {
    const rows = data.entries.filter((e) => e.loan_id === loan.id)
    downloadText(`interest-ledger-${people.get(loan.person_id)?.name ?? 'loan'}.csv`, interestLedgerCsv(rows, people.get(loan.person_id)?.name))
  }

  return (
    <>
      <Card title={t('addLoan')}>
        <p className="hint">{t('interestRule')}</p>
        <form className="grid-form" onSubmit={save}>
          <Field label={t('loanType')}>
            <select value={form.kind} onChange={(e) => update('kind', e.target.value)}>
              <option value="lent">{t('kindLentLong')}</option>
              <option value="borrowed">{t('kindBorrowedLong')}</option>
              <option value="bank">{t('kindBankLong')}</option>
            </select>
          </Field>
          <Field label={t('person')}>
            <select value={form.personId} onChange={(e) => update('personId', e.target.value)}>
              <option value="new">{t('newPerson')}</option>
              {data.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          {form.personId === 'new' && (
            <>
              <Field label={t('name')}><input value={form.name} onChange={(e) => update('name', e.target.value)} /></Field>
              <Field label={t('mobile')}><input value={form.mobile} onChange={(e) => update('mobile', e.target.value)} inputMode="tel" /></Field>
            </>
          )}
          <Field label={t(`loanDate_${form.kind}`)} hint={t('loanDateHint')}>
            <input type="date" max={today} value={form.startDate} onChange={(e) => update('startDate', e.target.value)} required />
          </Field>
          <Field label={t('principalAmount')}><input value={form.principal} onChange={(e) => update('principal', e.target.value)} placeholder="50000" inputMode="decimal" /></Field>
          <Field label={t('annualRate')} hint={rateHint}>
            <input value={form.rate} onChange={(e) => update('rate', e.target.value)} placeholder="18" inputMode="decimal" />
          </Field>
          <Field label={t('dueDay')} hint={t('dueDayHint')}><input value={form.dueDay} onChange={(e) => update('dueDay', e.target.value)} placeholder="10" inputMode="numeric" /></Field>
          <Field label={t('emiAmount')} hint={t('emiHint')}><input value={form.emi} onChange={(e) => update('emi', e.target.value)} inputMode="decimal" /></Field>
          <div className="field full"><button type="submit" className="btn primary" disabled={saving}>{saving ? t('saving') : t('saveLoan')}</button></div>
        </form>
      </Card>

      <Card title={t('loans')}>
        {data.loans.length === 0 ? (
          <Empty>{t('noLoans')}</Empty>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('person')}</th><th>{t('type')}</th><th>{t('loanDate')}</th><th className="num">{t('principalOutstanding')}</th>
                    <th className="num">{x('interestDue')}</th><th className="num">{x('accruedShort')}</th><th className="num">{x('totalOutstandingInterest')}</th>
                    <th className="num">{t('totalReceivable')}</th><th>{t('annualRateShort')}</th><th>{t('nextInterest')}</th><th className="no-print">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.loans.map((loan) => {
                    const entry = latestEntry(data.entries, loan.id)
                    const pos = interestPosition(entry, today)
                    const next = nextInterest(entry)
                    const person = people.get(loan.person_id)
                    const locked = hasPrincipalPayments(data.payments, loan.id)
                    const loanEntries = data.entries.filter((e) => e.loan_id === loan.id)
                    return (
                      <Fragment key={loan.id}>
                        <tr>
                          <td>{person?.name}<br /><small>{person?.mobile}</small></td>
                          <td><Pill tone={KIND_TONE[loan.kind]}>{t(KIND_KEY[loan.kind])}</Pill></td>
                          <td>{ddmmyyyy(loan.start_date)}</td>
                          <td className="num">{rupees(loan.outstanding_principal_paise)}</td>
                          <td className="num orange">{rupees(pos.pending)}</td>
                          <td className="num">{rupees(pos.accrued)}<br /><small>{pos.days} {x('days')}</small></td>
                          <td className="num red"><strong>{rupees(pos.total)}</strong></td>
                          <td className="num"><strong>{rupees(loan.outstanding_principal_paise + pos.pending)}</strong></td>
                          <td>{(loan.annual_rate_bp / 100).toFixed(2)}%{loan.emi_paise ? <><br /><small>EMI {rupees(loan.emi_paise)}</small></> : null}</td>
                          <td>{next && next.amount > 0 ? <>{ddmmyyyy(next.date)}<br /><small>+ {rupees(next.amount)}</small></> : '—'}</td>
                          <td className="no-print">
                            <div className="button-row">
                              <button type="button" className="btn small primary" onClick={() => toggle(loan.id, 'principal')} disabled={loan.outstanding_principal_paise <= 0}>{x('payPrincipal')}</button>
                              <button type="button" className="btn small" onClick={() => go('payments', { loanId: loan.id })}>{t('recordPayment')}</button>
                              <button type="button" className="btn small" onClick={() => toggle(loan.id, 'ledger')}>{t('viewInterest')}</button>
                              <button type="button" className="btn small" onClick={() => toggle(loan.id, 'edit')}>{t('edit')}</button>
                              {loan.kind === 'lent' && <button type="button" className="btn small" onClick={() => go('reminders')}>{t('sendReminder')}</button>}
                            </div>
                          </td>
                        </tr>
                        {panel?.id === loan.id && (
                          <tr>
                            <td colSpan={11}>
                              {panel.type === 'principal' && <PayPrincipal t={t} x={x} loan={loan} entries={loanEntries} pending={pos.pending} notify={notify} onDone={() => { setPanel(null); reload() }} />}
                              {panel.type === 'edit' && <EditTerms t={t} loan={loan} locked={locked} notify={notify} onDone={() => { setPanel(null); reload() }} />}
                              {panel.type === 'ledger' && (
                                <>
                                  <div className="ledger-head">
                                    <strong>{x('interestSummary')} — {person?.name} ({ddmmyyyy(loan.start_date)})</strong>
                                    <button type="button" className="btn small" onClick={() => csv(loan)}>{t('downloadCsv')}</button>
                                  </div>
                                  <InterestSummary x={x} entries={data.entries} loan={loan} today={today} />
                                  <strong>{t('monthlyLedger')}</strong>
                                  <LedgerTable t={t} today={today} entries={[...loanEntries].sort((a, b) => b.period_start.localeCompare(a.period_start))} />
                                </>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="hint">{x('accruedNote')}</p>
          </>
        )}
      </Card>
    </>
  )
}
