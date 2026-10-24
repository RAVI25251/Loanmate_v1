import { Fragment, useEffect, useMemo, useState } from 'react'
import { Card, Empty, Field, Notice, Pill, Switch } from '../components/ui.jsx'
import ContactForm from '../components/ContactForm.jsx'
import { ddmmyyyy, isEmail, normalizeMobile, rupees, toE164, todayIso } from '../lib/format.js'
import { REMINDER_TYPES, buildReminderQueue, getSetting } from '../lib/reminders.js'
import { renderCustomMessage, sampleMessage, smsInfo } from '../lib/messages.js'
import { buildEmailSubject, mailtoLink } from '../lib/remindMail.js'
import { copyText, downloadText } from '../lib/download.js'
import { smsHistoryCsv } from '../lib/report.js'
import { byId } from '../lib/selectors.js'
import { supabase } from '../lib/supabase.js'
import { describeError } from '../lib/api.js'
import { makeY } from '../lib/textV5.js'

const CATEGORIES = ['loan', 'house_rent', 'shop_rent']
const STATUS_TONE = { ready: 'orange', opened: 'blue', sent: 'green', skipped: 'gray', test_opened: 'gray' }
const channelOf = (row) => (row.channel === 'email' ? 'email' : 'sms')

function openSmsApp(mobile, message) {
  window.location.href = `sms:${toE164(mobile)}?body=${encodeURIComponent(message)}`
}
function openEmailApp(email, subject, message) {
  window.location.href = mailtoLink(email, subject, message)
}

// A person's switch for one channel (SMS or email). It cannot be switched ON without a valid number / address.
function ChannelSwitch({ t, y, person, field, reload, notify }) {
  const [on, setOn] = useState(person[field] === true)
  useEffect(() => setOn(person[field] === true), [person, field])
  const isSms = field === 'sms_enabled'

  async function change(value) {
    if (value && isSms && !normalizeMobile(person.mobile)) return notify('error', y('addMobileFirst'))
    if (value && !isSms && !isEmail(person.email)) return notify('error', y('addEmailFirst'))
    setOn(value)
    const { error } = await supabase.from('people').update({ [field]: value }).eq('id', person.id)
    if (error) {
      setOn(!value)
      notify('error', error.message)
    } else reload()
    return undefined
  }
  return <Switch checked={on} onChange={change} label={isSms ? (on ? t('smsOn') : t('smsOff')) : (on ? y('emailOn') : y('emailOff'))} />
}

// A loan's or a rent's own reminder switch
function ItemSwitch({ table, row, reload, notify, t }) {
  const [on, setOn] = useState(row.reminders_enabled !== false)
  useEffect(() => setOn(row.reminders_enabled !== false), [row])
  async function change(value) {
    setOn(value)
    const { error } = await supabase.from(table).update({ reminders_enabled: value }).eq('id', row.id)
    if (error) {
      setOn(!value)
      notify('error', error.message)
    } else reload()
  }
  return <Switch checked={on} onChange={change} label={on ? t('on') : t('off')} />
}

