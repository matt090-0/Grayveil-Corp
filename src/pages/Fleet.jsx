import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { SHIP_STATUSES } from '../lib/ranks'
import { SC_SHIPS } from '../lib/ships'
import { useToast } from '../components/Toast'
import { exportCSV } from '../lib/csv'
import { confirmAction } from '../lib/dialogs'
import {
  UEE_AMBER, ClassificationBar, TabStrip, StatCell, FilterRow, Card,
  StatusBadge, Field, EmptyState, UeeModal, btnMicro,
  timeAgo,
} from '../components/uee'

const STATUS_META = {
  AVAILABLE:   { color: '#5ce0a1', glyph: '◉', label: 'AVAILABLE' },
  DEPLOYED:    { color: UEE_AMBER, glyph: '⬢', label: 'DEPLOYED' },
  MAINTENANCE: { color: '#e05c5c', glyph: '⚠', label: 'MAINTENANCE' },
  RESERVED:    { color: '#5a80d9', glyph: '◇', label: 'RESERVED' },
}

const REQ_META = {
  PENDING:  { color: UEE_AMBER, glyph: '◐', label: 'PENDING' },
  APPROVED: { color: '#5ce0a1', glyph: '✓', label: 'APPROVED' },
  DENIED:   { color: '#e05c5c', glyph: '✕', label: 'DENIED' },
}

const FLEET_BLUE = '#5a80d9'

