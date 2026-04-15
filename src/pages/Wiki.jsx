import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import ReactMarkdown from 'react-markdown'

const CATEGORIES = ['GENERAL', 'SOP', 'COMBAT', 'TRADE', 'MINING', 'FITTING', 'RULES']
const CAT_BADGE = { GENERAL: 'badge-muted', SOP: 'badge-accent', COMBAT: 'badge-red', TRADE: 'badge-green', MINING: 'badge-amber', FITTING: 'badge-blue', RULES: 'badge-purple' }

function fmt(ts) { return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }

export default function Wiki() {
  const { profile: me } = useAuth()
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canWrite = me.tier <= 6

  async function load() {
    const { data } = await supabase.from('wiki_articles').select('*, author:profiles!wiki_articles_created_by_fkey(handle), editor:profiles!wiki_articles_updated_by_fkey(handle)').order('pinned', { ascending: false }).order('updated_at', { ascending: false })
    setArticles(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = articles.filter(a => {
    if (filter !== 'ALL' && a.category !== filter) return false
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  async function saveArticle() {
    if (!form.title || !form.content) { setError('Title and content required.'); return }
    const slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    setSaving(true)
    if (editing === 'new') {
      await supabase.from('wiki_articles').insert({ title: form.title, slug, content: form.content, category: form.category || 'GENERAL', min_tier: parseInt(form.min_tier) || 9, pinned: form.pinned || false, created_by: me.id, updated_by: me.id })
    } else {
      await supabase.from('wiki_articles').update({ title: form.title, slug, content: form.content, category: form.category, min_tier: parseInt(form.min_tier) || 9, pinned: form.pinned || false, updated_by: me.id }).eq('id', editing.id)
    }
    setEditing(null); setSaving(false); load()
  }

  async function deleteArticle(id) {
    if (!confirm('Delete this article?')) return
    await supabase.from('wiki_articles').delete().eq('id', id); setViewing(null); load()
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title">KNOWLEDGE BASE</div>
            <div className="page-subtitle">{articles.length} articles</div>
          </div>
          {canWrite && <button className="btn btn-primary" onClick={() => { setForm({ category: 'GENERAL', min_tier: 9 }); setError(''); setEditing('new') }}>+ NEW ARTICLE</button>}
        </div>
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          <input className="form-input" style={{ maxWidth: 200 }} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-ghost btn-sm" style={filter === 'ALL' ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}} onClick={() => setFilter('ALL')}>ALL</button>
          {CATEGORIES.map(c => <button key={c} className="btn btn-ghost btn-sm" style={filter === c ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}} onClick={() => setFilter(c)}>{c}</button>)}
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING...</div> : filtered.length === 0 ? <div className="empty-state">NO ARTICLES</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(a => (
              <div key={a.id} className="card card-sm" style={{ cursor: 'pointer' }} onClick={() => setViewing(a)}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-md)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-10">
                    {a.pinned && <span style={{ color: 'var(--accent)' }}>📌</span>}
                    <span className={`badge ${CAT_BADGE[a.category]}`}>{a.category}</span>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{a.title}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.author?.handle} · {fmt(a.updated_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* VIEW ARTICLE */}
      {viewing && (
        <Modal title={viewing.title} onClose={() => setViewing(null)} size="modal-lg">
          <div className="flex gap-8 mb-12">
            <span className={`badge ${CAT_BADGE[viewing.category]}`}>{viewing.category}</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>by {viewing.author?.handle} · updated {fmt(viewing.updated_at)}</span>
          </div>
          <div className="wiki-content" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 20, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.8, fontFamily: 'var(--font-mono)', minHeight: 150, maxHeight: 500, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
            <ReactMarkdown>{viewing.content}</ReactMarkdown>
          </div>
          <div className="modal-footer">
            {(viewing.created_by === me.id || me.tier <= 3) && <button className="btn btn-danger btn-sm" onClick={() => deleteArticle(viewing.id)}>DELETE</button>}
            {canWrite && <button className="btn btn-ghost" onClick={() => { setForm({ ...viewing }); setEditing(viewing); setViewing(null) }}>EDIT</button>}
            <button className="btn btn-ghost" onClick={() => setViewing(null)}>CLOSE</button>
          </div>
        </Modal>
      )}

      {/* EDIT/NEW ARTICLE */}
      {editing && (
        <Modal title={editing === 'new' ? 'NEW ARTICLE' : `EDIT — ${editing.title}`} onClose={() => setEditing(null)} size="modal-lg">
          <div className="form-group"><label className="form-label">TITLE *</label><input className="form-input" value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">CATEGORY</label><select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
            <div className="form-group"><label className="form-label">MIN TIER</label><input className="form-input" type="number" min="1" max="9" value={form.min_tier} onChange={e => setForm(f => ({ ...f, min_tier: e.target.value }))} /></div>
          </div>
          <div className="form-group">
            <div className="flex items-center gap-8 mb-4">
              <label className="form-label" style={{ marginBottom: 0 }}>CONTENT *</label>
              <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.pinned || false} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} /> PIN TO TOP
              </label>
            </div>
            <textarea className="form-textarea" style={{ minHeight: 250, fontFamily: 'var(--font-mono)', fontSize: 12 }} value={form.content || ''} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Article content..." />
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setEditing(null)}>CANCEL</button><button className="btn btn-primary" onClick={saveArticle} disabled={saving}>{saving ? 'SAVING...' : 'PUBLISH'}</button></div>
        </Modal>
      )}
    </>
  )
}
