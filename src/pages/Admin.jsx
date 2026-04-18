import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { RANKS, formatCredits } from '../lib/ranks'
import { SC_DIVISIONS } from '../lib/scdata'
import Modal from '../components/Modal'
import RankBadge from '../components/RankBadge'
import { discordAnnouncement } from '../lib/discord'
import { exportCSV } from '../lib/csv'
import { NAV, NAV_ITEMS, MAINT_BYPASS_TIER } from '../lib/nav'
import { notifyMaintenanceChange } from '../hooks/useMaintenanceMap'

const STRIKE_SUSPEND_THRESHOLD = 3
const STRIKE_BAN_THRESHOLD = 5
const AUTO_SUSPEND_DAYS = 7

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

  // ── FOUNDER CHECK — only SearthNox (is_founder) gets this page ──
  if (!me.is_founder) {
    return (
      <div className="page-body">
        <div className="empty-state" style={{ padding: 60 }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>ACCESS DENIED</div>
          <div style={{ color: 'var(--text-3)' }}>This panel is restricted to the Founder.</div>
        </div>
      </div>
    )
  }

  const load = useCallback(async () => {
    const [
      { data: members }, { data: contracts }, { data: intelligence }, { data: ledger },
      { data: recruitment }, { data: polls }, { data: announcements }, { data: log },
      { data: txns }, { data: loans }, { data: funds }, { data: budgets },
      { data: blacklist },
      { data: pending },
      { data: tres }, { data: settings },
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
    ])
    setD({ members: members||[], contracts: contracts||[], intelligence: intelligence||[], ledger: ledger||[], recruitment: recruitment||[], polls: polls||[], announcements: announcements||[], log: log||[], transactions: txns||[], loans: loans||[], funds: funds||[], budgets: budgets||[], blacklist: blacklist||[], pending: pending||[] })
    setTreasury(tres?.balance || 0)
    if (settings?.value?.percent !== undefined) setTaxRate(settings.value.percent)
    // Load Discord webhooks
    const { data: wh } = await supabase.from('org_settings').select('key, value').ilike('key', 'discord_%')
    const whMap = {}
    ;(wh || []).forEach(w => { whMap[w.key] = w.value?.url || '' })
    setWebhooks(whMap)
    // Load page maintenance map
    const { data: maintRow } = await supabase.from('org_settings').select('value').eq('key', 'page_maintenance').maybeSingle()
    setMaintMap(maintRow?.value || {})
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function flash(m) { setMsg(m); setTimeout(() => setMsg(''), 3000) }
  async function logAction(action, targetId, details) {
    await supabase.from('activity_log').insert({ action, actor_id: me.id, target_id: targetId || null, details })
  }

  async function sendModerationAlert(action, member, reason, details = {}) {
    const url = webhooks.discord_webhook_moderation || webhooks.discord_webhook_announcements
    if (!url) { flash(`${action} recorded — no moderation webhook configured, Discord not notified.`); return }
    try {
      const extra = []
      if (details.days) extra.push(`Duration: ${details.days}d`)
      if (details.suspended_until) extra.push(`Until: ${new Date(details.suspended_until).toLocaleString()}`)
      if (details.strike_count !== undefined) extra.push(`Strikes: ${details.strike_count}`)
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'Grayveil Moderation',
          embeds: [{
            title: `⚖ ${action}`,
            description: `Member: **${member.handle}**\nReason: ${reason}${extra.length ? `\n${extra.join('\n')}` : ''}`,
            color: action === 'BAN' ? 0xd64545 : action === 'SUSPEND' ? 0xd48b3a : 0x4aa3d4,
            footer: { text: `By ${me.handle}` },
            timestamp: new Date().toISOString(),
          }],
        }),
      })
      if (!resp.ok) flash(`${action} recorded — Discord webhook returned ${resp.status}.`)
    } catch (e) {
      flash(`${action} recorded — Discord alert failed: ${e.message}`)
    }
  }

  // ── DISCIPLINARY ACTIONS ──
  async function disciplineMember(member, action) {
    if (!member?.id) return
    if (member.is_founder && action !== 'WARN') { flash('Founder account cannot be disciplined from this panel.'); return }
    const reason = prompt(`${action} reason for ${member.handle}:`)
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
      const daysRaw = prompt('Suspend for how many days? (blank = indefinite)', '7')
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
      if (!confirm(`Ban ${member.handle}? This will remove access.`)) return
      const daysRaw = prompt('Ban for how many days? (blank = permanent)', '')
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
    const reason = prompt(`Reason to reset strike count for ${member.handle}:`)
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
    setSaving(true)
    await supabase.from('profiles').update(updates).eq('id', id)
    await logAction('admin_update_member', id, updates)
    setModal(null); setSaving(false); flash('Member updated.'); load()
  }
  async function deleteMember(m) {
    if (!confirm(`PERMANENTLY DELETE ${m.handle}? This is irreversible.`)) return
    await supabase.from('profiles').delete().eq('id', m.id)
    await logAction('admin_delete_member', m.id, { handle: m.handle })
    flash(`${m.handle} removed.`); load()
  }
  async function adjustWallet(memberId, newBalance) {
    await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', memberId)
    await logAction('admin_adjust_wallet', memberId, { new_balance: newBalance })
    flash('Wallet adjusted.'); load()
  }

  // ── BANK ACTIONS ──
  async function setTreasuryBalance(newBal) {
    await supabase.from('treasury').update({ balance: newBal }).eq('id', 1)
    await logAction('admin_set_treasury', null, { new_balance: newBal })
    flash('Treasury updated.'); load()
  }
  async function saveTaxRate(pct) {
    await supabase.from('org_settings').upsert({ key: 'tax_rate', value: { percent: pct }, updated_by: me.id })
    flash('Tax rate updated.'); load()
  }

  // ── LOAN ACTIONS ──
  async function approveLoan(loan) {
    const borrower = d.members.find(m => m.id === loan.borrower_id)
    await supabase.from('loans').update({ status: 'ACTIVE', approved_by: me.id }).eq('id', loan.id)
    await supabase.from('treasury').update({ balance: treasury - loan.amount }).eq('id', 1)
    await supabase.from('profiles').update({ wallet_balance: (borrower?.wallet_balance || 0) + loan.amount }).eq('id', loan.borrower_id)
    await supabase.from('transactions').insert({ type: 'loan_out', from_type: 'treasury', to_type: 'wallet', to_id: loan.borrower_id, amount: loan.amount, description: `Loan: ${loan.reason}`, recorded_by: me.id })
    flash('Loan approved & disbursed.'); load()
  }
  async function denyLoan(id) { await supabase.from('loans').update({ status: 'DENIED', approved_by: me.id }).eq('id', id); flash('Loan denied.'); load() }
  async function forgiveLoan(id) { await supabase.from('loans').update({ status: 'REPAID', repaid: 0 }).eq('id', id); await logAction('admin_forgive_loan', id, {}); flash('Loan forgiven.'); load() }

  // ── FUND ACTIONS ──
  async function cancelFund(id) { await supabase.from('ship_funds').update({ status: 'CANCELLED' }).eq('id', id); flash('Fund cancelled.'); load() }
  async function completeFund(id) { await supabase.from('ship_funds').update({ status: 'COMPLETED' }).eq('id', id); flash('Fund marked complete.'); load() }

  // ── ANNOUNCEMENT ──
  async function postAnnouncement() {
    if (!form.ann_title || !form.ann_content) return
    setSaving(true)
    await supabase.from('announcements').insert({ title: form.ann_title, content: form.ann_content, priority: form.ann_priority || 'ROUTINE', posted_by: me.id })
    await logAction('announcement_posted', null, { title: form.ann_title })
    discordAnnouncement(form.ann_title, form.ann_content, me.handle)
    setModal(null); setSaving(false); flash('Posted.'); load()
  }
  async function deleteAnnouncement(id) {
    if (!confirm('Delete this announcement?')) return
    await supabase.from('announcements').delete().eq('id', id); flash('Deleted.'); load()
  }

  // ── DANGER ZONE — DUAL APPROVE ──
  // Step 1: any founder REQUESTS the destructive action with a reason.
  // Step 2: a different founder (or the initiator after a 5-minute cool-off) APPROVES.
  // The actual delete/update runs server-side inside approve_admin_action().
  async function dangerAction(type) {
    const labels = {
      purge_log: 'PURGE activity log', purge_txns: 'PURGE transactions',
      purge_contracts: 'PURGE all contracts', purge_intel: 'PURGE intelligence',
      purge_fleet: 'PURGE fleet data', purge_polls: 'PURGE all polls',
      purge_ledger: 'PURGE ledger', purge_loans: 'PURGE loans',
      purge_funds: 'PURGE ship funds', reset_wallets: 'RESET all wallets to 0',
      reset_treasury: 'RESET treasury to 0',
    }
    const label = labels[type] || type
    const reason = prompt(`Reason to request "${label}"?\n\nThis creates a pending request. Another founder must approve it (or you may self-approve after a 5-minute cool-off).`)
    if (!reason || reason.trim().length < 3) { if (reason !== null) flash('Reason must be at least 3 characters.'); return }
    const { error } = await supabase.rpc('request_admin_action', { p_action_type: type, p_reason: reason.trim() })
    if (error) { flash(`Request failed: ${error.message}`); return }
    flash(`Request submitted: ${label}. Awaiting approval.`)
    load()
  }

  async function approvePendingAction(row) {
    const isSelf = row.initiated_by === me.id
    const ack = isSelf
      ? `Self-approve "${row.action_type}"?\n\nReason: ${row.reason}\n\nThis will execute the destructive action immediately.`
      : `Approve "${row.action_type}" requested by ${row.initiator?.handle || 'another founder'}?\n\nReason: ${row.reason}\n\nThis will execute the destructive action immediately.`
    if (!confirm(ack)) return
    const { data, error } = await supabase.rpc('approve_admin_action', { p_id: row.id })
    if (error) { flash(`Approve failed: ${error.message}`); return }
    flash(data || 'Action executed.')
    load()
  }

  async function cancelPendingAction(row) {
    if (!confirm(`Cancel pending request "${row.action_type}"?`)) return
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

  const TABS = ['overview', 'members', 'discipline', 'bank', 'loans', 'funds', 'comms', 'contracts', 'discord', 'maintenance', 'log', 'danger']
  const fmt = ts => new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  if (loading) return <div className="page-body"><div className="loading">LOADING ADMIN...</div></div>

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              COMMAND CONSOLE
              <span className="badge badge-accent" style={{ fontSize: 9 }}>FOUNDER</span>
            </div>
            <div className="page-subtitle">Full administrative control — {me.handle}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t} style={{ background: 'none', border: 'none', borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent', padding: '10px 16px', fontSize: 11, letterSpacing: '.08em', fontFamily: 'var(--font-mono)', color: tab === t ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer' }}
              onClick={() => setTab(t)}>{t.toUpperCase()}
              {t === 'loans' && pendingLoans > 0 && <span style={{ color: 'var(--red)', marginLeft: 4 }}>({pendingLoans})</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {msg && <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 6, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: 'var(--accent)' }}>{msg}</div>}

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <>
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
            <Section title="MEMBER WEALTH DISTRIBUTION">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {d.members.sort((a, b) => (b.wallet_balance||0) - (a.wallet_balance||0)).map(m => {
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
                setWebhookSaving(true)
                for (const [key, url] of Object.entries(webhooks)) {
                  await supabase.from('org_settings').upsert({ key, value: { url }, updated_by: me.id }, { onConflict: 'key' })
                }
                setWebhookSaving(false)
                flash('Discord webhooks saved')
              }}>
              {webhookSaving ? 'SAVING...' : 'SAVE ALL WEBHOOKS'}
            </button>

            {/* Test webhook */}
            <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>TEST WEBHOOK</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['announcements', 'operations', 'kills', 'contracts', 'recruitment', 'promotions'].map(ch => (
                  <button key={ch} className="btn btn-ghost btn-sm" onClick={async () => {
                    const url = webhooks[`discord_webhook_${ch}`]
                    if (!url) { flash(`No webhook URL set for ${ch}`); return }
                    try {
                      await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          username: 'Grayveil Corporation',
                          embeds: [{ title: `✅ Webhook Test: ${ch}`, description: 'This channel is connected to grayveil.net', color: 0xc8a55a, timestamp: new Date().toISOString() }],
                        }),
                      })
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
                  setMaintSaving(true)
                  const cleaned = {}
                  for (const [route, cfg] of Object.entries(maintMap)) {
                    if (cfg?.enabled || cfg?.note) cleaned[route] = { enabled: !!cfg.enabled, note: cfg.note || '' }
                  }
                  const { error } = await supabase.from('org_settings').upsert(
                    { key: 'page_maintenance', value: cleaned, updated_by: me.id },
                    { onConflict: 'key' },
                  )
                  setMaintSaving(false)
                  if (error) { flash(`Save failed: ${error.message}`); return }
                  notifyMaintenanceChange(cleaned)
                  await logAction('maintenance_updated', null, { routes: Object.keys(cleaned).filter(k => cleaned[k].enabled) })
                  flash('Maintenance settings saved')
                }}>
                {maintSaving ? 'SAVING...' : 'SAVE MAINTENANCE SETTINGS'}
              </button>
              <button className="btn btn-ghost" disabled={maintSaving}
                onClick={async () => {
                  if (!confirm('Clear all maintenance flags? Every section will be accessible again.')) return
                  setMaintSaving(true)
                  const { error } = await supabase.from('org_settings').upsert(
                    { key: 'page_maintenance', value: {}, updated_by: me.id },
                    { onConflict: 'key' },
                  )
                  setMaintSaving(false)
                  if (error) { flash(`Clear failed: ${error.message}`); return }
                  setMaintMap({})
                  notifyMaintenanceChange({})
                  await logAction('maintenance_cleared', null, {})
                  flash('All sections back online')
                }}>
                CLEAR ALL
              </button>
            </div>
          </Section>
        )}

        {/* ── ACTIVITY LOG ── */}
        {tab === 'log' && (
          <Section title={`AUDIT LOG — LAST ${d.log.length} ENTRIES`}>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => {
                const rows = d.log.map(l => ({
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
                {d.log.map(l => (
                  <tr key={l.id}>
                    <td className="mono text-muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmt(l.created_at)}</td>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>{l.action}</td>
                    <td className="text-muted">{l.actor?.handle || '—'}</td>
                    <td className="text-muted">{l.target_type || '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', maxWidth: 250 }} className="truncate">{l.details?.title || (l.details ? JSON.stringify(l.details) : '—')}</td>
                  </tr>
                ))}
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
            <div className="form-group"><label className="form-label">DIVISION</label><select className="form-select" value={form.division || ''} onChange={e => setForm(f => ({ ...f, division: e.target.value }))}><option value="">—</option>{SC_DIVISIONS.map(d => <option key={d}>{d}</option>)}</select></div>
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