export default function Fleet() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const [ships, setShips]       = useState([])
  const [members, setMembers]   = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(null)
  const [form, setForm]         = useState({})
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [tab, setTab]           = useState('REGISTRY')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch]     = useState('')
  const [reqModal, setReqModal] = useState(null)
  const [reqReason, setReqReason] = useState('')
  const [shipSearch, setShipSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const canManage = me.tier <= 4

  const filteredShipOptions = useMemo(() => {
    if (!shipSearch.trim()) return SC_SHIPS.slice(0, 20)
    const q = shipSearch.toLowerCase()
    return SC_SHIPS.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.manufacturer.toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q)
    ).slice(0, 20)
  }, [shipSearch])

  async function load() {
    const [{ data: s }, { data: m }, { data: r }] = await Promise.all([
      supabase.from('fleet').select('*, assigned:profiles(id, handle)').order('vessel_name'),
      supabase.from('profiles').select('id, handle').eq('status', 'ACTIVE').order('handle'),
      supabase.from('fleet_requests')
        .select('*, vessel:fleet(vessel_name, ship_class), requester:profiles!fleet_requests_requester_id_fkey(handle), reviewer:profiles!fleet_requests_reviewed_by_fkey(handle)')
        .order('created_at', { ascending: false }),
    ])
    setShips(s || [])
    setMembers(m || [])
    setRequests(r || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const counts = useMemo(() => {
    const c = { ALL: ships.length }
    Object.keys(STATUS_META).forEach(s => {
      c[s] = ships.filter(x => x.status === s).length
    })
    return c
  }, [ships])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ships
      .filter(s => statusFilter === 'ALL' || s.status === statusFilter)
      .filter(s => !q
        || (s.vessel_name || '').toLowerCase().includes(q)
        || (s.ship_class || '').toLowerCase().includes(q)
        || (s.manufacturer || '').toLowerCase().includes(q)
        || (s.role || '').toLowerCase().includes(q)
        || (s.assigned?.handle || '').toLowerCase().includes(q))
  }, [ships, statusFilter, search])

  const pendingRequests = useMemo(() => requests.filter(r => r.status === 'PENDING'), [requests])

  function openAdd() {
    setForm({ vessel_name: '', ship_class: '', manufacturer: '', role: '', assigned_to: '', status: 'AVAILABLE', notes: '' })
    setShipSearch(''); setError(''); setModal('add')
  }
  function openEdit(s) {
    setForm({
      vessel_name: s.vessel_name, ship_class: s.ship_class,
      manufacturer: s.manufacturer || '', role: s.role || '',
      assigned_to: s.assigned_to || '', status: s.status, notes: s.notes || '',
    })
    setShipSearch(s.ship_class || ''); setError(''); setModal(s)
  }
  function selectShip(ship) {
    setForm(f => ({ ...f, ship_class: ship.name, manufacturer: ship.manufacturer, role: ship.role }))
    setShipSearch(ship.name); setShowDropdown(false)
  }

  async function save() {
    if (!form.vessel_name || !form.ship_class) { setError('Vessel name and ship are required.'); return }
    setSaving(true)
    const payload = { ...form, assigned_to: form.assigned_to || null }
    const isAdd = modal === 'add'
    const { data, error } = isAdd
      ? await supabase.from('fleet').insert(payload).select().single()
      : await supabase.from('fleet').update(payload).eq('id', modal.id).select().single()
    if (error) { setError(error.message); setSaving(false); return }
    if (isAdd) {
      await supabase.from('activity_log').insert({
        actor_id: me.id, action: 'fleet_added',
        target_type: 'fleet', target_id: data.id,
        details: { title: `${form.vessel_name} (${form.ship_class})` },
      })
    }
    toast(isAdd ? 'Vessel registered' : 'Vessel updated', 'success')
    setModal(null); setSaving(false); load()
  }

  async function deleteShip(id) {
    if (!(await confirmAction('Remove this vessel from the registry?'))) return
    await supabase.from('fleet').delete().eq('id', id)
    toast('Vessel decommissioned', 'success')
    load()
  }

  async function submitRequest(ship) {
    if (!reqReason.trim()) return
    setSaving(true)
    await supabase.from('fleet_requests').insert({
      vessel_id: ship.id, requester_id: me.id, reason: reqReason.trim(),
    })
    toast('Request submitted', 'success')
    setReqModal(null); setReqReason(''); setSaving(false); load()
  }

  async function reviewRequest(reqId, status) {
    await supabase.from('fleet_requests').update({ status, reviewed_by: me.id }).eq('id', reqId)
    toast(status === 'APPROVED' ? 'Request approved' : 'Request denied', 'info')
    load()
  }

  function exportFleet() {
    exportCSV(ships.map(s => ({
      vessel: s.vessel_name, class: s.ship_class, status: s.status,
      manufacturer: s.manufacturer || '', role: s.role || '',
      assigned: s.assigned?.handle || '',
    })), 'grayveil_fleet')
    toast('Fleet exported', 'info')
  }

  return (
    <>
      <ClassificationBar
        section="GRAYVEIL FLEET REGISTRY"
        label={tab === 'REQUESTS' ? 'REQUEST QUEUE' : (statusFilter === 'ALL' ? 'ALL VESSELS' : statusFilter)}
        accent={FLEET_BLUE}
        right={(
          <>
            <span>VESSELS · {ships.length}</span>
            <span style={{ color: STATUS_META.AVAILABLE.color }}>READY · {counts.AVAILABLE || 0}</span>
            {pendingRequests.length > 0 && (
              <span style={{ color: UEE_AMBER }}>QUEUE · {pendingRequests.length}</span>
            )}
          </>
        )}
      />

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>FLEET REGISTRY</h1>
            <div style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 640 }}>
              Org-owned vessels and operative assignments. Request a vessel to lock it for an op; officers review.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {canManage && <button className="btn btn-primary" onClick={openAdd}>+ ADD VESSEL</button>}
            <button className="btn btn-ghost btn-sm" onClick={exportFleet}>EXPORT</button>
          </div>
        </div>

        <TabStrip
          active={tab} onChange={setTab}
          tabs={[
            { key: 'REGISTRY', label: 'REGISTRY', color: FLEET_BLUE, glyph: '◎', count: ships.length },
            { key: 'REQUESTS', label: 'REQUESTS', color: UEE_AMBER, glyph: '◐', count: requests.length, attention: pendingRequests.length },
          ]}
        />
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING FLEET DATA...</div> : tab === 'REGISTRY' ? (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 10, marginBottom: 16,
            }}>
              {Object.keys(STATUS_META).map(s => {
                const m = STATUS_META[s]
                return (
                  <StatCell
                    key={s}
                    label={m.label}
                    value={counts[s] || 0}
                    color={m.color}
                    glyph={m.glyph}
                    onClick={() => setStatusFilter(statusFilter === s ? 'ALL' : s)}
                    active={statusFilter === s}
                  />
                )
              })}
            </div>

            <FilterRow
              search={search} setSearch={setSearch}
              placeholder="Search vessel name, class, manufacturer, role, operator..."
            />

            {filtered.length === 0 ? (
              <EmptyState>
                {canManage
                  ? <>No vessels match. <a onClick={openAdd} style={{ color: FLEET_BLUE, cursor: 'pointer', textDecoration: 'underline' }}>Register one</a>.</>
                  : 'No vessels registered.'}
              </EmptyState>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 12,
              }}>
                {filtered.map(s => (
                  <FleetCard
                    key={s.id} ship={s}
                    canManage={canManage}
                    canDelete={me.tier <= 3}
                    onRequest={() => { setReqModal(s); setReqReason('') }}
                    onEdit={() => openEdit(s)}
                    onDelete={() => deleteShip(s.id)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          requests.length === 0 ? (
            <EmptyState>NO FLEET REQUESTS LOGGED</EmptyState>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 12,
            }}>
              {requests.map(r => (
                <RequestCard
                  key={r.id} request={r}
                  canReview={canManage && r.status === 'PENDING'}
                  onApprove={() => reviewRequest(r.id, 'APPROVED')}
                  onDeny={() => reviewRequest(r.id, 'DENIED')}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* REQUEST MODAL */}
      {reqModal && (
        <UeeModal
          accent={FLEET_BLUE}
          kicker={`◆ FLEET REQUEST · ${reqModal.ship_class.toUpperCase()}`}
          title={`Request ${reqModal.vessel_name}`}
          onClose={() => setReqModal(null)}
          maxWidth={520}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setReqModal(null)}>CANCEL</button>
              <button className="btn btn-primary" onClick={() => submitRequest(reqModal)} disabled={saving || !reqReason.trim()}>
                {saving ? 'SUBMITTING...' : 'SUBMIT REQUEST'}
              </button>
            </>
          )}
        >
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.6 }}>
            Requesting <strong style={{ color: 'var(--text-1)' }}>{reqModal.vessel_name}</strong> ({reqModal.ship_class}). An officer will review and approve or deny.
          </p>
          <div className="form-group">
            <label className="form-label">REASON / OPERATION</label>
            <textarea className="form-textarea" value={reqReason}
              onChange={e => setReqReason(e.target.value)}
              placeholder="What operation is this for? Expected return window?" />
          </div>
        </UeeModal>
      )}

      {/* ADD/EDIT MODAL */}
      {(modal === 'add' || (modal && typeof modal === 'object')) && (
        <UeeModal
          accent={FLEET_BLUE}
          kicker={modal === 'add' ? '◆ NEW VESSEL · FLEET REGISTRY' : `◆ EDIT · ${modal.vessel_name}`}
          title={modal === 'add' ? 'REGISTER VESSEL' : 'EDIT VESSEL'}
          onClose={() => setModal(null)}
          maxWidth={680}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'SAVING...' : modal === 'add' ? 'REGISTER' : 'UPDATE'}
              </button>
            </>
          )}
        >
          <div className="form-group">
            <label className="form-label">VESSEL NAME *</label>
            <input className="form-input" value={form.vessel_name}
              onChange={e => setForm(f => ({ ...f, vessel_name: e.target.value }))}
              placeholder="e.g. GVC Shadow, Spectre, Grayveil-01" autoFocus />
            <div className="form-hint">Your custom name for this vessel.</div>
          </div>

          <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label">SHIP CLASS *</label>
            <input className="form-input" value={shipSearch}
              onChange={e => { setShipSearch(e.target.value); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search ships... e.g. Cutlass, Carrack, Aurora"
              autoComplete="off" />
            {form.ship_class && (
              <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <StatusBadge color={UEE_AMBER} label={form.ship_class.toUpperCase()} />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em',
                  color: 'var(--text-3)', border: '1px solid var(--border)',
                  padding: '3px 8px', borderRadius: 3,
                }}>{form.manufacturer}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em',
                  color: 'var(--text-3)', border: '1px solid var(--border)',
                  padding: '3px 8px', borderRadius: 3,
                }}>{form.role}</span>
              </div>
            )}
            {showDropdown && filteredShipOptions.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                background: 'var(--bg-raised)', border: `1px solid ${FLEET_BLUE}55`,
                borderRadius: 3, maxHeight: 240, overflowY: 'auto',
                boxShadow: '0 8px 24px rgba(0,0,0,.4)', marginTop: 4,
              }}>
                {filteredShipOptions.map(s => (
                  <div key={s.name} onClick={() => selectShip(s)}
                    style={{
                      padding: '8px 12px', cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = `${FLEET_BLUE}11`}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                      <div style={{
                        fontSize: 10, color: 'var(--text-3)',
                        fontFamily: 'var(--font-mono)', letterSpacing: '.1em',
                      }}>{s.manufacturer} · {s.role}</div>
                    </div>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em',
                      color: FLEET_BLUE, border: `1px solid ${FLEET_BLUE}55`,
                      padding: '2px 6px', borderRadius: 3,
                    }}>{s.size}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">ASSIGNED TO</label>
              <select className="form-select" value={form.assigned_to}
                onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
                <option value="">Unassigned</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.handle}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">STATUS</label>
              <select className="form-select" value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {SHIP_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">NOTES</label>
            <textarea className="form-textarea" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Loadout, insurance tier, special equipment..." />
          </div>

          {error && <div className="form-error mb-8">{error}</div>}
        </UeeModal>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
function FleetCard({ ship: s, canManage, canDelete, onRequest, onEdit, onDelete }) {
  const meta = STATUS_META[s.status] || STATUS_META.AVAILABLE
  return (
    <Card accent={meta.color} minHeight={170}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600,
            color: 'var(--text-1)', lineHeight: 1.25,
          }}>
            {s.vessel_name}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em',
              color: UEE_AMBER, border: `1px solid ${UEE_AMBER}55`,
              padding: '1px 6px', borderRadius: 3,
            }}>{s.ship_class}</span>
            {s.manufacturer && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em',
                color: 'var(--text-3)',
              }}>{s.manufacturer}</span>
            )}
          </div>
        </div>
        <StatusBadge color={meta.color} glyph={meta.glyph} label={meta.label} />
      </div>

      {s.notes && (
        <div style={{
          fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {s.notes}
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        paddingTop: 8, borderTop: '1px dashed var(--border)',
      }}>
        <Field label="ROLE" value={s.role || '—'} />
        <Field label="OPERATOR" value={s.assigned?.handle || 'UNASSIGNED'} mono />
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {s.status === 'AVAILABLE' && (
          <button onClick={onRequest} style={btnMicro(meta.color, true)}>◆ REQUEST</button>
        )}
        {canManage && (
          <button onClick={onEdit} style={btnMicro(UEE_AMBER, !canDelete)}>✎ EDIT</button>
        )}
        {canDelete && (
          <button onClick={onDelete} style={btnMicro('#9099a8')}>✕</button>
        )}
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
function RequestCard({ request: r, canReview, onApprove, onDeny }) {
  const meta = REQ_META[r.status] || REQ_META.PENDING
  return (
    <Card accent={meta.color} minHeight={140}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600,
            color: 'var(--text-1)',
          }}>
            {r.vessel?.vessel_name || '—'}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em',
            color: 'var(--text-3)', marginTop: 2,
          }}>
            {r.vessel?.ship_class}
          </div>
        </div>
        <StatusBadge color={meta.color} glyph={meta.glyph} label={meta.label} />
      </div>

      {r.reason && (
        <div style={{
          fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6,
          padding: '8px 10px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border)', borderRadius: 3,
        }}>
          {r.reason}
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em',
        color: 'var(--text-3)', paddingTop: 6, borderTop: '1px dashed var(--border)',
      }}>
        <span>{(r.requester?.handle || '—').toUpperCase()}</span>
        <span>{r.reviewer ? `BY ${r.reviewer.handle.toUpperCase()}` : timeAgo(r.created_at)}</span>
      </div>

      {canReview && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onApprove} style={btnMicro('#5ce0a1', true)}>✓ APPROVE</button>
          <button onClick={onDeny}    style={btnMicro('#e05c5c', true)}>✕ DENY</button>
        </div>
      )}
    </Card>
  )
}
