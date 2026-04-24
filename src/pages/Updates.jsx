import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import ReactMarkdown from 'react-markdown'
import { confirmAction } from '../lib/dialogs'

// Public changelog. Everyone reads. Only tier<=1 can publish.
// CRITICAL: this page is visible to every signed-in member — DO NOT include
// anything security-sensitive in entries (no creds, infra details, exploit
// descriptions, internal URLs, tokens, or RLS policy specifics). Entries
// should describe user-facing changes in plain language.

const CATEGORIES = ['FEATURE', 'FIX', 'IMPROVEMENT', 'SECURITY', 'ANNOUNCEMENT']
const CAT_BADGE = {
  FEATURE: 'badge-accent',
  FIX: 'badge-blue',
  IMPROVEMENT: 'badge-green',
  SECURITY: 'badge-amber',
  ANNOUNCEMENT: 'badge-purple',
}

function fmt(ts) {
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Updates() {
  const { profile: me } = useAuth()
  const [releases, setReleases] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canPublish = me.tier <= 1

  async function load() {
    const { data } = await supabase
      .from('releases')
      .select('*, author:profiles!releases_created_by_fkey(handle)')
      .order('pinned', { ascending: false })
      .order('published_at', { ascending: false })
    setReleases(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = releases.filter(r => filter === 'ALL' || r.category === filter)

  async function saveRelease() {
    if (!form.version || !form.title || !form.body) {
      setError('Version, title, and body are required.')
      return
    }
    setSaving(true)
    const payload = {
      version: form.version.trim(),
      title: form.title.trim(),
      summary: form.summary?.trim() || null,
      body: form.body,
      category: form.category || 'FEATURE',
      pinned: !!form.pinned,
      updated_by: me.id,
    }
    if (editing === 'new') {
      await supabase.from('releases').insert({ ...payload, created_by: me.id })
    } else {
      await supabase.from('releases').update(payload).eq('id', editing.id)
    }
    setEditing(null)
    setSaving(false)
    load()
  }

  async function deleteRelease(id) {
    if (!(await confirmAction('Delete this release note?'))) return
    await supabase.from('releases').delete().eq('id', id)
    load()
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title">UPDATES</div>
            <div className="page-subtitle">{releases.length} release notes</div>
          </div>
          {canPublish && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setForm({ category: 'FEATURE', pinned: false })
                setError('')
                setEditing('new')
              }}
            >
              + PUBLISH UPDATE
            </button>
          )}
        </div>
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          <button
            className="btn btn-ghost btn-sm"
            style={filter === 'ALL' ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
            onClick={() => setFilter('ALL')}
          >
            ALL
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c}
              className="btn btn-ghost btn-sm"
              style={filter === c ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
              onClick={() => setFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="loading">LOADING...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">NO UPDATES YET</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(r => (
              <div key={r.id} className="card">
                <div className="flex items-center justify-between mb-8" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <div className="flex items-center gap-10" style={{ flexWrap: 'wrap' }}>
                    {r.pinned && <span style={{ color: 'var(--accent)' }}>📌</span>}
                    <span className={`badge ${CAT_BADGE[r.category]}`}>{r.category}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{r.version}</span>
                    <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-1)' }}>{r.title}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                    {fmt(r.published_at)}
                  </span>
                </div>
                {r.summary && (
                  <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 10 }}>
                    {r.summary}
                  </div>
                )}
                <div
                  className="wiki-content"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 16,
                    fontSize: 12.5,
                    color: 'var(--text-2)',
                    lineHeight: 1.7,
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  <ReactMarkdown>{r.body}</ReactMarkdown>
                </div>
                {canPublish && (
                  <div className="flex gap-8 mt-10" style={{ justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setForm({ ...r })
                        setError('')
                        setEditing(r)
                      }}
                    >
                      EDIT
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteRelease(r.id)}>
                      DELETE
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <Modal
          title={editing === 'new' ? 'PUBLISH UPDATE' : `EDIT — ${editing.title}`}
          onClose={() => setEditing(null)}
          size="modal-lg"
        >
          <div
            style={{
              background: 'rgba(200, 165, 90, 0.08)',
              border: '1px solid rgba(200, 165, 90, 0.4)',
              borderRadius: 'var(--radius-sm)',
              padding: 10,
              fontSize: 11,
              color: 'var(--text-2)',
              lineHeight: 1.5,
              marginBottom: 14,
              fontFamily: 'var(--font-mono)',
            }}
          >
            VISIBLE TO EVERY MEMBER. Describe user-facing changes only — no
            credentials, infra, exploit details, or internal URLs.
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">VERSION *</label>
              <input
                className="form-input"
                placeholder="v1.4.0"
                value={form.version || ''}
                onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">CATEGORY</label>
              <select
                className="form-select"
                value={form.category || 'FEATURE'}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">TITLE *</label>
            <input
              className="form-input"
              value={form.title || ''}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">SUMMARY</label>
            <input
              className="form-input"
              placeholder="One-liner shown above the body"
              value={form.summary || ''}
              onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <div className="flex items-center gap-8 mb-4">
              <label className="form-label" style={{ marginBottom: 0 }}>BODY * (Markdown)</label>
              <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.pinned || false}
                  onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))}
                />
                PIN TO TOP
              </label>
            </div>
            <textarea
              className="form-textarea"
              style={{ minHeight: 220, fontFamily: 'var(--font-mono)', fontSize: 12 }}
              value={form.body || ''}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder={'- Added X\n- Fixed Y\n- Improved Z'}
            />
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>CANCEL</button>
            <button className="btn btn-primary" onClick={saveRelease} disabled={saving}>
              {saving ? 'SAVING...' : 'PUBLISH'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
