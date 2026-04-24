import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { INTEL_CLASSES } from '../lib/ranks'
import { useToast } from '../components/Toast'
import { confirmAction } from '../lib/dialogs'
import {
  UEE_AMBER, ClassificationBar, TabStrip, StatCell, FilterRow, Card,
  StatusBadge, EmptyState, UeeModal, SectionHeader,
  timeAgo,
} from '../components/uee'

const CLASS_META = {
  OPEN:       { color: '#9099a8', glyph: '○', label: 'OPEN',       hint: 'Unrestricted — all personnel' },
  RESTRICTED: { color: UEE_AMBER, glyph: '◐', label: 'RESTRICTED', hint: 'Tiered clearance required' },
  CLASSIFIED: { color: '#e05c5c', glyph: '◉', label: 'CLASSIFIED', hint: 'Command-level eyes only' },
  BLACKLINE:  { color: '#b566d9', glyph: '⬢', label: 'BLACKLINE',  hint: 'Head Founder / Directorate only' },
}

export default function Intelligence() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const [files, setFiles]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(false)
  const [view, setView]     = useState(null)
  const [form, setForm]     = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const canPost = me.tier <= 6

  async function load() {
    const { data } = await supabase
      .from('intelligence')
      .select('*, posted_by:profiles(handle, tier)')
      .order('created_at', { ascending: false })
    setFiles(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const counts = useMemo(() => {
    const c = { ALL: files.length }
    Object.keys(CLASS_META).forEach(k => {
      c[k] = files.filter(f => f.classification === k).length
    })
    return c
  }, [files])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return files
      .filter(f => filter === 'ALL' || f.classification === filter)
      .filter(f => !q
        || (f.title || '').toLowerCase().includes(q)
        || (f.content || '').toLowerCase().includes(q)
        || (f.posted_by?.handle || '').toLowerCase().includes(q))
  }, [files, filter, search])

  const recentFile = files[0]

  const activeMeta = filter === 'ALL' ? null : CLASS_META[filter]

  function openPost() {
    const availableClasses = INTEL_CLASSES.filter(c => c.min_tier >= me.tier)
    const defaultClass = availableClasses[0] || INTEL_CLASSES[0]
    setForm({ title: '', content: '', classification: defaultClass.label, min_tier: defaultClass.min_tier })
    setError('')
    setModal(true)
  }

  async function save() {
    if (!form.title || !form.content) { setError('Title and content are required.'); return }
    setSaving(true)
    const { data, error } = await supabase.from('intelligence').insert({
      title: form.title,
      content: form.content,
      classification: form.classification,
      min_tier: parseInt(form.min_tier),
      posted_by: me.id,
    }).select().single()
    if (error) { setError(error.message); setSaving(false); return }
    await supabase.from('activity_log').insert({
      actor_id: me.id, action: 'intel_filed',
      target_type: 'intelligence', target_id: data.id,
      details: { title: form.title, classification: form.classification },
    })
    toast('Intelligence filed', 'success')
    setModal(false); setSaving(false); load()
  }

  async function deleteFile(id) {
    if (!(await confirmAction('Permanently purge this intelligence file?'))) return
    await supabase.from('intelligence').delete().eq('id', id)
    toast('File purged', 'success')
    setView(null)
    load()
  }

  const barAccent = activeMeta?.color || UEE_AMBER

  return (
    <>
      <ClassificationBar
        section="GRAYVEIL INTELLIGENCE ARCHIVE"
        label={activeMeta ? `${activeMeta.label} CHANNEL` : 'ALL CHANNELS'}
        accent={barAccent}
        right={(
          <>
            <span>CLEARANCE · T{me.tier}</span>
            <span style={{ color: UEE_AMBER }}>ACCESSIBLE · {files.length}</span>
            {recentFile && <span>LAST FILED · {timeAgo(recentFile.created_at)}</span>}
          </>
        )}
      />

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>INTELLIGENCE</h1>
            <div style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 640 }}>
              Field reports, recon dumps, and directorate briefings. Visibility is gated by clearance tier — what you see is what you're cleared for.
            </div>
          </div>
          {canPost && <button className="btn btn-primary" onClick={openPost}>+ FILE INTEL</button>}
        </div>

        <TabStrip
          active={filter} onChange={setFilter}
          tabs={[
            { key: 'ALL',        label: 'ALL',        color: '#d4d8e0',                count: counts.ALL || 0 },
            { key: 'OPEN',       label: 'OPEN',       color: CLASS_META.OPEN.color,       glyph: CLASS_META.OPEN.glyph,       count: counts.OPEN || 0 },
            { key: 'RESTRICTED', label: 'RESTRICTED', color: CLASS_META.RESTRICTED.color, glyph: CLASS_META.RESTRICTED.glyph, count: counts.RESTRICTED || 0 },
            { key: 'CLASSIFIED', label: 'CLASSIFIED', color: CLASS_META.CLASSIFIED.color, glyph: CLASS_META.CLASSIFIED.glyph, count: counts.CLASSIFIED || 0 },
            { key: 'BLACKLINE',  label: 'BLACKLINE',  color: CLASS_META.BLACKLINE.color,  glyph: CLASS_META.BLACKLINE.glyph,  count: counts.BLACKLINE || 0 },
          ]}
        />
      </div>

      <div className="page-body">
        {loading ? <div className="loading">RETRIEVING ARCHIVE...</div> : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 10, marginBottom: 16,
            }}>
              {Object.keys(CLASS_META).map(k => {
                const m = CLASS_META[k]
                return (
                  <StatCell
                    key={k}
                    label={m.label}
                    value={counts[k] || 0}
                    color={m.color}
                    glyph={m.glyph}
                    desc={m.hint}
                    onClick={() => setFilter(filter === k ? 'ALL' : k)}
                    active={filter === k}
                  />
                )
              })}
            </div>

            <FilterRow
              search={search} setSearch={setSearch}
              placeholder="Search title, content, author..."
            />

            {filtered.length === 0 ? (
              <EmptyState>
                {canPost
                  ? <>No files match the current filter. <a onClick={openPost} style={{ color: UEE_AMBER, cursor: 'pointer', textDecoration: 'underline' }}>File a report</a>.</>
                  : 'No intelligence files match the current filter.'}
              </EmptyState>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map(f => (
                  <IntelRow key={f.id} file={f} onOpen={() => setView(f)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* VIEW FILE */}
      {view && (
        <IntelDetail
          file={view}
          canDelete={view.posted_by?.id === me.id || me.tier <= 3}
          onDelete={() => deleteFile(view.id)}
          onClose={() => setView(null)}
        />
      )}

      {/* POST INTEL */}
      {modal && (
        <UeeModal
          accent={CLASS_META[form.classification]?.color || UEE_AMBER}
          kicker="◆ NEW INTEL REPORT · ARCHIVE"
          title="FILE INTELLIGENCE"
          onClose={() => setModal(false)}
          maxWidth={640}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setModal(false)}>CANCEL</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'FILING...' : 'FILE REPORT'}
              </button>
            </>
          )}
        >
          <div className="form-group">
            <label className="form-label">TITLE *</label>
            <input className="form-input" value={form.title || ''}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Brief identifying header" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">CLASSIFICATION</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {INTEL_CLASSES.filter(c => c.min_tier >= me.tier).map(c => {
                const m = CLASS_META[c.label] || { color: UEE_AMBER, glyph: '◆', hint: '' }
                const active = form.classification === c.label
                return (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, classification: c.label, min_tier: c.min_tier }))}
                    style={{
                      flex: '1 1 140px',
                      background: active ? `${m.color}18` : 'var(--bg-raised)',
                      border: `1px solid ${active ? m.color : 'var(--border)'}`,
                      borderLeft: `3px solid ${m.color}`,
                      borderRadius: 3,
                      padding: '8px 10px',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em',
                      color: m.color, fontWeight: 600,
                    }}>
                      {m.glyph} {c.label}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                      Tier {c.min_tier}+
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">CONTENT *</label>
            <textarea
              className="form-textarea"
              style={{ minHeight: 180, fontFamily: 'var(--font-mono)', fontSize: 12 }}
              value={form.content || ''}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Intelligence details, source information, actionable data..."
            />
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
        </UeeModal>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
function IntelRow({ file: f, onOpen }) {
  const meta = CLASS_META[f.classification] || CLASS_META.OPEN
  return (
    <Card accent={meta.color} onClick={onOpen} style={{ padding: '10px 14px', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <StatusBadge color={meta.color} glyph={meta.glyph} label={meta.label} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600,
          color: 'var(--text-1)', lineHeight: 1.3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {f.title}
        </div>
        {f.content && (
          <div style={{
            fontSize: 11, color: 'var(--text-3)', marginTop: 2,
            fontFamily: 'var(--font-mono)', letterSpacing: '.04em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {f.content.replace(/\n/g, ' · ').slice(0, 140)}
          </div>
        )}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em',
        color: 'var(--text-3)', textAlign: 'right', flexShrink: 0,
      }}>
        <div>{(f.posted_by?.handle || '—').toUpperCase()}</div>
        <div>{timeAgo(f.created_at)}</div>
      </div>
      <span style={{ color: meta.color, fontSize: 16, flexShrink: 0 }}>›</span>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
function IntelDetail({ file: f, canDelete, onDelete, onClose }) {
  const meta = CLASS_META[f.classification] || CLASS_META.OPEN
  return (
    <UeeModal
      accent={meta.color}
      kicker={`◆ ${meta.label} · INTEL FILE`}
      title={f.title}
      onClose={onClose}
      maxWidth={720}
      footer={(
        <>
          {canDelete && (
            <button className="btn btn-danger btn-sm" onClick={onDelete}>PURGE FILE</button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>CLOSE</button>
        </>
      )}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <StatusBadge color={meta.color} glyph={meta.glyph} label={meta.label} />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em',
          color: 'var(--text-3)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 3,
        }}>T{f.min_tier}+ CLEARANCE</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
          FILED BY · {(f.posted_by?.handle || '—').toUpperCase()} · {timeAgo(f.created_at)}
        </span>
      </div>

      <SectionHeader label="REPORT BODY" color={meta.color} />

      <div style={{
        background: 'rgba(0,0,0,0.35)',
        border: `1px solid ${meta.color}33`,
        borderLeft: `3px solid ${meta.color}`,
        borderRadius: 3,
        padding: '16px 18px',
        fontSize: 13,
        color: 'var(--text-2)',
        lineHeight: 1.75,
        whiteSpace: 'pre-wrap',
        fontFamily: 'var(--font-mono)',
        minHeight: 140,
        maxHeight: 420,
        overflowY: 'auto',
      }}>
        {f.content}
      </div>

      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap',
        marginTop: 14, padding: '8px 0 0',
        borderTop: '1px dashed var(--border)',
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em',
        color: 'var(--text-3)',
      }}>
        <span>HANDLING · {meta.hint.toUpperCase()}</span>
      </div>
    </UeeModal>
  )
}
