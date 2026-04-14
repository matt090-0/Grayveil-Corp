import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { RANKS, formatCredits } from '../lib/ranks'
import Modal from '../components/Modal'
import RankBadge from '../components/RankBadge'

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        fontSize: 10, letterSpacing: '.2em', color: 'var(--accent)',
        fontFamily: 'var(--font-mono)', marginBottom: 16,
        paddingBottom: 8, borderBottom: '1px solid var(--accent-dim)',
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        <span style={{ color: 'var(--accent)' }}>◆</span> {title}
      </div>
      {children}
    </div>
  )
}

function StatBox({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--bg-raised)', border: '1px solid var(--border)',
      borderRadius: 'var(--border-radius-lg)', padding: '14px 18px'
    }}>
      <div style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: color || 'var(--text-1)' }}>{value}</div>
    </div>
  )
}

export default function Admin() {
  const { profile: me } = useAuth()
  const [tab, setTab] = useState('stats')
  const [data, setData] = useState({
    members: [], contracts: [], intelligence: [], ledger: [],
    recruitment: [], polls: [], announcements: [], log: []
  })
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const [
      { data: members },
      { data: contracts },
      { data: intelligence },
      { data: ledger },
      { data: recruitment },
      { data: polls },
      { data: announcements },
      { data: log },
    ] = await Promise.all([
      supabase.from('profiles').select('*').order('tier').order('handle'),
      supabase.from('contracts').select('*, posted_by:profiles(handle)').order('created_at', { ascending: false }),
      supabase.from('intelligence').select('*, posted_by:profiles(handle)').order('created_at', { ascending: false }),
      supabase.from('ledger').select('*, member:profiles!ledger_member_id_fkey(handle)').order('created_at', { ascending: false }),
      supabase.from('recruitment').select('*').order('created_at', { ascending: false }),
      supabase.from('polls').select('*, created_by:profiles(handle)').order('created_at', { ascending: false }),
      supabase.from('announcements').select('*, posted_by:profiles(handle)').order('created_at', { ascending: false }),
      supabase.from('activity_log').select('*, actor:profiles!activity_log_actor_id_fkey(handle)').order('created_at', { ascending: false }).limit(100),
    ])
    setData({ members: members||[], contracts: contracts||[], intelligence: intelligence||[], ledger: ledger||[], recruitment: recruitment||[], polls: polls||[], announcements: announcements||[], log: log||[] })
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function logAction(action, targetId, details) {
    await supabase.from('activity_log').insert({ action, actor_id: me.id, target_id: targetId || null, details })
  }

  function flash(m) { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  // ── MEMBER ACTIONS ──
  async function updateMember(id, updates, logMsg) {
    setSaving(true)
    await supabase.from('profiles').update(updates).eq('id', id)
    await logAction(logMsg, id, updates)
    setModal(null); setSaving(false); flash('Done.'); load()
  }

  async function deleteMember(m) {
    if (!confirm(`Permanently delete ${m.handle}? This cannot be undone.`)) return
    await supabase.auth.admin?.deleteUser?.(m.id)
    await supabase.from('profiles').delete().eq('id', m.id)
    await logAction('DELETE_MEMBER', m.id, { handle: m.handle })
    flash(`${m.handle} removed.`); load()
  }

  // ── CONTRACT ACTIONS ──
  async function updateContract(id, updates) {
    await supabase.from('contracts').update(updates).eq('id', id)
    await logAction('UPDATE_CONTRACT', null, { contract_id: id, ...updates })
    flash('Contract updated.'); load()
  }

  async function deleteContract(id) {
    if (!confirm('Delete this contract permanently?')) return
    await supabase.from('contracts').delete().eq('id', id)
    await logAction('DELETE_CONTRACT', null, { contract_id: id })
    flash('Contract deleted.'); load()
  }

  // ── INTEL ACTIONS ──
  async function deleteIntel(id) {
    if (!confirm('Purge this intelligence file?')) return
    await supabase.from('intelligence').delete().eq('id', id)
    await logAction('DELETE_INTEL', null, { intel_id: id })
    flash('File purged.'); load()
  }

  // ── ANNOUNCEMENT ──
  async function postAnnouncement() {
    if (!form.title || !form.content) return
    setSaving(true)
    await supabase.from('announcements').insert({ title: form.title, content: form.content, priority: form.priority || 'ROUTINE', posted_by: me.id })
    await logAction('POST_ANNOUNCEMENT', null, { title: form.title, priority: form.priority })
    setModal(null); setSaving(false); flash('Transmission sent.'); load()
  }

  async function deleteAnnouncement(id) {
    if (!confirm('Delete this announcement?')) return
    await supabase.from('announcements').delete().eq('id', id)
    await logAction('DELETE_ANNOUNCEMENT', null, { ann_id: id })
    flash('Deleted.'); load()
  }

  // ── LEDGER ──
  async function addLedgerEntry() {
    if (!form.member_id || !form.amount || !form.description) return
    setSaving(true)
    const amount = parseInt(form.amount) * (form.type === 'debit' ? -1 : 1)
    await supabase.from('ledger').insert({ member_id: form.member_id, amount, description: form.description, recorded_by: me.id })
    await logAction('LEDGER_ENTRY', form.member_id, { amount, description: form.description })
    setModal(null); setSaving(false); flash('Entry added.'); load()
  }

  // ── RECRUITMENT ──
  async function updateRecruitment(id, status) {
    await supabase.from('recruitment').update({ status, updated_by: me.id }).eq('id', id)
    await logAction('UPDATE_RECRUITMENT', null, { id, status })
    flash('Pipeline updated.'); load()
  }

  async function deleteRecruitment(id) {
    if (!confirm('Remove from pipeline?')) return
    await supabase.from('recruitment').delete().eq('id', id)
    flash('Removed.'); load()
  }

  // ── POLLS ──
  async function deletePoll(id) {
    if (!confirm('Delete poll and all votes?')) return
    await supabase.from('polls').delete().eq('id', id)
    await logAction('DELETE_POLL', null, { poll_id: id })
    flash('Poll deleted.'); load()
  }

  // ── DANGER ZONE ──
  async function dangerAction(type) {
    if (!confirm(`CONFIRM: ${type}? This is irreversible.`)) return
    if (type === 'WIPE_POLLS') {
      await supabase.from('polls').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      flash('All polls wiped.')
    } else if (type === 'WIPE_INTEL') {
      await supabase.from('intelligence').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      flash('All intelligence purged.')
    } else if (type === 'RESET_RECRUITMENT') {
      await supabase.from('recruitment').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      flash('Recruitment pipeline cleared.')
    } else if (type === 'WIPE_LEDGER') {
      await supabase.from('ledger').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      flash('All ledger entries wiped.')
    } else if (type === 'WIPE_LOG') {
      await supabase.from('activity_log').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      flash('Activity log cleared.')
    }
    await logAction('DANGER_' + type, null, {})
    load()
  }

  // ── STATS ──
  const totalEarned = data.ledger.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0)
  const activeMembers = data.members.filter(m => m.status === 'ACTIVE').length
  const openContracts = data.contracts.filter(c => c.status === 'OPEN').length
  const pendingRecruits = data.recruitment.filter(r => r.status === 'PENDING').length

  const memberBalances = data.members.map(m => ({
    ...m,
    balance: data.ledger.filter(e => e.member_id === m.id).reduce((s, e) => s + e.amount, 0)
  })).sort((a, b) => b.balance - a.balance)

  const TABS = ['stats', 'members', 'contracts', 'intel', 'comms', 'ledger', 'recruit', 'polls', 'log', 'danger']

  if (loading) return (
    <>
      <div className="page-header"><div className="page-title">ADMIN CONSOLE</div></div>
      <div className="page-body"><div className="loading">LOADING ADMIN DATA...</div></div>
    </>
  )

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 16 }}>
          <div>
            <div className="page-title" style={{ color: 'var(--accent)' }}>ADMIN CONSOLE</div>
            <div className="page-subtitle">Architect access — full operational control</div>
          </div>
          {msg && <div style={{ background: 'var(--green-dim)', color: 'var(--green)', padding: '8px 16px', borderRadius: 'var(--border-radius-sm)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>{msg}</div>}
        </div>
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: '.5px solid var(--border-tertiary)', paddingBottom: 0 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                background: 'none', border: 'none', borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em',
                color: tab === t ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer', marginBottom: '-.5px'
              }}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body">

        {/* ── STATS ── */}
        {tab === 'stats' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, marginBottom: 24 }}>
              <StatBox label="ACTIVE MEMBERS" value={activeMembers} />
              <StatBox label="OPEN CONTRACTS" value={openContracts} color="var(--accent)" />
              <StatBox label="PENDING RECRUITS" value={pendingRecruits} color="var(--amber)" />
              <StatBox label="TOTAL EARNINGS" value={formatCredits(totalEarned)} color="var(--green)" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <Section title="RANK DISTRIBUTION">
                  <table className="data-table">
                    <thead><tr><th>RANK</th><th>COUNT</th></tr></thead>
                    <tbody>
                      {RANKS.map(r => {
                        const count = data.members.filter(m => m.tier === r.tier).length
                        if (!count) return null
                        return <tr key={r.tier}><td><RankBadge tier={r.tier} /></td><td className="mono">{count}</td></tr>
                      })}
                    </tbody>
                  </table>
                </Section>
              </div>
              <div>
                <Section title="TOP EARNERS">
                  <table className="data-table">
                    <thead><tr><th>MEMBER</th><th style={{ textAlign: 'right' }}>BALANCE</th></tr></thead>
                    <tbody>
                      {memberBalances.slice(0, 8).map(m => (
                        <tr key={m.id}>
                          <td>{m.handle}</td>
                          <td className="mono" style={{ textAlign: 'right', color: m.balance >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {formatCredits(m.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              </div>
            </div>
          </>
        )}

        {/* ── MEMBERS ── */}
        {tab === 'members' && (
          <Section title={`MEMBER MANAGEMENT — ${data.members.length} TOTAL`}>
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>HANDLE</th><th>RANK</th><th>STATUS</th><th>JOINED</th><th>ACTIONS</th></tr></thead>
                  <tbody>
                    {data.members.map(m => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 500 }}>
                          {m.handle}
                          {m.is_founder && <span className="badge badge-accent" style={{ marginLeft: 6, fontSize: 9 }}>FOUNDER</span>}
                        </td>
                        <td><RankBadge tier={m.tier} /></td>
                        <td><span className={`badge ${m.status === 'ACTIVE' ? 'badge-green' : m.status === 'SUSPENDED' ? 'badge-red' : 'badge-muted'}`}>{m.status}</span></td>
                        <td className="mono text-muted" style={{ fontSize: 11 }}>{new Date(m.joined_at).toLocaleDateString('en-GB')}</td>
                        <td>
                          {m.id !== me.id && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ id: m.id, handle: m.handle, tier: m.tier, rank: m.rank, status: m.status, division: m.division || '', speciality: m.speciality || '' }); setModal('editMember') }}>EDIT</button>
                              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--amber)' }}
                                onClick={() => updateMember(m.id, { status: m.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED' }, m.status === 'SUSPENDED' ? 'UNSUSPEND_MEMBER' : 'SUSPEND_MEMBER')}>
                                {m.status === 'SUSPENDED' ? 'UNSUSPEND' : 'SUSPEND'}
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => deleteMember(m)}>DELETE</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        )}

        {/* ── CONTRACTS ── */}
        {tab === 'contracts' && (
          <Section title={`CONTRACT CONTROL — ${data.contracts.length} TOTAL`}>
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>TITLE</th><th>TYPE</th><th>REWARD</th><th>STATUS</th><th>POSTED BY</th><th>ACTIONS</th></tr></thead>
                  <tbody>
                    {data.contracts.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 500, maxWidth: 200 }} className="truncate">{c.title}</td>
                        <td className="mono text-muted" style={{ fontSize: 11 }}>{c.contract_type}</td>
                        <td className="mono" style={{ color: 'var(--accent)' }}>{formatCredits(c.reward)}</td>
                        <td><span className={`badge ${c.status === 'OPEN' ? 'badge-green' : c.status === 'ACTIVE' ? 'badge-amber' : c.status === 'COMPLETE' ? 'badge-blue' : 'badge-muted'}`}>{c.status}</span></td>
                        <td className="text-muted">{c.posted_by?.handle || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {c.status !== 'COMPLETE' && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--green)' }} onClick={() => updateContract(c.id, { status: 'COMPLETE' })}>COMPLETE</button>}
                            {c.status !== 'CANCELLED' && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--amber)' }} onClick={() => updateContract(c.id, { status: 'CANCELLED' })}>CANCEL</button>}
                            <button className="btn btn-danger btn-sm" onClick={() => deleteContract(c.id)}>DELETE</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        )}

        {/* ── INTEL ── */}
        {tab === 'intel' && (
          <Section title={`INTELLIGENCE FILES — ${data.intelligence.length} TOTAL`}>
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>TITLE</th><th>CLASSIFICATION</th><th>FILED BY</th><th>DATE</th><th>ACTION</th></tr></thead>
                  <tbody>
                    {data.intelligence.map(f => (
                      <tr key={f.id}>
                        <td style={{ fontWeight: 500 }}>{f.title}</td>
                        <td><span className={`badge ${f.classification === 'OPEN' ? 'badge-muted' : f.classification === 'RESTRICTED' ? 'badge-amber' : f.classification === 'CLASSIFIED' ? 'badge-red' : 'badge-purple'}`}>{f.classification}</span></td>
                        <td className="text-muted">{f.posted_by?.handle || '—'}</td>
                        <td className="mono text-muted" style={{ fontSize: 11 }}>{new Date(f.created_at).toLocaleDateString('en-GB')}</td>
                        <td><button className="btn btn-danger btn-sm" onClick={() => deleteIntel(f.id)}>PURGE</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        )}

        {/* ── COMMS ── */}
        {tab === 'comms' && (
          <>
            <Section title="POST TRANSMISSION">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">TITLE</label>
                  <input className="form-input" value={form.ann_title || ''} onChange={e => setForm(f => ({ ...f, ann_title: e.target.value }))} placeholder="Transmission title" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">PRIORITY</label>
                  <select className="form-select" value={form.ann_priority || 'ROUTINE'} onChange={e => setForm(f => ({ ...f, ann_priority: e.target.value }))}>
                    <option>ROUTINE</option><option>HIGH</option><option>CRITICAL</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">CONTENT</label>
                <textarea className="form-textarea" value={form.ann_content || ''} onChange={e => setForm(f => ({ ...f, ann_content: e.target.value }))} placeholder="Message to all operatives..." style={{ minHeight: 100 }} />
              </div>
              <button className="btn btn-primary" disabled={saving} onClick={async () => {
                if (!form.ann_title || !form.ann_content) return
                setSaving(true)
                await supabase.from('announcements').insert({ title: form.ann_title, content: form.ann_content, priority: form.ann_priority || 'ROUTINE', posted_by: me.id })
                await logAction('POST_ANNOUNCEMENT', null, { title: form.ann_title })
                setForm(f => ({ ...f, ann_title: '', ann_content: '', ann_priority: 'ROUTINE' }))
                setSaving(false); flash('Transmission sent.'); load()
              }}>
                {saving ? 'SENDING...' : 'SEND TRANSMISSION'}
              </button>
            </Section>
            <Section title={`EXISTING TRANSMISSIONS — ${data.announcements.length}`}>
              <div className="card" style={{ padding: 0 }}>
                <table className="data-table">
                  <thead><tr><th>TITLE</th><th>PRIORITY</th><th>FROM</th><th>DATE</th><th>ACTION</th></tr></thead>
                  <tbody>
                    {data.announcements.map(a => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 500 }}>{a.title}</td>
                        <td><span className={`badge ${a.priority === 'CRITICAL' ? 'badge-red' : a.priority === 'HIGH' ? 'badge-amber' : 'badge-muted'}`}>{a.priority}</span></td>
                        <td className="text-muted">{a.posted_by?.handle || '—'}</td>
                        <td className="mono text-muted" style={{ fontSize: 11 }}>{new Date(a.created_at).toLocaleDateString('en-GB')}</td>
                        <td><button className="btn btn-danger btn-sm" onClick={() => deleteAnnouncement(a.id)}>DELETE</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}

        {/* ── LEDGER ── */}
        {tab === 'ledger' && (
          <>
            <Section title="ADD LEDGER ENTRY">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">MEMBER</label>
                  <select className="form-select" value={form.led_member || ''} onChange={e => setForm(f => ({ ...f, led_member: e.target.value }))}>
                    <option value="">Select...</option>
                    {data.members.map(m => <option key={m.id} value={m.id}>{m.handle}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">TYPE</label>
                  <select className="form-select" value={form.led_type || 'credit'} onChange={e => setForm(f => ({ ...f, led_type: e.target.value }))}>
                    <option value="credit">CREDIT (+)</option><option value="debit">DEBIT (−)</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">AMOUNT (aUEC)</label>
                  <input className="form-input" type="number" value={form.led_amount || ''} onChange={e => setForm(f => ({ ...f, led_amount: e.target.value }))} placeholder="0" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">DESCRIPTION</label>
                  <input className="form-input" value={form.led_desc || ''} onChange={e => setForm(f => ({ ...f, led_desc: e.target.value }))} placeholder="Reason..." />
                </div>
              </div>
              <button className="btn btn-primary" disabled={saving} onClick={async () => {
                if (!form.led_member || !form.led_amount || !form.led_desc) return
                setSaving(true)
                const amount = parseInt(form.led_amount) * (form.led_type === 'debit' ? -1 : 1)
                await supabase.from('ledger').insert({ member_id: form.led_member, amount, description: form.led_desc, recorded_by: me.id })
                await logAction('LEDGER_ENTRY', form.led_member, { amount, description: form.led_desc })
                setForm(f => ({ ...f, led_member: '', led_amount: '', led_desc: '' }))
                setSaving(false); flash('Entry added.'); load()
              }}>
                {saving ? 'SAVING...' : 'ADD ENTRY'}
              </button>
            </Section>
            <Section title="MEMBER BALANCES">
              <div className="card" style={{ padding: 0 }}>
                <table className="data-table">
                  <thead><tr><th>MEMBER</th><th>RANK</th><th style={{ textAlign: 'right' }}>BALANCE</th><th style={{ textAlign: 'right' }}>TOTAL EARNED</th><th style={{ textAlign: 'right' }}>TOTAL SPENT</th></tr></thead>
                  <tbody>
                    {memberBalances.map(m => {
                      const earned = data.ledger.filter(e => e.member_id === m.id && e.amount > 0).reduce((s, e) => s + e.amount, 0)
                      const spent = data.ledger.filter(e => e.member_id === m.id && e.amount < 0).reduce((s, e) => s + e.amount, 0)
                      return (
                        <tr key={m.id}>
                          <td style={{ fontWeight: 500 }}>{m.handle}</td>
                          <td><RankBadge tier={m.tier} /></td>
                          <td className="mono" style={{ textAlign: 'right', color: m.balance >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatCredits(m.balance)}</td>
                          <td className="mono text-muted" style={{ textAlign: 'right' }}>{formatCredits(earned)}</td>
                          <td className="mono" style={{ textAlign: 'right', color: 'var(--red)' }}>{formatCredits(spent)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}

        {/* ── RECRUITMENT ── */}
        {tab === 'recruit' && (
          <Section title={`RECRUITMENT PIPELINE — ${data.recruitment.length} TOTAL`}>
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>HANDLE</th><th>DISCORD</th><th>STATUS</th><th>NOTES</th><th>DATE</th><th>ACTIONS</th></tr></thead>
                  <tbody>
                    {data.recruitment.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 500 }}>{r.handle}</td>
                        <td className="mono text-muted">{r.discord || '—'}</td>
                        <td><span className={`badge ${r.status === 'APPROVED' ? 'badge-green' : r.status === 'VETTING' ? 'badge-amber' : r.status === 'REJECTED' ? 'badge-red' : 'badge-muted'}`}>{r.status}</span></td>
                        <td style={{ maxWidth: 180, fontSize: 12, color: 'var(--text-2)' }} className="truncate">{r.notes || '—'}</td>
                        <td className="mono text-muted" style={{ fontSize: 11 }}>{new Date(r.created_at).toLocaleDateString('en-GB')}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, color: 'var(--green)' }} onClick={() => updateRecruitment(r.id, 'APPROVED')}>✓</button>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, color: 'var(--amber)' }} onClick={() => updateRecruitment(r.id, 'VETTING')}>?</button>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, color: 'var(--red)' }} onClick={() => updateRecruitment(r.id, 'REJECTED')}>✕</button>
                            <button className="btn btn-danger btn-sm" onClick={() => deleteRecruitment(r.id)}>DEL</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        )}

        {/* ── POLLS ── */}
        {tab === 'polls' && (
          <Section title={`POLL MANAGEMENT — ${data.polls.length} TOTAL`}>
            <div className="card" style={{ padding: 0 }}>
              <table className="data-table">
                <thead><tr><th>QUESTION</th><th>CREATED BY</th><th>CLOSES</th><th>ACTION</th></tr></thead>
                <tbody>
                  {data.polls.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>{p.question}</td>
                      <td className="text-muted">{p.created_by?.handle || '—'}</td>
                      <td className="mono text-muted" style={{ fontSize: 11 }}>{p.ends_at ? new Date(p.ends_at).toLocaleDateString('en-GB') : 'No expiry'}</td>
                      <td><button className="btn btn-danger btn-sm" onClick={() => deletePoll(p.id)}>DELETE</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* ── ACTIVITY LOG ── */}
        {tab === 'log' && (
          <Section title={`ACTIVITY LOG — LAST ${data.log.length} ENTRIES`}>
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>TIMESTAMP</th><th>ACTION</th><th>ACTOR</th><th>TARGET</th><th>DETAILS</th></tr></thead>
                  <tbody>
                    {data.log.map(l => (
                      <tr key={l.id}>
                        <td className="mono text-muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                          {new Date(l.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>{l.action}</td>
                        <td className="text-muted">{l.actor?.handle || '—'}</td>
                        <td className="text-muted">{l.target_type || '—'}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', maxWidth: 200 }} className="truncate">
                          {l.details?.title || (l.details ? JSON.stringify(l.details) : '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>
        )}

        {/* ── DANGER ZONE ── */}
        {tab === 'danger' && (
          <Section title="DANGER ZONE — IRREVERSIBLE OPERATIONS">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { type: 'WIPE_POLLS', label: 'WIPE ALL POLLS', desc: 'Delete all polls and vote data permanently.', color: 'var(--amber)' },
                { type: 'WIPE_INTEL', label: 'PURGE ALL INTELLIGENCE', desc: 'Delete every intelligence file from the system.', color: 'var(--amber)' },
                { type: 'RESET_RECRUITMENT', label: 'CLEAR RECRUITMENT PIPELINE', desc: 'Remove all prospects from the pipeline.', color: 'var(--amber)' },
                { type: 'WIPE_LEDGER', label: 'WIPE ENTIRE LEDGER', desc: 'Delete all credit entries for all members.', color: 'var(--red)' },
                { type: 'WIPE_LOG', label: 'CLEAR ACTIVITY LOG', desc: 'Erase the admin activity log.', color: 'var(--text-3)' },
              ].map(d => (
                <div key={d.type} style={{
                  background: 'var(--bg-raised)', border: `1px solid ${d.color}22`,
                  borderRadius: 'var(--border-radius-lg)', padding: '16px 20px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16
                }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, color: d.color, marginBottom: 4 }}>{d.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{d.desc}</div>
                  </div>
                  <button className="btn btn-danger btn-sm" style={{ flexShrink: 0, borderColor: d.color, color: d.color }}
                    onClick={() => dangerAction(d.type)}>
                    EXECUTE
                  </button>
                </div>
              ))}
            </div>
          </Section>
        )}

      </div>

      {/* EDIT MEMBER MODAL */}
      {modal === 'editMember' && (
        <Modal title={`EDIT — ${form.handle}`} onClose={() => setModal(null)}>
          <div className="form-group">
            <label className="form-label">RANK</label>
            <select className="form-select" value={form.tier} onChange={e => {
              const t = parseInt(e.target.value)
              setForm(f => ({ ...f, tier: t, rank: RANKS.find(r => r.tier === t)?.rank }))
            }}>
              {RANKS.map(r => <option key={r.tier} value={r.tier}>{r.label} (Tier {r.tier})</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">DIVISION</label>
              <input className="form-input" value={form.division} onChange={e => setForm(f => ({ ...f, division: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">SPECIALITY</label>
              <input className="form-input" value={form.speciality} onChange={e => setForm(f => ({ ...f, speciality: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">STATUS</label>
            <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option>ACTIVE</option><option>INACTIVE</option><option>SUSPENDED</option>
            </select>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
            <button className="btn btn-primary" disabled={saving}
              onClick={() => updateMember(form.id, { rank: form.rank, tier: parseInt(form.tier), division: form.division || null, speciality: form.speciality || null, status: form.status }, 'EDIT_MEMBER')}>
              {saving ? 'SAVING...' : 'CONFIRM'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
