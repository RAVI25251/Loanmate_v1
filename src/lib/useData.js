import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { todayIso } from './format.js'

export const EMPTY = {
  people: [], loans: [], entries: [], properties: [], tenancies: [], dues: [],
  payments: [], reminders: [], smsHistory: [], emailHistory: [], settings: null, report: null,
}

// Loads everything for the signed-in owner. Missing months are generated first (safe to repeat).
export function useLoanMateData(session) {
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [problems, setProblems] = useState([])

  const reload = useCallback(async () => {
    if (!supabase || !session) return
    setLoading(true)
    const found = []

    const gen = await supabase.rpc('generate_ledgers')
    if (gen.error) found.push(`Setup needed: ${gen.error.message}`)
    else if (gen.data?.errors?.length) found.push(`Some ledgers need attention: ${gen.data.errors.map((x) => x.error).join('; ')}`)

    const [people, loans, entries, properties, tenancies, dues, payments, reminders, sms, emails, settings, report] = await Promise.all([
      supabase.from('people').select('*').order('name'),
      supabase.from('loans').select('*').eq('active', true).order('created_at', { ascending: false }),
      supabase.from('interest_entries').select('*').order('period_start'),
      supabase.from('properties').select('*').order('name'),
      supabase.from('tenancies').select('*'),
      supabase.from('rent_dues').select('*').order('period_key'),
      supabase.from('payments').select('*').order('payment_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('reminders').select('*'),
      supabase.from('sms_history').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('email_history').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('user_settings').select('*').maybeSingle(),
      supabase.rpc('my_weekly_report', { p_today: todayIso() }),
    ])

    for (const [name, res] of Object.entries({ people, loans, entries, properties, tenancies, dues, payments, reminders, sms, emails, settings })) {
      if (res.error) found.push(`${name}: ${res.error.message}`)
    }
    if (report.error) found.push(`report: ${report.error.message}`)

    setData({
      people: people.data ?? [],
      loans: loans.data ?? [],
      entries: entries.data ?? [],
      properties: properties.data ?? [],
      tenancies: tenancies.data ?? [],
      dues: dues.data ?? [],
      payments: payments.data ?? [],
      reminders: reminders.data ?? [],
      smsHistory: sms.data ?? [],
      emailHistory: emails.data ?? [],
      settings: settings.data ?? null,
      report: report.data ?? null,
    })
    setProblems(found)
    setLoading(false)
  }, [session])

  useEffect(() => {
    if (session) reload()
    else setData(EMPTY)
  }, [session, reload])

  return { data, reload, loading, problems }
}
