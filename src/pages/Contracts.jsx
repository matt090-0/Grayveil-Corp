import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { CONTRACT_TYPES, formatCredits, RANKS } from '../lib/ranks'
import Modal from '../components/Modal'

const STATUS_ORDER = ['OPEN', 'ACTIVE', 'COMPLETE', 'CANCELLED']
const STATUS_BADGE = { OPEN: 'badge-green', ACTIVE: 'badge-amber', COMPLETE: 'badge-blue', CANCELLED: 'badge-muted' }

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
  return `${Math.floor(diff/86400)}d ago`
}

export default function Contracts() {
  const { profile: me } = useAuth()
  const [contracts, setContracts] = useState([])
  const [claims, setClaims]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setStatus] = useState('ALL')
  const [modal, setModal]         = useState(null)
  const [form, setForm]           = useState({})
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [viewContract, setViewContract] = useState(null)

  const canPost = me.tier <= 4

  async function load() {
    const [{ data: c }, { data: cl }] = await Promise.all([
      supabase.from('contracts')
        .select('*, posted_by:profiles(handle, tier)')
        .order('created_at', { ascending: false }),
      supabase.from('contract_claims')
        .select('*, member:profiles(handle)')
        .eq('member_id', me.id),
    ])
    setContracts(c || [])
    setClaims(cl || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const myClaims = new Set(claims.map(c => c.contract_id))

  const filtered = contracts.filter(c =>
    statusFilter === 'ALL' || c.status === statusFilter
  )

  function openPost() {
    setForm({ title: '', contract_type: 'COMBAT', description: '', location: '', reward: '', min_tier: 9, status: 'OPEN' })
    setError('')
    setModal('post')
  }

  async function savePost() {
    if (!form.title) { setError('Title is required.'); return }
    setSaving(true)
    const { error } = await supabase.from('contracts').insert({
      ...form,
      reward: parseInt(form.reward) || 0,
      min_tier: parseInt(form.min_tier),
      posted_by: me.id,
    })
    if (error) { setError(error.message); setSaving(false); return }
    setModal(null); setSaving(false); load()
  }

  async function claimContract(id) {
    await supabase.from('contract_claims').insert({ contract_id: id, member_id: me.id })
    await supabase.from('contracts').update({ status: 'ACTIVE' }).eq('id', id).eq('status', 'OPEN')
    load()
  }

  async function updateStatus(id, status) {
    await supabase.from('contracts').update({ status }).eq('id', id)
    load()
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title">CONTRACTS</div>
            <div className="page-subtitle">Active operations and available assignments</div>
          </div>
          {canPost && <button className="btn btn-primary" onClick={openPost}>+ POST CONTRACT</button>}
        </div>
        <div className="flex gap-8" style={{ paddingBottom: 0 }}>
          {['ALL', ...STATUS_ORDER].map(s => (
            <button key={s} className={`btn btn-ghost btn-sm${statusFilter === s ? ' active' : ''}`}
              style={statusFilter === s ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
              onClick={() => setStatus(s)}>{s}</button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING CONTRACTS...</div> : filtered.length === 0 ? (
          <div className="empty-state">NO CONTRACTS FOUND</div>
        ) : (
          <div className="grid-auto">
            {filtered.map(c => {
              const claimed = myClaims.has(c.id)
              return (
                <div key={c.id} className="contract-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="flex items-center justify-between">
                    <span className={`badge ${STATUS_BADGE[c.status]}`}>{c.status}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{timeAgo(c.created_at)}</span>
                  </div>

                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 3 }}>{c.title}</div>
                    <div className="flex gap-8">
                      <span className="badge badge-muted" style={{ fontSize: 9 }}>{c.contract_type}</span>
                      {c.min_tier < 9 && <span className="badge badge-purple" style={{ fontSize: 9 }}>TIER {c.min_tier}+</span>}
                    </div>
                  </div>

                  {c.description && (
                    <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65 }}>{c.description}</p>
                  )}

                  <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {c.location && (
                      <div className="flex justify-between">
                        <span style={{ color: 'var(--text-3)' }}>LOCATION</span>
                        <span style={{ color: 'var(--text-1)' }}>{c.location}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-3)' }}>REWARD</span>
                      <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{formatCredits(c.reward)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-3)' }}>POSTED BY</span>
                      <span style={{ color: 'var(--text-2)' }}>{c.posted_by?.handle || '—'}</span>
                    </div>
                  </div>

                  <div className="flex gap-8" style={{ marginTop: 4 }}>
                    {c.status === 'OPEN' && !claimed && (
                      <button className="btn btn-primary btn-sm" onClick={() => claimContract(c.id)}>CLAIM</button>
                    )}
                    {claimed && c.status !== 'COMPLETE' && (
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--green)', borderColor: 'var(--green)' }}
                        onClick={() => updateStatus(c.id, 'COMPLETE')}>MARK COMPLETE</button>
                    )}
                    {canPost && c.status !== 'COMPLETE' && c.status !== 'CANCELLED' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(c.id, 'CANCELLED')}>CANCEL</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal === 'post' && (
        <Modal title="POST CONTRACT" onClose={() => setModal(null)} size="modal-lg">
          <div className="form-group">
            <label className="form-label">CONTRACT TITLE *</label>
            <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Operation name or contract description" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">TYPE</label>
              <select className="form-select" value={form.contract_type} onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))}>
                {CONTRACT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">CLEARANCE REQUIRED (TIER)</label>
              <select className="form-select" value={form.min_tier} onChange={e => setForm(f => ({ ...f, min_tier: parseInt(e.target.value) }))}>
                {RANKS.map(r => <option key={r.tier} value={r.tier}>{r.label} (Tier {r.tier})</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">LOCATION</label>
              <input className="form-input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Stanton — Hurston" />
            </div>
            <div className="form-group">
              <label className="form-label">REWARD (aUEC)</label>
              <input className="form-input" type="number" value={form.reward} onChange={e => setForm(f => ({ ...f, reward: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">BRIEFING</label>
            <textarea className="form-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Operation details, objectives, requirements..." />
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
            <button className="btn btn-primary" onClick={savePost} disabled={saving}>
              {saving ? 'POSTING...' : 'POST CONTRACT'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
