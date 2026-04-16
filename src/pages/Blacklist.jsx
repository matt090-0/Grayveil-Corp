import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { timeAgo } from '../lib/dates'
import { formatCredits } from '../lib/ranks'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'

const THREAT_STYLES = {
  LOW: { color: '#8a8f9c', bg: 'rgba(138,143,156,0.12)', border: 'rgba(138,143,156,0.3)' },
  MODERATE: { color: '#d4943a', bg: 'rgba(212,148,58,0.12)', border: 'rgba(212,148,58,0.3)' },
  HIGH: { color: '#e87040', bg: 'rgba(232,112,64,0.15)', border: 'rgba(232,112,64,0.4)' },
  CRITICAL: { color: '#e84040', bg: 'rgba(232,64,64,0.2)', border: 'rgba(232,64,64,0.5)' },
}

const CATEGORIES = ['HOSTILE', 'PIRATE', 'GRIEFER', 'SCAMMER', 'RIVAL', 'KOS']

export default function Blacklist() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active') // active | all | mine
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | 'add' | entry object
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const canAdd = me.tier <= 6 // members and up can add
  const canManage = me.tier <= 4 // officers can manage any

  async function load() {
    const { data } = await supabase.from('blacklist')
      .select('*, added_by_profile:profiles!blacklist_added_by_fkey(handle)')
      .order('created_at', { ascending: false })
    setEntries(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function saveEntry() {
    if (!form.target_handle || !form.reason) { toast('Target handle and reason required', 'error'); return }
    setSaving(true)
    const payload = {
      target_handle: form.target_handle.trim(),
      target_org: form.target_org?.trim() || null,
      threat_level: form.threat_level || 'MODERATE',
      category: form.category || 'HOSTILE',
      reason: form.reason.trim(),
      last_known_location: form.last_known_location?.trim() || null,
      last_known_ship: form.last_known_ship?.trim() || null,
      evidence_url: form.evidence_url?.trim() || null,
      bounty_offered: parseInt(form.bounty_offered) || 0,
    }
    if (modal === 'add') {
      const { error } = await supabase.from('blacklist').insert({ ...payload, added_by: me.id })
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast(`${form.target_handle} added to blacklist`, 'success')
    } else if (modal?.id) {
      const { error } = await supabase.from('blacklist').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', modal.id)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      toast('Entry updated', 'success')
    }
    setModal(null); setForm({}); setSaving(false); load()
  }

  async function updateStatus(id, status) {
    await supabase.from('blacklist').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    toast(`Marked as ${status}`, 'info'); load()
  }

  async function deleteEntry(id) {
    if (!confirm('Delete this entry permanently?')) return
    await supabase.from('blacklist').delete().eq('id', id)
    toast('Entry deleted', 'info'); load()
  }

  // Filter & search
  const filtered = entries.filter(e => {
    if (filter === 'active' && e.status !== 'ACTIVE') return false
    if (filter === 'mine' && e.added_by !== me.id) return false
    if (search && !e.target_handle.toLowerCase().includes(search.toLowerCase()) &&
      !e.target_org?.toLowerCase().includes(search.toLowerCase()) &&
      !e.reason.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const stats = {
    active: entries.filter(e => e.status === 'ACTIVE').length,
    critical: entries.filter(e => e.threat_level === 'CRITICAL' && e.status === 'ACTIVE').length,
    withBounty: entries.filter(e => e.bounty_offered > 0 && e.status === 'ACTIVE').length,
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div className="page-title">WANTED · BLACKLIST</div>
            <div className="page-subtitle">{stats.active} active threats · {stats.critical} critical · {stats.withBounty} with bounties</div>
          </div>
          {canAdd && (
            <button className="btn btn-primary" onClick={() => { setForm({ threat_level: 'MODERATE', category: 'HOSTILE' }); setModal('add') }}>+ ADD TARGET</button>
          )}
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input className="form-input" style={{ flex: 1, minWidth: 200, fontSize: 12 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search handle, org, or reason..." />
          {['active', 'all', 'mine'].map(f => (
            <button key={f} className="btn btn-ghost btn-sm" onClick={() => setFilter(f)}
              style={filter === f ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Loading...</div> :
        filtered.length === 0 ? <div className="empty-state">No blacklist entries match.</div> : (
          <div style={{ display: 'grid', gap: 10 }}>
            {filtered.map(e => {
              const ts = THREAT_STYLES[e.threat_level] || THREAT_STYLES.MODERATE
              const isMine = e.added_by === me.id
              return (
                <div key={e.id} className="card" style={{
                  padding: 14, borderLeft: `3px solid ${ts.color}`,
                  opacity: e.status === 'NEUTRALIZED' ? 0.55 : e.status === 'EXPIRED' ? 0.4 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, letterSpacing: '.03em' }}>{e.target_handle}</span>
                        {e.target_org && <span style={{ fontSize: 11, color: 'var(--text-2)' }}>@ {e.target_org}</span>}
                        <span style={{
                          fontSize: 9, letterSpacing: '.15em', fontFamily: 'var(--font-mono)',
                          padding: '2px 8px', borderRadius: 4,
                          background: ts.bg, color: ts.color, border: `1px solid ${ts.border}`,
                        }}>{e.threat_level}</span>
                        <span style={{
                          fontSize: 9, letterSpacing: '.15em', fontFamily: 'var(--font-mono)',
                          padding: '2px 8px', borderRadius: 4,
                          background: 'var(--bg-surface)', color: 'var(--text-2)', border: '1px solid var(--border)',
                        }}>{e.category}</span>
                        {e.status !== 'ACTIVE' && (
                          <span style={{
                            fontSize: 9, letterSpacing: '.15em', fontFamily: 'var(--font-mono)',
                            padding: '2px 8px', borderRadius: 4,
                            background: 'rgba(77,184,112,0.12)', color: 'var(--green)', border: '1px solid rgba(77,184,112,0.3)',
                          }}>{e.status}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.6, marginBottom: 6 }}>{e.reason}</div>
                      <div style={{ display: 'flex', gap: 14, fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', flexWrap: 'wrap' }}>
                        {e.last_known_location && <span>📍 {e.last_known_location}</span>}
                        {e.last_known_ship && <span>🛸 {e.last_known_ship}</span>}
                        {e.bounty_offered > 0 && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>💰 {formatCredits(e.bounty_offered)} aUEC</span>}
                        {e.evidence_url && <a href={e.evidence_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>📎 EVIDENCE</a>}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>
                        Added by {e.added_by_profile?.handle || '—'} · {timeAgo(e.created_at)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                      {(isMine || canManage) && e.status === 'ACTIVE' && (
                        <>
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 9, color: 'var(--green)' }} onClick={() => updateStatus(e.id, 'NEUTRALIZED')}>☠ NEUTRALIZED</button>
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 9 }} onClick={() => { setForm({ ...e }); setModal(e) }}>✎ EDIT</button>
                        </>
                      )}
                      {e.status !== 'ACTIVE' && (isMine || canManage) && (
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 9 }} onClick={() => updateStatus(e.id, 'ACTIVE')}>REACTIVATE</button>
                      )}
                      {(isMine || canManage) && (
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 9, color: 'var(--red)' }} onClick={() => deleteEntry(e.id)}>DELETE</button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'ADD TO BLACKLIST' : `EDIT — ${form.target_handle}`} onClose={() => { setModal(null); setForm({}) }} size="modal-lg">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group">
              <label className="form-label">TARGET HANDLE *</label>
              <input className="form-input" value={form.target_handle || ''} onChange={e => setForm({ ...form, target_handle: e.target.value })} placeholder="Pilot handle in SC" />
            </div>
            <div className="form-group">
              <label className="form-label">TARGET ORG</label>
              <input className="form-input" value={form.target_org || ''} onChange={e => setForm({ ...form, target_org: e.target.value })} placeholder="Their org (if any)" />
            </div>
            <div className="form-group">
              <label className="form-label">THREAT LEVEL</label>
              <select className="form-select" value={form.threat_level || 'MODERATE'} onChange={e => setForm({ ...form, threat_level: e.target.value })}>
                <option>LOW</option><option>MODERATE</option><option>HIGH</option><option>CRITICAL</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">CATEGORY</label>
              <select className="form-select" value={form.category || 'HOSTILE'} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">REASON *</label>
            <textarea className="form-textarea" style={{ minHeight: 80 }} value={form.reason || ''} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Why are they on the blacklist? What did they do?" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group">
              <label className="form-label">LAST KNOWN LOCATION</label>
              <input className="form-input" value={form.last_known_location || ''} onChange={e => setForm({ ...form, last_known_location: e.target.value })} placeholder="e.g. Port Olisar, Lorville" />
            </div>
            <div className="form-group">
              <label className="form-label">LAST KNOWN SHIP</label>
              <input className="form-input" value={form.last_known_ship || ''} onChange={e => setForm({ ...form, last_known_ship: e.target.value })} placeholder="e.g. Cutlass Black" />
            </div>
            <div className="form-group">
              <label className="form-label">BOUNTY (aUEC)</label>
              <input className="form-input" type="number" value={form.bounty_offered || 0} onChange={e => setForm({ ...form, bounty_offered: e.target.value })} placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">EVIDENCE URL</label>
              <input className="form-input" value={form.evidence_url || ''} onChange={e => setForm({ ...form, evidence_url: e.target.value })} placeholder="Screenshot, video, etc." />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => { setModal(null); setForm({}) }}>CANCEL</button>
            <button className="btn btn-primary" onClick={saveEntry} disabled={saving}>{saving ? 'SAVING...' : modal === 'add' ? 'ADD TO BLACKLIST' : 'SAVE CHANGES'}</button>
          </div>
        </Modal>
      )}
    </>
  )
}
