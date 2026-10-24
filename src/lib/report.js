// CSV builders. A byte-order mark is added so Excel shows Telugu names correctly.
const money = (paise) => ((Number(paise) || 0) / 100).toFixed(2)

export function csvEscape(v) {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export function toCsv(headers, rows) {
  return '\uFEFF' + [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n')
}

// The whole weekly report as one flat table: Section, Item, Detail, Amount
export function weeklyReportCsv(report) {
  const rows = []
  const add = (section, item, detail, amount) => rows.push([section, item, detail ?? '', amount == null ? '' : money(amount)])
  const r = report
  add('1 Lent', 'Total principal lent', '', r.lent.total_principal_lent)
  add('1 Lent', 'Principal outstanding', '', r.lent.principal_outstanding)
  r.borrowers.forEach((b) => add('2 Borrowers', b.person, `principal ${money(b.principal_outstanding)}; interest due ${money(b.interest_pending)}; running days ${b.accrued_days} = ${money(b.accrued_interest)}; total outstanding interest ${money(b.total_outstanding_interest)}; next interest ${b.next_interest_date ?? ''}`, b.total_receivable))
  add('3 Interest', 'Interest added till today (completed months)', '', r.interest.added_total)
  add('3 Interest', 'Previous pending interest', '', r.interest.previous_pending)
  add('3 Interest', 'Current (latest completed) month interest', '', r.interest.current_interest)
  add('3 Interest', 'Interest received', '', r.interest.received)
  add('3 Interest', 'Interest due (outstanding)', '', r.interest.outstanding)
  add('3 Interest', 'Interest for running days (not yet added)', '', r.interest.accrued)
  add('3 Interest', 'Total outstanding interest incl. running days', '', r.interest.total_outstanding)
  add('4 Borrowed', 'Money borrowed', '', r.borrowed.borrowed_principal)
  add('4 Borrowed', 'Bank loans', '', r.borrowed.bank_principal)
  add('4 Borrowed', 'Interest payable', '', r.borrowed.interest_payable)
  add('4 Borrowed', 'Interest for running days (not yet added)', '', r.borrowed.accrued_interest)
  r.emis.upcoming.forEach((x) => add('5 EMI upcoming', x.person, `${x.direction} due ${x.due_date}`, x.amount))
  r.emis.overdue.forEach((x) => add('5 EMI overdue', x.person, `${x.direction} due ${x.due_date}`, x.amount))
  for (const k of ['house', 'shop']) r.rent_expected[k].forEach((x) => add(`6 ${k} rent expected`, `${x.property} ${x.unit ?? ''}`.trim(), x.tenant, x.monthly_total))
  r.rent_collected.items.forEach((x) => add(`7 Rent collected (${x.kind})`, x.tenant, `${x.property} on ${x.date}`, x.amount))
  for (const k of ['house', 'shop']) r.rent_pending[k].forEach((x) => add(`8 ${k} rent pending`, `${x.property} ${x.unit ?? ''}`.trim(), `${x.tenant}; previous arrears ${money(x.previous_arrears)}; ${x.months_overdue} month(s)`, x.closing_arrears))
  r.payments_week.received.forEach((x) => add('9 Received', x.person, `${x.type} on ${x.date}`, x.amount))
  r.payments_week.made.forEach((x) => add('9 Paid', x.person, `${x.type} on ${x.date}`, x.amount))
  r.upcoming.collections.forEach((x) => add('10 Upcoming collection', x.person, `${x.category} due ${x.due_date}`, x.amount))
  r.upcoming.payments.forEach((x) => add('10 Upcoming payment', x.person, `${x.category} due ${x.due_date}`, x.amount))
  add('11 Monthly', 'Income (interest + rent)', r.monthly.period, r.monthly.income)
  add('11 Monthly', 'Expenses (interest + repayments)', r.monthly.period, r.monthly.expenses)
  add('11 Monthly', 'Principal collected', r.monthly.period, r.monthly.principal_collected)
  add('11 Monthly', 'Net income', r.monthly.period, r.monthly.net_income)
  add('12 Overdue', 'Overdue interest', '', r.overdue.interest)
  add('12 Overdue', 'Overdue EMI', '', r.overdue.emi)
  add('12 Overdue', 'Overdue rent', '', r.overdue.rent)
  add('12 Overdue', 'TOTAL OVERDUE', '', r.overdue.total)
  return toCsv(['Section', 'Item', 'Detail', 'Amount (INR)'], rows)
}

// personName may be a text or a function (entry) => text, so one file can hold every loan
export function interestLedgerCsv(entries, personName = '') {
  const nameFor = typeof personName === 'function' ? personName : () => personName
  return toCsv(
    ['Person', 'Month starts', 'Month completes', 'Annual rate %', 'Opening principal', 'Previous pending interest', 'Interest added at completion', 'Interest received', 'Interest remaining', 'Principal repaid', 'Closing principal', 'Total receivable'],
    entries.map((e) => [nameFor(e), e.period_start, e.period_end, (e.annual_rate_bp / 100).toFixed(2), money(e.opening_principal_paise), money(e.previous_pending_paise), money(e.current_interest_paise), money(e.interest_received_paise), money(e.closing_pending_paise), money(e.principal_repaid_paise), money(e.closing_principal_paise), money(e.closing_principal_paise + e.closing_pending_paise)]),
  )
}

export function paymentsCsv(payments, nameOf) {
  return toCsv(
    ['Date', 'Person', 'Type', 'Amount', 'Method', 'Reference', 'Notes', 'Status', 'Void reason'],
    payments.map((p) => [p.payment_date, nameOf(p.person_id), p.payment_type, money(p.amount_paise), p.method, p.reference ?? '', p.notes ?? '', p.voided_at ? 'VOIDED' : 'active', p.void_reason ?? '']),
  )
}

export function rentCsv(rows) {
  return toCsv(
    ['Type', 'Property', 'Unit', 'Tenant', 'Month', 'Due date', 'Rent', 'Maintenance', 'Previous arrears', 'Paid', 'Closing arrears'],
    rows.map((r) => [r.kind, r.property, r.unit ?? '', r.tenant, r.period_key, r.due_date, money(r.rent_paise), money(r.maintenance_paise), money(r.previous_arrears_paise), money(r.paid_paise), money(r.closing_arrears_paise)]),
  )
}

export function liabilitiesCsv(loans, nameOf, latestEntry) {
  return toCsv(
    ['Lender', 'Type', 'Principal outstanding', 'Interest payable', 'EMI', 'Due day', 'Annual rate %'],
    loans.map((l) => [nameOf(l.person_id), l.kind, money(l.outstanding_principal_paise), money(latestEntry(l.id)?.closing_pending_paise ?? 0), money(l.emi_paise), l.due_day, (l.annual_rate_bp / 100).toFixed(2)]),
  )
}

export function smsHistoryCsv(rows, nameOf) {
  return toCsv(['Date', 'Person', 'Status', 'Message', 'Details'], rows.map((h) => [h.created_at, nameOf(h.person_id), h.status, h.message, h.failure_details ?? '']))
}

export function emailHistoryCsv(rows) {
  return toCsv(['Date', 'Recipient', 'Status', 'Subject', 'Details'], rows.map((h) => [h.created_at, h.recipient, h.status, h.subject ?? '', h.failure_details ?? '']))
}
