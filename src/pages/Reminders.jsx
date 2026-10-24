import { Fragment, useMemo, useState } from 'react'
import { Card, Empty, Field, Notice, Pill, Switch } from '../components/ui.jsx'
import { ddmmyyyy, normalizeMobile, rupees, toE164, todayIso } from '../lib/format.js'
import { REMINDER_TYPES, buildReminderQueue, getSetting } from '../lib/reminders.js'
import { renderCustomMessage, sampleMessage, smsInfo } from '../lib/messages.js'
import { copyText, downloadText } from '../lib/download.js'
import { smsHistoryCsv } from '../lib/report.js'
import { byId } from '../lib/selectors.js'
import { supabase } from '../lib/supabase.js'
import { describeError } from '../lib/api.js'

const CATEGORIES = ['loan', 'house_rent', 'shop_rent']
const STATUS_TONE = { ready: 'orange', opened: 'blue', sent: 'green', skipped: 'gray', test_opened: 'gray' }

function openComposer(mobile, message) {
  window.location.href = `sms:${toE164(mobile)}?body=${encodeURIComponent(message)}`
}

function PersonSettings({ t, person, reminders, userId, ownerMobile, notify, reload }) {
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
  const info = smsInfo(preview)

  async function save() {
    const d = Number(days)
    if (!Number.isInteger(d) || d < 0 || d > 30) return notify('error', t('badDaysBefore'))
    setBusy(true)
    const p = await supabase.from('people').update({ sms_language: lang }).eq('id', person.id)
    const rows = REMINDER_TYPES.map((type) => ({
      owner_id: userId,
      person_id: person.id,
      reminder_type: type,
      enabled: types[type],
      language: lang,
      days_before: d,
      reminder_time: `${time}:00`,
      custom_message: custom.trim() || null,
    }))
    const r = await supabase.from('reminders').upsert(rows, { onConflict: 'owner_id,person_id,reminder_type' })
    setBusy(false)
    if (p.error || r.error) return notify('error', (p.error || r.error).message)
    notify('success', t('reminderSettingsSaved'))
    reload()
    return undefined
  }

  async function sendTest() {
    const mobile = normalizeMobile(ownerMobile)
    if (!mobile) return notify('error', t('ownerMobileNeeded'))
    const { error } = await supabase.from('sms_history').insert({ owner_id: userId, person_id: person.id, message: preview, status: 'test_opened', dedupe_key: `test|${person.id}|${Date.now()}` })
    if (error) return notify('error', error.message)
    reload()
    openComposer(mobile, preview)
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
        <small>{t('sampleValues')} · {info.length} {t('characters')} · {info.parts} {t('smsParts')}{info.unicode ? ` · ${t('unicodeNote')}` : ''}</small>
      </div>

      <div className="button-row">
        <button type="button" className="btn primary" onClick={save} disabled={busy}>{busy ? t('saving') : t('save')}</button>
        <button type="button" className="btn" onClick={sendTest}>{t('sendTest')}</button>
      </div>
      <p className="hint">{t('enableAfterPreview')}</p>
    </div>
  )
}

// The person's master ON/OFF switch (no reminders are ever offered for people whose switch is OFF)
function PersonSwitch({ t, person, reload, notify }) {
  const [on, setOn] = useState(person.sms_enabled)
  async function change(value) {
    setOn(value)
    const { error } = await supabase.from('people').update({ sms_enabled: value }).eq('id', person.id)
    if (error) {
      setOn(!value)
      notify('error', error.message)
    } else reload()
  }
  return <Switch checked={on} onChange={change} label={on ? t('smsOn') : t('smsOff')} />
}

