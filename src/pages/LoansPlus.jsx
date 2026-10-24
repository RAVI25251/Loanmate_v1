import { useCallback, useEffect, useMemo, useState } from 'react'
import Loans from './Loans.jsx'
import ContactForm from '../components/ContactForm.jsx'
import { Card, Empty, Field, Pill } from '../components/ui.jsx'
import { ddmmyyyy, rupees } from '../lib/format.js'
import { byId } from '../lib/selectors.js'
import { describeError, rpc } from '../lib/api.js'
import { supabase } from '../lib/supabase.js'
import { fill, makeY } from '../lib/textV5.js'

const KIND_TONE = { lent: 'green', borrowed: 'orange', bank: 'blue' }
const KIND_KEY = { lent: 'kindLent', borrowed: 'kindBorrowed', bank: 'kindBank' }

// Confirms and runs "delete loan". The loan is kept as a recoverable record; its payments are voided, not erased.
export function DeletePanel({ t, y, loan, person, payments, notify, onDone }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const mine = payments.filter((p) => p.loan_id === loan.id && !p.voided_at)
  const total = mine.reduce((s, p) => s + p.amount_paise, 0)

  async function remove(e) {
    e.preventDefault()
    if (reason.trim().length < 3) return notify('error', y('badReason'))
    if (!window.confirm(y('confirmDeletePrompt'))) return undefined
    setBusy(true)
    try {
      await rpc('delete_loan', { p_loan: loan.id, p_reason: reason.trim() })
      notify('success', y('loanDeleted'))
      onDone()
    } catch (err) {
      notify('error', describeError(err))
    }
    setBusy(false)
    return undefined
  }

  return (
    <form className="grid-form edit-panel" onSubmit={remove}>
      <div className="field full">
        <strong>{y('deleteTitle')} — {person?.name} · {rupees(loan.outstanding_principal_paise)}</strong>
        <small className="hint-text">{fill(y('deleteWarn'), { n: mine.length, amt: rupees(total) })}</small>
      </div>
      <Field label={y('deleteReason')} hint={y('deleteReasonHint')} full>
        <input value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="field full">
        <button type="submit" className="btn danger" disabled={busy}>{busy ? t('saving') : y('confirmDelete')}</button>
      </div>
    </form>
  )
}

// The list of deleted loans, each with a Restore button
export function DeletedLoans({ t, y, loans, people, error, notify, onDone }) {
  const [busyId, setBusyId] = useState('')

  async function restore(loan) {
    setBusyId(loan.id)
    try {
      await rpc('restore_loan', { p_loan: loan.id })
      notify('success', y('loanRestored'))
      onDone()
    } catch (err) {
      notify('error', describeError(err))
    }
    setBusyId('')
  }

  return (
    <Card title={y('deletedLoans')} className="no-print">
      {error && <p className="message error">{y('needSql4')} ({error})</p>}
      {!error && loans.length === 0 && <Empty>{y('noDeletedLoans')}</Empty>}
      {loans.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>{t('person')}</th><th>{t('type')}</th><th className="num">{t('principalOutstanding')}</th><th>{y('deletedOn')}</th><th>{y('reasonLabel')}</th><th>{t('actions')}</th></tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <tr key={loan.id}>
                    <td>{people.get(loan.person_id)?.name}</td>
                    <td><Pill tone={KIND_TONE[loan.kind]}>{t(KIND_KEY[loan.kind])}</Pill></td>
                    <td className="num">{rupees(loan.opening_principal_paise)}</td>
                    <td>{ddmmyyyy(loan.deleted_at)}</td>
                    <td>{loan.deleted_reason}</td>
                    <td className="no-print"><button type="button" className="btn small primary" disabled={busyId === loan.id} onClick={() => restore(loan)}>{busyId === loan.id ? t('saving') : y('restore')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">{y('restoreNote')}</p>
        </>
      )}
    </Card>
  )
}

// Your Loans page, plus "Manage loans" (edit phone / email, delete) and "Deleted loans" underneath it.
export default function LoansPlus(props) {
  const { t, lang, data, reload, notify } = props
  const y = useMemo(() => makeY(lang), [lang])
  const people = useMemo(() => byId(data.people), [data.people])
  const [panel, setPanel] = useState(null) // { id, type: 'contact' | 'delete' }
  const [deleted, setDeleted] = useState([])
  const [deletedError, setDeletedError] = useState('')

  const loadDeleted = useCallback(async () => {
    const { data: rows, error } = await supabase.from('loans').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false })
    if (error) setDeletedError(error.message)
    else {
      setDeleted(rows ?? [])
      setDeletedError('')
    }
  }, [])

  useEffect(() => {
    loadDeleted()
  }, [loadDeleted, data.loans.length])

  async function afterChange() {
    setPanel(null)
    await reload()
    await loadDeleted()
  }

  const toggle = (id, type) => setPanel(panel?.id === id && panel.type === type ? null : { id, type })

  return (
    <>
      <Loans {...props} />

      <Card title={y('manageLoans')} className="no-print">
        {data.loans.length === 0 ? (
          <Empty>{t('noLoans')}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>{t('person')}</th><th>{t('mobile')} / {y('channelEmail')}</th><th>{t('type')}</th><th className="num">{t('principalOutstanding')}</th><th>{t('actions')}</th></tr>
              </thead>
              <tbody>
                {data.loans.map((loan) => {
                  const person = people.get(loan.person_id)
                  const count = data.payments.filter((p) => p.loan_id === loan.id && !p.voided_at).length
                  return (
                    <ManageRow key={loan.id}>
                      <tr>
                        <td>{person?.name}</td>
                        <td>{person?.mobile || <span className="red">{t('noMobile')}</span>}<br /><small>{person?.email || <span className="red">{y('noEmail')}</span>}</small></td>
                        <td><Pill tone={KIND_TONE[loan.kind]}>{t(KIND_KEY[loan.kind])}</Pill><br /><small>{count} {y('paymentsWord')}</small></td>
                        <td className="num">{rupees(loan.outstanding_principal_paise)}</td>
                        <td className="no-print">
                          <div className="button-row">
                            <button type="button" className="btn small" onClick={() => toggle(loan.id, 'contact')}>{y('editContact')}</button>
                            <button type="button" className="btn small danger" onClick={() => toggle(loan.id, 'delete')}>{y('deleteLoan')}</button>
                          </div>
                        </td>
                      </tr>
                      {panel?.id === loan.id && (
                        <tr>
                          <td colSpan={5}>
                            {panel.type === 'contact' && person && <ContactForm t={t} y={y} person={person} notify={notify} onSaved={afterChange} />}
                            {panel.type === 'delete' && <DeletePanel t={t} y={y} loan={loan} person={person} payments={data.payments} notify={notify} onDone={afterChange} />}
                          </td>
                        </tr>
                      )}
                    </ManageRow>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <DeletedLoans t={t} y={y} loans={deleted} people={people} error={deletedError} notify={notify} onDone={afterChange} />
    </>
  )
}

// A table row group (a plain wrapper so two <tr> can share one key)
function ManageRow({ children }) {
  return <>{children}</>
}
