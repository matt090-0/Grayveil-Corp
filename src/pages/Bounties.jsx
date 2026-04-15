import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatCredits } from '../lib/ranks'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { greenBurst } from '../lib/confetti'

function fmt(ts) { return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
function timeLeft(ts) {
  if (!ts) return '—'
  const diff = new Date(ts) - Date.now()
  if (diff <= 0) return 'EXPIRED'
  const d = Math.floor(diff / 86400000)
  return d > 0 ? `${d}d left` : `${Math.floor(diff / 3600000)}h left`
}

const STATUS_BADGE = { ACTIVE: 'badge-green', CLAIMED: 'badge-accent', CANCELLED: 'badge-muted', EXPIRED: 'badge-red' }

export default function Bounties() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const [bounties, setBounties] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('active')

  const canPost = me.tier <= 4

  async function load() {
    const { data } = await supabase.from('bounties').select('*, poster:profiles!bounties_posted_by_fkey(handle), claimer:profiles!bounties_claimed_by_fkey(handle)').order('created_at', { ascending: false })
    setBounties(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const active = bounties.filter(b => b.status === 'ACTIVE')
  const claimed = bounties.filter(b => b.status === 'CLAIMED')
  const other = bounties.filter(b => b.status !== 'ACTIVE' && b.status !== 'CLAIMED')

  async function postBounty(e) {
    e.preventDefault()
    if (!form.target_name) { setError('Target name required.'); return }
    setSaving(true)
    const { error: err } = await supabase.from('bounties').insert({
      target_name: form.target_name, target_org: form.target_org || null,
      reason: form.reason || null, reward: parseInt(form.reward) || 0,
      posted_by: me.id, expires_at: form.expires_at || null,
    })
    if (err) { setError(err.message); setSaving(false); return }
    toast('Bounty posted', 'success'); setModal(null); setSaving(false); setForm({}); load()
  }

  async function claimBounty(b) {
    if (!confirm(`Claim bounty on ${b.target_name} for ${formatCredits(b.reward)}?`)) return
    const { error: err } = await supabase.rpc('claim_bounty', { p_bounty_id: b.id })
    if (err) { toast(err.message, 'error'); return }
    greenBurst()
    toast(`Bounty claimed — ${formatCredits(b.reward)} deposited`, 'success')
    load()
  }

  async function cancelBounty(id) {
    if (!confirm('Cancel this bounty?')) return
    await supabase.from('bounties').update({ status: 'CANCELLED' }).eq('id', id)
    toast('Bounty cancelled', 'info'); load()
  }

  const shown = tab === 'active' ? active : tab === 'claimed' ? claimed : other

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title">BOUNTY BOARD</div>
            <div className="page-subtitle">{active.length} active bounties · {formatCredits(active.reduce((s, b) => s + (b.reward || 0), 0))} total rewards</div>
          </div>
          {canPost && <button className="btn btn-primary" onClick={() => { setForm({}); setError(''); setModal('post') }}>POST BOUNTY</button>}
        </div>
        <div className="flex gap-8">
          {['active', 'claimed', 'history'].map(t => (
            <button key={t} className="btn btn-ghost btn-sm" style={tab === t ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}} onClick={() => setTab(t)}>{t.toUpperCase()}</button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING...</div> : shown.length === 0 ? (
          <div className="empty-state">{tab === 'active' ? 'NO ACTIVE BOUNTIES' : 'NOTHING HERE'}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {shown.map(b => (
              <div key={b.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--red)', opacity: 0.15, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, border: '1.5px solid var(--red)' }}>
                  <span style={{ opacity: 1, color: 'var(--red)', fontSize: 18 }}>✕</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{b.target_name}</span>
                    {b.target_org && <span className="badge badge-muted">{b.target_org}</span>}
                    <span className={`badge ${STATUS_BADGE[b.status]}`}>{b.status}</span>
                  </div>
                  {b.reason && <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>{b.reason}</div>}
                  <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', display: 'flex', gap: 16 }}>
                    <span>Posted by {b.poster?.handle || '—'}</span>
                    <span>{fmt(b.created_at)}</span>
                    {b.expires_at && <span>{timeLeft(b.expires_at)}</span>}
                    {b.claimer && <span>Claimed by {b.claimer.handle}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--accent)' }}>{formatCredits(b.reward)}</div>
                  {b.status === 'ACTIVE' && (
                    <div className="flex gap-4" style={{ marginTop: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => claimBounty(b)}>CLAIM</button>
                      {(b.posted_by === me.id || me.tier <= 3) && <button className="btn btn-ghost btn-sm" onClick={() => cancelBounty(b.id)}>✕</button>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal === 'post' && (
        <Modal title="POST BOUNTY" onClose={() => setModal(null)}>
          <form onSubmit={postBounty}>
            <div className="form-row">
              <div className="form-group"><label className="form-label">TARGET NAME *</label><input className="form-input" value={form.target_name || ''} onChange={e => setForm(f => ({ ...f, target_name: e.target.value }))} placeholder="Player handle" /></div>
              <div className="form-group"><label className="form-label">TARGET ORG</label><input className="form-input" value={form.target_org || ''} onChange={e => setForm(f => ({ ...f, target_org: e.target.value }))} placeholder="Org tag" /></div>
            </div>
            <div className="form-group"><label className="form-label">REASON</label><textarea className="form-textarea" value={form.reason || ''} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Why this bounty exists..." /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">REWARD (aUEC from treasury)</label><input className="form-input" type="number" value={form.reward || ''} onChange={e => setForm(f => ({ ...f, reward: e.target.value }))} placeholder="0" /></div>
              <div className="form-group"><label className="form-label">EXPIRES</label><input className="form-input" type="date" value={form.expires_at || ''} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} /></div>
            </div>
            {error && <div className="form-error mb-8">{error}</div>}
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'POSTING...' : 'POST BOUNTY'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
