import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { RANKS, formatCredits } from '../lib/ranks'
import { SC_DIVISIONS } from '../lib/scdata'
import Modal from '../components/Modal'
import RankBadge from '../components/RankBadge'
import AccessDeniedScreen from '../components/AccessDeniedScreen'
import { discordAnnouncement, discordModeration, discordRecruitmentStatus, testDiscordWebhook } from '../lib/discord'
import { exportCSV } from '../lib/csv'
import { NAV, NAV_ITEMS, MAINT_BYPASS_TIER } from '../lib/nav'
import { notifyMaintenanceChange } from '../hooks/useMaintenanceMap'
import { notifyStatusBoardChange, DEFAULT_STATUS_BOARD, STATUS_COLORS, STATUS_BOARD_KEY } from '../hooks/useStatusBoard'
import { confirmAction, promptAction } from '../lib/dialogs'

const STRIKE_SUSPEND_THRESHOLD = 3
const STRIKE_BAN_THRESHOLD = 5
const AUTO_SUSPEND_DAYS = 7
const ADMIN_UNLOCK_WINDOW_MS = 10 * 60 * 1000
const REQUIRED_DISCORD_KEYS = [
  'discord_webhook_announcements',
  'discord_webhook_moderation',
  'discord_webhook_operations',
  'discord_webhook_kills',
  'discord_webhook_contracts',
  'discord_webhook_recruitment',
  'discord_webhook_promotions',
]
const FLEET_501ST_MEMBERS_DEFAULT = { allow_founders: true, member_ids: [], handles: [] }
const FLEET_501ST_PASSCODES_DEFAULT = {
  codes: [],
  member_codes_by_id: {},
  member_codes_by_handle: {},
  rotating: { enabled: false, period_seconds: 60, secret: '' },
}
const ADMIN_ACTION_PERMISSIONS = {
  admin_console: 'ADMIN CONSOLE',
  manage_members: 'MEMBERS',
  manage_discipline: 'DISCIPLINE',
  manage_finance: 'BANKING',
  manage_loans: 'LOANS',
  manage_funds: 'FUNDS',
  manage_comms: 'COMMS',
  manage_contracts: 'CONTRACTS',
  manage_discord: 'DISCORD',
  manage_maintenance: 'MAINTENANCE',
  view_audit: 'AUDIT LOG',
  manage_danger: 'DANGER ZONE',
  manage_control: 'CONTROL SETTINGS',
}
const DEFAULT_ROLE_PERMISSIONS = {
  command: ['admin_console', 'manage_members', 'manage_discipline', 'manage_finance', 'manage_loans', 'manage_funds', 'manage_comms', 'manage_contracts', 'manage_discord', 'manage_maintenance', 'view_audit'],
  officer: ['admin_console', 'manage_members', 'manage_discipline', 'manage_comms', 'manage_contracts', 'view_audit'],
  specialist: ['admin_console', 'manage_comms', 'view_audit'],
  auxiliary: [],
}
const ROLE_GROUPS = [
  { key: 'command', label: 'HIGH COMMAND', minTier: 1, maxTier: 2 },
  { key: 'officer', label: 'OFFICER CORPS', minTier: 3, maxTier: 4 },
  { key: 'specialist', label: 'SPECIALIST WINGS', minTier: 5, maxTier: 6 },
  { key: 'auxiliary', label: 'AUXILIARY POOL', minTier: 7, maxTier: 9 },
]
const DEFAULT_ADMIN_CONTROL = {
  incident_mode: false,
  incident_note: '',
  feature_flags: {
    roster_phase3: true,
    comms_uee_refit: true,
    admin_guardrails: true,
  },
  role_permissions: DEFAULT_ROLE_PERMISSIONS,
}

function roleFromTier(tier) {
  const group = ROLE_GROUPS.find(g => tier >= g.minTier && tier <= g.maxTier)
  return group?.key || 'auxiliary'
}

function normalizeAdminControl(value) {
  return {
    ...DEFAULT_ADMIN_CONTROL,
    ...(value || {}),
    feature_flags: {
      ...DEFAULT_ADMIN_CONTROL.feature_flags,
      ...((value && value.feature_flags) || {}),
    },
    role_permissions: {
      ...DEFAULT_ROLE_PERMISSIONS,
      ...((value && value.role_permissions) || {}),
    },
  }
}

function normalizeStringList(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(v => String(v || '').trim()).filter(Boolean))]
}

function randomCode(prefix = 'GV') {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 8; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return `${prefix}-${out.slice(0, 4)}-${out.slice(4)}`
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 10, letterSpacing: '.2em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--accent-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--accent)' }}>◆</span> {title}
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 18px' }}>
      <div style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: color || 'var(--text-1)' }}>{value}</div>
    </div>
  )
}

