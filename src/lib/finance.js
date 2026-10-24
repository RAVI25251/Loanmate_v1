// Reference implementation of the interest and rent rules.
// The database functions follow the same rules. Everything is in whole paise.
//
// INTEREST: annual rate, months counted from the loan date, interest added only when a month completes.
// Interest for the running days (since the last due date) is shown as "accrued" = monthly interest / 30 per day.
import { addMonthsToDate } from './format.js'

// Monthly interest = principal x annual rate / 12   (rate in basis points: 18% = 1800), rounded half up
export function monthlyInterest(principalPaise, annualBp) {
  return Number((BigInt(principalPaise) * BigInt(annualBp) + 60000n) / 120000n)
}

// Interest for the running days: monthly interest / 30 x days since the last due date, rounded half up,
// never more than one month's interest. Display only: it is not added to the ledger until the month completes.
export function accruedInterest(openingPaise, annualBp, daysElapsed) {
  const monthly = BigInt(monthlyInterest(openingPaise, annualBp))
  const days = BigInt(Math.max(0, Math.floor(daysElapsed)))
  const raw = (monthly * days + 15n) / 30n
  return Number(raw > monthly ? monthly : raw)
}

/**
 * payments:    [{ date: 'YYYY-MM-DD', type: 'interest' | 'principal', amount }]
 * rateChanges: [{ fromDate, annualBp }] in the order they were made.
 * Returns one row per month window from the loan date up to the month running on asOf.
 */
export function buildInterestLedger({ openingPrincipal, annualBp, startDate, asOf, payments = [], rateChanges = [] }) {
  const rows = []
  let opening = openingPrincipal
  let previousPending = 0
  for (let k = 1; k <= 1200; k += 1) {
    const periodStart = addMonthsToDate(startDate, k - 1)
    const periodEnd = addMonthsToDate(startDate, k)
    if (periodStart > asOf) break
    const complete = periodEnd <= asOf

    let rate = annualBp
    for (const change of rateChanges) if (periodEnd >= change.fromDate) rate = change.annualBp

    const inWindow = (p) => p.date >= periodStart && p.date < periodEnd && p.date <= asOf
    const received = payments.filter((p) => p.type === 'interest' && inWindow(p)).reduce((s, p) => s + p.amount, 0)
    const repaid = payments.filter((p) => p.type === 'principal' && inWindow(p)).reduce((s, p) => s + p.amount, 0)
    if (received > previousPending) throw new Error(`Interest paid for the month starting ${periodStart} is more than the interest added so far`)
    if (repaid > opening) throw new Error(`Principal repaid for the month starting ${periodStart} is more than the principal outstanding`)

    const current = complete && repaid < opening ? monthlyInterest(opening, rate) : 0
    const closingPending = previousPending + current - received
    const closingPrincipal = opening - repaid
    rows.push({
      periodKey: periodEnd.slice(0, 7), periodStart, periodEnd, complete, annualBp: rate, opening, previousPending,
      currentInterest: current, interestReceived: received, principalRepaid: repaid, closingPending, closingPrincipal,
      totalReceivable: closingPrincipal + closingPending,
    })
    previousPending = closingPending
    opening = closingPrincipal
    if (closingPrincipal === 0 && closingPending === 0) break
  }
  return rows
}

function nextPeriod(p) {
  const [y, m] = p.split('-').map(Number)
  const idx = y * 12 + m
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`
}

/** RENT (calendar months). payments: [{ period, amount }] applied to a rent month. */
export function buildRentLedger({ startPeriod, throughPeriod, rentPaise, maintenancePaise = 0, payments = [] }) {
  const rows = []
  let prev = 0
  for (let p = startPeriod; p <= throughPeriod; p = nextPeriod(p)) {
    const paid = payments.filter((x) => x.period === p).reduce((s, x) => s + x.amount, 0)
    const total = prev + rentPaise + maintenancePaise
    if (paid > total) throw new Error(`Rent paid for ${p} is more than the rent outstanding`)
    const closing = total - paid
    rows.push({ period: p, rent: rentPaise, maintenance: maintenancePaise, previousArrears: prev, paid, closingArrears: closing, status: closing === 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid' })
    prev = closing
  }
  return rows
}