export default function Reminders({ t, data, reload, notify, userId }) {
  const [open, setOpen] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const settings = data.settings
  const globalEnabled = settings ? settings.sms_enabled : true
  const people = useMemo(() => byId(data.people), [data.people])
  const today = todayIso()

  const queue = useMemo(
    () => buildReminderQueue({ today, people: data.people, reminders: data.reminders, loans: data.loans, entries: data.entries, payments: data.payments, tenancies: data.tenancies, properties: data.properties, dues: data.dues, smsHistory: data.smsHistory, globalEnabled }),
    [today, data, globalEnabled],
  )

  async function setGlobal(value) {
    const { error } = await supabase.from('user_settings').upsert({ owner_id: userId, sms_enabled: value }, { onConflict: 'owner_id' })
    if (error) notify('error', error.message)
    else reload()
  }

  async function sendSms(item) {
    if (!item.mobileOk) return notify('error', t('invalidMobile'))
    const { error } = await supabase.from('sms_history').insert({ owner_id: userId, person_id: item.personId, message: item.message, status: 'opened', dedupe_key: item.key })
    if (error) return notify(error.code === '23505' ? 'info' : 'error', error.code === '23505' ? t('alreadyHandled') : error.message)
    openComposer(item.mobile, item.message) // open at once, while the click is still fresh
    reload()
    return undefined
  }

  async function setStatus(historyId, status) {
    const { error } = await supabase.from('sms_history').update({ status }).eq('id', historyId)
    if (error) notify('error', error.message)
    else reload()
  }

  async function skip(item) {
    const { error } = await supabase.from('sms_history').insert({ owner_id: userId, person_id: item.personId, message: item.message, status: 'skipped', dedupe_key: item.key })
    if (error) notify('error', describeError(error))
    else reload()
  }

  async function copy(item) {
    const ok = await copyText(item.message)
    notify(ok ? 'success' : 'error', ok ? t('copied') : t('copyFailed'))
  }

  const ready = queue.filter((q) => q.status === 'ready')
  const handled = queue.filter((q) => q.status !== 'ready')

  return (
    <>
      <Card title={t('smsReminders')} right={<Switch checked={globalEnabled} onChange={setGlobal} label={globalEnabled ? t('smsOn') : t('smsOff')} />}>
        <Notice tone="info">{t('smsHowItWorks')}</Notice>
        {!globalEnabled && <Notice tone="warn">{t('smsGloballyOff')}</Notice>}
      </Card>

      <Card title={t('readyToSend')} right={<Pill tone="orange">{ready.length}</Pill>}>
        {ready.length === 0 ? (
          <Empty>{t('noReminders')}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('person')}</th><th>{t('type')}</th><th>{t('dueDate')}</th><th className="num">{t('amount')}</th><th>{t('message')}</th><th className="no-print">{t('actions')}</th></tr></thead>
              <tbody>
                {ready.map((item) => {
                  const info = smsInfo(item.message)
                  return (
                    <Fragment key={item.key}>
                      <tr>
                        <td>{item.personName}<br /><small>{item.mobileOk ? item.mobile : <span className="red">{t('invalidMobile')}</span>}</small></td>
                        <td>{t(`cat_${item.category}`)}<br /><Pill tone={item.stage === 'overdue' ? 'red' : item.stage === 'due' ? 'orange' : 'blue'}>{t(`stage_${item.stage}`)}</Pill></td>
                        <td>{ddmmyyyy(item.dueDate)}</td>
                        <td className="num orange">{rupees(item.amount)}</td>
                        <td><button type="button" className="link-button" onClick={() => setOpen(open === item.key ? null : item.key)}>{open === item.key ? t('hide') : t('preview')}</button> <small>({item.lang === 'te' ? 'తెలుగు' : 'English'} · {info.parts} {t('smsParts')})</small></td>
                        <td className="no-print">
                          <div className="button-row">
                            <button type="button" className="btn small primary" onClick={() => sendSms(item)} disabled={!item.mobileOk}>{t('openSms')}</button>
                            <button type="button" className="btn small" onClick={() => copy(item)}>{t('copy')}</button>
                            <button type="button" className="btn small" onClick={() => skip(item)}>{t('skip')}</button>
                          </div>
                        </td>
                      </tr>
                      {open === item.key && <tr><td colSpan={6}><p className="sms-text">{item.message}</p></td></tr>}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {handled.length > 0 && <p className="hint">{handled.length} {t('alreadyHandledCount')}</p>}
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
                  </div>
                  <PersonSwitch t={t} person={person} reload={reload} notify={notify} />
                  <button type="button" className="btn small" onClick={() => setExpanded(expanded === person.id ? null : person.id)}>{expanded === person.id ? t('hide') : t('settings')}</button>
                </div>
                {expanded === person.id && <PersonSettings t={t} person={person} reminders={data.reminders} userId={userId} ownerMobile={settings?.owner_mobile} notify={notify} reload={reload} />}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={t('smsHistory')} right={<button type="button" className="btn small no-print" onClick={() => downloadText('sms-history.csv', smsHistoryCsv(data.smsHistory, (id) => people.get(id)?.name ?? ''))}>{t('downloadCsv')}</button>}>
        {data.smsHistory.length === 0 ? <Empty>{t('noHistory')}</Empty> : (
          <div className="table-wrap">
            <table className="compact">
              <thead><tr><th>{t('date')}</th><th>{t('person')}</th><th>{t('status')}</th><th>{t('message')}</th><th className="no-print"></th></tr></thead>
              <tbody>
                {data.smsHistory.map((h) => (
                  <tr key={h.id}>
                    <td>{ddmmyyyy(h.created_at)}</td>
                    <td>{people.get(h.person_id)?.name}</td>
                    <td><Pill tone={STATUS_TONE[h.status] || 'gray'}>{t(`sms_${h.status}`)}</Pill></td>
                    <td className="sms-cell">{h.message}</td>
                    <td className="no-print">{h.status === 'opened' && <button type="button" className="btn small" onClick={() => setStatus(h.id, 'sent')}>{t('markSent')}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">{t('noDeliveryClaim')}</p>
      </Card>
    </>
  )
}
