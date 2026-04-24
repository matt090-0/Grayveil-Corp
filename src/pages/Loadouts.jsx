import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { confirmAction } from '../lib/dialogs'
import Modal from '../components/Modal'
import { SC_SHIPS } from '../lib/ships'
import {
  SHIP_SLOTS,
  WEAPON_SLOTS,
  ARMOR_SLOTS,
  WEAPON_ARCHETYPES,
  ARMOR_ARCHETYPES,
} from '../lib/scgear'

// ── UEE visual language ────────────────────────────────────────────────────
const UEE_AMBER = '#c8a55a'
const CLIP_CHAMFER = 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))'
const CLIP_CHAMFER_SM = 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))'

const KINDS = {
  ship: {
    key: 'ship',
    label: 'SHIP LOADOUTS',
    short: 'SHIPS',
    singular: 'ship loadout',
    table: 'ship_loadouts',
    slots: SHIP_SLOTS,
    archetypes: [],
    color: '#5a80d9',
    glyph: '◈',
    blurb: 'Ship builds — weapons, shields, drives, and systems.',
  },
  weapon: {
    key: 'weapon',
    label: 'WEAPON LOADOUTS',
    short: 'WEAPONS',
    singular: 'weapon loadout',
    table: 'weapon_loadouts',
    slots: WEAPON_SLOTS,
    archetypes: WEAPON_ARCHETYPES,
    color: '#e05c5c',
    glyph: '⚔',
    blurb: 'Infantry kits — primary, sidearm, melee, throwables, and support.',
  },
  armor: {
    key: 'armor',
    label: 'ARMOR LOADOUTS',
    short: 'ARMOR',
    singular: 'armor loadout',
    table: 'armor_loadouts',
    slots: ARMOR_SLOTS,
    archetypes: ARMOR_ARCHETYPES,
    color: '#c8a55a',
    glyph: '▣',
    blurb: 'Suit configurations — helmet, core, limbs, backpack, undersuit.',
  },
}

const KIND_ORDER = ['ship', 'weapon', 'armor']

function fmt(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function Loadouts() {
  const { profile: me } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState('ship')
  const [data, setData] = useState({ ship: [], weapon: [], armor: [] })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('newest')
  const [detail, setDetail] = useState(null)
  const [editing, setEditing] = useState(null) // null | 'new' | row
  const [busy, setBusy] = useState(false)

  const kind = KINDS[tab]

  async function load() {
    setLoading(true)
    const [ship, weapon, armor] = await Promise.all([
      supabase.from('ship_loadouts').select('*, author:profiles!created_by(handle, avatar_color)').order('created_at', { ascending: false }),
      supabase.from('weapon_loadouts').select('*, author:profiles!created_by(handle, avatar_color)').order('created_at', { ascending: false }),
      supabase.from('armor_loadouts').select('*, author:profiles!created_by(handle, avatar_color)').order('created_at', { ascending: false }),
    ])
    setData({
      ship:   ship.data   || [],
      weapon: weapon.data || [],
      armor:  armor.data  || [],
    })
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const counts = {
    ship: data.ship.length,
    weapon: data.weapon.length,
    armor: data.armor.length,
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let out = data[tab] || []
    if (q) {
      out = out.filter(r => {
        const hay = [
          r.name, r.role, r.archetype, r.description,
          r.ship_class, r.author?.handle,
          ...Object.values(r.components || {}),
        ].filter(Boolean).join(' ').toLowerCase()
        return hay.includes(q)
      })
    }
    if (sort === 'newest') out = [...out].sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    else if (sort === 'oldest') out = [...out].sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
    else if (sort === 'az') out = [...out].sort((a,b) => (a.name||'').localeCompare(b.name||''))
    return out
  }, [data, tab, search, sort])

  function openNew() {
    setEditing({ _new: true, components: {} })
  }
  function openEdit(row) {
    setEditing({ ...row, components: row.components || {} })
  }

  async function onDelete(row) {
    if (!(await confirmAction(`Delete "${row.name}"? This can't be undone.`))) return
    setBusy(true)
    const { error } = await supabase.from(kind.table).delete().eq('id', row.id)
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Loadout deleted')
    setDetail(null)
    load()
  }

  return (
    <>
      <ClassificationBar kind={kind} count={counts[tab]} />

      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 8 }}>
          <div>
            <div className="page-title">LOADOUT ARCHIVE</div>
            <div className="page-subtitle">{kind.blurb}</div>
          </div>
          <button
            className="btn btn-primary"
            onClick={openNew}
            style={{ clipPath: CLIP_CHAMFER_SM }}
          >
            + NEW {kind.short === 'SHIPS' ? 'SHIP BUILD' : kind.short === 'WEAPONS' ? 'KIT' : 'ARMOR SET'}
          </button>
        </div>
      </div>

      <div className="page-body">
        <TabStrip tab={tab} setTab={setTab} counts={counts} />

        <FilterRow
          search={search} setSearch={setSearch}
          sort={sort} setSort={setSort}
          accent={kind.color}
        />

        {loading ? (
          <div className="loading">LOADING ARCHIVE…</div>
        ) : rows.length === 0 ? (
          <EmptyPanel kind={kind} onNew={openNew} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {rows.map(r => (
              <LoadoutCard key={r.id} row={r} kind={kind} onClick={() => setDetail(r)} />
            ))}
          </div>
        )}
      </div>

      {detail && (
        <DetailModal
          row={detail}
          kind={kind}
          me={me}
          onClose={() => setDetail(null)}
          onEdit={() => { const r = detail; setDetail(null); openEdit(r) }}
          onDelete={() => onDelete(detail)}
          busy={busy}
        />
      )}

      {editing && (
        <EditorModal
          row={editing}
          kind={kind}
          me={me}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
          busy={busy}
          setBusy={setBusy}
          toast={toast}
        />
      )}
    </>
  )
}

