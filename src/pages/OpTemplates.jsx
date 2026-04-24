import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { goldBurst } from '../lib/confetti'
import { discordNewOp } from '../lib/discord'
import ReactMarkdown from 'react-markdown'
import { confirmAction } from '../lib/dialogs'

// Category → accent color, icon glyph, badge class.
// Colors are set once here so every surface (chip, stripe, icon, hover glow)
// stays in sync. If you want to tweak a category palette, change it in CAT.
const CAT = {
  COMBAT:   { color: '#e05c5c', glyph: '⚔',  badge: 'badge-red',    blurb: 'Kinetic ops — PvP, PvE, CZ, patrol.' },
  MINING:   { color: '#e0a155', glyph: '⛏',  badge: 'badge-amber',  blurb: 'Prospecting, extraction, refining.' },
  TRADE:    { color: '#5ce0a1', glyph: '⬢',  badge: 'badge-green',  blurb: 'Cargo runs — legal and otherwise.' },
  ESCORT:   { color: '#5a80d9', glyph: '⟶',  badge: 'badge-blue',   blurb: 'Convoy, VIP, and evac work.' },
  RECON:    { color: '#a860e0', glyph: '◎',  badge: 'badge-purple', blurb: 'Scouting, intel, infiltration.' },
  SALVAGE:  { color: '#9aa0ac', glyph: '✦',  badge: 'badge-muted',  blurb: 'Strip derelicts and battlefields.' },
  RACING:   { color: '#c8a55a', glyph: '◢',  badge: 'badge-accent', blurb: 'Circuit races and time trials.' },
  GENERAL:  { color: '#b4b8c4', glyph: '●',  badge: 'badge-muted',  blurb: 'Social, training, multi-crew practice.' },
}
const CATEGORIES = Object.keys(CAT)
const SORTS = [
  { id: 'popular', label: 'MOST USED' },
  { id: 'recent',  label: 'NEWEST' },
  { id: 'name',    label: 'A → Z' },
]

