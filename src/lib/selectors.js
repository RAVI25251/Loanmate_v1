// Small helpers that read the loaded data.
import { accruedInterest, monthlyInterest } from './finance.js'
import { daysBetween, toPaise } from './format.js'

export const byId = (rows) => new Map(rows.map((r) => [r.id, r]))

// The month window that is running today (or the last one, if the loan is settled)
export function latestEntry(entries, loanId) {
  let best = null
  for (const e of entries) if (e.loan_id === loanId && (!best || e.period_start > best.period_start)) best = e
  return best
}

// When the running month completes and how much interest will be added then
export function nextInterest(entry) {
  if (!entry) return null
  const amount = entry.closing_principal_paise === 0 ? 0 : monthlyInterest(entry.opening_principal_paise, entry.annual_rate_bp)
  return { date: entry.period_end, amount }
}

/**
 * The interest position of one loan today:
 *   pending  = interest due (added at completed months, minus interest received)
 *   days     = running days since the last due date
 *   accrued  = interest for those days (monthly interest / 30 per day) - shown, not added, not payable yet, not overdue
 *   total    = pending + accrued  (total outstanding interest)
 */
export function interestPosition(entry, today) {
  if (!entry) return { pending: 0, days: 0, accrued: 0, total: 0, lastDueDate: null }
  const settled = entry.closing_principal_paise === 0
  const days = settled ? 0 : Math.max(0, daysBetween(entry.period_start, today))
  const accrued = settled ? 0 : accruedInterest(entry.opening_principal_paise, entry.annual_rate_bp, days)
  return { pending: entry.closing_pending_paise, days, accrued, total: entry.closing_pending_paise + accrued, lastDueDate: entry.period_start }
}

// Everything added since the loan date (completed months) and everything received
export function interestTotals(entries, loanId, today) {
  let added = 0
  let received = 0
  for (const e of entries) {
    if (e.loan_id !== loanId || e.period_start > today) continue
    added += e.current_interest_paise
    received += e.interest_received_paise
  }
  return { added, received }
}

export function latestDue(dues, tenancyId, upToPeriod) {
  let best = null
  for (const d of dues) {
    if (d.tenancy_id !== tenancyId) continue
    if (upToPeriod && d.period_key > upToPeriod) continue
    if (!best || d.period_key > best.period_key) best = d
  }
  return best
}

export function hasPrincipalPayments(payments, loanId) {
  return payments.some((p) => p.loan_id === loanId && !p.voided_at && p.payment_type === 'principal')
}

/**
 * What a principal payment will do, before it is saved.
 *   mode 'part'   = pay some or all of the principal
 *   mode 'settle' = pay ALL the principal and ALL the interest due, closing the loan
 */
export function principalPlan({ mode, amountText, outstanding, pending, date, entries }) {
  const principal = mode === 'settle' ? outstanding : toPaise(amountText)
  const interest = mode === 'settle' ? pending : 0
  const valid = principal !== null && principal > 0 && principal <= outstanding
  const after = valid ? outstanding - principal : null
  const win = entries.find((e) => e.period_start <= date && date < e.period_end)
  return {
    valid, principal, interest, after,
    lowerFrom: valid && after > 0 && win ? win.period_end : null,
    closesLoan: valid && mode === 'settle',
    staysOpenForInterest: valid && mode === 'part' && after === 0 && pending > 0,
  }
}
