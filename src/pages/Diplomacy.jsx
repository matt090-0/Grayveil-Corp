import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { confirmAction } from '../lib/dialogs'
import {
  UEE_AMBER, ClassificationBar, TabStrip, StatCell, FilterRow, Card,
  StatusBadge, Field, EmptyState, UeeModal, SectionHeader, btnMicro,
  fmtDate, timeAgo,
} from '../components/uee'

const STATUSES = ['ALLIED', 'FRIENDLY', 'NEUTRAL', 'UNFRIENDLY', 'HOSTILE', 'KOS']

const STATUS_META = {
  ALLIED:     { color: '#5ce0a1', glyph: '◈', label: 'ALLIED',     hint: 'Formal alliance — joint ops' },
  FRIENDLY:   { color: '#5a80d9', glyph: '◇', label: 'FRIENDLY',   hint: 'Positive relations' },
  NEUTRAL:    { color: '#9099a8', glyph: '○', label: 'NEUTRAL',    hint: 'No ties either way' },
  UNFRIENDLY: { color: UEE_AMBER, glyph: '◐', label: 'UNFRIENDLY', hint: 'Strained — watch carefully' },
  HOSTILE:    { color: '#e05c5c', glyph: '◉', label: 'HOSTILE',    hint: 'Engage on sight when justified' },
  KOS:        { color: '#ff3a3a', glyph: '⬢', label: 'KOS',        hint: 'Kill on sight — no hesitation' },
}

const SIZES = ['SMALL', 'MEDIUM', 'LARGE']

