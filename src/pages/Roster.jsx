import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { RANKS, canPromote } from '../lib/ranks'
import RankBadge from '../components/RankBadge'
import Modal from '../components/Modal'
import { SC_DIVISIONS, SC_SPECIALITIES } from '../lib/scdata'
import MemberDossier from '../components/MemberDossier'
import { useToast } from '../components/Toast'
import { discordPromotion } from '../lib/discord'
import { exportCSV } from '../lib/csv'

function lastSeen(ts) {
  if (!ts) return '—'
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 300) return 'ONLINE'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function Roster() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('')
  const [editing, setEditing] = useState(null)
  const [editData, setEditData] = useState({})
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [viewing, setViewing] = useState(null)

  async function load() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('tier')
      .order('handle')
    setMembers(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const canEdit = me.tier <= 3 || (me.tier <= 5)
  const filtered = members.filter(m =>
    m.handle.toLowerCase().includes(filter.toLowerCase()) ||
    m.rank.toLowerCase().includes(filter.toLowerCase())
  )

  function openEdit(m) {
    setEditing(m)
    setEditData({ rank: m.rank, tier: m.tier, division: m.division||'', speciality: m.speciality||'', status: m.status||'ACTIVE' })
    setError('')
  }

  async function saveEdit() {
    if (!canPromote(me.tier, editData.tier)) {
      setError('You do not have the authority to assign this rank.')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        rank: editData.rank,
        tier: parseInt(editData.tier),
        division: editData.division || null,
        speciality: editData.speciality || null,
        status: editData.status,
      })
      .eq('id', editing.id)
    if (error) { setError(error.message); setSaving(false); return }
    // Log promotion/rank change activity
    if (parseInt(editData.tier) !== editing.tier) {
      const newRankInfo = RANKS.find(r => r.tier === parseInt(editData.tier))
      await supabase.from('activity_log').insert({ actor_id: me.id, action: 'member_promoted', target_type: 'profile', target_id: editing.id, details: { title: editing.handle, new_rank: newRankInfo?.label || editData.rank } })
      // Notify the promoted member
      await supabase.from('notifications').insert({ recipient_id: editing.id, type: 'promotion', title: 'Rank Updated', message: `You have been assigned ${newRankInfo?.label || editData.rank} by ${me.handle}.`, link: '/roster' })
      discordPromotion(editing.handle, newRankInfo?.label || editData.rank, me.handle)
    }
    setEditing(null)
    setSaving(false)
    toast(`${editing.handle} updated`, 'success')
    load()
  }

  function tierBg(tier) {
    if (tier <= 2) return 'var(--accent-dim)'
    if (tier <= 4) return 'var(--blue-dim)'
    return 'transparent'
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <div className="page-title">ROSTER</div>
            <div className="page-subtitle">Division membership — {members.length} operatives</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => {
            exportCSV(members.map(m => ({ handle: m.handle, rank: m.rank, tier: m.tier, division: m.division || '', speciality: m.speciality || '', status: m.status, rep: m.rep_score || 0, joined: m.joined_at?.slice(0,10) })), 'grayveil_roster')
            toast('Roster exported', 'info')
          }}>EXPORT CSV</button>
        </div>
      </div>

      <div className="page-body">
        <div className="section-header mb-16">
          <input
            className="form-input"
            placeholder="Filter by handle or rank..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ maxWidth: 300 }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {filtered.length} of {members.length}
          </span>
        </div>

        {loading ? <div className="loading">LOADING ROSTER...</div> : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>HANDLE</th>
                    <th>RANK</th>
                    <th>DIVISION</th>
                    <th>SPECIALITY</th>
                    <th>STATUS</th>
                    <th>LAST SEEN</th>
                    {canEdit && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="empty-state">NO RESULTS</td></tr>
                  ) : filtered.map(m => (
                    <tr key={m.id} style={{ background: m.id === me.id ? 'var(--accent-glow)' : undefined, cursor: 'pointer' }}
                      onClick={() => setViewing(m)}>
                      <td>
                        <div className="flex items-center gap-8">
                          <div className="avatar" style={{ width: 26, height: 26, fontSize: 10 }}>
                            {m.handle.slice(0,2).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: m.id === me.id ? 500 : 400 }}>{m.handle}</span>
                          {m.is_founder && <span className="badge badge-accent" style={{ fontSize: 9, padding: '1px 6px' }}>FOUNDER</span>}
                        </div>
                      </td>
                      <td><RankBadge tier={m.tier} /></td>
                      <td><span className="text-muted mono">{m.division || '—'}</span></td>
                      <td><span className="text-muted mono">{m.speciality || '—'}</span></td>
                      <td>
                        <span className={`badge ${m.status === 'ACTIVE' ? 'badge-green' : m.status === 'SUSPENDED' ? 'badge-red' : 'badge-muted'}`}>
                          {m.status}
                        </span>
                      </td>
                      <td>
                        <span className="mono text-muted" style={{ fontSize: 11, color: lastSeen(m.last_seen_at) === 'ONLINE' ? 'var(--green)' : undefined }}>
                          {lastSeen(m.last_seen_at)}
                        </span>
                      </td>
                      {canEdit && (
                        <td onClick={e => e.stopPropagation()}>
                          {m.id !== me.id && me.tier < m.tier && (
                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}>EDIT</button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <Modal title={`EDIT — ${editing.handle}`} onClose={() => setEditing(null)}>
          <div className="form-group">
            <label className="form-label">RANK</label>
            <select className="form-select" value={editData.tier} onChange={e => {
              const t = parseInt(e.target.value)
              const r = RANKS.find(x => x.tier === t)
              setEditData(d => ({ ...d, tier: t, rank: r.rank }))
            }}>
              {RANKS.filter(r => r.tier > me.tier || me.tier === 1).map(r => (
                <option key={r.tier} value={r.tier}>{r.label} (Tier {r.tier})</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">DIVISION</label>
              <select className="form-select" value={editData.division} onChange={e => setEditData(d => ({ ...d, division: e.target.value }))}>
                <option value="">— Select —</option>
                {SC_DIVISIONS.map(d => (
                  <option key={d} value={d} disabled={d === 'High Command' && !me.is_head_founder}>
                    {d}{d === 'High Command' && !me.is_head_founder ? ' · head-only' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">SPECIALITY</label>
              <select className="form-select" value={editData.speciality} onChange={e => setEditData(d => ({ ...d, speciality: e.target.value }))}>
                <option value="">— Select —</option>
                {SC_SPECIALITIES.map(s => (
                  <option key={s} value={s} disabled={s === 'Strategic Command' && !me.is_head_founder}>
                    {s}{s === 'Strategic Command' && !me.is_head_founder ? ' · head-only' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">STATUS</label>
            <select className="form-select" value={editData.status} onChange={e => setEditData(d => ({ ...d, status: e.target.value }))}>
              <option>ACTIVE</option>
              <option>INACTIVE</option>
              <option>SUSPENDED</option>
            </select>
          </div>
          {error && <div className="form-error mb-16">{error}</div>}
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>CANCEL</button>
            <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
              {saving ? 'SAVING...' : 'CONFIRM CHANGES'}
            </button>
          </div>
        </Modal>
      )}

      {viewing && <MemberDossier member={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}
