import { createClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()

export const supabaseReady = Boolean(url && key)

// Only the public URL and the publishable key are used here. Never put a secret / service_role key in the website.
export const supabase = supabaseReady
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null
