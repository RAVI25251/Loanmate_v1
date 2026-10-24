import { Fragment, useMemo, useState } from 'react'
import { Card, Empty, Field, Pill, Stat } from '../components/ui.jsx'
import { currentPeriod, daysBetween, ddmmyyyy, rupees, toPaise, todayIso } from '../lib/format.js'
import { describeError, rpc } from '../lib/api.js'
import { supabase } from '../lib/supabase.js'
import { byId, latestDue } from '../lib/selectors.js'
import { downloadText } from '../lib/download.js'
import { rentCsv } from '../lib/report.js'

function emptyForm() {
  return {
    personId: 'new', name: '', mobile: '', propertyId: 'new', propertyName: '', address: '', unit: '',
    rent: '', maintenance: '', deposit: '', start: todayIso(), end: '', dueDay: '',
  }
}

function EditTerms({ t, tenancy, notify, onDone }) {
  const [rent, setRent] = useState((tenancy.monthly_rent_paise / 100).toString())
  const [maint, setMaint] = useState(tenancy.maintenance_paise ? (tenancy.maintenance_paise / 100).toString() : '')
  const [dueDay, setDueDay] = useState(String(tenancy.due_day))
  const [from, setFrom] = useState(currentPeriod())
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault()
    const rentPaise = toPaise(rent)
    const maintPaise = maint === '' ? 0 : toPaise(maint)
    const day = Number(dueDay)
    if (rentPaise === null || rentPaise <= 0) return notify('error', t('badRent'))
    if (maintPaise === null) return notify('error', t('badAmount'))
    if (!Number.isInteger(day) || day < 1 || day > 31) return notify('error', t('badDueDay'))
    setBusy(true)
    try {
      await rpc('update_tenancy_terms', { p_tenancy: tenancy.id, p_rent: rentPaise, p_maintenance: maintPaise, p_due_day: day, p_from: from })
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
      <Field label={t('monthlyRent')}><input value={rent} onChange={(e) => setRent(e.target.value)} inputMode="decimal" /></Field>
      <Field label={t('maintenance')}><input value={maint} onChange={(e) => setMaint(e.target.value)} inputMode="decimal" /></Field>
      <Field label={t('dueDay')}><input value={dueDay} onChange={(e) => setDueDay(e.target.value)} inputMode="numeric" /></Field>
      <Field label={t('rentFrom')} hint={t('rentFromHint')}><input type="month" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
      <div className="field full"><button type="submit" className="btn primary" disabled={busy}>{busy ? t('saving') : t('saveTerms')}</button></div>
    </form>
  )
}

function MoveOut({ t, tenancy, notify, onDone }) {
  const [date, setDate] = useState(todayIso())
  const [busy, setBusy] = useState(false)
  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await rpc('move_out_tenancy', { p_tenancy: tenancy.id, p_date: date })
      notify('success', t('movedOut'))
      onDone()
    } catch (err) {
      notify('error', describeError(err))
    }
    setBusy(false)
  }
  return (
    <form className="grid-form edit-panel" onSubmit={save}>
      <Field label={t('moveOutDate')} hint={t('moveOutHint')}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
      <div className="field full"><button type="submit" className="btn danger" disabled={busy}>{busy ? t('saving') : t('confirmMoveOut')}</button></div>
    </form>
  )
}

