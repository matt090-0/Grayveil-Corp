import { supabase } from '../supabaseClient'

const KEY_MEMBERS = 'fleet_501st_members'
const KEY_PASSCODES = 'fleet_501st_passcodes'
const SESSION_PREFIX = 'gv_501st_unlock_'
const FALLBACK_CODES = ['501ST']

function normalizeCode(value) {
  return String(value || '').trim()
}

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

export async function get501stConfig() {
  const { data, error } = await supabase
    .from('org_settings')
    .select('key, value')
    .in('key', [KEY_MEMBERS, KEY_PASSCODES])

  if (error) return { error, config: null }

  const byKey = Object.fromEntries((data || []).map(r => [r.key, r.value || {}]))
  const members = byKey[KEY_MEMBERS] || {}
  const passcodes = byKey[KEY_PASSCODES] || {}
  const config = {
    memberIds: new Set(members.member_ids || []),
    handles: new Set((members.handles || []).map(h => String(h || '').toLowerCase())),
    allowFounders: members.allow_founders !== false,
    globalCodes: (passcodes.codes || []).map(normalizeCode).filter(Boolean),
    memberCodesById: passcodes.member_codes_by_id || {},
    memberCodesByHandle: Object.fromEntries(
      Object.entries(passcodes.member_codes_by_handle || {}).map(([k, v]) => [k.toLowerCase(), normalizeCode(v)]),
    ),
  }
  return { error: null, config }
}

export function is501stChosen(profile, config) {
  if (!profile || !config) return false
  if (profile.is_founder && config.allowFounders) return true
  if (config.memberIds.has(profile.id)) return true
  if (config.handles.has(String(profile.handle || '').toLowerCase())) return true
  return false
}

export function verify501stPasscode(profile, config, inputCode) {
  if (!profile || !config) return false
  const input = normalizeCode(inputCode)
  if (!input) return false

  const byId = normalizeCode(config.memberCodesById?.[profile.id])
  if (byId) return byId === input

  const byHandle = normalizeCode(config.memberCodesByHandle?.[String(profile.handle || '').toLowerCase()])
  if (byHandle) return byHandle === input

  const allowed = (config.globalCodes?.length ? config.globalCodes : FALLBACK_CODES).map(normalizeCode)
  return allowed.includes(input)
}