export default function Diplomacy() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)

  const canEdit = me.tier <= 4

  async function load() {
    const { data } = await supabase.from('diplomacy')
      .select('*, editor:profiles(handle)')
      .order('status')
      .order('org_name')
    setOrgs(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const counts = useMemo(() => {
    const c = { ALL: orgs.length }
    STATUSES.forEach(s => { c[s] = orgs.filter(o => o.status === s).length })
    return c
  }, [orgs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orgs
      .filter(o => filter === 'ALL' || o.status === filter)
      .filter(o => !q
        || (o.org_name || '').toLowerCase().includes(q)
        || (o.org_tag || '').toLowerCase().includes(q)
        || (o.contact_person || '').toLowerCase().includes(q)
        || (o.contact_discord || '').toLowerCase().includes(q)
        || (o.notes || '').toLowerCase().includes(q))
  }, [orgs, filter, search])

  async function saveOrg() {
    if (!form.org_name) { setError('Org name required.'); return }
    setSaving(true)
    const payload = {
      ...form,
      updated_by: me.id,
      last_interaction: form.last_interaction || null,
    }
    if (modal === 'add') {
      await supabase.from('diplomacy').insert(payload)
      toast('Organisation added', 'success')
    } else {
      await supabase.from('diplomacy').update(payload).eq('id', modal.id)
      toast('Relations updated', 'success')
    }
    setModal(null); setSaving(false); load()
  }

  async function deleteOrg(id) {
    if (!(await confirmAction('Remove this org from the tracker?'))) return
    await supabase.from('diplomacy').delete().eq('id', id)
    toast('Org removed', 'success')
    setDetail(null)
    load()
  }

  function openEdit(o) {
    setForm({ ...o })
    setError('')
    setModal(o)
  }

  function openAdd() {
    setForm({ status: 'NEUTRAL' })
    setError('')
    setModal('add')
  }

  const activeMeta = filter === 'ALL' ? null : STATUS_META[filter]
  const barAccent = activeMeta?.color || UEE_AMBER

  const hostileCount = (counts.HOSTILE || 0) + (counts.KOS || 0)
  const friendlyCount = (counts.ALLIED || 0) + (counts.FRIENDLY || 0)

  return (
    <>
      <ClassificationBar
        section="GRAYVEIL DIPLOMATIC REGISTRY"
        label={activeMeta ? `${activeMeta.label} PARTIES` : 'ALL CONTACTS'}
        accent={barAccent}
        right={(
          <>
            <span>TRACKED · {orgs.length}</span>
            <span style={{ color: STATUS_META.ALLIED.color }}>FRIENDLY · {friendlyCount}</span>
            <span style={{ color: STATUS_META.HOSTILE.color }}>HOSTILE · {hostileCount}</span>
          </>
        )}
      />

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>DIPLOMACY</h1>
            <div style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 640 }}>
              Standing orders on every org we've logged — allies, neutrals, and parties we shoot on sight. Keep it current.
            </div>
          </div>
          {canEdit && <button className="btn btn-primary" onClick={openAdd}>+ ADD ORG</button>}
        </div>

        <TabStrip
          active={filter} onChange={setFilter}
          tabs={[
            { key: 'ALL',        label: 'ALL',        color: '#d4d8e0',                     count: counts.ALL || 0 },
            ...STATUSES.map(s => ({
              key:   s,
              label: STATUS_META[s].label,
              color: STATUS_META[s].color,
              glyph: STATUS_META[s].glyph,
              count: counts[s] || 0,
            })),
          ]}
        />
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING DIPLOMATIC REGISTRY...</div> : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 8, marginBottom: 16,
            }}>
              {STATUSES.map(s => {
                const m = STATUS_META[s]
                return (
                  <StatCell
                    key={s}
                    label={m.label}
                    value={counts[s] || 0}
                    color={m.color}
                    glyph={m.glyph}
                    desc={m.hint}
                    onClick={() => setFilter(filter === s ? 'ALL' : s)}
                    active={filter === s}
                  />
                )
              })}
            </div>

            <FilterRow
              search={search} setSearch={setSearch}
              placeholder="Search name, tag, contact, notes..."
            />

            {filtered.length === 0 ? (
              <EmptyState>
                {canEdit
                  ? <>No orgs match. <a onClick={openAdd} style={{ color: UEE_AMBER, cursor: 'pointer', textDecoration: 'underline' }}>Add one</a>.</>
                  : 'No orgs match the current filter.'}
              </EmptyState>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 12,
              }}>
                {filtered.map(o => (
                  <OrgCard
                    key={o.id} org={o}
                    canEdit={canEdit}
                    canDelete={me.tier <= 3}
                    onOpen={() => setDetail(o)}
                    onEdit={e => { e.stopPropagation(); openEdit(o) }}
                    onDelete={e => { e.stopPropagation(); deleteOrg(o.id) }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ORG DETAIL */}
      {detail && (
        <OrgDetail
          org={detail}
          canEdit={canEdit}
          canDelete={me.tier <= 3}
          onEdit={() => { openEdit(detail); setDetail(null) }}
          onDelete={() => deleteOrg(detail.id)}
          onClose={() => setDetail(null)}
        />
      )}

      {/* ADD / EDIT */}
      {modal && (
        <UeeModal
          accent={STATUS_META[form.status]?.color || UEE_AMBER}
          kicker={modal === 'add' ? '◆ NEW CONTACT · DIPLOMATIC REGISTRY' : `◆ EDIT · ${modal.org_name}`}
          title={modal === 'add' ? 'LOG ORGANISATION' : 'UPDATE RELATIONS'}
          onClose={() => setModal(null)}
          maxWidth={660}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
              <button className="btn btn-primary" onClick={saveOrg} disabled={saving}>
                {saving ? 'SAVING...' : modal === 'add' ? 'LOG ORG' : 'UPDATE'}
              </button>
            </>
          )}
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">ORG NAME *</label>
              <input className="form-input" value={form.org_name || ''}
                onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">TAG</label>
              <input className="form-input" value={form.org_tag || ''}
                onChange={e => setForm(f => ({ ...f, org_tag: e.target.value }))}
                placeholder="e.g. [GREY]" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">DIPLOMATIC STATUS</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 4 }}>
              {STATUSES.map(s => {
                const m = STATUS_META[s]
                const active = form.status === s
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, status: s }))}
                    style={{
                      background: active ? `${m.color}1f` : 'var(--bg-raised)',
                      border: `1px solid ${active ? m.color : 'var(--border)'}`,
                      borderLeft: `3px solid ${m.color}`,
                      borderRadius: 3,
                      padding: '7px 10px',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em',
                      color: m.color, fontWeight: 600,
                    }}>
                      {m.glyph} {m.label}
                    </div>
                    <div style={{ fontSize: 9.5, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.3 }}>
                      {m.hint}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">SIZE</label>
              <select className="form-select" value={form.org_size || ''}
                onChange={e => setForm(f => ({ ...f, org_size: e.target.value }))}>
                <option value="">—</option>
                {SIZES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">LAST INTERACTION</label>
              <input className="form-input" type="date"
                value={form.last_interaction ? form.last_interaction.slice(0, 10) : ''}
                onChange={e => setForm(f => ({ ...f, last_interaction: e.target.value || null }))} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">CONTACT</label>
              <input className="form-input" value={form.contact_person || ''}
                onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">DISCORD</label>
              <input className="form-input" value={form.contact_discord || ''}
                onChange={e => setForm(f => ({ ...f, contact_discord: e.target.value }))} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">NOTES</label>
            <textarea className="form-textarea" value={form.notes || ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Relationship history, terms, agreements, threat assessment..." />
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
        </UeeModal>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
function OrgCard({ org: o, canEdit, canDelete, onOpen, onEdit, onDelete }) {
  const meta = STATUS_META[o.status] || STATUS_META.NEUTRAL
  return (
    <Card accent={meta.color} onClick={onOpen} minHeight={160}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600,
            color: 'var(--text-1)', lineHeight: 1.25,
          }}>
            {o.org_name}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            {o.org_tag && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.15em',
                color: 'var(--text-3)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: 3,
              }}>{o.org_tag}</span>
            )}
            {o.org_size && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.2em',
                color: 'var(--text-3)',
              }}>{o.org_size}</span>
            )}
          </div>
        </div>
        <StatusBadge color={meta.color} glyph={meta.glyph} label={meta.label} />
      </div>

      {o.notes && (
        <div style={{
          fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {o.notes}
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        paddingTop: 8, borderTop: '1px dashed var(--border)',
      }}>
        <Field label="CONTACT" value={o.contact_person || '—'} />
        <Field label="LAST CONTACT" value={fmtDate(o.last_interaction)} mono />
      </div>

      {canEdit && (
        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6 }}>
          <button onClick={onEdit} style={btnMicro(UEE_AMBER, true)}>◆ EDIT</button>
          {canDelete && (
            <button onClick={onDelete} style={btnMicro('#9099a8')}>✕</button>
          )}
        </div>
      )}
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
function OrgDetail({ org: o, canEdit, canDelete, onEdit, onDelete, onClose }) {
  const meta = STATUS_META[o.status] || STATUS_META.NEUTRAL
  return (
    <UeeModal
      accent={meta.color}
      kicker={`◆ DIPLOMATIC FILE · ${meta.label}`}
      title={o.org_name}
      onClose={onClose}
      maxWidth={640}
      footer={(
        <>
          {canEdit && <button className="btn btn-ghost" onClick={onEdit}>EDIT</button>}
          {canDelete && <button className="btn btn-danger btn-sm" onClick={onDelete}>REMOVE</button>}
          <button className="btn btn-primary" onClick={onClose}>CLOSE</button>
        </>
      )}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <StatusBadge color={meta.color} glyph={meta.glyph} label={meta.label} />
        {o.org_tag && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.22em',
            color: 'var(--text-3)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 3,
          }}>{o.org_tag}</span>
        )}
        {o.org_size && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em',
            color: 'var(--text-3)',
          }}>{o.org_size}</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
          UPDATED · {(o.editor?.handle || '—').toUpperCase()}
          {o.updated_at && <> · {timeAgo(o.updated_at)}</>}
        </span>
      </div>

      <div style={{
        padding: '10px 12px', marginBottom: 16,
        background: `${meta.color}0a`,
        border: `1px solid ${meta.color}33`,
        borderLeft: `3px solid ${meta.color}`,
        borderRadius: 3,
        fontSize: 12, color: 'var(--text-2)',
        fontFamily: 'var(--font-mono)', letterSpacing: '.05em',
      }}>
        STANDING ORDER · {meta.hint.toUpperCase()}
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10,
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border)',
        borderRadius: 3, marginBottom: 18,
      }}>
        <Field label="CONTACT"        value={o.contact_person || '—'} />
        <Field label="DISCORD"        value={o.contact_discord || '—'} mono />
        <Field label="LAST INTERACTION" value={fmtDate(o.last_interaction)} mono />
      </div>

      <SectionHeader label="DOSSIER NOTES" color={meta.color} />
      <div style={{
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid var(--border)',
        borderRadius: 3, padding: '14px 16px',
        fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7,
        whiteSpace: 'pre-wrap', minHeight: 80,
      }}>
        {o.notes || <span style={{ color: 'var(--text-3)' }}>No dossier notes on file.</span>}
      </div>
    </UeeModal>
  )
}
