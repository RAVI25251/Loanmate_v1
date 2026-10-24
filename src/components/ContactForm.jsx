import { useState } from 'react'
import { Field } from './ui.jsx'
import { validateContact } from '../lib/contact.js'
import { describeError, rpc } from '../lib/api.js'

// Edit a person's name, mobile number and email address. Used for borrowers and for tenants.
export default function ContactForm({ t, y, person, notify, onSaved }) {
  const [name, setName] = useState(person.name ?? '')
  const [mobile, setMobile] = useState(person.mobile ?? '')
  const [email, setEmail] = useState(person.email ?? '')
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault()
    const check = validateContact({ name, mobile, email })
    if (!check.ok) {
      if (check.errors.name) return notify('error', y('nameNeeded'))
      if (check.errors.mobile) return notify('error', y('badMobileNum'))
      return notify('error', y('badEmailAddr'))
    }
    setBusy(true)
    try {
      await rpc('update_person_contact', { p_person: person.id, p_name: check.name, p_mobile: check.mobile, p_email: check.email })
      notify('success', y('contactSaved'))
      onSaved()
    } catch (err) {
      notify('error', describeError(err))
    }
    setBusy(false)
    return undefined
  }

  return (
    <form className="grid-form edit-panel" onSubmit={save} noValidate>
      <Field label={t('name')}><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label={t('mobile')} hint={y('mobileHint')}><input value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" placeholder="9876543210" /></Field>
      <Field label={y('emailAddress')} hint={y('emailHint')}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></Field>
      <div className="field full">
        <button type="submit" className="btn primary" disabled={busy}>{busy ? t('saving') : y('saveContact')}</button>
        <small className="hint-text">{y('contactSwitchNote')}</small>
      </div>
    </form>
  )
}
