import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { INTEL_CLASSES } from '../lib/ranks'
import Modal from '../components/Modal'

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
  return `${Math.floor(diff/86400)}d ago`
}

const CLASS_BADGE = {
  OPEN:       'badge-muted',
  RESTRICTED: 'badge-amber',
  CLASSIFIED: 'badge-red',
  BLACKLINE:  'badge-purple',
}

export default function Intelligence() {
  const { profile: me } = useAuth()
  const [files, setFiles]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [modal, setModal]   = useState(false)
  const [view, setView]     = useState(null)
  const [form, setForm]     = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const canPost = me.tier <= 6

  async function load() {
    const { data } = await supabase
      .from('intelligence')
      // include id in posted_by so delete check works
      .select('*, posted_by:profiles(id, handle, tier)')
      .order('created_at', { ascending: false })
    setFiles(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = files.filter(f => filter === 'ALL' || f.classification === filter)

  function openPost() {
    // Default to HIGHEST classification the user is cleared for
    const available = INTEL_CLASSES.filter(c => me.tier <= c.min_tier)
    const defaultClass = available[available.length - 1] || INTEL_CLASSES[0]
    setForm({ title: '', content: '', classification: defaultClass.label, min_tier: defaultClass.min_tier })
    setError('')
    setModal(true)
  }

  async function save() {
    if (!form.title || !form.content) { setError('Title and content are required.'); return }
    setSaving(true)
    const { error } = await supabase.from('intelligence').insert({
      title: form.title,
      content: form.content,
      classification: form.classification,
      min_tier: parseInt(form.min_tier),
      posted_by: me.id,
    })
    if (error) { setError(error.message); setSaving(false); return }
    setModal(false); setSaving(false); load()
  }

  async function deleteFile(id) {
    if (!confirm('Permanently purge this intelligence file?')) return
    await supabase.from('intelligence').delete().eq('id', id)
    setView(null)
    load()
  }

  const availableClasses = INTEL_CLASSES.filter(c => me.tier <= c.min_tier)

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title">INTELLIGENCE</div>
            <div className="page-subtitle">Clearance level: Tier {me.tier} — {files.length} files accessible</div>
          </div>
          {canPost && <button className="btn btn-primary" onClick={openPost}>+ FILE INTEL</button>}
        </div>
        <div className="flex gap-8" style={{ paddingBottom: 0 }}>
          {['ALL', ...INTEL_CLASSES.map(c => c.label)].map(c => (
            <button key={c} className="btn btn-ghost btn-sm"
              style={filter === c ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
              onClick={() => setFilter(c)}>{c}</button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">RETRIEVING FILES...</div> : filtered.length === 0 ? (
          <div className="empty-state">NO INTELLIGENCE FILES AVAILABLE</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(f => (
              <div
                key={f.id}
                className="card card-sm"
                style={{ cursor: 'pointer', transition: 'border-color .15s' }}
                onClick={() => setView(f)}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-md)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-12">
                    <span className={`badge ${CLASS_BADGE[f.classification]}`}>{f.classification}</span>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{f.title}</span>
                  </div>
                  <div className="flex items-center gap-12">
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {f.posted_by?.handle || '—'} · {timeAgo(f.created_at)}
                    </span>
                    <span style={{ color: 'var(--text-3)', fontSize: 14 }}>›</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* VIEW FILE */}
      {view && (
        <Modal title={view.title} onClose={() => setView(null)} size="modal-lg">
          <div className="flex gap-8 mb-16">
            <span className={`badge ${CLASS_BADGE[view.classification]}`}>{view.classification}</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              Filed by {view.posted_by?.handle || '—'} · {timeAgo(view.created_at)}
            </span>
          </div>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px',
            fontSize: 13,
            color: 'var(--text-2)',
            lineHeight: 1.8,
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--font-mono)',
            minHeight: 120,
          }}>
            {view.content}
          </div>
          <div className="modal-footer">
            {/* Fix: use view.posted_by?.id (now fetched) for author check, or admin check */}
            {(view.posted_by?.id === me.id || me.tier <= 3) && (
              <button className="btn btn-danger btn-sm" onClick={() => deleteFile(view.id)}>PURGE FILE</button>
            )}
            <button className="btn btn-ghost" onClick={() => setView(null)}>CLOSE</button>
          </div>
        </Modal>
      )}

      {/* POST INTEL */}
      {modal && (
        <Modal title="FILE INTELLIGENCE REPORT" onClose={() => setModal(false)} size="modal-lg">
          <div className="form-group">
            <label className="form-label">TITLE *</label>
            <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Brief identifying header" />
          </div>
          <div className="form-group">
            <label className="form-label">CLASSIFICATION</label>
            <select className="form-select" value={form.classification} onChange={e => {
              const cls = INTEL_CLASSES.find(c => c.label === e.target.value)
              setForm(f => ({ ...f, classification: cls.label, min_tier: cls.min_tier }))
            }}>
              {availableClasses.map(c => (
                <option key={c.label} value={c.label}>{c.label} — visible to Tier {c.min_tier} and above</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">CONTENT *</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 160, fontFamily: 'var(--font-mono)', fontSize: 12 }}
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Intelligence details, source information, actionable data..."
            />
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setModal(false)}>CANCEL</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'FILING...' : 'FILE REPORT'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