export default function OpTemplates() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('popular')

  const canCreate = me.tier <= 4

  async function load() {
    const { data } = await supabase
      .from('op_templates')
      .select('*, creator:profiles!op_templates_created_by_fkey(handle)')
      .order('use_count', { ascending: false })
    setTemplates(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Derived counts per category for the filter chips
  const counts = useMemo(() => {
    const c = { ALL: templates.length }
    for (const t of templates) c[t.category] = (c[t.category] || 0) + 1
    return c
  }, [templates])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = filter === 'ALL' ? templates : templates.filter(t => t.category === filter)
    if (q) {
      list = list.filter(t =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.location || '').toLowerCase().includes(q)
      )
    }
    if (sort === 'recent') {
      list = [...list].sort((a, b) => (new Date(b.created_at || 0)) - (new Date(a.created_at || 0)))
    } else if (sort === 'name') {
      list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }
    // 'popular' is the default order from the query
    return list
  }, [templates, filter, search, sort])

  async function saveTemplate(e) {
    e.preventDefault()
    if (!form.name || !form.briefing) { setError('Name and briefing are required.'); return }
    setSaving(true)
    const payload = {
      name: form.name, description: form.description || '',
      event_type: form.event_type || 'OPERATION', location: form.location || null,
      duration_hours: parseFloat(form.duration_hours) || 2,
      min_slots: parseInt(form.min_slots) || 4, max_slots: parseInt(form.max_slots) || 12,
      min_tier: parseInt(form.min_tier) || 9,
      required_roles: (form.roles_text || '').split('\n').map(s => s.trim()).filter(Boolean),
      required_ships: (form.ships_text || '').split('\n').map(s => s.trim()).filter(Boolean),
      briefing: form.briefing, category: form.category || 'GENERAL',
      is_public: form.is_public !== false, created_by: me.id,
    }
    if (form.editing_id) {
      await supabase.from('op_templates').update(payload).eq('id', form.editing_id)
      toast('Template updated', 'success')
    } else {
      await supabase.from('op_templates').insert(payload)
      toast('Template created', 'success')
    }
    setModal(null); setSaving(false); setForm({}); load()
  }

  async function launchOp(tpl) {
    const startsAt = new Date()
    startsAt.setHours(startsAt.getHours() + 1)
    const { error: err } = await supabase.from('events').insert({
      title: tpl.name,
      description: tpl.briefing,
      event_type: tpl.event_type || 'OPERATION',
      location: tpl.location || 'TBD',
      starts_at: startsAt.toISOString(),
      min_tier: tpl.min_tier || 9,
      max_slots: tpl.max_slots || 12,
      created_by: me.id,
      status: 'SCHEDULED',
    })
    if (err) { toast(err.message, 'error'); return }
    await supabase.from('op_templates').update({ use_count: (tpl.use_count || 0) + 1 }).eq('id', tpl.id)
    goldBurst()
    discordNewOp(tpl.name, tpl.event_type, tpl.location, 'In 1 hour', me.handle)
    toast(`Op "${tpl.name}" scheduled — starts in 1 hour`, 'success')
    navigate('/events')
  }

  function openEdit(tpl) {
    setForm({
      editing_id: tpl.id, name: tpl.name, description: tpl.description,
      event_type: tpl.event_type, location: tpl.location,
      duration_hours: tpl.duration_hours, min_slots: tpl.min_slots, max_slots: tpl.max_slots,
      min_tier: tpl.min_tier, roles_text: (tpl.required_roles || []).join('\n'),
      ships_text: (tpl.required_ships || []).join('\n'),
      briefing: tpl.briefing, category: tpl.category, is_public: tpl.is_public,
    })
    setError(''); setModal('create')
  }

  async function deleteTemplate(id) {
    if (!(await confirmAction('Delete this template?'))) return
    await supabase.from('op_templates').delete().eq('id', id)
    toast('Template deleted', 'info'); setViewing(null); load()
  }

  const selectedCat = filter === 'ALL' ? null : CAT[filter]

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="page-title">OP TEMPLATES</div>
            <div className="page-subtitle">
              {templates.length} saved briefings · one-click launch
              {selectedCat && <> · viewing <span style={{ color: selectedCat.color }}>{filter}</span> — <span style={{ color: 'var(--text-3)' }}>{selectedCat.blurb}</span></>}
            </div>
          </div>
          {canCreate && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setForm({ category: 'GENERAL', min_tier: 9, min_slots: 4, max_slots: 12, duration_hours: 2, event_type: 'OPERATION', is_public: true })
                setError(''); setModal('create')
              }}
            >
              + NEW TEMPLATE
            </button>
          )}
        </div>

        {/* Search + Sort */}
        <div className="flex gap-8 mb-12" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-input"
            style={{ maxWidth: 260, flex: '1 1 200px' }}
            placeholder="Search name, description, location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex gap-4" style={{ marginLeft: 'auto', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, letterSpacing: '.2em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', alignSelf: 'center', marginRight: 4 }}>
              SORT
            </span>
            {SORTS.map(s => (
              <button
                key={s.id}
                className="btn btn-ghost btn-sm"
                style={sort === s.id ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
                onClick={() => setSort(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category chips with counts + color dots */}
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          <button
            className="btn btn-ghost btn-sm"
            style={filter === 'ALL' ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
            onClick={() => setFilter('ALL')}
          >
            ALL <span style={{ opacity: 0.55, marginLeft: 6 }}>{counts.ALL || 0}</span>
          </button>
          {CATEGORIES.map(c => {
            const active = filter === c
            const meta = CAT[c]
            return (
              <button
                key={c}
                className="btn btn-ghost btn-sm"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  ...(active
                    ? { background: `${meta.color}22`, color: meta.color, borderColor: meta.color }
                    : {}),
                }}
                onClick={() => setFilter(c)}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, opacity: active ? 1 : 0.65 }} />
                {c}
                <span style={{ opacity: 0.55 }}>{counts[c] || 0}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="loading">LOADING...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            {search ? `NO TEMPLATES MATCH "${search.toUpperCase()}"` : `NO TEMPLATES${filter !== 'ALL' ? ` IN ${filter}` : ''}`}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {filtered.map(t => {
              const meta = CAT[t.category] || CAT.GENERAL
              const canEdit = (t.created_by === me.id) || me.tier <= 3
              return (
                <TemplateCard
                  key={t.id}
                  template={t}
                  meta={meta}
                  canCreate={canCreate}
                  canEdit={canEdit}
                  onView={() => setViewing(t)}
                  onLaunch={() => launchOp(t)}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* ═══ VIEW TEMPLATE ═══ */}
      {viewing && (() => {
        const meta = CAT[viewing.category] || CAT.GENERAL
        return (
          <Modal title="" onClose={() => setViewing(null)} size="modal-lg">
            <div style={{ margin: '-20px -24px -16px' }}>
              {/* Category-coloured header strip */}
              <div style={{
                background: `linear-gradient(135deg, ${meta.color}22, ${meta.color}08 60%, transparent)`,
                borderBottom: `1px solid ${meta.color}55`,
                padding: '22px 28px 20px',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `radial-gradient(circle at 90% 20%, ${meta.color}18, transparent 55%)`,
                  pointerEvents: 'none',
                }} />
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: `${meta.color}22`,
                        border: `1px solid ${meta.color}66`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, color: meta.color,
                      }}>{meta.glyph}</div>
                      <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, lineHeight: 1.15 }}>
                          {viewing.name}
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <span className={`badge ${meta.badge}`} style={{ fontSize: 10 }}>{viewing.category}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                      {canCreate && <button className="btn btn-primary btn-sm" onClick={() => launchOp(viewing)}>LAUNCH OP</button>}
                      {(viewing.created_by === me.id || me.tier <= 3) && (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => { openEdit(viewing); setViewing(null) }}>EDIT</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => deleteTemplate(viewing.id)}>DELETE</button>
                        </>
                      )}
                    </div>
                  </div>
                  {viewing.description && (
                    <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10, lineHeight: 1.55 }}>
                      {viewing.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', flexWrap: 'wrap' }}>
                    <span>{viewing.min_slots}-{viewing.max_slots} players</span>
                    <span>{viewing.duration_hours}h estimated</span>
                    <span>{viewing.location || 'Location TBD'}</span>
                    <span>Min tier: {viewing.min_tier}</span>
                    <span>Used {viewing.use_count || 0}×</span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '20px 28px 24px' }}>
                {/* Required roles + ships */}
                {((viewing.required_roles || []).length > 0 || (viewing.required_ships || []).length > 0) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                    {(viewing.required_roles || []).length > 0 && (
                      <div>
                        <div style={{ fontSize: 9, letterSpacing: '.2em', color: meta.color, fontFamily: 'var(--font-mono)', marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${meta.color}33` }}>
                          REQUIRED ROLES
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {viewing.required_roles.map((r, i) => (
                            <div key={i} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                              {r}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(viewing.required_ships || []).length > 0 && (
                      <div>
                        <div style={{ fontSize: 9, letterSpacing: '.2em', color: meta.color, fontFamily: 'var(--font-mono)', marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${meta.color}33` }}>
                          RECOMMENDED SHIPS
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {viewing.required_ships.map((s, i) => (
                            <span key={i} style={{ fontSize: 11, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 8px' }}>{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Briefing */}
                <div style={{ fontSize: 9, letterSpacing: '.2em', color: meta.color, fontFamily: 'var(--font-mono)', marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${meta.color}33` }}>
                  OPERATION BRIEFING
                </div>
                <div className="wiki-content" style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
                  padding: 20, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.8,
                  fontFamily: 'var(--font-mono)', maxHeight: 400, overflowY: 'auto', whiteSpace: 'pre-wrap',
                }}>
                  <ReactMarkdown>{viewing.briefing}</ReactMarkdown>
                </div>

                <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 12 }}>
                  Created by {viewing.creator?.handle || '—'}
                </div>
              </div>
            </div>
          </Modal>
        )
      })()}

      {/* ═══ CREATE/EDIT TEMPLATE ═══ */}
      {modal === 'create' && (
        <Modal title={form.editing_id ? 'EDIT TEMPLATE' : 'NEW OP TEMPLATE'} onClose={() => setModal(null)} size="modal-lg">
          <form onSubmit={saveTemplate}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">TEMPLATE NAME *</label>
                <input className="form-input" value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Jumptown Lockdown" />
              </div>
              <div className="form-group">
                <label className="form-label">CATEGORY</label>
                <select className="form-select" value={form.category || 'GENERAL'} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">SHORT DESCRIPTION</label>
              <input className="form-input" value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="One-line summary of this operation type" />
            </div>

            <div className="form-row">
              <div className="form-group"><label className="form-label">TYPE</label>
                <select className="form-select" value={form.event_type || 'OPERATION'} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}>
                  <option>OPERATION</option><option>TRAINING</option><option>SOCIAL</option><option>MEETING</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">LOCATION</label><input className="form-input" value={form.location || ''} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Yela Belt" /></div>
              <div className="form-group"><label className="form-label">DURATION (h)</label><input className="form-input" type="number" step="0.5" value={form.duration_hours || ''} onChange={e => setForm(f => ({ ...f, duration_hours: e.target.value }))} /></div>
            </div>

            <div className="form-row">
              <div className="form-group"><label className="form-label">MIN PLAYERS</label><input className="form-input" type="number" value={form.min_slots || ''} onChange={e => setForm(f => ({ ...f, min_slots: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">MAX PLAYERS</label><input className="form-input" type="number" value={form.max_slots || ''} onChange={e => setForm(f => ({ ...f, max_slots: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">MIN TIER</label><input className="form-input" type="number" min="1" max="9" value={form.min_tier || ''} onChange={e => setForm(f => ({ ...f, min_tier: e.target.value }))} /></div>
            </div>

            <div className="form-row">
              <div className="form-group"><label className="form-label">REQUIRED ROLES (one per line)</label><textarea className="form-textarea" style={{ minHeight: 60 }} value={form.roles_text || ''} onChange={e => setForm(f => ({ ...f, roles_text: e.target.value }))} placeholder="Fighter Escort x3&#10;Ground Team x2&#10;Cargo Hauler x1" /></div>
              <div className="form-group"><label className="form-label">RECOMMENDED SHIPS (one per line)</label><textarea className="form-textarea" style={{ minHeight: 60 }} value={form.ships_text || ''} onChange={e => setForm(f => ({ ...f, ships_text: e.target.value }))} placeholder="Gladius&#10;Arrow&#10;Cutlass Black" /></div>
            </div>

            <div className="form-group">
              <label className="form-label">FULL BRIEFING *</label>
              <textarea className="form-textarea" style={{ minHeight: 180, fontFamily: 'var(--font-mono)', fontSize: 12 }} value={form.briefing || ''} onChange={e => setForm(f => ({ ...f, briefing: e.target.value }))} placeholder="Full operation briefing — phases, procedures, contingencies, payout..." />
            </div>

            {error && <div className="form-error mb-8">{error}</div>}
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'SAVING...' : form.editing_id ? 'UPDATE TEMPLATE' : 'CREATE TEMPLATE'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

// Individual card — extracted so each one owns its hover state without
// re-rendering the whole grid on mouseenter/leave.
function TemplateCard({ template: t, meta, canCreate, canEdit, onView, onLaunch }) {
  const [hover, setHover] = useState(false)
  const roleCount = (t.required_roles || []).length
  const shipCount = (t.required_ships || []).length
  return (
    <div
      onClick={onView}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        background: 'var(--bg-raised)',
        border: `1px solid ${hover ? meta.color + '88' : 'var(--border)'}`,
        borderRadius: 10,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform .18s, border-color .18s, box-shadow .18s',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hover ? `0 10px 30px rgba(0,0,0,.35), 0 0 0 1px ${meta.color}22, 0 0 22px ${meta.color}18` : '0 2px 8px rgba(0,0,0,.18)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Left accent bar + soft glow */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: 0, width: 3,
        background: meta.color, opacity: hover ? 1 : 0.7,
        transition: 'opacity .18s',
      }} />
      <div aria-hidden style={{
        position: 'absolute', top: -30, right: -30, width: 120, height: 120,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${meta.color}22 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ padding: '16px 18px 14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {/* Header — icon + title + category badge */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 7,
              background: `${meta.color}1f`,
              border: `1px solid ${meta.color}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: meta.color, fontSize: 15, flexShrink: 0,
            }}>
              {meta.glyph}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-1)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.name}
              </div>
              <div style={{ fontSize: 10, color: meta.color, letterSpacing: '.15em', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {t.category}
              </div>
            </div>
          </div>
          <div style={{
            fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)',
            background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4,
            padding: '2px 7px', flexShrink: 0,
          }}>
            {t.use_count || 0}× used
          </div>
        </div>

        {/* Description */}
        {t.description && (
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.55,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {t.description}
          </div>
        )}

        {/* Key stats row */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 10, color: 'var(--text-3)',
          fontFamily: 'var(--font-mono)', marginTop: 'auto',
        }}>
          <span style={statPillStyle}>👥 {t.min_slots}-{t.max_slots}</span>
          <span style={statPillStyle}>⏱ {t.duration_hours}h</span>
          <span style={statPillStyle}>📍 {t.location || 'TBD'}</span>
          {roleCount > 0 && <span style={statPillStyle}>◆ {roleCount} role{roleCount === 1 ? '' : 's'}</span>}
          {shipCount > 0 && <span style={statPillStyle}>✈ {shipCount} ship{shipCount === 1 ? '' : 's'}</span>}
        </div>
      </div>

      {/* Action footer */}
      <div style={{
        borderTop: '1px solid var(--border)',
        padding: '8px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: hover ? `${meta.color}10` : 'var(--bg-surface)',
        transition: 'background .18s',
      }}>
        <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          {t.creator?.handle ? `@${t.creator.handle}` : '—'}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={(e) => { e.stopPropagation(); onView() }}
            style={{ padding: '3px 10px', fontSize: 10 }}
          >
            DETAILS
          </button>
          {canCreate && (
            <button
              className="btn btn-primary btn-sm"
              onClick={(e) => { e.stopPropagation(); onLaunch() }}
              style={{ padding: '3px 12px', fontSize: 10, background: meta.color, borderColor: meta.color, color: '#0a0b0f' }}
            >
              LAUNCH
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const statPillStyle = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '2px 7px',
  display: 'inline-flex', alignItems: 'center', gap: 4,
}