function History({ t, dues, notify, onDone }) {
  const [notes, setNotes] = useState({})
  async function saveNote(due) {
    const { error } = await supabase.from('rent_dues').update({ notes: notes[due.id] ?? due.notes ?? '' }).eq('id', due.id)
    if (error) notify('error', error.message)
    else {
      notify('success', t('noteSaved'))
      onDone()
    }
  }
  return (
    <div className="table-wrap">
      <table className="compact">
        <thead>
          <tr>
            <th>{t('month')}</th><th>{t('dueDate')}</th><th className="num">{t('rent')}</th><th className="num">{t('previousArrears')}</th>
            <th className="num">{t('paid')}</th><th className="num">{t('closingArrears')}</th><th>{t('status')}</th><th>{t('lateNote')}</th>
          </tr>
        </thead>
        <tbody>
          {[...dues].sort((a, b) => b.period_key.localeCompare(a.period_key)).map((d) => (
            <tr key={d.id}>
              <td>{d.period_key}</td>
              <td>{ddmmyyyy(d.due_date)}</td>
              <td className="num">{rupees(d.rent_paise + d.maintenance_paise)}</td>
              <td className="num">{rupees(d.previous_arrears_paise)}</td>
              <td className="num green">{rupees(d.paid_paise)}</td>
              <td className="num red">{rupees(d.closing_arrears_paise)}</td>
              <td>{d.closing_arrears_paise === 0 ? <Pill tone="green">{t('statusPaid')}</Pill> : d.paid_paise > 0 ? <Pill tone="orange">{t('statusPartial')}</Pill> : <Pill tone="red">{t('statusUnpaid')}</Pill>}</td>
              <td>
                <input className="note-input" value={notes[d.id] ?? d.notes ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [d.id]: e.target.value }))} />
                <button type="button" className="btn small" onClick={() => saveNote(d)}>{t('save')}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Rent({ t, data, reload, notify, go, nav }) {
  const [kind, setKind] = useState(nav.rentKind || 'house')
  const [showForm, setShowForm] = useState(Boolean(nav.openForm))
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [panel, setPanel] = useState(null) // { id, type: 'edit' | 'out' | 'history' }
  const people = useMemo(() => byId(data.people), [data.people])
  const properties = useMemo(() => byId(data.properties), [data.properties])
  const period = currentPeriod()
  const today = todayIso()
  const r = data.report

  const rows = data.tenancies
    .map((tn) => ({ tn, property: properties.get(tn.property_id), person: people.get(tn.person_id), due: latestDue(data.dues, tn.id, period) }))
    .filter((x) => x.property?.kind === kind)
  const activeRows = rows.filter((x) => x.tn.active)
  const endedWithArrears = rows.filter((x) => !x.tn.active && x.due && x.due.closing_arrears_paise > 0)
  const vacant = data.properties.filter((p) => p.kind === kind && p.vacant)
  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))
  const label = t(kind === 'house' ? 'houseRent' : 'shopRent')

  async function save(e) {
    e.preventDefault()
    const rentPaise = toPaise(form.rent)
    const maintPaise = form.maintenance === '' ? 0 : toPaise(form.maintenance)
    const depositPaise = form.deposit === '' ? 0 : toPaise(form.deposit)
    const day = Number(form.dueDay)
    if (rentPaise === null || rentPaise <= 0) return notify('error', t('badRent'))
    if (maintPaise === null || depositPaise === null) return notify('error', t('badAmount'))
    if (!Number.isInteger(day) || day < 1 || day > 31) return notify('error', t('badDueDay'))
    if (form.personId === 'new' && !form.name.trim()) return notify('error', t('nameRequired'))
    if (form.propertyId === 'new' && !form.propertyName.trim()) return notify('error', t('propertyRequired'))
    setSaving(true)
    try {
      await rpc('add_tenancy', {
        p_kind: kind,
        p_property_id: form.propertyId === 'new' ? null : form.propertyId,
        p_property_name: form.propertyName,
        p_address: form.address,
        p_unit: form.unit,
        p_person_id: form.personId === 'new' ? null : form.personId,
        p_name: form.name,
        p_mobile: form.mobile,
        p_rent: rentPaise,
        p_maintenance: maintPaise,
        p_deposit: depositPaise,
        p_start: form.start,
        p_end: form.end || null,
        p_due_day: day,
      })
      notify('success', t('tenantSaved'))
      setForm(emptyForm())
      setShowForm(false)
      await reload()
    } catch (err) {
      notify('error', describeError(err))
    }
    setSaving(false)
    return undefined
  }

  function exportRent() {
    const csvRows = data.dues
      .map((d) => {
        const tn = data.tenancies.find((x) => x.id === d.tenancy_id)
        const property = properties.get(tn?.property_id)
        return property?.kind === kind ? { kind, property: property.name, unit: property.unit_number, tenant: people.get(tn.person_id)?.name ?? '', ...d } : null
      })
      .filter(Boolean)
    downloadText(`${kind}-rent-report.csv`, rentCsv(csvRows))
  }

  const houseTotal = r?.rent_expected.house_total ?? 0
  const shopTotal = r?.rent_expected.shop_total ?? 0

  return (
    <>
      <div className="stat-grid">
        <Stat label={t('houseRentExpected')} value={rupees(houseTotal)} sub={t('perMonth')} />
        <Stat label={t('shopRentExpected')} value={rupees(shopTotal)} sub={t('perMonth')} />
        <Stat label={t('combinedRentalIncome')} value={rupees(houseTotal + shopTotal)} tone="green" sub={t('perMonth')} />
        <Stat label={t('rentPending')} value={rupees((r?.rent_pending.house_total ?? 0) + (r?.rent_pending.shop_total ?? 0))} tone="red" sub={`${t('houseRent')} ${rupees(r?.rent_pending.house_total ?? 0)} · ${t('shopRent')} ${rupees(r?.rent_pending.shop_total ?? 0)}`} />
      </div>

      <div className="subtabs no-print">
        <button type="button" className={kind === 'house' ? 'tab active' : 'tab'} onClick={() => setKind('house')}>{t('houseRent')}</button>
        <button type="button" className={kind === 'shop' ? 'tab active' : 'tab'} onClick={() => setKind('shop')}>{t('shopRent')}</button>
        <button type="button" className="btn primary push-right" onClick={() => setShowForm(!showForm)}>{kind === 'house' ? t('addTenant') : t('addShopTenant')}</button>
      </div>

      {showForm && (
        <Card title={kind === 'house' ? t('addTenant') : t('addShopTenant')}>
          <form className="grid-form" onSubmit={save}>
            <Field label={kind === 'house' ? t('tenant') : t('tenantOrBusiness')}>
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
            <Field label={t('property')}>
              <select value={form.propertyId} onChange={(e) => update('propertyId', e.target.value)}>
                <option value="new">{t('newProperty')}</option>
                {vacant.map((p) => <option key={p.id} value={p.id}>{p.name} ({t('vacant')})</option>)}
              </select>
            </Field>
            {form.propertyId === 'new' && (
              <>
                <Field label={t('propertyName')}><input value={form.propertyName} onChange={(e) => update('propertyName', e.target.value)} /></Field>
                <Field label={t('address')}><input value={form.address} onChange={(e) => update('address', e.target.value)} /></Field>
                <Field label={t('unitNumber')}><input value={form.unit} onChange={(e) => update('unit', e.target.value)} /></Field>
              </>
            )}
            <Field label={t('monthlyRent')}><input value={form.rent} onChange={(e) => update('rent', e.target.value)} inputMode="decimal" /></Field>
            <Field label={t('maintenance')}><input value={form.maintenance} onChange={(e) => update('maintenance', e.target.value)} inputMode="decimal" /></Field>
            <Field label={t('securityDeposit')}><input value={form.deposit} onChange={(e) => update('deposit', e.target.value)} inputMode="decimal" /></Field>
            <Field label={t('agreementStart')}><input type="date" value={form.start} onChange={(e) => update('start', e.target.value)} required /></Field>
            <Field label={t('agreementEnd')}><input type="date" value={form.end} onChange={(e) => update('end', e.target.value)} /></Field>
            <Field label={t('dueDay')}><input value={form.dueDay} onChange={(e) => update('dueDay', e.target.value)} placeholder="5" inputMode="numeric" /></Field>
            <div className="field full"><button type="submit" className="btn primary" disabled={saving}>{saving ? t('saving') : t('saveTenant')}</button></div>
          </form>
        </Card>
      )}

      <Card title={`${label} — ${t('tenants')}`} right={<button type="button" className="btn small no-print" onClick={exportRent}>{t('downloadCsv')}</button>}>
        {activeRows.length === 0 ? (
          <Empty>{t('noTenants')}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('property')}</th><th>{t('tenant')}</th><th className="num">{t('monthlyRent')}</th><th>{t('dueDay')}</th>
                  <th>{t('agreementEnd')}</th><th>{t('thisMonth')}</th><th className="num">{t('closingArrears')}</th><th className="no-print">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map(({ tn, property, person, due }) => {
                  const closing = due?.closing_arrears_paise ?? 0
                  const overdue = due && closing > 0 && due.due_date < today
                  const endsSoon = tn.agreement_end && daysBetween(today, tn.agreement_end) <= 60
                  const expired = tn.agreement_end && tn.agreement_end < today
                  return (
                    <Fragment key={tn.id}>
                      <tr>
                        <td>{property?.name}<br /><small>{property?.unit_number} {property?.address !== '-' ? property?.address : ''}</small></td>
                        <td>{person?.name}<br /><small>{person?.mobile}</small></td>
                        <td className="num">{rupees(tn.monthly_rent_paise + tn.maintenance_paise)}{tn.maintenance_paise ? <><br /><small>{t('maintenance')} {rupees(tn.maintenance_paise)}</small></> : null}</td>
                        <td>{tn.due_day}</td>
                        <td>{tn.agreement_end ? ddmmyyyy(tn.agreement_end) : '—'}{expired ? <><br /><Pill tone="red">{t('leaseExpired')}</Pill></> : endsSoon ? <><br /><Pill tone="orange">{t('leaseEndingSoon')}</Pill></> : null}</td>
                        <td>{!due ? '—' : closing === 0 ? <Pill tone="green">{t('statusPaid')}</Pill> : due.paid_paise > 0 ? <Pill tone={overdue ? 'red' : 'orange'}>{t('statusPartial')}</Pill> : <Pill tone={overdue ? 'red' : 'orange'}>{overdue ? t('statusOverdue') : t('statusUnpaid')}</Pill>}</td>
                        <td className={`num ${closing > 0 ? 'red' : ''}`}>{rupees(closing)}</td>
                        <td className="no-print">
                          <div className="button-row">
                            <button type="button" className="btn small" onClick={() => go('payments', { tenancyId: tn.id })}>{t('recordPayment')}</button>
                            <button type="button" className="btn small" onClick={() => setPanel(panel?.id === tn.id && panel.type === 'history' ? null : { id: tn.id, type: 'history' })}>{t('history')}</button>
                            <button type="button" className="btn small" onClick={() => setPanel(panel?.id === tn.id && panel.type === 'edit' ? null : { id: tn.id, type: 'edit' })}>{t('edit')}</button>
                            <button type="button" className="btn small" onClick={() => go('reminders')}>{t('sendReminder')}</button>
                            <button type="button" className="btn small danger" onClick={() => setPanel(panel?.id === tn.id && panel.type === 'out' ? null : { id: tn.id, type: 'out' })}>{t('moveOut')}</button>
                          </div>
                        </td>
                      </tr>
                      {panel?.id === tn.id && (
                        <tr>
                          <td colSpan={8}>
                            {panel.type === 'edit' && <EditTerms t={t} tenancy={tn} notify={notify} onDone={() => { setPanel(null); reload() }} />}
                            {panel.type === 'out' && <MoveOut t={t} tenancy={tn} notify={notify} onDone={() => { setPanel(null); reload() }} />}
                            {panel.type === 'history' && <History t={t} dues={data.dues.filter((d) => d.tenancy_id === tn.id)} notify={notify} onDone={reload} />}
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

      {endedWithArrears.length > 0 && (
        <Card title={t('arrearsFromPastTenants')}>
          <ul className="plain-list">
            {endedWithArrears.map(({ tn, property, person, due }) => (
              <li key={tn.id}>{person?.name} · {property?.name} — <span className="red">{rupees(due.closing_arrears_paise)}</span> <button type="button" className="btn small no-print" onClick={() => go('payments', { tenancyId: tn.id })}>{t('recordPayment')}</button></li>
            ))}
          </ul>
        </Card>
      )}

      <Card title={t('vacancyReport')}>
        {vacant.length === 0 ? <Empty>{t('noVacancies')}</Empty> : (
          <ul className="plain-list">{vacant.map((p) => <li key={p.id}>{p.name}{p.unit_number ? ` (${p.unit_number})` : ''} <Pill tone="blue">{t('vacant')}</Pill></li>)}</ul>
        )}
      </Card>
    </>
  )
}
