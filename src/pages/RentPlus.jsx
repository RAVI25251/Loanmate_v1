import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import Rent from './Rent.jsx'
import ContactForm from '../components/ContactForm.jsx'
import { Card, Empty, Field, Pill } from '../components/ui.jsx'
import { ddmmyyyy, rupees, toPaise } from '../lib/format.js'
import { byId } from '../lib/selectors.js'
import { describeError, rpc } from '../lib/api.js'
import { supabase } from '../lib/supabase.js'
import { fill, makeY } from '../lib/textV5.js'
import { makeZ } from '../lib/textV6.js'

// Edit the property (name, address, unit) and the agreement (deposit, start, end, notes) of one rent entry.
export function EditAgreement({ t, z, tenancy, property, notify, onDone }) {
  const [name, setName] = useState(property?.name ?? '')
  const [address, setAddress] = useState(property?.address && property.address !== '-' ? property.address : '')
  const [unit, setUnit] = useState(property?.unit_number ?? '')
  const [deposit, setDeposit] = useState(tenancy.deposit_paise ? (tenancy.deposit_paise / 100).toString() : '')
  const [start, setStart] = useState(tenancy.agreement_start ?? '')
  const [end, setEnd] = useState(tenancy.agreement_end ?? '')
  const [notes, setNotes] = useState(tenancy.notes ?? '')
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault()
    const depositPaise = deposit.trim() === '' ? 0 : toPaise(deposit)
    if (!name.trim()) return notify('error', z('propertyNeeded'))
    if (depositPaise === null) return notify('error', z('badDeposit'))
    if (!start) return notify('error', z('startNeeded'))
    if (end && end < start) return notify('error', z('endBeforeStart'))
    setBusy(true)
    try {
      await rpc('update_tenancy_details', {
        p_tenancy: tenancy.id, p_property_name: name.trim(), p_address: address, p_unit: unit,
        p_deposit: depositPaise, p_start: start, p_end: end || null, p_notes: notes,
      })
      notify('success', z('agreementSaved'))
      onDone()
    } catch (err) {
      notify('error', describeError(err))
    }
    setBusy(false)
    return undefined
  }

  return (
    <form className="grid-form edit-panel" onSubmit={save}>
      <div className="field full"><strong>{z('agreementTitle')}</strong></div>
      <Field label={t('propertyName')}><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label={t('address')}><input value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
      <Field label={t('unitNumber')}><input value={unit} onChange={(e) => setUnit(e.target.value)} /></Field>
      <Field label={t('securityDeposit')}><input value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" /></Field>
      <Field label={t('agreementStart')}><input type="date" value={start} onChange={(e) => setStart(e.target.value)} required /></Field>
      <Field label={t('agreementEnd')}><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      <Field label={t('notes')} full><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={z('notesPlaceholder')} /></Field>
      <div className="field full">
        <button type="submit" className="btn primary" disabled={busy}>{busy ? t('saving') : z('saveAgreement')}</button>
        <small className="hint-text">{z('agreementHint')}</small>
      </div>
    </form>
  )
}

