import { supabase } from './supabase.js'

export function cleanError(message) {
  return String(message || 'Something went wrong').replace(/^DUPLICATE:\s*/, '')
}

// Calls a database function and throws a readable error.
export async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new Error(cleanError(error.message))
  return data
}

export function describeError(e) {
  return cleanError(e?.message || e)
}
