// Email reminders. The app opens YOUR email program with the message already written; you press Send.
// (A website cannot send email by itself without a paid sending service, and it cannot know if it was delivered.)
import { ddmmyyyy, rupeesPlain } from './format.js'

const KIND = {
  en: { house_rent: 'House rent', shop_rent: 'Shop rent', loan: 'Payment', interest: 'Interest' },
  te: { house_rent: 'ఇంటి అద్దె', shop_rent: 'షాపు అద్దె', loan: 'చెల్లింపు', interest: 'వడ్డీ' },
}

export function buildEmailSubject({ lang = 'en', category = 'loan', amount, dueDate, overdue = false }) {
  const A = rupeesPlain(amount)
  const D = ddmmyyyy(dueDate)
  const kind = (KIND[lang === 'te' ? 'te' : 'en'][category]) || KIND.en.loan
  if (lang === 'te') {
    return overdue ? `${kind} గడువు దాటింది: ${A} (${D} తేదీ)` : `${kind} రిమైండర్: ${A} (${D} తేదీ)`
  }
  return overdue ? `${kind} overdue: ${A} was due on ${D}` : `${kind} reminder: ${A} due on ${D}`
}

// A link that opens the email program: mailto:address?subject=...&body=...
export function mailtoLink(email, subject, body) {
  return `mailto:${String(email).trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