// ── Classification bar ────────────────────────────────────────────────────
function ClassificationBar({ kind, count }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '6px 18px',
      background: 'linear-gradient(90deg, rgba(200,165,90,.08), transparent 60%)',
      borderBottom: `1px solid ${UEE_AMBER}33`,
      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em',
      color: UEE_AMBER, textTransform: 'uppercase',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: UEE_AMBER, animation: 'pulse 2.4s ease-in-out infinite' }} />
      <span>UEE · LOADOUT REGISTRY</span>
      <span style={{ opacity: .4 }}>//</span>
      <span style={{ color: kind.color }}>{kind.glyph} {kind.label}</span>
      <span style={{ opacity: .4 }}>//</span>
      <span style={{ opacity: .6 }}>{count} ON FILE</span>
      <span style={{ flex: 1 }} />
      <span style={{ opacity: .5 }}>CLR: PUBLIC</span>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────
function TabStrip({ tab, setTab, counts }) {
  return (
    <div style={{
      display: 'flex', gap: 0, marginBottom: 18,
      borderBottom: '1px solid var(--border-md)',
    }}>
      {KIND_ORDER.map(k => {
        const kinfo = KINDS[k]
        const active = tab === k
        return (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              background: active ? `${kinfo.color}18` : 'transparent',
              border: 0,
              borderBottom: active ? `2px solid ${kinfo.color}` : '2px solid transparent',
              padding: '12px 20px',
              color: active ? kinfo.color : 'var(--text-2)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11, letterSpacing: '.16em',
              cursor: 'pointer',
              transition: 'all .15s',
              display: 'flex', alignItems: 'center', gap: 10,
              fontWeight: active ? 600 : 400,
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-1)' }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-2)' }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>{kinfo.glyph}</span>
            {kinfo.label}
            <span style={{
              fontSize: 10, padding: '2px 7px',
              background: active ? `${kinfo.color}33` : 'var(--bg-raised)',
              border: `1px solid ${active ? kinfo.color + '55' : 'var(--border)'}`,
              borderRadius: 10,
              minWidth: 18, textAlign: 'center',
              color: active ? kinfo.color : 'var(--text-3)',
            }}>{counts[k]}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Filter row ────────────────────────────────────────────────────────────
function FilterRow({ search, setSearch, sort, setSort, accent }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
      <input
        className="form-input"
        placeholder="SEARCH · name, role, component, author…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ flex: 1, minWidth: 240, fontFamily: 'var(--font-mono)', letterSpacing: '.04em', borderColor: search ? accent + '55' : undefined }}
      />
      <select className="form-select" value={sort} onChange={e => setSort(e.target.value)} style={{ maxWidth: 180 }}>
        <option value="newest">NEWEST FIRST</option>
        <option value="oldest">OLDEST FIRST</option>
        <option value="az">A → Z</option>
      </select>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────
function EmptyPanel({ kind, onNew }) {
  return (
    <div style={{
      padding: '60px 20px',
      textAlign: 'center',
      background: 'var(--bg-raised)',
      clipPath: CLIP_CHAMFER,
      border: '1px solid var(--border)',
      color: 'var(--text-3)',
      fontFamily: 'var(--font-mono)',
    }}>
      <div style={{ fontSize: 40, color: kind.color, marginBottom: 12 }}>{kind.glyph}</div>
      <div style={{ fontSize: 13, letterSpacing: '.15em', marginBottom: 6 }}>NO {kind.short} ON FILE</div>
      <div style={{ fontSize: 11, marginBottom: 20 }}>Be the first to file a {kind.singular}.</div>
      <button className="btn btn-primary" onClick={onNew} style={{ clipPath: CLIP_CHAMFER_SM }}>
        + FILE NEW {kind.short === 'SHIPS' ? 'BUILD' : kind.short === 'WEAPONS' ? 'KIT' : 'ARMOR SET'}
      </button>
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────
function LoadoutCard({ row, kind, onClick }) {
  const comp = row.components || {}
  const filled = kind.slots.filter(s => comp[s.key] && String(comp[s.key]).trim()).slice(0, 4)
  const subtitle = kind.key === 'ship' ? row.ship_class : row.archetype
  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        clipPath: CLIP_CHAMFER,
        background: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        padding: 0,
        cursor: 'pointer',
        transition: 'transform .15s, box-shadow .15s',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = `0 6px 20px ${kind.color}33`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Left accent stripe */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: kind.color }} />

      <div style={{ padding: '14px 16px 12px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 30, height: 30, flexShrink: 0,
            display: 'grid', placeItems: 'center',
            background: `${kind.color}18`,
            border: `1px solid ${kind.color}55`,
            color: kind.color,
            fontSize: 16,
            clipPath: 'polygon(20% 0, 80% 0, 100% 50%, 80% 100%, 20% 100%, 0 50%)',
          }}>{kind.glyph}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.name}
            </div>
            {subtitle && (
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: kind.color, letterSpacing: '.1em', marginTop: 2 }}>
                {subtitle.toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {row.role && (
          <div style={{
            display: 'inline-block',
            padding: '2px 8px',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '.12em',
            color: 'var(--text-2)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            marginBottom: 10,
          }}>
            {row.role.toUpperCase()}
          </div>
        )}

        {row.description && (
          <p style={{
            fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5, margin: '0 0 12px 0',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {row.description}
          </p>
        )}

        {/* Filled-slot preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
          {filled.length === 0 ? (
            <div style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: 11 }}>No components filed yet.</div>
          ) : filled.map(s => (
            <div key={s.key} style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
              <span style={{ color: s.color, minWidth: 34, letterSpacing: '.08em', fontSize: 9 }}>{s.short || s.label.slice(0, 3)}</span>
              <span style={{ color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {comp[s.key]}
              </span>
            </div>
          ))}
          {kind.slots.filter(s => comp[s.key] && String(comp[s.key]).trim()).length > 4 && (
            <div style={{ color: 'var(--text-3)', fontSize: 10, fontStyle: 'italic' }}>
              +{kind.slots.filter(s => comp[s.key] && String(comp[s.key]).trim()).length - 4} more…
            </div>
          )}
        </div>
      </div>

      <div style={{
        padding: '8px 16px 10px 18px',
        borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.08em',
      }}>
        <span>BY {(row.author?.handle || 'UNKNOWN').toUpperCase()}</span>
        <span>{fmt(row.created_at)}</span>
      </div>
    </div>
  )
}

// ── Detail modal ──────────────────────────────────────────────────────────
function DetailModal({ row, kind, me, onClose, onEdit, onDelete, busy }) {
  const comp = row.components || {}
  const canManage = row.created_by === me.id || me.tier <= 4
  const canDelete = row.created_by === me.id || me.tier <= 3
  const subtitle = kind.key === 'ship' ? row.ship_class : row.archetype

  return (
    <Modal title="" onClose={onClose} size="modal-lg">
      {/* Header strip */}
      <div style={{
        margin: '-20px -20px 16px',
        padding: '14px 20px',
        background: `linear-gradient(90deg, ${kind.color}22, transparent)`,
        borderBottom: `1px solid ${kind.color}55`,
      }}>
        <div style={{ fontSize: 9, letterSpacing: '.2em', color: kind.color, fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
          {kind.label}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20, color: kind.color }}>{kind.glyph}</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{row.name}</div>
            {subtitle && <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.1em', marginTop: 2 }}>{subtitle.toUpperCase()}</div>}
          </div>
        </div>
      </div>

      {/* Meta strip */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {row.role && <MetaChip label="ROLE" value={row.role} />}
        <MetaChip label="FILED" value={fmt(row.created_at)} />
        <MetaChip label="BY" value={row.author?.handle || '—'} />
      </div>

      {row.description && (
        <div style={{
          padding: 14, marginBottom: 18,
          background: 'var(--bg-surface)',
          clipPath: CLIP_CHAMFER_SM,
          fontSize: 13, lineHeight: 1.6, color: 'var(--text-2)',
          borderLeft: `2px solid ${kind.color}`,
        }}>
          {row.description}
        </div>
      )}

      {/* Component grid */}
      <div style={{ fontSize: 10, letterSpacing: '.18em', color: kind.color, fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
        ◆ COMPONENTS FILED
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, marginBottom: 20 }}>
        {kind.slots.map(s => {
          const v = comp[s.key]
          return (
            <div key={s.key} style={{
              padding: '10px 12px',
              background: v ? 'var(--bg-raised)' : 'transparent',
              border: `1px solid ${v ? s.color + '44' : 'var(--border)'}`,
              borderLeft: `3px solid ${v ? s.color : 'var(--border)'}`,
              clipPath: CLIP_CHAMFER_SM,
              opacity: v ? 1 : 0.5,
            }}>
              <div style={{ fontSize: 9, letterSpacing: '.18em', fontFamily: 'var(--font-mono)', color: s.color, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span>{s.glyph}</span>{s.label}
              </div>
              <div style={{ fontSize: 12, color: v ? 'var(--text-1)' : 'var(--text-3)', fontStyle: v ? 'normal' : 'italic', wordBreak: 'break-word' }}>
                {v || '— empty —'}
              </div>
            </div>
          )
        })}
      </div>

      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onClose}>CLOSE</button>
        {canManage && <button className="btn btn-ghost" onClick={onEdit}>EDIT</button>}
        {canDelete && <button className="btn" onClick={onDelete} disabled={busy} style={{ color: 'var(--red)', border: '1px solid var(--red)' }}>DELETE</button>}
      </div>
    </Modal>
  )
}

function MetaChip({ label, value }) {
  return (
    <div style={{
      padding: '4px 10px',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 3,
      fontFamily: 'var(--font-mono)',
    }}>
      <div style={{ fontSize: 9, letterSpacing: '.16em', color: 'var(--text-3)' }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-1)', marginTop: 1 }}>{value}</div>
    </div>
  )
}

// ── Editor modal (create + edit) ──────────────────────────────────────────
function EditorModal({ row, kind, me, onClose, onSaved, busy, setBusy, toast }) {
  const isNew = !!row._new
  const [form, setForm] = useState({
    name:        row.name || '',
    archetype:   row.archetype || '',
    ship_class:  row.ship_class || '',
    role:        row.role || '',
    description: row.description || '',
    components:  row.components || {},
  })
  const [shipSearch, setShipSearch] = useState(row.ship_class || '')
  const [shipDrop, setShipDrop]     = useState(false)
  const [error, setError]           = useState('')

  const shipResults = useMemo(() => {
    const q = shipSearch.trim().toLowerCase()
    if (!q) return SC_SHIPS.slice(0, 12)
    return SC_SHIPS.filter(s => s.name.toLowerCase().includes(q)).slice(0, 12)
  }, [shipSearch])

  function setComp(key, val) {
    setForm(f => ({ ...f, components: { ...f.components, [key]: val } }))
  }

  async function save() {
    setError('')
    if (!form.name.trim()) { setError('Name is required.'); return }
    if (kind.key === 'ship' && !form.ship_class.trim()) { setError('Ship class is required.'); return }

    setBusy(true)
    const payload = {
      name:        form.name.trim(),
      role:        form.role.trim() || null,
      description: form.description.trim() || null,
      components:  form.components,
    }
    if (kind.key === 'ship') {
      payload.ship_class = form.ship_class.trim()
    } else {
      payload.archetype = form.archetype.trim() || null
    }

    let error
    if (isNew) {
      payload.created_by = me.id
      ;({ error } = await supabase.from(kind.table).insert(payload))
    } else {
      ;({ error } = await supabase.from(kind.table).update(payload).eq('id', row.id))
    }
    setBusy(false)
    if (error) { setError(error.message); return }
    toast(isNew ? 'Loadout filed' : 'Loadout updated', 'success')
    onSaved()
  }

  const datalistId = `gear-catalog-${kind.key}`

  return (
    <Modal title={`${isNew ? 'FILE NEW' : 'AMEND'} — ${kind.label}`} onClose={onClose} size="modal-lg">
      {/* Global datalists for this kind */}
      {kind.slots.map(s => (
        <datalist key={s.key} id={`${datalistId}-${s.key}`}>
          {s.list.map(item => <option key={item} value={item} />)}
        </datalist>
      ))}

      <div className="form-row">
        <div className="form-group" style={{ flex: 2 }}>
          <label className="form-label">NAME *</label>
          <input
            className="form-input"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder={kind.key === 'ship' ? 'PvP Brawler · Mining Config' : kind.key === 'weapon' ? 'Boarding Kit · Sniper Support' : 'Heavy Assault · Light EVA'}
          />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label">ROLE</label>
          <input
            className="form-input"
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            placeholder="optional"
          />
        </div>
      </div>

      {kind.key === 'ship' ? (
        <div className="form-group" style={{ position: 'relative' }}>
          <label className="form-label">SHIP CLASS *</label>
          <input
            className="form-input"
            value={shipSearch}
            onChange={e => { setShipSearch(e.target.value); setForm(f => ({ ...f, ship_class: e.target.value })); setShipDrop(true) }}
            onFocus={() => setShipDrop(true)}
            onBlur={() => setTimeout(() => setShipDrop(false), 150)}
            placeholder="Search ships…"
            autoComplete="off"
          />
          {shipDrop && shipResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: 'var(--bg-raised)', border: '1px solid var(--border-md)',
              borderRadius: 'var(--radius-sm)', maxHeight: 240, overflowY: 'auto',
              boxShadow: '0 8px 24px rgba(0,0,0,.4)', marginTop: 2,
            }}>
              {shipResults.map(s => (
                <div
                  key={s.name}
                  onMouseDown={() => { setForm(f => ({ ...f, ship_class: s.name })); setShipSearch(s.name); setShipDrop(false) }}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ color: 'var(--text-1)' }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.08em', marginTop: 2 }}>{s.manufacturer}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="form-group">
          <label className="form-label">ARCHETYPE</label>
          <input
            list={`${datalistId}-archetypes`}
            className="form-input"
            value={form.archetype}
            onChange={e => setForm(f => ({ ...f, archetype: e.target.value }))}
            placeholder="e.g. Heavy Assault, Sniper Support"
          />
          <datalist id={`${datalistId}-archetypes`}>
            {kind.archetypes.map(a => <option key={a} value={a} />)}
          </datalist>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">DESCRIPTION</label>
        <textarea
          className="form-textarea"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="When to use this, tactical notes, terrain, target profile…"
          rows={3}
        />
      </div>

      <div style={{ fontSize: 10, letterSpacing: '.18em', color: kind.color, fontFamily: 'var(--font-mono)', margin: '18px 0 10px' }}>
        ◆ COMPONENTS
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
        {kind.slots.map(s => (
          <div key={s.key} className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ color: s.color, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11 }}>{s.glyph}</span>{s.label}
            </label>
            <input
              list={`${datalistId}-${s.key}`}
              className="form-input"
              value={form.components[s.key] || ''}
              onChange={e => setComp(s.key, e.target.value)}
              placeholder={s.list.length ? `e.g. ${s.list[0]}` : 'Type anything…'}
            />
          </div>
        ))}
      </div>

      {error && <div className="form-error" style={{ marginTop: 14 }}>{error}</div>}

      <div className="modal-footer" style={{ marginTop: 18 }}>
        <button className="btn btn-ghost" onClick={onClose}>CANCEL</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? 'SAVING…' : isNew ? 'FILE LOADOUT' : 'UPDATE LOADOUT'}
        </button>
      </div>
    </Modal>
  )
}
