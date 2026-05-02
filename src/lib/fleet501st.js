import { supabase } from '../supabaseClient'

const SESSION_PREFIX = 'gv_501st_unlock_'

function keyFor(profile) {
  return `${SESSION_PREFIX}${profile?.id || 'anon'}`
}

export function is501stUnlocked(profile) {
  if (!profile?.id) return false
  try {
    return sessionStorage.getItem(keyFor(profile)) === '1'
  } catch {
    return false
  }
}

export function unlock501st(profile) {
  if (!profile?.id) return
  try { sessionStorage.setItem(keyFor(profile), '1') } catch {}
}

export function lock501st(profile) {
  if (!profile?.id) return
  try { sessionStorage.removeItem(keyFor(profile)) } catch {}
}

export async function is501stChosen() {
  const { data, error } = await supabase.rpc('is_501st_chosen')
  if (error) return { error, chosen: false }
  return { error: null, chosen: !!data }
}

export async function verify501stPasscode(inputCode) {
  const code = String(inputCode || '').trim()
  if (!code) return { error: null, valid: false }
  const { data, error } = await supabase.rpc('verify_501st_passcode', { p_code: code })
  if (error) return { error, valid: false }
  return { error: null, valid: !!data }
}

export async function get501stCellMembers() {
  const { data, error } = await supabase.rpc('get_501st_cell_members')
  if (error) return { error, members: [] }
  return { error: null, members: data || [] }
}