export default function Admin() {
  const { profile: me } = useAuth()
  const myRole = roleFromTier(me.tier)
  const [tab, setTab] = useState('overview')
  const [d, setD] = useState({ members: [], contracts: [], intelligence: [], ledger: [], recruitment: [], polls: [], announcements: [], log: [], transactions: [], loans: [], funds: [], budgets: [], blacklist: [], pending: [] })
  const [treasury, setTreasury] = useState(0)
  const [taxRate, setTaxRate] = useState(10)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [webhooks, setWebhooks] = useState({})
  const [webhookSaving, setWebhookSaving] = useState(false)
  const [maintMap, setMaintMap] = useState({})
  const [maintSaving, setMaintSaving] = useState(false)
  const [statusBoard, setStatusBoard] = useState(DEFAULT_STATUS_BOARD)
  const [statusBoardSaving, setStatusBoardSaving] = useState(false)
  const [adminControl, setAdminControl] = useState(DEFAULT_ADMIN_CONTROL)
  const [controlSaving, setControlSaving] = useState(false)
  const [adminUnlockedUntil, setAdminUnlockedUntil] = useState(0)
  const [auditQuery, setAuditQuery] = useState('')
  const [auditAction, setAuditAction] = useState('ALL')
  const [auditActor, setAuditActor] = useState('ALL')
  const [auditTargetType, setAuditTargetType] = useState('ALL')
  const [fleet501stMembers, setFleet501stMembers] = useState(FLEET_501ST_MEMBERS_DEFAULT)
  const [fleet501stPasscodes, setFleet501stPasscodes] = useState(FLEET_501ST_PASSCODES_DEFAULT)
  const [fleet501stSaving, setFleet501stSaving] = useState(false)
  const [fleet501stRotatingPreview, setFleet501stRotatingPreview] = useState(null)

  const hasPermission = useCallback((key) => {
    if (me.is_founder) return true
    const list = adminControl.role_permissions?.[myRole] || []
    return list.includes(key)
  }, [me.is_founder, adminControl.role_permissions, myRole])

  function flash(m) { setMsg(m); setTimeout(() => setMsg(''), 3000) }
  async function ensureElevatedUnlock(label) {
    if (me.is_founder) return true
    if (Date.now() < adminUnlockedUntil) return true
    const input = await promptAction(`Elevated action required for ${label}. Type ADMIN to continue:`)
    if (input !== 'ADMIN') {
      flash('Elevation check failed.')
      return false
    }
    setAdminUnlockedUntil(Date.now() + ADMIN_UNLOCK_WINDOW_MS)
    return true
  }
  async function saveAdminControl(next, message) {
    setControlSaving(true)
    const normalized = normalizeAdminControl(next)
    const { error } = await supabase
      .from('org_settings')
      .upsert({ key: 'admin_control', value: normalized, updated_by: me.id }, { onConflict: 'key' })
    setControlSaving(false)
    if (error) {
      flash(`Admin control save failed: ${error.message}`)
      return false
    }
    setAdminControl(normalized)
    if (message) flash(message)
    return true
  }

  const load = useCallback(async () => {
    const [
      { data: members }, { data: contracts }, { data: intelligence }, { data: ledger },
      { data: recruitment }, { data: polls }, { data: announcements }, { data: log },
      { data: txns }, { data: loans }, { data: funds }, { data: budgets },
      { data: blacklist },
      { data: pending },
      { data: tres }, { data: settings }, { data: controlRow },
    ] = await Promise.all([
      supabase.from('profiles').select('*').order('tier').order('handle'),
      supabase.from('contracts').select('*, posted_by:profiles(handle)').order('created_at', { ascending: false }),
      supabase.from('intelligence').select('*, posted_by:profiles(handle)').order('created_at', { ascending: false }),
      supabase.from('ledger').select('*, member:profiles!ledger_member_id_fkey(handle)').order('created_at', { ascending: false }),
      supabase.from('recruitment').select('*').order('created_at', { ascending: false }),
      supabase.from('polls').select('*, created_by:profiles(handle)').order('created_at', { ascending: false }),
      supabase.from('announcements').select('*, posted_by:profiles(handle)').order('created_at', { ascending: false }),
      supabase.from('activity_log').select('*, actor:profiles!activity_log_actor_id_fkey(handle)').order('created_at', { ascending: false }).limit(200),
      supabase.from('transactions').select('*, from_profile:profiles!transactions_from_id_fkey(handle), to_profile:profiles!transactions_to_id_fkey(handle)').order('created_at', { ascending: false }).limit(200),
      supabase.from('loans').select('*, borrower:profiles!loans_borrower_id_fkey(handle), approver:profiles!loans_approved_by_fkey(handle)').order('created_at', { ascending: false }),
      supabase.from('ship_funds').select('*').order('created_at', { ascending: false }),
      supabase.from('division_budgets').select('*').order('division'),
      supabase.from('blacklist').select('id, target_handle, status, created_at').order('created_at', { ascending: false }),
      supabase.from('pending_admin_actions').select('*, initiator:profiles!pending_admin_actions_initiated_by_fkey(handle), approver:profiles!pending_admin_actions_approved_by_fkey(handle)').order('initiated_at', { ascending: false }).limit(50),
      supabase.from('treasury').select('balance').eq('id', 1).single(),
      supabase.from('org_settings').select('value').eq('key', 'tax_rate').maybeSingle(),
      supabase.from('org_settings').select('value').eq('key', 'admin_control').maybeSingle(),
    ])
    setD({ members: members||[], contracts: contracts||[], intelligence: intelligence||[], ledger: ledger||[], recruitment: recruitment||[], polls: polls||[], announcements: announcements||[], log: log||[], transactions: txns||[], loans: loans||[], funds: funds||[], budgets: budgets||[], blacklist: blacklist||[], pending: pending||[] })
    setTreasury(tres?.balance || 0)
    if (settings?.value?.percent !== undefined) setTaxRate(settings.value.percent)
    setAdminControl(normalizeAdminControl(controlRow?.value))
    // Load Discord webhooks
    const { data: wh } = await supabase.from('org_settings').select('key, value').ilike('key', 'discord_%')
    const whMap = {}
    ;(wh || []).forEach(w => { whMap[w.key] = w.value?.url || '' })
    setWebhooks(whMap)
    // Load page maintenance map
    const { data: maintRow } = await supabase.from('org_settings').select('value').eq('key', 'page_maintenance').maybeSingle()
    setMaintMap(maintRow?.value || {})
    // Load landing status board (hero cells + recruitment-open flag)
    const { data: boardRow } = await supabase.from('org_settings').select('value').eq('key', STATUS_BOARD_KEY).maybeSingle()
    setStatusBoard({ ...DEFAULT_STATUS_BOARD, ...(boardRow?.value || {}) })
    if (me.is_founder) {
      const { data: fleetRows } = await supabase
        .from('org_settings')
        .select('key, value')
        .in('key', ['fleet_501st_members', 'fleet_501st_passcodes'])
      const membersRow = fleetRows?.find(r => r.key === 'fleet_501st_members')?.value || {}
      const passcodesRow = fleetRows?.find(r => r.key === 'fleet_501st_passcodes')?.value || {}
      setFleet501stMembers({
        allow_founders: membersRow.allow_founders !== false,
        member_ids: normalizeStringList(membersRow.member_ids),
        handles: normalizeStringList(membersRow.handles),
      })
      setFleet501stPasscodes({
        codes: normalizeStringList(passcodesRow.codes),
        member_codes_by_id: passcodesRow.member_codes_by_id || {},
        member_codes_by_handle: passcodesRow.member_codes_by_handle || {},
        rotating: {
          enabled: !!passcodesRow.rotating?.enabled,
          period_seconds: Number(passcodesRow.rotating?.period_seconds) || 60,
          secret: String(passcodesRow.rotating?.secret || ''),
        },
      })
    }
    setLoading(false)
  }, [me.is_founder])

  useEffect(() => { load() }, [load])

  async function logAction(action, targetId, details) {
    await supabase.from('activity_log').insert({ action, actor_id: me.id, target_id: targetId || null, details })
  }

  async function sendModerationAlert(action, member, reason, details = {}) {
    // Server-side RPC; webhook URL stays in the DB. Errors are captured by Sentry
    // inside the queue — we don't block the moderation flow on Discord delivery.
    await discordModeration(action, member.handle, reason, me.handle, details)
  }

  async function requestSensitiveAction({ actionType, label, payload = {}, reasonPrompt }) {
    const reason = await promptAction(reasonPrompt || `Reason for ${label}:`)
    if (!reason?.trim()) return 'failed'
    const trimmed = reason.trim()
    const { error } = await supabase.rpc('request_admin_action', {
      p_action_type: actionType,
      p_reason: trimmed,
      p_payload: payload,
    })
    if (error) {
      flash(`Request failed: ${error.message}`)
      return 'failed'
    }
    flash(`Approval request submitted: ${label}.`)
    await load()
    return 'queued'
  }

  async function save501stSettings() {
    if (!me.is_founder) { flash('Founder access required.'); return }
    if (!(await ensureElevatedUnlock('High Council access control update'))) return
    setFleet501stSaving(true)
    const selectedMembers = d.members.filter(m => fleet501stMembers.member_ids.includes(m.id))
    const nextMembers = {
      allow_founders: fleet501stMembers.allow_founders !== false,
      member_ids: normalizeStringList(fleet501stMembers.member_ids),
      handles: normalizeStringList(selectedMembers.map(m => m.handle)),
    }
    const nextPasscodes = {
      codes: normalizeStringList(fleet501stPasscodes.codes),
      member_codes_by_id: Object.fromEntries(
        Object.entries(fleet501stPasscodes.member_codes_by_id || {})
          .map(([id, code]) => [id, String(code || '').trim()])
          .filter(([, code]) => !!code),
      ),
      member_codes_by_handle: {},
      rotating: {
        enabled: !!fleet501stPasscodes.rotating?.enabled,
        period_seconds: Math.max(60, Math.min(3600, Number(fleet501stPasscodes.rotating?.period_seconds) || 60)),
        secret: String(fleet501stPasscodes.rotating?.secret || '').trim(),
      },
    }

    const [membersWrite, passcodesWrite] = await Promise.all([
      supabase.from('org_settings').upsert(
        { key: 'fleet_501st_members', value: nextMembers, updated_by: me.id },
        { onConflict: 'key' },
      ),
      supabase.from('org_settings').upsert(
        { key: 'fleet_501st_passcodes', value: nextPasscodes, updated_by: me.id },
        { onConflict: 'key' },
      ),
    ])
    setFleet501stSaving(false)
    if (membersWrite.error || passcodesWrite.error) {
      flash(`High Council save failed: ${membersWrite.error?.message || passcodesWrite.error?.message}`)
      return
    }
    setFleet501stMembers(nextMembers)
    setFleet501stPasscodes(nextPasscodes)
    flash('High Council access settings saved.')
  }

  async function previewRotatingCode() {
    if (!me.is_founder) return
    const { data, error } = await supabase.rpc('get_501st_rotating_code')
    if (error) {
      flash(`Rotating code unavailable: ${error.message}`)
      return
    }
    const row = Array.isArray(data) ? data[0] : data
    setFleet501stRotatingPreview(row || null)
  }

  // ── DISCIPLINARY ACTIONS ──
  async function disciplineMember(member, action) {
    if (!hasPermission('manage_discipline')) { flash('Missing permission: manage_discipline'); return }
    if (!member?.id) return
    if (member.is_founder && action !== 'WARN') { flash('Founder account cannot be disciplined from this panel.'); return }
    if ((action === 'SUSPEND' || action === 'BAN' || action === 'CLEAR') && !(await ensureElevatedUnlock(`discipline ${action}`))) return
    const reason = await promptAction(`${action} reason for ${member.handle}:`)
    if (!reason?.trim()) return

    if (action === 'WARN') {
      const newStrikeCount = (member.strike_count || 0) + 1
      const updates = { strike_count: newStrikeCount }
      let followupAction = 'discipline_warn'
      if (newStrikeCount >= STRIKE_BAN_THRESHOLD) {
        updates.status = 'BANNED'
        updates.status_reason = `Auto-ban at ${newStrikeCount} strikes — ${reason.trim()}`
        updates.suspended_until = null
        followupAction = 'discipline_auto_ban'
      } else if (newStrikeCount >= STRIKE_SUSPEND_THRESHOLD) {
        const suspendUntil = new Date(Date.now() + AUTO_SUSPEND_DAYS * 86400000).toISOString()
        updates.status = 'SUSPENDED'
        updates.suspended_until = suspendUntil
        updates.status_reason = `Auto-suspension at ${newStrikeCount} strikes — ${reason.trim()}`
        followupAction = 'discipline_auto_suspend'
      }
      const { error } = await supabase.from('profiles').update(updates).eq('id', member.id)
      if (error) { flash(`Warn failed: ${error.message}`); return }
      await logAction(followupAction, member.id, { handle: member.handle, reason: reason.trim(), strike_count: newStrikeCount })
      if (followupAction === 'discipline_auto_ban') {
        await supabase.from('blacklist').insert({
          target_handle: member.handle,
          category: 'KOS',
          threat_level: 'CRITICAL',
          reason: `AUTO BAN (STRIKES) — ${reason.trim()}`,
          status: 'ACTIVE',
          added_by: me.id,
        })
        await sendModerationAlert('AUTO BAN', member, reason.trim(), { strike_count: newStrikeCount })
        flash(`${member.handle} warned and auto-banned at ${newStrikeCount} strikes.`)
      } else if (followupAction === 'discipline_auto_suspend') {
        await sendModerationAlert('AUTO SUSPEND', member, reason.trim(), { strike_count: newStrikeCount, days: AUTO_SUSPEND_DAYS, suspended_until: updates.suspended_until })
        flash(`${member.handle} warned and auto-suspended at ${newStrikeCount} strikes.`)
      } else {
        await sendModerationAlert('WARN', member, reason.trim(), { strike_count: newStrikeCount })
        flash(`${member.handle} warned (strikes: ${newStrikeCount}).`)
      }
      load()
      return
    }

    if (action === 'SUSPEND') {
      const daysRaw = await promptAction('Suspend for how many days? (blank = indefinite)', '7')
      const days = parseInt(daysRaw)
      const suspendedUntil = Number.isFinite(days) && days > 0 ? new Date(Date.now() + (days * 86400000)).toISOString() : null
      const { error } = await supabase.from('profiles').update({ status: 'SUSPENDED', suspended_until: suspendedUntil, status_reason: reason.trim() }).eq('id', member.id)
      if (error) { flash(`Suspend failed: ${error.message}`); return }
      await logAction('discipline_suspend', member.id, { handle: member.handle, reason: reason.trim(), days: Number.isFinite(days) ? days : null, suspended_until: suspendedUntil })
      await sendModerationAlert('SUSPEND', member, reason.trim(), { days: Number.isFinite(days) ? days : null, suspended_until: suspendedUntil, strike_count: member.strike_count || 0 })
      flash(`${member.handle} suspended.`)
      load()
      return
    }

    if (action === 'BAN') {
      if (!(await confirmAction(`Ban ${member.handle}? This will remove access.`))) return
      const daysRaw = await promptAction('Ban for how many days? (blank = permanent)', '')
      const days = parseInt(daysRaw)
      const bannedUntil = Number.isFinite(days) && days > 0 ? new Date(Date.now() + (days * 86400000)).toISOString() : null
      await supabase.from('profiles').update({ status: 'BANNED', suspended_until: bannedUntil, status_reason: reason.trim() }).eq('id', member.id)
      await supabase.from('blacklist').insert({
        target_handle: member.handle,
        category: 'KOS',
        threat_level: 'HIGH',
        reason: `ORG BAN — ${reason.trim()}`,
        status: 'ACTIVE',
        added_by: me.id,
      })
      await logAction('discipline_ban', member.id, { handle: member.handle, reason: reason.trim(), days: Number.isFinite(days) ? days : null, suspended_until: bannedUntil })
      await sendModerationAlert('BAN', member, reason.trim(), { days: Number.isFinite(days) ? days : null, suspended_until: bannedUntil, strike_count: member.strike_count || 0 })
      flash(`${member.handle} banned${bannedUntil ? ` until ${new Date(bannedUntil).toLocaleDateString()}` : ' permanently'} and added to blacklist.`)
      load()
      return
    }

    if (action === 'CLEAR') {
      await supabase.from('profiles').update({ status: 'ACTIVE', suspended_until: null, status_reason: null }).eq('id', member.id)
      await logAction('discipline_clear', member.id, { handle: member.handle, reason: reason.trim() })
      await sendModerationAlert('CLEAR', member, reason.trim(), { strike_count: member.strike_count || 0 })
      flash(`${member.handle} restored to ACTIVE.`)
      load()
    }
  }

  async function resetStrikes(member) {
    if (!hasPermission('manage_discipline')) { flash('Missing permission: manage_discipline'); return }
    const reason = await promptAction(`Reason to reset strike count for ${member.handle}:`)
    if (!reason?.trim()) return
    const { error } = await supabase.from('profiles').update({ strike_count: 0 }).eq('id', member.id)
    if (error) { flash(`Reset failed: ${error.message}`); return }
    await logAction('discipline_reset_strikes', member.id, { handle: member.handle, reason: reason.trim() })
    await sendModerationAlert('RESET STRIKES', member, reason.trim(), { strike_count: 0 })
    flash(`${member.handle} strike count reset.`)
    load()
  }


  // ── MEMBER ACTIONS ──
  async function updateMember(id, updates) {
    if (!hasPermission('manage_members')) { flash('Missing permission: manage_members'); return }
    if (!(await ensureElevatedUnlock('member profile update'))) return
    const member = d.members.find(m => m.id === id)
    const label = `member update for ${member?.handle || 'member'}`
    await requestSensitiveAction({
      actionType: 'member_update',
      label,
      payload: { member_id: id, ...updates },
      reasonPrompt: `Reason for ${label}:`,
    })
    setModal(null)
  }
  async function deleteMember(m) {
    if (!hasPermission('manage_members')) { flash('Missing permission: manage_members'); return }
    if (!(await ensureElevatedUnlock('member deletion'))) return
    if (!(await confirmAction(`PERMANENTLY DELETE ${m.handle}? This is irreversible.`))) return
    await requestSensitiveAction({
      actionType: 'member_delete',
      label: `member delete for ${m.handle}`,
      payload: { member_id: m.id, handle: m.handle },
      reasonPrompt: `Reason for deleting ${m.handle}:`,
    })
  }
  async function adjustWallet(memberId, newBalance) {
    if (!hasPermission('manage_finance')) { flash('Missing permission: manage_finance'); return }
    if (!(await ensureElevatedUnlock('wallet adjustment'))) return
    const member = d.members.find(m => m.id === memberId)
    await requestSensitiveAction({
      actionType: 'member_wallet_adjust',
      label: `wallet adjust for ${member?.handle || 'member'}`,
      payload: { member_id: memberId, wallet_balance: newBalance },
      reasonPrompt: `Reason for wallet adjustment (${member?.handle || memberId}):`,
    })
  }

  // ── BANK ACTIONS ──
  async function setTreasuryBalance(newBal) {
    if (!hasPermission('manage_finance')) { flash('Missing permission: manage_finance'); return }
    if (!(await ensureElevatedUnlock('treasury update'))) return
    await requestSensitiveAction({
      actionType: 'set_treasury_balance',
      label: 'treasury balance change',
      payload: { balance: newBal },
      reasonPrompt: `Reason for setting treasury to ${formatCredits(newBal)}:`,
    })
  }
  async function saveTaxRate(pct) {
    if (!hasPermission('manage_finance')) { flash('Missing permission: manage_finance'); return }
    if (!(await ensureElevatedUnlock('tax change'))) return
    await requestSensitiveAction({
      actionType: 'set_tax_rate',
      label: 'tax rate change',
      payload: { percent: pct },
      reasonPrompt: `Reason for changing tax rate to ${pct}%:`,
    })
  }

  // ── LOAN ACTIONS ──
  async function approveLoan(loan) {
    if (!hasPermission('manage_loans')) { flash('Missing permission: manage_loans'); return }
    const borrower = d.members.find(m => m.id === loan.borrower_id)
    await supabase.from('loans').update({ status: 'ACTIVE', approved_by: me.id }).eq('id', loan.id)
    await supabase.from('treasury').update({ balance: treasury - loan.amount }).eq('id', 1)
    await supabase.from('profiles').update({ wallet_balance: (borrower?.wallet_balance || 0) + loan.amount }).eq('id', loan.borrower_id)
    await supabase.from('transactions').insert({ type: 'loan_out', from_type: 'treasury', to_type: 'wallet', to_id: loan.borrower_id, amount: loan.amount, description: `Loan: ${loan.reason}`, recorded_by: me.id })
    flash('Loan approved & disbursed.'); load()
  }
  async function denyLoan(id) { if (!hasPermission('manage_loans')) { flash('Missing permission: manage_loans'); return }; await supabase.from('loans').update({ status: 'DENIED', approved_by: me.id }).eq('id', id); flash('Loan denied.'); load() }
  async function forgiveLoan(id) { if (!hasPermission('manage_loans')) { flash('Missing permission: manage_loans'); return }; await supabase.from('loans').update({ status: 'REPAID', repaid: 0 }).eq('id', id); await logAction('admin_forgive_loan', id, {}); flash('Loan forgiven.'); load() }

  // ── FUND ACTIONS ──
  async function cancelFund(id) { if (!hasPermission('manage_funds')) { flash('Missing permission: manage_funds'); return }; await supabase.from('ship_funds').update({ status: 'CANCELLED' }).eq('id', id); flash('Fund cancelled.'); load() }
  async function completeFund(id) { if (!hasPermission('manage_funds')) { flash('Missing permission: manage_funds'); return }; await supabase.from('ship_funds').update({ status: 'COMPLETED' }).eq('id', id); flash('Fund marked complete.'); load() }

  // ── ANNOUNCEMENT ──
  async function postAnnouncement() {
    if (!hasPermission('manage_comms')) { flash('Missing permission: manage_comms'); return }
    if (!form.ann_title || !form.ann_content) return
    setSaving(true)
    await supabase.from('announcements').insert({ title: form.ann_title, content: form.ann_content, priority: form.ann_priority || 'ROUTINE', posted_by: me.id })
    await logAction('announcement_posted', null, { title: form.ann_title })
    discordAnnouncement(form.ann_title, form.ann_content, me.handle)
    setModal(null); setSaving(false); flash('Posted.'); load()
  }
  async function deleteAnnouncement(id) {
    if (!hasPermission('manage_comms')) { flash('Missing permission: manage_comms'); return }
    if (!(await confirmAction('Delete this announcement?'))) return
    await supabase.from('announcements').delete().eq('id', id); flash('Deleted.'); load()
  }

  // ── DANGER ZONE — DUAL APPROVE ──
  // Step 1: any founder REQUESTS the destructive action with a reason.
  // Step 2: a different founder (or the initiator after a 5-minute cool-off) APPROVES.
  // The actual delete/update runs server-side inside approve_admin_action().
  async function dangerAction(type) {
    if (!hasPermission('manage_danger')) { flash('Missing permission: manage_danger'); return }
    if (!(await ensureElevatedUnlock(`danger action: ${type}`))) return
    const labels = {
      purge_log: 'PURGE activity log', purge_txns: 'PURGE transactions',
      purge_contracts: 'PURGE all contracts', purge_intel: 'PURGE intelligence',
      purge_fleet: 'PURGE fleet data', purge_polls: 'PURGE all polls',
      purge_ledger: 'PURGE ledger', purge_loans: 'PURGE loans',
      purge_funds: 'PURGE ship funds', reset_wallets: 'RESET all wallets to 0',
      reset_treasury: 'RESET treasury to 0',
    }
    const label = labels[type] || type
    const reason = await promptAction(`Reason to request "${label}"?\n\nThis creates a pending request. Another founder must approve it (or you may self-approve after a 5-minute cool-off).`)
    if (!reason || reason.trim().length < 3) { if (reason !== null) flash('Reason must be at least 3 characters.'); return }
    const { error } = await supabase.rpc('request_admin_action', { p_action_type: type, p_reason: reason.trim() })
    if (error) { flash(`Request failed: ${error.message}`); return }
    flash(`Request submitted: ${label}. Awaiting approval.`)
    load()
  }

  async function approvePendingAction(row) {
    if (!hasPermission('manage_danger')) { flash('Missing permission: manage_danger'); return }
    const isSelf = row.initiated_by === me.id
    const ack = isSelf
      ? `Self-approve "${row.action_type}"?\n\nReason: ${row.reason}\n\nThis will execute the destructive action immediately.`
      : `Approve "${row.action_type}" requested by ${row.initiator?.handle || 'another founder'}?\n\nReason: ${row.reason}\n\nThis will execute the destructive action immediately.`
    if (!(await confirmAction(ack))) return
    const { data, error } = await supabase.rpc('approve_admin_action', { p_id: row.id })
    if (error) { flash(`Approve failed: ${error.message}`); return }
    flash(data || 'Action executed.')
    load()
  }

  async function cancelPendingAction(row) {
    if (!hasPermission('manage_danger')) { flash('Missing permission: manage_danger'); return }
    if (!(await confirmAction(`Cancel pending request "${row.action_type}"?`))) return
    const { error } = await supabase.rpc('cancel_admin_action', { p_id: row.id })
    if (error) { flash(`Cancel failed: ${error.message}`); return }
    flash('Request cancelled.')
    load()
  }

  // Stats
  const activeMembers = d.members.filter(m => m.status === 'ACTIVE').length
  const openContracts = d.contracts.filter(c => c.status === 'OPEN').length
  const totalWealth = d.members.reduce((s, m) => s + (m.wallet_balance || 0), 0) + treasury
  const pendingLoans = d.loans.filter(l => l.status === 'PENDING').length
  const activeLoans = d.loans.filter(l => l.status === 'ACTIVE')
  const outstandingDebt = activeLoans.reduce((s, l) => s + (l.amount - l.repaid), 0)
  const suspendedMembers = d.members.filter(m => m.status === 'SUSPENDED').length
  const bannedMembers = d.members.filter(m => m.status === 'BANNED').length
  const warningCount = d.log.filter(l => l.action.includes('discipline_') && l.action.includes('warn')).length

  const tabPermission = {
    overview: 'admin_console',
    approvals: 'admin_console',
    members: 'manage_members',
    discipline: 'manage_discipline',
    bank: 'manage_finance',
    loans: 'manage_loans',
    funds: 'manage_funds',
    comms: 'manage_comms',
    contracts: 'manage_contracts',
    discord: 'manage_discord',
    maintenance: 'manage_maintenance',
    status: 'manage_maintenance',
    log: 'view_audit',
    danger: 'manage_danger',
    control: 'manage_control',
  }
  const TAB_GROUPS = [
    { key: 'mission', label: 'MISSION CONTROL', tabs: ['overview'] },
    { key: 'queue', label: 'APPROVALS', tabs: ['approvals'] },
    { key: 'ops', label: 'OPERATIONS', tabs: ['members', 'discipline', 'comms', 'contracts'] },
    { key: 'economy', label: 'ECONOMY', tabs: ['bank', 'loans', 'funds'] },
    { key: 'system', label: 'SYSTEM', tabs: ['discord', 'maintenance', 'status', 'control'] },
    { key: 'security', label: 'SECURITY', tabs: ['log', 'danger'] },
  ]
  const tabLabel = {
    overview: 'OVERVIEW',
    approvals: 'APPROVALS',
    members: 'MEMBERS',
    discipline: 'DISCIPLINE',
    bank: 'BANK',
    loans: 'LOANS',
    funds: 'FUNDS',
    comms: 'COMMS',
    contracts: 'CONTRACTS',
    discord: 'DISCORD',
    maintenance: 'MAINTENANCE',
    status: 'STATUS BOARD',
    log: 'AUDIT LOG',
    danger: 'DANGER',
    control: 'CONTROL',
  }
  const TABS = TAB_GROUPS.flatMap(g => g.tabs)
  const availableTabs = TABS.filter(t => hasPermission(tabPermission[t]))
  const hasAdminAccess = me.is_founder || hasPermission('admin_console')
  const pendingApprovals = d.pending.filter(p => p.status === 'PENDING').length
  const maintenanceLive = Object.values(maintMap || {}).filter(v => v?.enabled).length
  const missingWebhooks = REQUIRED_DISCORD_KEYS.filter(k => !(webhooks[k] || '').trim()).length
  const highRiskRecent = d.log.filter(l =>
    (l.action || '').startsWith('discipline_')
    || ['admin_delete_member', 'admin_set_treasury', 'maintenance_updated', 'maintenance_cleared'].includes(l.action)
    || (l.action || '').includes('danger')
  ).slice(0, 6)
  const needsActionCards = [
    {
      key: 'approvals',
      title: 'Pending approvals',
      value: pendingApprovals,
      tone: pendingApprovals > 0 ? 'var(--amber)' : 'var(--text-2)',
      cta: 'Open security queue',
      tab: 'danger',
    },
    {
      key: 'maintenance',
      title: 'Maintenance pages live',
      value: maintenanceLive,
      tone: maintenanceLive > 0 ? 'var(--amber)' : 'var(--text-2)',
      cta: 'Review maintenance flags',
      tab: 'maintenance',
    },
    {
      key: 'discord',
      title: 'Discord routes missing',
      value: missingWebhooks,
      tone: missingWebhooks > 0 ? 'var(--red)' : 'var(--green)',
      cta: 'Check webhooks',
      tab: 'discord',
    },
    {
      key: 'loans',
      title: 'Loan approvals waiting',
      value: pendingLoans,
      tone: pendingLoans > 0 ? 'var(--amber)' : 'var(--text-2)',
      cta: 'Review loan requests',
      tab: 'loans',
    },
  ]
  function tabBadge(tabKey) {
    if (tabKey === 'approvals') return pendingApprovals + pendingLoans
    if (tabKey === 'danger') return pendingApprovals
    if (tabKey === 'loans') return pendingLoans
    if (tabKey === 'maintenance') return maintenanceLive
    if (tabKey === 'discord') return missingWebhooks
    return 0
  }
  const unifiedApprovals = useMemo(() => {
    const dangerTypes = new Set([
      'purge_log','purge_txns','purge_contracts','purge_intel','purge_fleet',
      'purge_polls','purge_ledger','purge_loans','purge_funds','reset_wallets','reset_treasury',
    ])
    const dangerRows = d.pending
      .filter(p => p.status === 'PENDING')
      .map(p => ({
        id: `danger-${p.id}`,
        kind: dangerTypes.has(p.action_type) ? 'DANGER' : 'ADMIN',
        risk: dangerTypes.has(p.action_type) ? 'CRITICAL' : 'HIGH',
        created_at: p.initiated_at,
        summary: p.action_type,
        requester: p.initiator?.handle || 'Founder',
        detail: p.reason || 'No reason',
        row: p,
      }))
    const loanRows = d.loans
      .filter(l => l.status === 'PENDING')
      .map(l => ({
        id: `loan-${l.id}`,
        kind: 'LOAN',
        risk: 'MEDIUM',
        created_at: l.created_at,
        summary: `Loan ${formatCredits(l.amount)}`,
        requester: l.borrower?.handle || 'Unknown',
        detail: l.reason || 'No reason',
        row: l,
      }))
    return [...dangerRows, ...loanRows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [d.pending, d.loans])
  const filteredAudit = useMemo(() => {
    const q = auditQuery.trim().toLowerCase()
    return d.log.filter(l => {
      if (auditAction !== 'ALL' && l.action !== auditAction) return false
      if (auditActor !== 'ALL' && String(l.actor_id || '') !== auditActor) return false
      if (auditTargetType !== 'ALL' && (l.target_type || '') !== auditTargetType) return false
      if (!q) return true
      const blob = `${l.action || ''} ${l.actor?.handle || ''} ${l.target_type || ''} ${JSON.stringify(l.details || {})}`.toLowerCase()
      return blob.includes(q)
    })
  }, [d.log, auditAction, auditActor, auditTargetType, auditQuery])
  const uniqueAuditActions = useMemo(
    () => [...new Set(d.log.map(l => l.action).filter(Boolean))].sort(),
    [d.log],
  )
  const uniqueAuditActors = useMemo(
    () => d.members.filter(m => d.log.some(l => l.actor_id === m.id)).sort((a, b) => a.handle.localeCompare(b.handle)),
    [d.members, d.log],
  )
  const uniqueTargetTypes = useMemo(
    () => [...new Set(d.log.map(l => l.target_type).filter(Boolean))].sort(),
    [d.log],
  )
  const roleBandMeta = useMemo(() => (
    ROLE_GROUPS.map(group => ({
      ...group,
      rankMeta: RANKS
        .filter(r => r.tier >= group.minTier && r.tier <= group.maxTier)
        .map(r => ({ tier: r.tier, label: r.label })),
    }))
  ), [])
  useEffect(() => {
    if (!availableTabs.includes(tab)) setTab(availableTabs[0] || 'overview')
  }, [availableTabs, tab])
  const fmt = ts => new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  if (loading) return <div className="page-body"><div className="loading">LOADING ADMIN...</div></div>
  if (!hasAdminAccess) {
    return (
      <AccessDeniedScreen
        permission="admin_console"
        reason="The Command Console is restricted to founders and authorized officers. Your current credentials don't include the admin console permission."
        minTier={1}
        currentTier={me.tier}
      />
    )
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              COMMAND CONSOLE
              <span className="badge badge-accent" style={{ fontSize: 9 }}>FOUNDER</span>
              {adminControl.incident_mode && <span className="badge badge-red" style={{ fontSize: 9 }}>INCIDENT MODE</span>}
            </div>
            <div className="page-subtitle">Full administrative control — {me.handle}</div>
          </div>
        </div>
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
          {TAB_GROUPS.map(group => {
            const groupTabs = group.tabs.filter(t => availableTabs.includes(t))
            if (!groupTabs.length) return null
            return (
              <div key={group.key} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{
                  fontSize: 9,
                  letterSpacing: '.18em',
                  color: 'var(--text-3)',
                  fontFamily: 'var(--font-mono)',
                  minWidth: 120,
                }}>
                  {group.label}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  {groupTabs.map(t => {
                    const badge = tabBadge(t)
                    const active = tab === t
                    return (
                      <button
                        key={t}
                        style={{
                          background: active ? 'var(--accent-glow)' : 'transparent',
                          border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          borderRadius: 4,
                          padding: '7px 10px',
                          fontSize: 10,
                          letterSpacing: '.08em',
                          fontFamily: 'var(--font-mono)',
                          color: active ? 'var(--accent)' : 'var(--text-2)',
                          cursor: 'pointer',
                        }}
                        onClick={() => setTab(t)}
                      >
                        {tabLabel[t] || t.toUpperCase()}
                        {badge > 0 && <span style={{ color: badge > 0 && (t === 'discord' ? 'var(--red)' : 'var(--amber)'), marginLeft: 6 }}>● {badge}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="page-body">
        {msg && <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 6, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: 'var(--accent)' }}>{msg}</div>}

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <>
            <Section title="COMMAND DECK — LIVE STATUS">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 14 }}>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>INCIDENT STATE</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: adminControl.incident_mode ? 'var(--red)' : 'var(--green)' }}>
                    {adminControl.incident_mode ? 'ACTIVE INCIDENT' : 'NOMINAL'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                    {adminControl.incident_note || 'No incident note logged.'}
                  </div>
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>APPROVAL QUEUE</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: pendingApprovals > 0 ? 'var(--amber)' : 'var(--text-1)' }}>
                    {pendingApprovals} pending
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setTab('danger')}>OPEN SECURITY QUEUE</button>
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>DISCORD HEALTH</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: missingWebhooks > 0 ? 'var(--red)' : 'var(--green)' }}>
                    {missingWebhooks > 0 ? `${missingWebhooks} routes missing` : 'ALL ROUTES LIVE'}
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setTab('discord')}>CHECK WEBHOOKS</button>
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>MAINTENANCE</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: maintenanceLive > 0 ? 'var(--amber)' : 'var(--text-1)' }}>
                    {maintenanceLive} page{maintenanceLive === 1 ? '' : 's'} gated
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setTab('maintenance')}>REVIEW FLAGS</button>
                </div>
              </div>
            </Section>

            <Section title="NEEDS ACTION NOW">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
                {needsActionCards.map(card => (
                  <div key={card.key} className="card" style={{ padding: 12, borderLeft: `2px solid ${card.tone}` }}>
                    <div style={{ fontSize: 10, letterSpacing: '.14em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{card.title.toUpperCase()}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: card.tone, marginTop: 4 }}>{card.value}</div>
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setTab(card.tab)}>{card.cta}</button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary btn-sm" onClick={() => setTab('approvals')}>OPEN UNIFIED APPROVALS</button>
              </div>
            </Section>

            <Section title="ORG VITALS">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
                <Stat label="MEMBERS" value={activeMembers} />
                <Stat label="TREASURY" value={formatCredits(treasury)} color="var(--accent)" />
                <Stat label="TOTAL ORG WEALTH" value={formatCredits(totalWealth)} color="var(--green)" />
                <Stat label="OPEN CONTRACTS" value={openContracts} />
                <Stat label="FLEET SIZE" value={d.contracts.length} />
                <Stat label="INTEL FILES" value={d.intelligence.length} />
                <Stat label="PENDING LOANS" value={pendingLoans} color={pendingLoans > 0 ? 'var(--red)' : undefined} />
                <Stat label="OUTSTANDING DEBT" value={formatCredits(outstandingDebt)} color="var(--amber)" />
                <Stat label="SUSPENDED" value={suspendedMembers} color={suspendedMembers > 0 ? 'var(--amber)' : undefined} />
                <Stat label="BANNED" value={bannedMembers} color={bannedMembers > 0 ? 'var(--red)' : undefined} />
                <Stat label="WARNINGS LOGGED" value={warningCount} />
                <Stat label="TAX RATE" value={`${taxRate}%`} />
                <Stat label="ACTIVITY LOG" value={`${d.log.length} entries`} />
              </div>
            </Section>
            <Section title="HIGH-RISK ACTION TIMELINE">
              <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table className="data-table">
                <thead><tr><th>TIME</th><th>ACTION</th><th>ACTOR</th><th>TARGET</th><th>DETAIL</th></tr></thead>
                <tbody>
                  {highRiskRecent.map(l => (
                    <tr key={l.id}>
                      <td className="mono text-muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmt(l.created_at)}</td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--amber)' }}>{l.action}</td>
                      <td>{l.actor?.handle || '—'}</td>
                      <td>{l.target_type || '—'}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-2)' }}>{l.details?.reason || l.details?.title || '—'}</td>
                    </tr>
                  ))}
                  {highRiskRecent.length === 0 && <tr><td colSpan={5} className="empty-state">NO HIGH-RISK ACTIONS RECENTLY</td></tr>}
                </tbody>
              </table></div></div>
            </Section>
            <Section title="MEMBER WEALTH DISTRIBUTION">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[...d.members].sort((a, b) => (b.wallet_balance||0) - (a.wallet_balance||0)).map(m => {
                  const pct = totalWealth > 0 ? Math.round(((m.wallet_balance||0) / totalWealth) * 100) : 0
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                      <span style={{ width: 120, fontSize: 12, fontWeight: m.id === me.id ? 500 : 400 }}>{m.handle}</span>
                      <div style={{ flex: 1, height: 6, background: 'var(--bg-surface)', borderRadius: 3 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 3, minWidth: pct > 0 ? 4 : 0 }} />
                      </div>
                      <span style={{ width: 100, textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>{formatCredits(m.wallet_balance||0)}</span>
                    </div>
                  )
                })}
              </div>
            </Section>
          </>
        )}

        {/* ── APPROVALS INBOX ── */}
        {tab === 'approvals' && (
          <>
            <Section title={`UNIFIED APPROVALS INBOX — ${unifiedApprovals.length}`}>
              <div className="card" style={{ padding: 12, marginBottom: 10, fontSize: 12, color: 'var(--text-2)' }}>
                One queue for sensitive command actions. Danger requests require explicit approval flow;
                loan requests can be approved/denied from this same inbox.
              </div>
              <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table className="data-table">
                <thead><tr><th>TIME</th><th>TYPE</th><th>RISK</th><th>REQUEST</th><th>REQUESTER</th><th>DETAIL</th><th>ACTIONS</th></tr></thead>
                <tbody>
                  {unifiedApprovals.map(item => (
                    <tr key={item.id}>
                      <td className="mono text-muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmt(item.created_at)}</td>
                      <td><span className={`badge ${item.kind === 'DANGER' ? 'badge-red' : item.kind === 'ADMIN' ? 'badge-blue' : 'badge-amber'}`}>{item.kind}</span></td>
                      <td>
                        <span className={`badge ${item.risk === 'CRITICAL' ? 'badge-red' : item.risk === 'HIGH' ? 'badge-amber' : 'badge-muted'}`}>
                          {item.risk}
                        </span>
                      </td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>{item.summary}</td>
                      <td>{item.requester}</td>
                      <td style={{ fontSize: 12, maxWidth: 260 }}>{item.detail}</td>
                      <td>
                        {item.kind !== 'LOAN' ? (
                          <div className="flex gap-8">
                            <button className="btn btn-danger btn-sm" onClick={() => approvePendingAction(item.row)}>APPROVE</button>
                            {item.row.initiated_by === me.id && (
                              <button className="btn btn-ghost btn-sm" onClick={() => cancelPendingAction(item.row)}>CANCEL</button>
                            )}
                          </div>
                        ) : (
                          <div className="flex gap-8">
                            <button className="btn btn-primary btn-sm" onClick={() => approveLoan(item.row)}>APPROVE</button>
                            <button className="btn btn-danger btn-sm" onClick={() => denyLoan(item.row.id)}>DENY</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {unifiedApprovals.length === 0 && (
                    <tr><td colSpan={7} className="empty-state">NO PENDING APPROVALS</td></tr>
                  )}
                </tbody>
              </table></div></div>
            </Section>
          </>
        )}

        {/* ── MEMBERS ── */}
        {tab === 'members' && (
          <Section title={`ALL MEMBERS — ${d.members.length}`}>
            <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table className="data-table">
              <thead><tr><th>HANDLE</th><th>RANK</th><th>TIER</th><th>DIVISION</th><th>STATUS</th><th>WALLET</th><th>LAST SEEN</th><th></th></tr></thead>
              <tbody>
                {d.members.map(m => (
                  <tr key={m.id} style={{ background: m.id === me.id ? 'var(--accent-glow)' : undefined }}>
                    <td style={{ fontWeight: 500 }}>{m.handle} {m.is_founder && <span className="badge badge-accent" style={{ fontSize: 8 }}>F</span>}</td>
                    <td><RankBadge tier={m.tier} /></td>
                    <td className="mono">{m.tier}</td>
                    <td className="text-muted">{m.division || '—'}</td>
                    <td><span className={`badge ${m.status === 'ACTIVE' ? 'badge-green' : 'badge-red'}`}>{m.status}</span></td>
                    <td className="mono" style={{ color: 'var(--green)' }}>{formatCredits(m.wallet_balance||0)}</td>
                    <td className="mono text-muted" style={{ fontSize: 11 }}>{m.last_seen_at ? fmt(m.last_seen_at) : '—'}</td>
                    <td>
                      <div className="flex gap-8">
                        <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ ...m, newWallet: m.wallet_balance||0 }); setModal({ type: 'edit_member', member: m }) }}>EDIT</button>
                        {!m.is_founder && <button className="btn btn-danger btn-sm" onClick={() => deleteMember(m)}>✕</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div></div>
          </Section>
        )}


        {/* ── DISCIPLINE ── */}
        {tab === 'discipline' && (
          <>
            <Section title="DISCIPLINARY CONTROL">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 16 }}>
                <Stat label="ACTIVE WARNINGS" value={warningCount} color={warningCount > 0 ? 'var(--amber)' : undefined} />
                <Stat label="SUSPENDED MEMBERS" value={suspendedMembers} color={suspendedMembers > 0 ? 'var(--amber)' : undefined} />
                <Stat label="BANNED MEMBERS" value={bannedMembers} color={bannedMembers > 0 ? 'var(--red)' : undefined} />
                <Stat label="BLACKLIST ENTRIES" value={d.blacklist.filter(b => b.status === 'ACTIVE').length} />
              </div>
              <div className="card" style={{ padding: 12, fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>
                Use <b>WARN</b> for documented behavior flags, <b>SUSPEND</b> for temporary lockout, and <b>BAN</b> for permanent removal. Every action is written to the audit log with a reason.
              </div>
            </Section>

            <Section title={`MEMBER ENFORCEMENT — ${d.members.length}`}>
              <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table className="data-table">
                <thead><tr><th>HANDLE</th><th>RANK</th><th>STATUS</th><th>STRIKES</th><th>SUSPENDED UNTIL</th><th>LAST SEEN</th><th>ACTIONS</th></tr></thead>
                <tbody>
                  {d.members.map(m => (
                    <tr key={m.id} style={{ opacity: m.status === 'BANNED' ? 0.65 : 1 }}>
                      <td style={{ fontWeight: 500 }}>{m.handle} {m.is_founder && <span className="badge badge-accent" style={{ fontSize: 8 }}>F</span>}</td>
                      <td><RankBadge tier={m.tier} /></td>
                      <td><span className={`badge ${m.status === 'ACTIVE' ? 'badge-green' : m.status === 'SUSPENDED' ? 'badge-amber' : 'badge-red'}`}>{m.status}</span></td>
                      <td><span className={`badge ${(m.strike_count || 0) >= STRIKE_SUSPEND_THRESHOLD ? 'badge-red' : (m.strike_count || 0) > 0 ? 'badge-amber' : 'badge-muted'}`}>{m.strike_count || 0}</span></td>
                      <td className="mono text-muted" style={{ fontSize: 11 }}>{m.suspended_until ? fmt(m.suspended_until) : '—'}</td>
                      <td className="mono text-muted" style={{ fontSize: 11 }}>{m.last_seen_at ? fmt(m.last_seen_at) : '—'}</td>
                      <td>
                        {!m.is_founder ? (
                          <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => disciplineMember(m, 'WARN')}>WARN</button>
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--amber)' }} onClick={() => disciplineMember(m, 'SUSPEND')}>SUSPEND</button>
                            <button className="btn btn-danger btn-sm" onClick={() => disciplineMember(m, 'BAN')}>BAN</button>
                            {(m.strike_count || 0) > 0 && <button className="btn btn-ghost btn-sm" onClick={() => resetStrikes(m)}>RESET STRIKES</button>}
                            {m.status !== 'ACTIVE' && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--green)' }} onClick={() => disciplineMember(m, 'CLEAR')}>CLEAR</button>}
                          </div>
                        ) : <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Founder protected</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div></div>
            </Section>

            <Section title="RECENT DISCIPLINARY ACTIONS">
              <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table className="data-table">
                <thead><tr><th>TIME</th><th>ACTION</th><th>ACTOR</th><th>TARGET</th><th>REASON</th></tr></thead>
                <tbody>
                  {d.log.filter(l => l.action.startsWith('discipline_')).slice(0, 40).map(l => (
                    <tr key={l.id}>
                      <td className="mono text-muted" style={{ fontSize: 11 }}>{fmt(l.created_at)}</td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>{l.action.replace('discipline_', '').toUpperCase()}</td>
                      <td>{l.actor?.handle || '—'}</td>
                      <td>{l.details?.handle || l.target_id || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-2)' }}>
                        {l.details?.reason || '—'}
                        {l.details?.strike_count !== undefined ? ` • strikes ${l.details.strike_count}` : ''}
                        {l.details?.days ? ` • ${l.details.days}d` : ''}
                      </td>
                    </tr>
                  ))}
                  {d.log.filter(l => l.action.startsWith('discipline_')).length === 0 && (
                    <tr><td colSpan={5} className="empty-state">NO DISCIPLINARY ACTIONS LOGGED</td></tr>
                  )}
                </tbody>
              </table></div></div>
            </Section>
          </>
        )}


        {/* ── BANK ── */}
        {tab === 'bank' && (
          <>
            <Section title="TREASURY CONTROL">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                <Stat label="TREASURY" value={formatCredits(treasury)} color="var(--accent)" />
                <Stat label="TOTAL WALLETS" value={formatCredits(d.members.reduce((s, m) => s + (m.wallet_balance||0), 0))} color="var(--green)" />
                <Stat label="TAX RATE" value={`${taxRate}%`} />
              </div>
              <div className="flex gap-8 mb-20">
                <button className="btn btn-primary btn-sm" onClick={() => { setForm({ treasAmount: '' }); setModal('set_treasury') }}>SET TREASURY</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ newTax: taxRate }); setModal('set_tax') }}>CHANGE TAX</button>
              </div>
            </Section>

            <Section title={`ALL TRANSACTIONS — ${d.transactions.length}`}>
              <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table className="data-table">
                <thead><tr><th>DATE</th><th>TYPE</th><th>FROM</th><th>TO</th><th>DESCRIPTION</th><th style={{ textAlign: 'right' }}>AMOUNT</th></tr></thead>
                <tbody>
                  {d.transactions.length === 0 ? <tr><td colSpan={6} className="empty-state">NO TRANSACTIONS</td></tr> : d.transactions.map(t => (
                    <tr key={t.id}>
                      <td className="mono text-muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmt(t.created_at)}</td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>{t.type}</td>
                      <td className="text-muted">{t.from_type === 'treasury' ? 'TREASURY' : t.from_profile?.handle || t.from_type || '—'}</td>
                      <td className="text-muted">{t.to_type === 'treasury' ? 'TREASURY' : t.to_profile?.handle || t.to_type || '—'}</td>
                      <td style={{ fontSize: 12 }}>{t.description || '—'}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 500 }}>{formatCredits(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div></div>
            </Section>
          </>
        )}

        {/* ── LOANS ── */}
        {tab === 'loans' && (
          <Section title={`ALL LOANS — ${d.loans.length}`}>
            {d.loans.length === 0 ? <div className="empty-state">NO LOANS</div> : (
              <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table className="data-table">
                <thead><tr><th>BORROWER</th><th>AMOUNT</th><th>REPAID</th><th>OUTSTANDING</th><th>REASON</th><th>STATUS</th><th>DATE</th><th></th></tr></thead>
                <tbody>
                  {d.loans.map(l => {
                    const outstanding = l.amount - l.repaid
                    return (
                      <tr key={l.id}>
                        <td style={{ fontWeight: 500 }}>{l.borrower?.handle || '—'}</td>
                        <td className="mono">{formatCredits(l.amount)}</td>
                        <td className="mono" style={{ color: 'var(--green)' }}>{formatCredits(l.repaid)}</td>
                        <td className="mono" style={{ color: outstanding > 0 ? 'var(--red)' : 'var(--green)' }}>{formatCredits(outstanding)}</td>
                        <td style={{ fontSize: 12, maxWidth: 200 }}>{l.reason || '—'}</td>
                        <td><span className={`badge ${l.status === 'PENDING' ? 'badge-amber' : l.status === 'ACTIVE' ? 'badge-blue' : l.status === 'REPAID' ? 'badge-green' : 'badge-red'}`}>{l.status}</span></td>
                        <td className="mono text-muted" style={{ fontSize: 11 }}>{fmt(l.created_at)}</td>
                        <td>
                          <div className="flex gap-8">
                            {l.status === 'PENDING' && <><button className="btn btn-primary btn-sm" onClick={() => approveLoan(l)}>APPROVE</button><button className="btn btn-danger btn-sm" onClick={() => denyLoan(l.id)}>DENY</button></>}
                            {l.status === 'ACTIVE' && <button className="btn btn-ghost btn-sm" onClick={() => forgiveLoan(l.id)}>FORGIVE</button>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table></div></div>
            )}
          </Section>
        )}

        {/* ── FUNDS ── */}
        {tab === 'funds' && (
          <Section title={`SHIP FUNDS — ${d.funds.length}`}>
            {d.funds.length === 0 ? <div className="empty-state">NO SHIP FUNDS</div> : d.funds.map(f => {
              const pct = Math.min(100, Math.round((f.current_amount / f.target_amount) * 100))
              return (
                <div key={f.id} className="card mb-12">
                  <div className="flex items-center justify-between mb-8">
                    <div><span style={{ fontWeight: 500, fontSize: 15 }}>{f.name}</span>{f.ship_class && <span style={{ color: 'var(--text-3)', marginLeft: 10, fontSize: 12 }}>{f.ship_class}</span>}</div>
                    <div className="flex gap-8">
                      <span className={`badge ${f.status === 'ACTIVE' ? 'badge-green' : f.status === 'COMPLETED' ? 'badge-accent' : 'badge-muted'}`}>{f.status}</span>
                      {f.status === 'ACTIVE' && <button className="btn btn-ghost btn-sm" onClick={() => completeFund(f.id)}>COMPLETE</button>}
                      {f.status === 'ACTIVE' && <button className="btn btn-danger btn-sm" onClick={() => cancelFund(f.id)}>CANCEL</button>}
                    </div>
                  </div>
                  <div style={{ height: 8, background: 'var(--bg-surface)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? 'var(--green)' : 'var(--accent)', borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{formatCredits(f.current_amount)} / {formatCredits(f.target_amount)} — {pct}%</div>
                </div>
              )
            })}
          </Section>
        )}

        {/* ── COMMS ── */}
        {tab === 'comms' && (
          <>
            <Section title="POST ANNOUNCEMENT">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 500 }}>
                <input className="form-input" value={form.ann_title || ''} onChange={e => setForm(f => ({ ...f, ann_title: e.target.value }))} placeholder="Transmission title" />
                <select className="form-select" value={form.ann_priority || 'ROUTINE'} onChange={e => setForm(f => ({ ...f, ann_priority: e.target.value }))}>
                  {['ROUTINE', 'IMPORTANT', 'URGENT', 'CRITICAL'].map(p => <option key={p}>{p}</option>)}
                </select>
                <textarea className="form-textarea" value={form.ann_content || ''} onChange={e => setForm(f => ({ ...f, ann_content: e.target.value }))} placeholder="Message..." style={{ minHeight: 80 }} />
                <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={postAnnouncement} disabled={saving}>POST</button>
              </div>
            </Section>
            <Section title={`ALL ANNOUNCEMENTS — ${d.announcements.length}`}>
              {d.announcements.map(a => (
                <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><span style={{ fontWeight: 500, fontSize: 13 }}>{a.title}</span><span className="text-muted" style={{ fontSize: 11, marginLeft: 10 }}>{a.priority} · {fmt(a.created_at)}</span></div>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteAnnouncement(a.id)}>✕</button>
                </div>
              ))}
            </Section>
          </>
        )}

        {/* ── CONTRACTS ── */}
        {tab === 'contracts' && (
          <Section title={`ALL CONTRACTS — ${d.contracts.length}`}>
            <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table className="data-table">
              <thead><tr><th>TITLE</th><th>TYPE</th><th>STATUS</th><th>REWARD</th><th>POSTED BY</th><th>DATE</th></tr></thead>
              <tbody>
                {d.contracts.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.title}</td>
                    <td className="mono text-muted" style={{ fontSize: 11 }}>{c.contract_type}</td>
                    <td><span className={`badge ${c.status === 'OPEN' ? 'badge-green' : c.status === 'ACTIVE' ? 'badge-amber' : c.status === 'COMPLETE' ? 'badge-blue' : 'badge-muted'}`}>{c.status}</span></td>
                    <td className="mono" style={{ color: 'var(--accent)' }}>{formatCredits(c.reward)}</td>
                    <td className="text-muted">{c.posted_by?.handle || '—'}</td>
                    <td className="mono text-muted" style={{ fontSize: 11 }}>{fmt(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div></div>
          </Section>
        )}

        {/* ── DISCORD WEBHOOKS ── */}
        {tab === 'discord' && (
          <Section title="DISCORD WEBHOOK CONFIGURATION">
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.8 }}>
              Paste webhook URLs from your Discord server. Each channel gets its own webhook. Go to Discord → Channel → Edit → Integrations → Webhooks → New Webhook → Copy URL.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { key: 'discord_webhook_announcements', label: 'ANNOUNCEMENTS', desc: 'Org announcements and critical updates' },
                { key: 'discord_webhook_moderation', label: 'MODERATION LOG', desc: 'Warn/suspend/ban actions and strike resets' },
                { key: 'discord_webhook_operations', label: 'OPERATIONS FEED', desc: 'New operations scheduled from templates' },
                { key: 'discord_webhook_kills', label: 'KILL FEED / BOUNTIES', desc: 'Kill board entries, bounty posts and claims' },
                { key: 'discord_webhook_contracts', label: 'CONTRACTS', desc: 'Contract posts and completions' },
                { key: 'discord_webhook_recruitment', label: 'RECRUITMENT', desc: 'New applications from the apply page' },
                { key: 'discord_webhook_promotions', label: 'PROMOTIONS / MEDALS', desc: 'Rank changes and medal awards' },
                { key: 'discord_invite_url', label: 'DISCORD INVITE LINK', desc: 'Shown to new members (not a webhook)' },
              ].map(wh => (
                <div key={wh.key} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{wh.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{wh.desc}</div>
                    </div>
                    {webhooks[wh.key] && <span style={{ fontSize: 9, color: 'var(--green)', fontFamily: 'var(--font-mono)', background: 'rgba(90,184,112,0.1)', border: '1px solid rgba(90,184,112,0.2)', borderRadius: 4, padding: '2px 6px' }}>CONNECTED</span>}
                  </div>
                  <input className="form-input" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}
                    value={webhooks[wh.key] || ''}
                    onChange={e => setWebhooks(w => ({ ...w, [wh.key]: e.target.value }))}
                    placeholder={wh.key === 'discord_invite_url' ? 'https://discord.gg/...' : 'https://discord.com/api/webhooks/...'}
                  />
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={webhookSaving}
              onClick={async () => {
                if (!hasPermission('manage_discord')) { flash('Missing permission: manage_discord'); return }
                if (!(await ensureElevatedUnlock('discord webhook update'))) return
                setWebhookSaving(true)
                await requestSensitiveAction({
                  actionType: 'discord_save_webhooks',
                  label: 'discord webhook update',
                  payload: { webhooks },
                  reasonPrompt: 'Reason for updating Discord webhook routes:',
                })
                setWebhookSaving(false)
              }}>
              {webhookSaving ? 'SAVING...' : 'SAVE ALL WEBHOOKS'}
            </button>

            {/* Test webhook */}
            <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>TEST WEBHOOK</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['announcements', 'moderation', 'operations', 'kills', 'contracts', 'recruitment', 'promotions'].map(ch => (
                  <button key={ch} className="btn btn-ghost btn-sm" onClick={async () => {
                    if (!hasPermission('manage_discord')) { flash('Missing permission: manage_discord'); return }
                    try {
                      await testDiscordWebhook(ch)
                      flash(`Test sent to #${ch}`)
                    } catch (e) { flash(`Failed: ${e.message}`) }
                  }}>TEST #{ch.toUpperCase()}</button>
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* ── MAINTENANCE ── */}
        {tab === 'maintenance' && (
          <Section title="SECTION MAINTENANCE MODE">
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.7 }}>
              Toggle any sidebar section into maintenance mode. While a section is in maintenance, only
              officers <b>Vice Admiral and above</b> (tier ≤ {MAINT_BYPASS_TIER}) can access it —
              everyone else sees a maintenance screen. Use this when you're rebuilding or debugging a
              page without taking the whole site down.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {NAV.map((item, i) => {
                if (item.section) {
                  return (
                    <div key={`sec-${item.section}`} style={{ fontSize: 10, letterSpacing: '.2em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginTop: i > 0 ? 14 : 0, marginBottom: 2 }}>
                      {item.section}
                    </div>
                  )
                }
                const cfg = maintMap[item.to] || { enabled: false, note: '' }
                const setCfg = (next) => setMaintMap(m => ({ ...m, [item.to]: { ...cfg, ...next } }))
                return (
                  <div key={item.to} style={{
                    background: 'var(--bg-surface)',
                    border: `1px solid ${cfg.enabled ? 'var(--amber)' : 'var(--border)'}`,
                    borderRadius: 8, padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!cfg.enabled}
                        onChange={e => setCfg({ enabled: e.target.checked })}
                        style={{ width: 16, height: 16, accentColor: 'var(--amber)' }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 600, color: cfg.enabled ? 'var(--amber)' : 'var(--text-1)', fontFamily: 'var(--font-mono)', letterSpacing: '.08em' }}>
                        {item.label}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{item.to}</span>
                    </label>
                    <input
                      className="form-input"
                      style={{ flex: 1, minWidth: 200, fontSize: 12 }}
                      placeholder="Optional note shown to members (e.g. 'Rebuilding ledger filters — back by 18:00 UTC')"
                      value={cfg.note || ''}
                      onChange={e => setCfg({ note: e.target.value })}
                      disabled={!cfg.enabled}
                    />
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="btn btn-primary" disabled={maintSaving}
                onClick={async () => {
                  if (!hasPermission('manage_maintenance')) { flash('Missing permission: manage_maintenance'); return }
                  if (!(await ensureElevatedUnlock('maintenance update'))) return
                  setMaintSaving(true)
                  const cleaned = {}
                  for (const [route, cfg] of Object.entries(maintMap)) {
                    if (cfg?.enabled || cfg?.note) cleaned[route] = { enabled: !!cfg.enabled, note: cfg.note || '' }
                  }
                  const mode = await requestSensitiveAction({
                    actionType: 'maintenance_save',
                    label: 'maintenance map update',
                    payload: { map: cleaned },
                    reasonPrompt: 'Reason for maintenance map update:',
                  })
                  setMaintSaving(false)
                  if (mode === 'executed') notifyMaintenanceChange(cleaned)
                }}>
                {maintSaving ? 'SAVING...' : 'SAVE MAINTENANCE SETTINGS'}
              </button>
              <button className="btn btn-ghost" disabled={maintSaving}
                onClick={async () => {
                  if (!hasPermission('manage_maintenance')) { flash('Missing permission: manage_maintenance'); return }
                  if (!(await ensureElevatedUnlock('maintenance clear'))) return
                  if (!(await confirmAction('Clear all maintenance flags? Every section will be accessible again.'))) return
                  setMaintSaving(true)
                  const mode = await requestSensitiveAction({
                    actionType: 'maintenance_clear',
                    label: 'maintenance clear',
                    payload: {},
                    reasonPrompt: 'Reason for clearing all maintenance flags:',
                  })
                  setMaintSaving(false)
                  if (mode === 'executed') {
                    setMaintMap({})
                    notifyMaintenanceChange({})
                  }
                }}>
                CLEAR ALL
              </button>
            </div>
          </Section>
        )}

        {/* ── STATUS BOARD ── */}
        {tab === 'status' && (
          <Section title="LANDING PAGE STATUS BOARD">
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.7 }}>
              Live-edit the three readiness cells under the hero on the public landing page
              (<code style={{ color: 'var(--accent)' }}>grayveil.net</code>) and the recruitment
              gate that controls <code style={{ color: 'var(--accent)' }}>/apply</code>. Changes
              push out via Realtime — every visitor with the page open sees the new state within
              a second, no refresh.
            </div>

            {/* ── Recruitment toggle (drives /apply gate + waitlist eyebrows) ── */}
            <div style={{
              background: 'var(--bg-surface)',
              border: `1px solid ${statusBoard.recruitment_open ? 'var(--green)' : 'var(--amber)'}`,
              borderRadius: 8, padding: '14px 18px', marginBottom: 24,
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1, minWidth: 280 }}>
                <input
                  type="checkbox"
                  checked={!!statusBoard.recruitment_open}
                  onChange={e => setStatusBoard(b => ({ ...b, recruitment_open: e.target.checked }))}
                  style={{ width: 18, height: 18, accentColor: 'var(--green)' }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', fontFamily: 'var(--font-mono)', letterSpacing: '.06em' }}>
                    RECRUITMENT OPEN
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    When ON, /apply shows the form. When OFF, prospects see the standing-down
                    notice and CTAs across the site route to the Discord waitlist.
                  </div>
                </div>
              </label>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em',
                padding: '6px 10px', borderRadius: 4,
                background: statusBoard.recruitment_open ? 'rgba(70,180,90,0.15)' : 'rgba(212,175,110,0.15)',
                color: statusBoard.recruitment_open ? 'var(--green)' : 'var(--amber)',
              }}>
                {statusBoard.recruitment_open ? '● INTAKE LIVE' : '● WAITLIST MODE'}
              </span>
            </div>

            {/* ── Two editable hero cells (recruitment is derived) ── */}
            <div style={{ fontSize: 11, letterSpacing: '.18em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
              HERO READINESS CELLS
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10, lineHeight: 1.6 }}>
              The third cell (RECRUITMENT) auto-derives from the toggle above —
              <b style={{ color: 'var(--green)' }}> OPEN · green</b> when intake is live,
              <b style={{ color: 'var(--amber)' }}> WAITLIST · amber</b> when paused.
              Edit COMMAND and ALERT LEVEL below.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {[
                { key: 'command', label: 'COMMAND'     },
                { key: 'alert',   label: 'ALERT LEVEL' },
              ].map(cell => {
                const cur = statusBoard[cell.key] || { status: '', color: 'accent' }
                const setCell = (next) => setStatusBoard(b => ({ ...b, [cell.key]: { ...cur, ...next } }))
                return (
                  <div key={cell.key} style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8, padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  }}>
                    <div style={{ minWidth: 130 }}>
                      <div style={{ fontSize: 10, letterSpacing: '.2em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                        LABEL
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginTop: 2 }}>
                        {cell.label}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 10, letterSpacing: '.2em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                        STATUS TEXT
                      </div>
                      <input
                        className="form-input"
                        style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.01em' }}
                        value={cur.status || ''}
                        maxLength={20}
                        onChange={e => setCell({ status: e.target.value.toUpperCase() })}
                        placeholder="e.g. OPERATIONAL"
                      />
                    </div>
                    <div style={{ minWidth: 150 }}>
                      <div style={{ fontSize: 10, letterSpacing: '.2em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                        DOT COLOR
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 14, height: 14, borderRadius: '50%',
                          background: STATUS_COLORS[cur.color] || STATUS_COLORS.accent,
                          boxShadow: `0 0 10px ${STATUS_COLORS[cur.color] || STATUS_COLORS.accent}`,
                          flexShrink: 0,
                        }} />
                        <select
                          className="form-select"
                          style={{ fontSize: 12, flex: 1 }}
                          value={cur.color || 'accent'}
                          onChange={e => setCell({ color: e.target.value })}
                        >
                          {Object.keys(STATUS_COLORS).map(c => (
                            <option key={c} value={c}>{c.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" disabled={statusBoardSaving}
                onClick={async () => {
                  if (!hasPermission('manage_maintenance')) { flash('Missing permission: manage_maintenance'); return }
                  setStatusBoardSaving(true)
                  // Sanitize before sending so a bad client can't write garbage
                  // colors or oversized status strings.
                  const clean = {
                    command:     { status: String(statusBoard.command?.status     || '').slice(0, 20).toUpperCase(), color: STATUS_COLORS[statusBoard.command?.color]     ? statusBoard.command.color     : 'accent' },
                    alert:       { status: String(statusBoard.alert?.status       || '').slice(0, 20).toUpperCase(), color: STATUS_COLORS[statusBoard.alert?.color]       ? statusBoard.alert.color       : 'accent' },
                    recruitment: { status: String(statusBoard.recruitment?.status || '').slice(0, 20).toUpperCase(), color: STATUS_COLORS[statusBoard.recruitment?.color] ? statusBoard.recruitment.color : 'accent' },
                    recruitment_open: !!statusBoard.recruitment_open,
                  }
                  // Snapshot the previous flag BEFORE we save so we can detect
                  // a flip and announce only on actual transitions (not every
                  // re-save of the same state).
                  const { data: prev } = await supabase
                    .from('org_settings')
                    .select('value')
                    .eq('key', STATUS_BOARD_KEY)
                    .maybeSingle()
                  const prevOpen = !!prev?.value?.recruitment_open
                  const { error } = await supabase
                    .from('org_settings')
                    .upsert({ key: STATUS_BOARD_KEY, value: clean, updated_by: me.id }, { onConflict: 'key' })
                  setStatusBoardSaving(false)
                  if (error) { flash(`Status board save failed: ${error.message}`); return }
                  // Optimistic local push so the admin sees their own change
                  // immediately, even before the realtime round-trip lands.
                  setStatusBoard(clean)
                  notifyStatusBoardChange(clean)
                  // Fire a Discord announcement only when the flag actually
                  // flipped. Best-effort — failure shouldn't block the save.
                  if (prevOpen !== clean.recruitment_open) {
                    discordRecruitmentStatus(clean.recruitment_open, me.handle).catch(() => {})
                    flash(`Status board updated · Discord announcement ${clean.recruitment_open ? 'OPEN' : 'CLOSED'} sent.`)
                  } else {
                    flash('Status board updated — live on landing page.')
                  }
                }}>
                {statusBoardSaving ? 'SAVING...' : 'SAVE & PUSH LIVE'}
              </button>
              <button className="btn btn-ghost" disabled={statusBoardSaving}
                onClick={() => setStatusBoard(DEFAULT_STATUS_BOARD)}>
                RESET TO DEFAULTS
              </button>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.06em' }}>
                Changes propagate via Supabase Realtime — no refresh needed.
              </span>
            </div>
          </Section>
        )}

        {/* ── CONTROL ── */}
        {tab === 'control' && (
          <>
            <Section title="ADMIN GUARDRAILS">
              <div className="card" style={{ padding: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>Incident Mode</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Signals an active incident so officers can coordinate from the admin console.</div>
                  </div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    <input
                      type="checkbox"
                      checked={!!adminControl.incident_mode}
                      onChange={e => setAdminControl(c => ({ ...c, incident_mode: e.target.checked }))}
                      style={{ width: 16, height: 16, accentColor: 'var(--amber)' }}
                    />
                    INCIDENT MODE
                  </label>
                </div>
                <input
                  className="form-input"
                  style={{ marginTop: 10 }}
                  value={adminControl.incident_note || ''}
                  onChange={e => setAdminControl(c => ({ ...c, incident_note: e.target.value }))}
                  placeholder="Incident note (shown to command only)"
                />
              </div>
              <button className="btn btn-primary" disabled={controlSaving} onClick={async () => {
                if (!hasPermission('manage_control')) { flash('Missing permission: manage_control'); return }
                if (!(await ensureElevatedUnlock('admin guardrail update'))) return
                await saveAdminControl(adminControl, 'Admin guardrails saved')
              }}>
                {controlSaving ? 'SAVING...' : 'SAVE GUARDRAILS'}
              </button>
            </Section>

            <Section title="FEATURE FLAGS">
              <div className="card" style={{ padding: 12 }}>
                {Object.entries(adminControl.feature_flags || {}).map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px dashed var(--border)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{key}</div>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                      <input
                        type="checkbox"
                        checked={!!value}
                        onChange={e => setAdminControl(c => ({ ...c, feature_flags: { ...c.feature_flags, [key]: e.target.checked } }))}
                        style={{ width: 14, height: 14, accentColor: 'var(--accent)' }}
                      />
                      {value ? 'ENABLED' : 'DISABLED'}
                    </label>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="ROLE PERMISSIONS">
              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
                  Permissions are configured by rank band so they match your roster tiers.
                </div>
                {roleBandMeta.map((role) => (
                  <div key={role.key} style={{ marginBottom: 12 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', color: 'var(--accent)', marginBottom: 6 }}>
                      {role.rankMeta.map(r => `T${r.tier} ${String(r.label || '').toUpperCase()}`).join(' · ')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>
                      Permission band key: {role.label}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 6 }}>
                      {Object.entries(ADMIN_ACTION_PERMISSIONS).map(([perm, label]) => {
                        const checked = !!adminControl.role_permissions?.[role.key]?.includes(perm)
                        return (
                          <label key={perm} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e => {
                                setAdminControl(c => {
                                  const current = new Set(c.role_permissions?.[role.key] || [])
                                  if (e.target.checked) current.add(perm)
                                  else current.delete(perm)
                                  return { ...c, role_permissions: { ...c.role_permissions, [role.key]: [...current] } }
                                })
                              }}
                              style={{ width: 14, height: 14, accentColor: 'var(--accent)' }}
                            />
                            {label}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="HIGH COUNCIL ACCESS MANAGER">
              {!me.is_founder ? (
                <div className="card" style={{ padding: 12, color: 'var(--text-3)', fontSize: 12 }}>
                  Founder access required to view or modify High Council codes and membership.
                </div>
              ) : (
                <>
                  <div className="card" style={{ padding: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>Seated Council</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                          Select which members can unlock the High Council chamber.
                        </div>
                      </div>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        <input
                          type="checkbox"
                          checked={fleet501stMembers.allow_founders !== false}
                          onChange={e => setFleet501stMembers(s => ({ ...s, allow_founders: e.target.checked }))}
                          style={{ width: 14, height: 14, accentColor: 'var(--accent)' }}
                        />
                        ALLOW FOUNDERS
                      </label>
                    </div>
                    <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                      {d.members.map(m => {
                        const checked = fleet501stMembers.member_ids.includes(m.id)
                        return (
                          <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', fontSize: 12 }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e => setFleet501stMembers(prev => {
                                const next = new Set(prev.member_ids)
                                if (e.target.checked) next.add(m.id)
                                else next.delete(m.id)
                                return { ...prev, member_ids: [...next] }
                              })}
                              style={{ width: 14, height: 14, accentColor: 'var(--accent)' }}
                            />
                            <span>{m.handle}</span>
                            <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>T{m.tier}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div className="card" style={{ padding: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                      <div style={{ fontWeight: 600 }}>Shared Council Codes</div>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setFleet501stPasscodes(s => ({ ...s, codes: [...normalizeStringList(s.codes), randomCode('CELL')] }))}
                      >
                        + GENERATE CODE
                      </button>
                    </div>
                    <textarea
                      className="form-textarea"
                      style={{ minHeight: 90, fontFamily: 'var(--font-mono)', fontSize: 11 }}
                      value={(fleet501stPasscodes.codes || []).join('\n')}
                      onChange={e => setFleet501stPasscodes(s => ({ ...s, codes: normalizeStringList(e.target.value.split('\n')) }))}
                      placeholder="One global code per line"
                    />
                    <div style={{ marginTop: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                          <input
                            type="checkbox"
                            checked={!!fleet501stPasscodes.rotating?.enabled}
                            onChange={e => setFleet501stPasscodes(s => ({
                              ...s,
                              rotating: { ...(s.rotating || {}), enabled: e.target.checked },
                            }))}
                            style={{ width: 14, height: 14, accentColor: 'var(--accent)' }}
                          />
                          ENABLE ROTATING CODE
                        </label>
                        <button className="btn btn-ghost btn-sm" onClick={previewRotatingCode}>
                          PREVIEW LIVE CODE
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, marginTop: 8, alignItems: 'end' }}>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>ROTATING SECRET</div>
                          <input
                            className="form-input"
                            style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
                            value={fleet501stPasscodes.rotating?.secret || ''}
                            onChange={e => setFleet501stPasscodes(s => ({
                              ...s,
                              rotating: { ...(s.rotating || {}), secret: e.target.value },
                            }))}
                            placeholder="Keep this private"
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>PERIOD (SEC)</div>
                          <input
                            className="form-input"
                            type="number"
                            min={60}
                            max={3600}
                            value={fleet501stPasscodes.rotating?.period_seconds || 60}
                            onChange={e => setFleet501stPasscodes(s => ({
                              ...s,
                              rotating: { ...(s.rotating || {}), period_seconds: Number(e.target.value) || 60 },
                            }))}
                          />
                        </div>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setFleet501stPasscodes(s => ({
                            ...s,
                            rotating: { ...(s.rotating || {}), secret: randomCode('ROTATE') + randomCode('SEED') },
                          }))}
                        >
                          GENERATE SECRET
                        </button>
                      </div>
                      {fleet501stRotatingPreview?.code && (
                        <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                          LIVE CODE: <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{fleet501stRotatingPreview.code}</span>
                          {' · '}expires {fmt(fleet501stRotatingPreview.expires_at)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="card" style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Per-Member Override Codes</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 8 }}>
                      {d.members
                        .filter(m => fleet501stMembers.member_ids.includes(m.id))
                        .map(m => (
                          <div key={m.id}>
                            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{m.handle}</div>
                            <input
                              className="form-input"
                              style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
                              value={fleet501stPasscodes.member_codes_by_id?.[m.id] || ''}
                              onChange={e => setFleet501stPasscodes(s => ({
                                ...s,
                                member_codes_by_id: { ...(s.member_codes_by_id || {}), [m.id]: e.target.value },
                              }))}
                              placeholder="Optional personal code"
                            />
                          </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button className="btn btn-primary" disabled={fleet501stSaving} onClick={save501stSettings}>
                        {fleet501stSaving ? 'SAVING...' : 'SAVE 501ST SETTINGS'}
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={() => setFleet501stPasscodes(s => ({ ...s, codes: [], member_codes_by_id: {} }))}
                      >
                        CLEAR CODES
                      </button>
                    </div>
                  </div>
                </>
              )}
            </Section>
          </>
        )}

        {/* ── ACTIVITY LOG ── */}
        {tab === 'log' && (
          <Section title={`AUDIT LOG — ${filteredAudit.length}/${d.log.length} ENTRIES`}>
            <div className="card" style={{ padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8 }}>
                <input className="form-input" placeholder="Search action, actor, details..." value={auditQuery} onChange={e => setAuditQuery(e.target.value)} />
                <select className="form-select" value={auditAction} onChange={e => setAuditAction(e.target.value)}>
                  <option value="ALL">ALL ACTIONS</option>
                  {uniqueAuditActions.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <select className="form-select" value={auditActor} onChange={e => setAuditActor(e.target.value)}>
                  <option value="ALL">ALL ACTORS</option>
                  {uniqueAuditActors.map(a => <option key={a.id} value={a.id}>{a.handle}</option>)}
                </select>
                <select className="form-select" value={auditTargetType} onChange={e => setAuditTargetType(e.target.value)}>
                  <option value="ALL">ALL TARGETS</option>
                  {uniqueTargetTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => {
                const rows = filteredAudit.map(l => ({
                  timestamp: l.created_at,
                  action: l.action,
                  actor: l.actor?.handle || '',
                  target_type: l.target_type || '',
                  target_id: l.target_id || '',
                  details: l.details ? JSON.stringify(l.details) : '',
                }))
                exportCSV('audit-log.csv', rows)
              }}>⬇ EXPORT CSV</button>
            </div>
            <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table className="data-table">
              <thead><tr><th>TIMESTAMP</th><th>ACTION</th><th>ACTOR</th><th>TARGET TYPE</th><th>DETAILS</th></tr></thead>
              <tbody>
                {filteredAudit.map(l => (
                  <tr key={l.id}>
                    <td className="mono text-muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmt(l.created_at)}</td>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>{l.action}</td>
                    <td className="text-muted">{l.actor?.handle || '—'}</td>
                    <td className="text-muted">{l.target_type || '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', maxWidth: 250 }} className="truncate">{l.details?.title || (l.details ? JSON.stringify(l.details) : '—')}</td>
                  </tr>
                ))}
                {filteredAudit.length === 0 && <tr><td colSpan={5} className="empty-state">NO MATCHING ENTRIES</td></tr>}
              </tbody>
            </table></div></div>
          </Section>
        )}

        {/* ── DANGER ZONE ── */}
        {tab === 'danger' && (
          <>
            <Section title="☠ DANGER ZONE — DUAL-APPROVE REQUIRED">
              <p style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>
                Each action below is destructive and irreversible. Clicking a button creates a <b>pending request</b>; another founder must approve it before it runs.
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 20 }}>
                Single-founder fallback: the initiator may self-approve after a 5-minute cool-off. Requests expire automatically after 24 hours.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
                {[
                  { key: 'purge_log', label: 'PURGE ACTIVITY LOG' },
                  { key: 'purge_txns', label: 'PURGE TRANSACTIONS' },
                  { key: 'purge_contracts', label: 'PURGE ALL CONTRACTS' },
                  { key: 'purge_intel', label: 'PURGE INTELLIGENCE' },
                  { key: 'purge_fleet', label: 'PURGE FLEET DATA' },
                  { key: 'purge_polls', label: 'PURGE ALL POLLS' },
                  { key: 'purge_ledger', label: 'PURGE LEDGER' },
                  { key: 'purge_loans', label: 'PURGE ALL LOANS' },
                  { key: 'purge_funds', label: 'PURGE SHIP FUNDS' },
                  { key: 'reset_wallets', label: 'RESET ALL WALLETS → 0' },
                  { key: 'reset_treasury', label: 'RESET TREASURY → 0' },
                ].map(a => (
                  <button key={a.key} className="btn btn-danger" style={{ justifyContent: 'center' }} onClick={() => dangerAction(a.key)}>{a.label}</button>
                ))}
              </div>
            </Section>

            <Section title={`PENDING ADMIN ACTIONS — ${d.pending.filter(p => p.status === 'PENDING').length}`}>
              {d.pending.filter(p => p.status === 'PENDING').length === 0 ? (
                <div className="empty-state">No pending requests.</div>
              ) : (
                <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table className="data-table">
                  <thead><tr><th>ACTION</th><th>REASON</th><th>INITIATOR</th><th>REQUESTED</th><th>SELF-APPROVE OK</th><th>EXPIRES</th><th>ACTIONS</th></tr></thead>
                  <tbody>
                    {d.pending.filter(p => p.status === 'PENDING').map(p => {
                      const initiated = new Date(p.initiated_at).getTime()
                      const cooldownReadyAt = initiated + 5 * 60 * 1000
                      const isSelf = p.initiated_by === me.id
                      const selfReady = !isSelf || Date.now() >= cooldownReadyAt
                      return (
                        <tr key={p.id}>
                          <td className="mono" style={{ fontSize: 11, color: 'var(--red)' }}>{p.action_type}</td>
                          <td style={{ fontSize: 12, maxWidth: 280 }}>{p.reason || '—'}</td>
                          <td>{p.initiator?.handle || '—'}{isSelf && <span className="badge badge-accent" style={{ fontSize: 8, marginLeft: 6 }}>YOU</span>}</td>
                          <td className="mono text-muted" style={{ fontSize: 11 }}>{fmt(p.initiated_at)}</td>
                          <td className="mono" style={{ fontSize: 11, color: selfReady ? 'var(--green)' : 'var(--amber)' }}>
                            {!isSelf ? '—' : selfReady ? 'READY' : `at ${new Date(cooldownReadyAt).toLocaleTimeString()}`}
                          </td>
                          <td className="mono text-muted" style={{ fontSize: 11 }}>{fmt(p.expires_at)}</td>
                          <td>
                            <div className="flex gap-8">
                              <button className="btn btn-danger btn-sm" disabled={isSelf && !selfReady} onClick={() => approvePendingAction(p)}>APPROVE</button>
                              {isSelf && <button className="btn btn-ghost btn-sm" onClick={() => cancelPendingAction(p)}>CANCEL</button>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table></div></div>
              )}
            </Section>

            <Section title="RECENT ADMIN ACTION HISTORY">
              {d.pending.filter(p => p.status !== 'PENDING').length === 0 ? (
                <div className="empty-state">No history yet.</div>
              ) : (
                <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table className="data-table">
                  <thead><tr><th>ACTION</th><th>STATUS</th><th>INITIATOR</th><th>APPROVER</th><th>REASON</th><th>RESULT</th><th>WHEN</th></tr></thead>
                  <tbody>
                    {d.pending.filter(p => p.status !== 'PENDING').slice(0, 20).map(p => (
                      <tr key={p.id}>
                        <td className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>{p.action_type}</td>
                        <td>
                          <span className={`badge ${p.status === 'EXECUTED' ? 'badge-green' : p.status === 'CANCELLED' ? 'badge-muted' : 'badge-amber'}`}>{p.status}</span>
                        </td>
                        <td>{p.initiator?.handle || '—'}</td>
                        <td>{p.approver?.handle || '—'}</td>
                        <td style={{ fontSize: 12, maxWidth: 220 }}>{p.reason || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{p.result_message || '—'}</td>
                        <td className="mono text-muted" style={{ fontSize: 11 }}>{fmt(p.approved_at || p.initiated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div></div>
              )}
            </Section>
          </>
        )}
      </div>

      {/* ── MODALS ── */}
      {modal?.type === 'edit_member' && (
        <Modal title={`EDIT — ${modal.member.handle}`} onClose={() => setModal(null)}>
          <div className="form-group">
            <label className="form-label">RANK</label>
            <select className="form-select" value={form.tier} onChange={e => { const t = parseInt(e.target.value); const r = RANKS.find(x => x.tier === t); setForm(f => ({ ...f, tier: t, rank: r.rank })) }}>
              {RANKS.map(r => <option key={r.tier} value={r.tier}>{r.label} (Tier {r.tier})</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">DIVISION</label><select className="form-select" value={form.division || ''} onChange={e => setForm(f => ({ ...f, division: e.target.value }))}><option value="">—</option>{SC_DIVISIONS.map(d => <option key={d} value={d} disabled={d === 'High Command' && !me.is_head_founder}>{d}{d === 'High Command' && !me.is_head_founder ? ' · head-only' : ''}</option>)}</select></div>
            <div className="form-group"><label className="form-label">STATUS</label><select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}><option>ACTIVE</option><option>INACTIVE</option><option>SUSPENDED</option><option>BANNED</option></select></div>
          </div>
          <div className="form-group">
            <label className="form-label">WALLET BALANCE (aUEC)</label>
            <input className="form-input" type="number" value={form.newWallet} onChange={e => setForm(f => ({ ...f, newWallet: parseInt(e.target.value) || 0 }))} />
            <div className="form-hint">Directly set this member's wallet balance.</div>
          </div>
          <div className="form-group">
            <label className="form-label">FOUNDER STATUS</label>
            <select className="form-select" value={form.is_founder ? 'true' : 'false'} onChange={e => setForm(f => ({ ...f, is_founder: e.target.value === 'true' }))}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
            <button className="btn btn-primary" onClick={() => {
              const walletChanged = form.newWallet !== (modal.member.wallet_balance || 0)
              const updates = { rank: form.rank, tier: form.tier, division: form.division || null, status: form.status, is_founder: form.is_founder }
              if (walletChanged) updates.wallet_balance = form.newWallet
              updateMember(modal.member.id, updates)
            }} disabled={saving}>{saving ? 'SAVING...' : 'CONFIRM'}</button>
          </div>
        </Modal>
      )}

      {modal === 'set_treasury' && (
        <Modal title="SET TREASURY BALANCE" onClose={() => setModal(null)}>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>Current: <strong style={{ color: 'var(--accent)' }}>{formatCredits(treasury)}</strong></p>
          <div className="form-group"><label className="form-label">NEW BALANCE (aUEC)</label><input className="form-input" type="number" value={form.treasAmount} onChange={e => setForm(f => ({ ...f, treasAmount: e.target.value }))} /></div>
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button><button className="btn btn-primary" onClick={() => { setTreasuryBalance(parseInt(form.treasAmount) || 0); setModal(null) }}>SET</button></div>
        </Modal>
      )}

      {modal === 'set_tax' && (
        <Modal title="SET ORG TAX RATE" onClose={() => setModal(null)}>
          <div className="form-group"><label className="form-label">TAX RATE (%)</label><input className="form-input" type="number" min="0" max="100" value={form.newTax} onChange={e => setForm(f => ({ ...f, newTax: e.target.value }))} /></div>
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button><button className="btn btn-primary" onClick={() => { saveTaxRate(parseInt(form.newTax) || 0); setModal(null) }}>SAVE</button></div>
        </Modal>
      )}
    </>
  )
}
