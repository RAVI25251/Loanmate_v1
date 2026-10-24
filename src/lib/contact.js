// Checks a person's contact details before they are saved. The database repeats the same checks.
import { isEmail, normalizeMobile } from './format.js'

/**
 * Returns { ok, errors, name, mobile, email }.
 *   mobile -> 10 digits (the +91, 91 or a leading 0 are removed), or null when empty
 *   email  -> lower case, or null when empty
 *   errors -> { name?, mobile?, email? } with the field that is wrong
 */
export function validateContact({ name, mobile, email }) {
  const errors = {}

  const cleanName = String(name ?? '').trim()
  if (!cleanName) errors.name = 'name'

  const rawMobile = String(mobile ?? '').trim()
  let cleanMobile = null
  if (rawMobile !== '') {
    cleanMobile = normalizeMobile(rawMobile)
    if (!cleanMobile) errors.mobile = 'mobile'
  }

  const rawEmail = String(email ?? '').trim().toLowerCase()
  let cleanEmail = null
  if (rawEmail !== '') {
    if (isEmail(rawEmail)) cleanEmail = rawEmail
    else errors.email = 'email'
  }

  return { ok: Object.keys(errors).length === 0, errors, name: cleanName, mobile: cleanMobile, email: cleanEmail }
}
