import { useMemo } from 'react'
import { Card, Empty, Notice, Pill, Stat } from '../components/ui.jsx'
import { ddmmyyyy, rupees } from '../lib/format.js'
import { makeX } from '../lib/textV4.js'

const CAT = { interest: 'catInterest', emi: 'catEmi', rent: 'catRent' }

function Row({ t, item }) {
  return (
    <tr>
      <td>{item.person}</td>
      <td>{t(CAT[item.category] || 'catInterest')}{item.label ? ` · ${item.label}` : ''}</td>
      <td>{ddmmyyyy(item.due_date)}</td>
      <td className="num orange">{rupees(item.amount)}</td>
    </tr>
  )
}

export default function Dashboard({ t, lang, data, go }) {
  const x = useMemo(() => makeX(lang), [lang])
  const r = data.report

  const actions = (
    <div className="button-row no-print">
      <button type="button" className="btn primary" onClick={() => go('loans')}>{t('addLoan')}</button>
      <button type="button" className="btn" onClick={() => go('loans')}>{x('payPrincipal')}</button>
      <button type="button" className="btn" onClick={() => go('rent', { rentKind: 'house', openForm: true })}>{t('addTenant')}</button>
      <button type="button" className="btn" onClick={() => go('rent', { rentKind: 'shop', openForm: true })}>{t('addShopTenant')}</button>
      <button type="button" className="btn" onClick={() => go('payments')}>{t('recordPayment')}</button>
      <button type="button" className="btn" onClick={() => go('loans')}>{t('viewInterest')}</button>
      <button type="button" className="btn" onClick={() => go('reminders')}>{t('sendReminder')}</button>
    </div>
  )

  if (!r) {
    return (
      <>
        {actions}
        <Notice tone="warn">{t('dashboardUnavailable')}</Notice>
      </>
    )
  }

  const rentPending = r.rent_pending.house_total + r.rent_pending.shop_total
  const rentCollected = r.rent_collected.house_total + r.rent_collected.shop_total
  const borrowedTotal = r.borrowed.borrowed_principal + r.borrowed.bank_principal
  const overdueRows = [
    ...r.borrowers.filter((b) => b.overdue_interest > 0 && b.emi === 0).map((b) => ({ key: `i${b.loan_id}`, person: b.person, label: t('overdueInterest'), amount: b.overdue_interest })),
    ...r.emis.overdue.filter((e) => e.direction === 'receive').map((e) => ({ key: `e${e.loan_id}`, person: e.person, label: `${t('catEmi')} · ${ddmmyyyy(e.due_date)}`, amount: e.amount })),
    ...['house', 'shop'].flatMap((k) =>
      r.rent_pending[k].map((e) => ({ key: `r${k}${e.property}${e.tenant}`, person: e.tenant, label: `${t(k === 'house' ? 'houseRent' : 'shopRent')} · ${e.property} (${e.months_overdue} ${t('months')})`, amount: e.closing_arrears })),
    ),
  ]

  return (
    <>
      {actions}

      <div className="stat-grid">
        <Stat label={t('principalLent')} value={rupees(r.lent.total_principal_lent)} sub={`${t('outstanding')}: ${rupees(r.lent.principal_outstanding)}`} />
        <Stat label={x('interestDue')} value={rupees(r.interest.outstanding)} tone="orange" sub={`${x('interestAddedTotal')}: ${rupees(r.interest.added_total)} · ${x('interestReceivedTotal')}: ${rupees(r.interest.received_total)}`} />
        <Stat label={x('totalOutstandingInterest')} value={rupees(r.interest.total_outstanding)} tone="red" sub={`${rupees(r.interest.outstanding)} + ${x('accruedShort')} ${rupees(r.interest.accrued)}`} />
        <Stat label={t('borrowedAndBank')} value={rupees(borrowedTotal)} sub={`${t('borrowed')}: ${rupees(r.borrowed.borrowed_principal)} · ${t('bankLoans')}: ${rupees(r.borrowed.bank_principal)}`} />
        <Stat label={t('overdueTotal')} value={rupees(r.overdue.total)} tone="red" sub={`${t('overdueInterest')} ${rupees(r.overdue.interest)} · EMI ${rupees(r.overdue.emi)} · ${t('rent')} ${rupees(r.overdue.rent)}`} />
        <Stat label={t('interestPayable')} value={rupees(r.borrowed.interest_payable)} sub={`${x('accruedShort')}: ${rupees(r.borrowed.accrued_interest)}`} />
        <Stat label={t('houseRentExpected')} value={rupees(r.rent_expected.house_total)} sub={t('perMonth')} />
        <Stat label={t('shopRentExpected')} value={rupees(r.rent_expected.shop_total)} sub={t('perMonth')} />
        <Stat label={t('rentCollectedWeek')} value={rupees(rentCollected)} tone="green" sub={`${t('houseRent')} ${rupees(r.rent_collected.house_total)} · ${t('shopRent')} ${rupees(r.rent_collected.shop_total)}`} />
        <Stat label={t('rentPending')} value={rupees(rentPending)} tone="red" sub={t('includesArrears')} />
        <Stat label={t('collectionsThisWeek')} value={rupees(r.upcoming.collections_total)} tone="orange" sub={t('next7Days')} />
        <Stat label={t('monthlyIncome')} value={rupees(r.monthly.income)} tone="green" sub={`${t('interest')} ${rupees(r.monthly.interest_income)} · ${t('rent')} ${rupees(r.monthly.rent_income)}`} />
        <Stat label={t('monthlyExpenses')} value={rupees(r.monthly.expenses)} sub={`${t('interest')} ${rupees(r.monthly.interest_paid)} · ${t('repayments')} ${rupees(r.monthly.principal_repaid)}`} />
        <Stat label={t('monthlyCollections')} value={rupees(r.monthly.principal_collected)} tone="green" sub={`${t('netIncome')}: ${rupees(r.monthly.net_income)}`} />
      </div>
      <p className="hint">{x('accruedNote')}</p>

      <div className="two-col">
        <Card title={t('upcomingCollections')} right={<Pill tone="orange">{t('next7Days')}</Pill>}>
          {r.upcoming.collections.length === 0 ? (
            <Empty>{t('nothingUpcoming')}</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>{t('person')}</th><th>{t('type')}</th><th>{t('dueDate')}</th><th className="num">{t('amount')}</th></tr></thead>
                <tbody>{r.upcoming.collections.map((e, i) => <Row key={i} t={t} item={e} />)}</tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title={t('upcomingPayments')} right={<Pill tone="orange">{t('next7Days')}</Pill>}>
          {r.upcoming.payments.length === 0 ? (
            <Empty>{t('nothingUpcoming')}</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>{t('person')}</th><th>{t('type')}</th><th>{t('dueDate')}</th><th className="num">{t('amount')}</th></tr></thead>
                <tbody>{r.upcoming.payments.map((e, i) => <Row key={i} t={t} item={e} />)}</tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card title={t('overdueAndArrears')} right={<Pill tone="red">{rupees(r.overdue.total)}</Pill>}>
        {overdueRows.length === 0 ? (
          <Empty>{t('nothingOverdue')}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('person')}</th><th>{t('details')}</th><th className="num">{t('amount')}</th></tr></thead>
              <tbody>
                {overdueRows.map((e) => (
                  <tr key={e.key}><td>{e.person}</td><td>{e.label}</td><td className="num red">{rupees(e.amount)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(r.vacant_properties.length > 0 || r.leases_ending.length > 0) && (
        <div className="two-col">
          <Card title={t('vacantProperties')}>
            {r.vacant_properties.length === 0 ? <Empty>{t('none')}</Empty> : (
              <ul className="plain-list">{r.vacant_properties.map((v, i) => <li key={i}>{v.property}{v.unit ? ` (${v.unit})` : ''} <Pill tone="blue">{t(v.kind === 'shop' ? 'shopRent' : 'houseRent')}</Pill></li>)}</ul>
            )}
          </Card>
          <Card title={t('leasesEnding')}>
            {r.leases_ending.length === 0 ? <Empty>{t('none')}</Empty> : (
              <ul className="plain-list">{r.leases_ending.map((v, i) => <li key={i}>{v.tenant} · {v.property} — {ddmmyyyy(v.end_date)}</li>)}</ul>
            )}
          </Card>
        </div>
      )}
    </>
  )
}