// Confirms and runs "delete rent entry". It is kept as a recoverable record; its payments are voided, not erased.
export function DeleteRentPanel({ t, y, z, tenancy, person, property, payments, notify, onDone }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const mine = payments.filter((p) => p.tenancy_id === tenancy.id && !p.voided_at)
  const total = mine.reduce((s, p) => s + p.amount_paise, 0)

  async function remove(e) {
    e.preventDefault()
    const clean = reason.trim()
    if (clean.length < 3) return notify('error', y('badReason'))
    if (!window.confirm(z('confirmDeleteRentPrompt'))) return undefined
    setBusy(true)
    try {
      await rpc('delete_tenancy', { p_tenancy: tenancy.id, p_reason: clean })
      notify('success', z('rentDeleted'))
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
        <strong>{z('deleteRentTitle')} — {person?.name} · {property?.name}</strong>
        <small className="hint-text">{fill(z('deleteRentWarn'), { who: person?.name ?? '', n: mine.length, amt: rupees(total) })}</small>
      </div>
      <Field label={y('deleteReason')} hint={y('deleteReasonHint')} full>
        <input value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="field full">
        <button type="submit" className="btn danger" disabled={busy}>{busy ? t('saving') : z('confirmDeleteRent')}</button>
      </div>
    </form>
  )
}

// The list of deleted rent entries, each with a Restore button
export function DeletedRents({ t, y, z, rows, people, properties, error, notify, onDone }) {
  const [busyId, setBusyId] = useState('')

  async function restore(row) {
    setBusyId(row.id)
    try {
      await rpc('restore_tenancy', { p_tenancy: row.id })
      notify('success', z('rentRestored'))
      onDone()
    } catch (err) {
      notify('error', describeError(err))
    }
    setBusyId('')
  }

  return (
    <Card title={z('deletedRents')} className="no-print">
      {error && <p className="message error">{z('needSql5')} ({error})</p>}
      {!error && rows.length === 0 && <Empty>{z('noDeletedRents')}</Empty>}
      {rows.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>{t('tenant')}</th><th>{t('property')}</th><th>{t('monthlyRent')}</th><th>{t('date')}</th><th>{t('details')}</th><th>{t('actions')}</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{people.get(row.person_id)?.name}</td>
                    <td>{properties.get(row.property_id)?.name}</td>
                    <td className="num">{rupees(row.monthly_rent_paise + row.maintenance_paise)}</td>
                    <td>{ddmmyyyy(row.deleted_at)}</td>
                    <td>{row.deleted_reason}</td>
                    <td className="no-print"><button type="button" className="btn small primary" disabled={busyId === row.id} onClick={() => restore(row)}>{busyId === row.id ? t('saving') : y('restore')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">{z('restoreRentNote')}</p>
        </>
      )}
    </Card>
  )
}

// Your Rent page, plus "Manage rent" (edit property and agreement, edit phone / email, delete)
// and "Deleted rent entries" underneath it.
export default function RentPlus(props) {
  const { t, lang, data, reload, notify } = props
  const y = useMemo(() => makeY(lang), [lang])
  const z = useMemo(() => makeZ(lang), [lang])
  const people = useMemo(() => byId(data.people), [data.people])
  const properties = useMemo(() => byId(data.properties), [data.properties])
  const [panel, setPanel] = useState(null) // { id, type: 'agreement' | 'contact' | 'delete' }
  const [deleted, setDeleted] = useState([])
  const [deletedError, setDeletedError] = useState('')

  const loadDeleted = useCallback(async () => {
    const { data: rows, error } = await supabase.from('tenancies').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false })
    if (error) setDeletedError(error.message)
    else {
      setDeleted(rows ?? [])
      setDeletedError('')
    }
  }, [])

  useEffect(() => {
    loadDeleted()
  }, [loadDeleted, data.tenancies.length])

  async function afterChange() {
    setPanel(null)
    await reload()
    await loadDeleted()
  }

  const toggle = (id, type) => setPanel(panel?.id === id && panel.type === type ? null : { id, type })

  return (
    <>
      <Rent {...props} />

      <Card title={z('manageRent')} className="no-print">
        {data.tenancies.length === 0 ? (
          <Empty>{t('noTenants')}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>{t('tenant')}</th><th>{t('property')}</th><th>{t('status')}</th><th className="num">{t('monthlyRent')}</th><th className="no-print">{t('actions')}</th></tr>
              </thead>
              <tbody>
                {data.tenancies.map((tn) => {
                  const person = people.get(tn.person_id)
                  const property = properties.get(tn.property_id)
                  const count = data.payments.filter((p) => p.tenancy_id === tn.id && !p.voided_at).length
                  return (
                    <Fragment key={tn.id}>
                      <tr>
                        <td>{person?.name}<br /><small>{person?.mobile || <span className="red">{t('noMobile')}</span>}{person?.email ? ` · ${person.email}` : ''}</small></td>
                        <td>{property?.name}<br /><small>{property?.unit_number} · {count} {y('paymentsWord')}</small></td>
                        <td><Pill tone={tn.active ? 'green' : 'gray'}>{tn.active ? z('statusActive') : z('statusMovedOut')}</Pill></td>
                        <td className="num">{rupees(tn.monthly_rent_paise + tn.maintenance_paise)}</td>
                        <td className="no-print">
                          <div className="button-row">
                            <button type="button" className="btn small" onClick={() => toggle(tn.id, 'agreement')}>{z('editAgreement')}</button>
                            <button type="button" className="btn small" onClick={() => toggle(tn.id, 'contact')}>{y('editContact')}</button>
                            <button type="button" className="btn small danger" onClick={() => toggle(tn.id, 'delete')}>{z('deleteRent')}</button>
                          </div>
                        </td>
                      </tr>
                      {panel?.id === tn.id && (
                        <tr>
                          <td colSpan={5}>
                            {panel.type === 'agreement' && <EditAgreement t={t} z={z} tenancy={tn} property={property} notify={notify} onDone={afterChange} />}
                            {panel.type === 'contact' && person && <ContactForm t={t} y={y} person={person} notify={notify} onSaved={afterChange} />}
                            {panel.type === 'delete' && <DeleteRentPanel t={t} y={y} z={z} tenancy={tn} person={person} property={property} payments={data.payments} notify={notify} onDone={afterChange} />}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <DeletedRents t={t} y={y} z={z} rows={deleted} people={people} properties={properties} error={deletedError} notify={notify} onDone={afterChange} />
    </>
  )
}
