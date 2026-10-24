// Money, dates and phone numbers. Money is always whole paise (integers): no rounding errors.

export function toPaise(value) {
  const clean = String(value ?? '').trim().replace(/,/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null
  const [whole, fraction = ''] = clean.split('.')
  return Number(whole) * 100 + Number((fraction + '00').slice(0, 2))
}

// "18" -> 1800 basis points, "10.5" -> 1050, "" -> 0. Returns null when invalid.
export function percentToBp(value) {
  const clean = String(value ?? '').trim()
  if (clean === '') return 0
  return toPaise(clean)
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const rupees = (paise) => inr.format((Number(paise) || 0) / 100)

// For SMS text: "₹50,000" or "₹50,000.50"
export function rupeesPlain(paise) {
  const p = Math.round(Number(paise) || 0)
  const whole = p % 100 === 0
  const f = new Intl.NumberFormat('en-IN', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })
  return '₹' + f.format(p / 100)
}

export function ddmmyyyy(value) {
  if (!value) return ''
  const [y, m, d] = String(value).slice(0, 10).split('-')
  return `${d}-${m}-${y}`
}

const pad = (n) => String(n).padStart(2, '0')

export function todayIso(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export const currentPeriod = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

export function addMonths(period, n) {
  const [y, m] = period.split('-').map(Number)
  const idx = y * 12 + (m - 1) + n
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`
}
export function daysInMonth(period) {
  const [y, m] = period.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}
// Due date of a month, clamped to the month length (31st -> 28th in February)
export function dueDateFor(period, day) {
  return `${period}-${pad(Math.min(Number(day), daysInMonth(period)))}`
}
// Add whole months to a date, keeping the day where possible: 31-01 + 1 month = 28-02, 31-01 + 2 months = 31-03
export function addMonthsToDate(iso, n) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  const idx = y * 12 + (m - 1) + n
  const ny = Math.floor(idx / 12)
  const nm = (idx % 12) + 1
  const dim = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  return `${ny}-${pad(nm)}-${pad(Math.min(d, dim))}`
}
export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
export function daysBetween(fromIso, toIso) {
  const a = fromIso.split('-').map(Number)
  const b = toIso.split('-').map(Number)
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000)
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_TE = ['జనవరి', 'ఫిబ్రవరి', 'మార్చి', 'ఏప్రిల్', 'మే', 'జూన్', 'జూలై', 'ఆగస్టు', 'సెప్టెంబర్', 'అక్టోబర్', 'నవంబర్', 'డిసెంబర్']
export function periodLabel(period, lang = 'en') {
  const [y, m] = period.split('-').map(Number)
  return `${(lang === 'te' ? MONTHS_TE : MONTHS_EN)[m - 1]} ${y}`
}

// Indian mobile numbers: 10 digits starting 6-9 (accepts +91, 91 or a leading 0)
export function normalizeMobile(raw) {
  let n = String(raw ?? '').replace(/\D/g, '')
  if (n.length === 12 && n.startsWith('91')) n = n.slice(2)
  else if (n.length === 11 && n.startsWith('0')) n = n.slice(1)
  return /^[6-9]\d{9}$/.test(n) ? n : null
}
export const toE164 = (raw) => {
  const n = normalizeMobile(raw)
  return n ? `+91${n}` : null
}
export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim())
