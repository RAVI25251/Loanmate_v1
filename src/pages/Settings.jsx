import { useEffect, useState } from 'react'
import { Card, Field, Notice, Pill, Switch } from '../components/ui.jsx'
import { ddmmyyyy, isEmail, normalizeMobile } from '../lib/format.js'
import { supabase } from '../lib/supabase.js'

export const SECTIONS = ['lent', 'borrowers', 'interest', 'borrowed', 'emis', 'rent_expected', 'rent_collected', 'rent_pending', 'payments_week', 'upcoming', 'monthly', 'overdue']
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const DEFAULTS = {
  language: 'en', sms_enabled: true, owner_mobile: '', report_email: '', weekly_report_enabled: false, report_day: 0,
  report_time: '08:00', report_timezone: 'Asia/Kolkata', report_language: 'en', attach_csv: false, report_sections: {},
}

export default function Settings({ t, data, reload, notify, userId, email, lang, setLang }) {
  const [s, setS] = useState({ ...DEFAULTS, ...(data.settings ?? {}) })
  const [busy, setBusy] = useState(false)
  const last = data.emailHistory[0]

  useEffect(() => {
    if (data.settings) setS({ ...DEFAULTS, ...data.settings, report_time: String(data.settings.report_time).slice(0, 5) })
  }, [data.settings])

  const set = (field, value) => setS((x) => ({ ...x, [field]: value }))
  const sectionOn = (key) => s.report_sections?.[key] !== false
  const setSection = (key, value) => set('report_sections', { ...s.report_sections, [key]: value })

  async function save(e) {
    e.preventDefault()
    if (s.report_email && !isEmail(s.report_email)) return notify('error', t('badEmail'))
    if (s.owner_mobile && !normalizeMobile(s.owner_mobile)) return notify('error', t('invalidMobile'))
    if (s.weekly_report_enabled && !s.report_email) return notify('error', t('emailRequired'))
    setBusy(true)
    const row = {
      owner_id: userId,
      language: lang,
      sms_enabled: s.sms_enabled,
      owner_mobile: s.owner_mobile || null,
      report_email: s.report_email ? s.report_email.trim().toLowerCase() : null,
      weekly_report_enabled: s.weekly_report_enabled,
      report_day: Number(s.report_day),
      report_time: `${String(s.report_time).slice(0, 5)}:00`,
      report_timezone: s.report_timezone || 'Asia/Kolkata',
      report_language: s.report_language,
      attach_csv: s.attach_csv,
      report_sections: s.report_sections ?? {},
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('user_settings').upsert(row, { onConflict: 'owner_id' })
    setBusy(false)
    if (error) return notify('error', error.message)
    notify('success', t('settingsSaved'))
    reload()
    return undefined
  }

  return (
    <form onSubmit={save}>
      <Card title={t('languageSettings')}>
        <div className="grid-form">
          <Field label={t('appLanguage')} hint={t('languageHint')}>
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="en">English</option>
              <option value="te">తెలుగు (Telugu)</option>
            </select>
          </Field>
          <Field label={t('accountEmail')}><input value={email} disabled /></Field>
        </div>
      </Card>

      <Card title={t('smsSettings')}>
        <div className="grid-form">
          <div className="field"><Switch checked={s.sms_enabled} onChange={(v) => set('sms_enabled', v)} label={s.sms_enabled ? t('smsOn') : t('smsOff')} /><small className="hint-text">{t('smsGlobalHint')}</small></div>
          <Field label={t('myMobile')} hint={t('myMobileHint')}><input value={s.owner_mobile ?? ''} onChange={(e) => set('owner_mobile', e.target.value)} inputMode="tel" /></Field>
        </div>
      </Card>

      <Card title={t('weeklyEmail')} right={<Switch checked={s.weekly_report_enabled} onChange={(v) => set('weekly_report_enabled', v)} label={s.weekly_report_enabled ? t('on') : t('off')} />}>
        <Notice tone="info">{t('emailOnlyToMe')}</Notice>
        <div className="grid-form">
          <Field label={t('myEmail')}><input type="email" value={s.report_email ?? ''} onChange={(e) => set('report_email', e.target.value)} placeholder="you@example.com" /></Field>
          <Field label={t('reportLanguage')}>
            <select value={s.report_language} onChange={(e) => set('report_language', e.target.value)}>
              <option value="en">English</option>
              <option value="te">తెలుగు (Telugu)</option>
            </select>
          </Field>
          <Field label={t('deliveryDay')}>
            <select value={s.report_day} onChange={(e) => set('report_day', e.target.value)}>
              {DAYS.map((d, i) => <option key={d} value={i}>{t(`day_${d}`)}</option>)}
            </select>
          </Field>
          <Field label={t('deliveryTime')} hint={t('deliveryTimeHint')}><input type="time" value={String(s.report_time).slice(0, 5)} onChange={(e) => set('report_time', e.target.value)} /></Field>
          <Field label={t('timezone')}>
            <select value={s.report_timezone} onChange={(e) => set('report_timezone', e.target.value)}>
              <option value="Asia/Kolkata">India (IST) — Asia/Kolkata</option>
              <option value="Asia/Dubai">Dubai — Asia/Dubai</option>
              <option value="Asia/Singapore">Singapore — Asia/Singapore</option>
              <option value="Europe/London">London — Europe/London</option>
              <option value="America/New_York">New York — America/New_York</option>
              <option value="UTC">UTC</option>
            </select>
          </Field>
          <div className="field"><Switch checked={s.attach_csv} onChange={(v) => set('attach_csv', v)} label={t('attachCsv')} /><small className="hint-text">{t('attachHint')}</small></div>
        </div>

        <h3 className="sub-heading">{t('includeSections')}</h3>
        <div className="section-grid">
          {SECTIONS.map((k, i) => <Switch key={k} checked={sectionOn(k)} onChange={(v) => setSection(k, v)} label={`${i + 1}. ${t(`s_${k}`)}`} />)}
        </div>

        <div className="status-box">
          <strong>{t('deliveryStatus')}</strong>
          <ul className="plain-list">
            <li>{t('chk_email')}: {data.settings?.report_email ? <Pill tone="green">{t('done')}</Pill> : <Pill tone="orange">{t('pending')}</Pill>}</li>
            <li>{t('chk_enabled')}: {data.settings?.weekly_report_enabled ? <Pill tone="green">{t('on')}</Pill> : <Pill tone="orange">{t('off')}</Pill>}</li>
            <li>{t('lastEmail')}: {last ? <><Pill tone={last.status === 'accepted' ? 'green' : last.status === 'failed' ? 'red' : 'gray'}>{t(`email_${last.status}`)}</Pill> {ddmmyyyy(last.created_at)} {last.failure_details ? <small className="red">— {last.failure_details}</small> : null}</> : <Pill tone="orange">{t('neverSent')}</Pill>}</li>
          </ul>
          <small className="hint-text">{t('acceptedNotDelivered')}</small>
        </div>
      </Card>

      <div className="save-bar">
        <button type="submit" className="btn primary" disabled={busy}>{busy ? t('saving') : t('saveSettings')}</button>
      </div>
    </form>
  )
}