function PersonSettings({ t, y, person, reminders, userId, ownerMobile, ownerEmail, notify, reload }) {
  const initial = Object.fromEntries(REMINDER_TYPES.map((type) => [type, getSetting(reminders, person.id, type)]))
  const [lang, setLang] = useState(person.sms_language || 'en')
  const [types, setTypes] = useState(Object.fromEntries(REMINDER_TYPES.map((x) => [x, initial[x].enabled])))
  const [days, setDays] = useState(String(initial.upcoming.daysBefore))
  const [time, setTime] = useState(initial.due.time)
  const [custom, setCustom] = useState(initial.due.custom)
  const [category, setCategory] = useState('loan')
  const [busy, setBusy] = useState(false)

  const base = sampleMessage(lang, category, person.name)
  const preview = custom.trim()
    ? renderCustomMessage(custom, { name: person.name, amount: 100000, dueDate: '2026-10-10', principal: 5000000, interest: 80000, month: lang === 'te' ? 'అక్టోబర్ 2026' : 'October 2026', arrears: 500000, total: 2300000 })
    : base
  const sampleSubject = buildEmailSubject({ lang, category: category === 'loan' ? 'interest' : category, amount: 100000, dueDate: '2026-10-10' })
  const info = smsInfo(preview)

  async function save() {
    const d = Number(days)
    if (!Number.isInteger(d) || d < 0 || d > 30) return notify('error', t('badDaysBefore'))
    setBusy(true)
    const p = await supabase.from('people').update({ sms_language: lang }).eq('id', person.id)
    const rows = REMINDER_TYPES.map((type) => ({
      owner_id: userId, person_id: person.id, reminder_type: type, enabled: types[type], language: lang,
      days_before: d, reminder_time: `${time}:00`, custom_message: custom.trim() || null,
    }))
    const r = await supabase.from('reminders').upsert(rows, { onConflict: 'owner_id,person_id,reminder_type' })
    setBusy(false)
    if (p.error || r.error) return notify('error', (p.error || r.error).message)
    notify('success', t('reminderSettingsSaved'))
    reload()
    return undefined
  }

  async function sendTest(channel) {
    const mobile = normalizeMobile(ownerMobile)
    if (channel === 'sms' && !mobile) return notify('error', t('ownerMobileNeeded'))
    if (channel === 'email' && !isEmail(ownerEmail)) return notify('error', y('addEmailFirst'))
    const row = { owner_id: userId, person_id: person.id, message: preview, status: 'test_opened', dedupe_key: `test|${channel}|${person.id}|${Date.now()}` }
    if (channel === 'email') row.channel = 'email'
    const { error } = await supabase.from('sms_history').insert(row)
    if (error) return notify('error', error.message)
    reload()
    if (channel === 'sms') openSmsApp(mobile, preview)
    else openEmailApp(ownerEmail, sampleSubject, preview)
    return undefined
  }

  return (
    <div className="person-settings">
      <div className="grid-form">
        <Field label={t('smsLanguage')}>
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="en">English</option>
            <option value="te">తెలుగు (Telugu)</option>
          </select>
        </Field>
        <Field label={t('daysBefore')} hint={t('daysBeforeHint')}><input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" /></Field>
        <Field label={t('reminderTime')} hint={t('reminderTimeHint')}><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        <div className="field">
          <label>{t('reminderTypes')}</label>
          <div className="switch-stack">
            {REMINDER_TYPES.map((type) => <Switch key={type} checked={types[type]} onChange={(v) => setTypes((s) => ({ ...s, [type]: v }))} label={t(`stage_${type}`)} />)}
          </div>
        </div>
        <Field label={t('customMessage')} full hint={t('customMessageHint')}>
          <textarea rows={2} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Hello {Name}, ₹{Amount} is due on {DueDate}." />
        </Field>
      </div>

      <div className="preview-box">
        <div className="button-row">
          <strong>{t('preview')}</strong>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat_${c}`)}</option>)}
          </select>
        </div>
        <p className="sms-text">{preview}</p>
        <small>{y('channelSms')}: {t('sampleValues')} · {info.length} {t('characters')} · {info.parts} {t('smsParts')}{info.unicode ? ` · ${t('unicodeNote')}` : ''}</small>
        <p className="sms-text"><strong>{y('channelEmail')}: {sampleSubject}</strong>{'\n'}{preview}</p>
      </div>

      <div className="button-row">
        <button type="button" className="btn primary" onClick={save} disabled={busy}>{busy ? t('saving') : t('save')}</button>
        <button type="button" className="btn" onClick={() => sendTest('sms')}>{t('sendTest')}</button>
        <button type="button" className="btn" onClick={() => sendTest('email')}>{y('sendTestEmail')}</button>
      </div>
      <p className="hint">{t('enableAfterPreview')}</p>
    </div>
  )
}

export default function Reminders({ t, lang, data, reload, notify, userId, email }) {
  const y = useMemo(() => makeY(lang), [lang])
  const [open, setOpen] = useState(null)
  const [expanded, setExpanded] = useState(null) // { id, type: 'settings' | 'contact' }
  const settings = data.settings
  const smsGlobal = settings ? settings.sms_enabled !== false : true
  const emailGlobal = settings ? settings.email_reminders_enabled !== false : true
  const people = useMemo(() => byId(data.people), [data.people])
  const properties = useMemo(() => byId(data.properties), [data.properties])
  const today = todayIso()

  const queue = useMemo(
    () => buildReminderQueue({ today, people: data.people, reminders: data.reminders, loans: data.loans, entries: data.entries, payments: data.payments, tenancies: data.tenancies, properties: data.properties, dues: data.dues, smsHistory: data.smsHistory, globalEnabled: smsGlobal, emailGlobalEnabled: emailGlobal }),
    [today, data, smsGlobal, emailGlobal],
  )

  async function setGlobal(field, value) {
    const { error } = await supabase.from('user_settings').upsert({ owner_id: userId, [field]: value }, { onConflict: 'owner_id' })
    if (error) notify('error', error.message)
    else reload()
  }

  function historyRow(item, status) {
    const row = { owner_id: userId, person_id: item.personId, message: item.message, status, dedupe_key: item.key }
    if (item.channel === 'email') row.channel = 'email'
    return row
  }

  async function openItem(item) {
    if (!item.contactOk) return notify('error', item.channel === 'sms' ? t('invalidMobile') : y('invalidEmail'))
    const { error } = await supabase.from('sms_history').insert(historyRow(item, 'opened'))
    if (error) return notify(error.code === '23505' ? 'info' : 'error', error.code === '23505' ? t('alreadyHandled') : error.message)
    if (item.channel === 'sms') openSmsApp(item.mobile, item.message) // opened at once, while the click is still fresh
    else openEmailApp(item.email, item.subject, item.message)
    reload()
    return undefined
  }

  async function setStatus(historyId, status) {
    const { error } = await supabase.from('sms_history').update({ status }).eq('id', historyId)
    if (error) notify('error', error.message)
    else reload()
  }

  async function skip(item) {
    const { error } = await supabase.from('sms_history').insert(historyRow(item, 'skipped'))
    if (error) notify('error', describeError(error))
    else reload()
  }

  async function copy(item) {
    const ok = await copyText(item.channel === 'email' ? `${item.subject}\n\n${item.message}` : item.message)
    notify(ok ? 'success' : 'error', ok ? t('copied') : t('copyFailed'))
  }

  const ready = queue.filter((q) => q.status === 'ready')
  const handled = queue.filter((q) => q.status !== 'ready')
  const lentLoans = data.loans.filter((l) => l.kind === 'lent')
  const activeTenancies = data.tenancies.filter((tn) => tn.active)
  const toggleExpanded = (id, type) => setExpanded(expanded?.id === id && expanded.type === type ? null : { id, type })
  const csvRows = data.smsHistory.map((h) => ({ ...h, message: `[${channelOf(h) === 'email' ? y('channelEmail') : y('channelSms')}] ${h.message}` }))

  return (
    <>
      <Card
        title={y('remindersTitle')}
        right={
          <div className="button-row">
            <Switch checked={smsGlobal} onChange={(v) => setGlobal('sms_enabled', v)} label={smsGlobal ? t('smsOn') : t('smsOff')} />
            <Switch checked={emailGlobal} onChange={(v) => setGlobal('email_reminders_enabled', v)} label={emailGlobal ? y('emailOn') : y('emailOff')} />
          </div>
        }
      >
        <Notice tone="info">{y('howItWorks')}</Notice>
        <p className="hint">{y('switchOrder')}</p>
        {!smsGlobal && <Notice tone="warn">{y('smsAllOff')}</Notice>}
        {!emailGlobal && <Notice tone="warn">{y('emailAllOff')}</Notice>}
      </Card>

      <Card title={t('readyToSend')} right={<Pill tone="orange">{ready.length}</Pill>}>
        {ready.length === 0 ? (
          <Empty>{t('noReminders')}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('person')}</th><th>{y('channelWord')}</th><th>{t('type')}</th><th>{t('dueDate')}</th><th className="num">{t('amount')}</th><th>{t('message')}</th><th className="no-print">{t('actions')}</th></tr></thead>
              <tbody>
                {ready.map((item) => {
                  const info = smsInfo(item.message)
                  const isSms = item.channel === 'sms'
                  return (
                    <Fragment key={item.key}>
                      <tr>
                        <td>
                          {item.personName}<br />
                          <small>{isSms ? (item.mobileOk ? `+91 ${item.mobile}` : <span className="red">{t('invalidMobile')}</span>) : (item.emailOk ? item.email : <span className="red">{item.email ? y('invalidEmail') : y('noEmail')}</span>)}</small>
                        </td>
                        <td><Pill tone={isSms ? 'blue' : 'green'}>{isSms ? y('channelSms') : y('channelEmail')}</Pill></td>
                        <td>{t(`cat_${item.category}`)}<br /><Pill tone={item.stage === 'overdue' ? 'red' : item.stage === 'due' ? 'orange' : 'blue'}>{t(`stage_${item.stage}`)}</Pill></td>
                        <td>{ddmmyyyy(item.dueDate)}</td>
                        <td className="num orange">{rupees(item.amount)}</td>
                        <td><button type="button" className="link-button" onClick={() => setOpen(open === item.key ? null : item.key)}>{open === item.key ? t('hide') : t('preview')}</button> <small>({item.lang === 'te' ? 'తెలుగు' : 'English'}{isSms ? ` · ${info.parts} ${t('smsParts')}` : ''})</small></td>
                        <td className="no-print">
                          <div className="button-row">
                            <button type="button" className="btn small primary" onClick={() => openItem(item)} disabled={!item.contactOk}>{isSms ? t('openSms') : y('openEmail')}</button>
                            <button type="button" className="btn small" onClick={() => copy(item)}>{t('copy')}</button>
                            <button type="button" className="btn small" onClick={() => skip(item)}>{t('skip')}</button>
                          </div>
                        </td>
                      </tr>
                      {open === item.key && <tr><td colSpan={7}><p className="sms-text">{item.subject ? <strong>{item.subject}{'\n'}</strong> : null}{item.message}</p></td></tr>}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {handled.length > 0 && <p className="hint">{handled.length} {t('alreadyHandledCount')}</p>}
        <p className="hint">{y('mailNote')}</p>
      </Card>

      <Card title={t('peopleSettings')}>
        {data.people.length === 0 ? <Empty>{t('noPeople')}</Empty> : (
          <div className="people-list">
            {data.people.map((person) => (
              <div className="person-card" key={person.id}>
                <div className="person-head">
                  <div>
                    <strong>{person.name}</strong>
                    <br /><small>{person.mobile ? (normalizeMobile(person.mobile) ? `+91 ${normalizeMobile(person.mobile)}` : <span className="red">{t('invalidMobile')}</span>) : <span className="red">{t('noMobile')}</span>}</small>
                    <br /><small>{person.email ? (isEmail(person.email) ? person.email : <span className="red">{y('invalidEmail')}</span>) : <span className="red">{y('noEmail')}</span>}</small>
                  </div>
                  <ChannelSwitch t={t} y={y} person={person} field="sms_enabled" reload={reload} notify={notify} />
                  <ChannelSwitch t={t} y={y} person={person} field="email_enabled" reload={reload} notify={notify} />
                  <div className="button-row">
                    <button type="button" className="btn small" onClick={() => toggleExpanded(person.id, 'contact')}>{y('editContact')}</button>
                    <button type="button" className="btn small" onClick={() => toggleExpanded(person.id, 'settings')}>{expanded?.id === person.id && expanded.type === 'settings' ? t('hide') : t('settings')}</button>
                  </div>
                </div>
                {expanded?.id === person.id && expanded.type === 'contact' && <ContactForm t={t} y={y} person={person} notify={notify} onSaved={() => { setExpanded(null); reload() }} />}
                {expanded?.id === person.id && expanded.type === 'settings' && <PersonSettings t={t} y={y} person={person} reminders={data.reminders} userId={userId} ownerMobile={settings?.owner_mobile} ownerEmail={email} notify={notify} reload={reload} />}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={y('perItemTitle')}>
        <p className="hint">{y('perItemHint')}</p>
        {lentLoans.length === 0 && activeTenancies.length === 0 ? <Empty>{y('noItems')}</Empty> : (
          <div className="table-wrap">
            <table className="compact">
              <thead><tr><th>{t('person')}</th><th>{t('type')}</th><th className="num">{t('amount')}</th><th>{t('reminders')}</th></tr></thead>
              <tbody>
                {lentLoans.map((loan) => (
                  <tr key={loan.id}>
                    <td>{people.get(loan.person_id)?.name}</td>
                    <td>{t('kindLent')}</td>
                    <td className="num">{rupees(loan.outstanding_principal_paise)}</td>
                    <td><ItemSwitch table="loans" row={loan} reload={reload} notify={notify} t={t} /></td>
                  </tr>
                ))}
                {activeTenancies.map((tn) => {
                  const property = properties.get(tn.property_id)
                  return (
                    <tr key={tn.id}>
                      <td>{people.get(tn.person_id)?.name}</td>
                      <td>{t(property?.kind === 'shop' ? 'shopRent' : 'houseRent')} · {property?.name}</td>
                      <td className="num">{rupees(tn.monthly_rent_paise + tn.maintenance_paise)}</td>
                      <td><ItemSwitch table="tenancies" row={tn} reload={reload} notify={notify} t={t} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={y('reminderHistory')} right={<button type="button" className="btn small no-print" onClick={() => downloadText('reminder-history.csv', smsHistoryCsv(csvRows, (id) => people.get(id)?.name ?? ''))}>{t('downloadCsv')}</button>}>
        {data.smsHistory.length === 0 ? <Empty>{t('noHistory')}</Empty> : (
          <div className="table-wrap">
            <table className="compact">
              <thead><tr><th>{t('date')}</th><th>{t('person')}</th><th>{y('channelWord')}</th><th>{t('status')}</th><th>{t('message')}</th><th className="no-print"></th></tr></thead>
              <tbody>
                {data.smsHistory.map((h) => (
                  <tr key={h.id}>
                    <td>{ddmmyyyy(h.created_at)}</td>
                    <td>{people.get(h.person_id)?.name}</td>
                    <td><Pill tone={channelOf(h) === 'email' ? 'green' : 'blue'}>{channelOf(h) === 'email' ? y('channelEmail') : y('channelSms')}</Pill></td>
                    <td><Pill tone={STATUS_TONE[h.status] || 'gray'}>{t(`sms_${h.status}`)}</Pill></td>
                    <td className="sms-cell">{h.message}</td>
                    <td className="no-print">{h.status === 'opened' && <button type="button" className="btn small" onClick={() => setStatus(h.id, 'sent')}>{t('markSent')}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">{y('historyNote')}</p>
      </Card>
    </>
  )
}
