import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { SHIP_STATUSES } from '../lib/ranks'
import { SC_SHIPS } from '../lib/ships'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { exportCSV } from '../lib/csv'

const STATUS_BADGE = { AVAILABLE: 'badge-green', DEPLOYED: 'badge-amber', MAINTENANCE: 'badge-red', RESERVED: 'badge-blue' }
const REQ_BADGE = { PENDING: 'badge-amber', APPROVED: 'badge-green', DENIED: 'badge-red' }

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
  const [tab, setTab]           = useState('registry')
  const [reqModal, setReqModal] = useState(null)
  const [reqReason, setReqReason] = useState('')
  // Ship selector
  const [shipSearch, setShipSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const canManage = me.tier <= 4

  const filteredShips = useMemo(() => {
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
      supabase.from('fleet_requests').select('*, vessel:fleet(vessel_name, ship_class), requester:profiles!fleet_requests_requester_id_fkey(handle), reviewer:profiles!fleet_requests_reviewed_by_fkey(handle)').order('created_at', { ascending: false }),
    ])
    setShips(s || []); setMembers(m || []); setRequests(r || []); setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setForm({ vessel_name: '', ship_class: '', manufacturer: '', role: '', assigned_to: '', status: 'AVAILABLE', notes: '' })
    setShipSearch(''); setError(''); setModal('add')
  }

  function openEdit(s) {
    setForm({ vessel_name: s.vessel_name, ship_class: s.ship_class, manufacturer: s.manufacturer||'', role: s.role||'', assigned_to: s.assigned_to||'', status: s.status, notes: s.notes||'' })
    setShipSearch(s.ship_class || ''); setError(''); setModal(s)
  }

  function selectShip(ship) {
    setForm(f => ({ ...f, ship_class: ship.name, manufacturer: ship.manufacturer, role: ship.role }))
    setShipSearch(ship.name)
    setShowDropdown(false)
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
      await supabase.from('activity_log').insert({ actor_id: me.id, action: 'fleet_added', target_type: 'fleet', target_id: data.id, details: { title: `${form.vessel_name} (${form.ship_class})` } })
    }
    setModal(null); setSaving(false); load()
  }

  async function deleteShip(id) {
    if (!confirm('Remove this vessel from the registry?')) return
    await supabase.from('fleet').delete().eq('id', id); load()
  }

  async function submitRequest(ship) {
    if (!reqReason.trim()) return
    setSaving(true)
    await supabase.from('fleet_requests').insert({ vessel_id: ship.id, requester_id: me.id, reason: reqReason.trim() })
    setReqModal(null); setReqReason(''); setSaving(false); load()
  }

  async function reviewRequest(reqId, status) {
    await supabase.from('fleet_requests').update({ status, reviewed_by: me.id }).eq('id', reqId); load()
  }

  const pendingRequests = requests.filter(r => r.status === 'PENDING')

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title">FLEET REGISTRY</div>
            <div className="page-subtitle">{ships.length} vessels on record</div>
          </div>
          <div className="flex gap-8">
            {canManage && <button className="btn btn-primary" onClick={openAdd}>+ ADD VESSEL</button>}
            <button className="btn btn-ghost btn-sm" onClick={() => {
              exportCSV(ships.map(s => ({ vessel: s.vessel_name, class: s.ship_class, status: s.status, manufacturer: s.manufacturer || '', role: s.role || '' })), 'grayveil_fleet')
              toast('Fleet exported', 'info')
            }}>EXPORT</button>
          </div>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-ghost btn-sm" style={tab === 'registry' ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}} onClick={() => setTab('registry')}>REGISTRY</button>
          <button className="btn btn-ghost btn-sm" style={tab === 'requests' ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}} onClick={() => setTab('requests')}>
            REQUESTS {pendingRequests.length > 0 && <span style={{ color: 'var(--amber)', marginLeft: 4 }}>({pendingRequests.length})</span>}
          </button>
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING FLEET DATA...</div> : tab === 'registry' ? (
          ships.length === 0 ? <div className="empty-state">NO VESSELS REGISTERED</div> : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>VESSEL NAME</th><th>CLASS</th><th>MANUFACTURER</th><th>ROLE</th><th>ASSIGNED TO</th><th>STATUS</th><th></th></tr></thead>
                  <tbody>
                    {ships.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 500 }}>{s.vessel_name}</td>
                        <td className="mono">{s.ship_class}</td>
                        <td className="text-muted">{s.manufacturer || '—'}</td>
                        <td className="text-muted">{s.role || '—'}</td>
                        <td>{s.assigned?.handle || <span className="text-muted">—</span>}</td>
                        <td><span className={`badge ${STATUS_BADGE[s.status] || 'badge-muted'}`}>{s.status}</span></td>
                        <td>
                          <div className="flex gap-8">
                            {s.status === 'AVAILABLE' && <button className="btn btn-ghost btn-sm" onClick={() => { setReqModal(s); setReqReason('') }}>REQUEST</button>}
                            {canManage && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>EDIT</button>}
                            {me.tier <= 3 && <button className="btn btn-danger btn-sm" onClick={() => deleteShip(s.id)}>✕</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          requests.length === 0 ? <div className="empty-state">NO FLEET REQUESTS</div> : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>VESSEL</th><th>REQUESTED BY</th><th>REASON</th><th>STATUS</th><th>REVIEWED BY</th><th></th></tr></thead>
                  <tbody>
                    {requests.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 500 }}>{r.vessel?.vessel_name || '—'}<br/><span className="text-muted mono" style={{ fontSize: 11 }}>{r.vessel?.ship_class}</span></td>
                        <td>{r.requester?.handle || '—'}</td>
                        <td style={{ maxWidth: 200 }}><span style={{ fontSize: 12, color: 'var(--text-2)' }}>{r.reason || '—'}</span></td>
                        <td><span className={`badge ${REQ_BADGE[r.status]}`}>{r.status}</span></td>
                        <td className="text-muted">{r.reviewer?.handle || '—'}</td>
                        <td>
                          {canManage && r.status === 'PENDING' && (
                            <div className="flex gap-8">
                              <button className="btn btn-primary btn-sm" onClick={() => reviewRequest(r.id, 'APPROVED')}>APPROVE</button>
                              <button className="btn btn-danger btn-sm" onClick={() => reviewRequest(r.id, 'DENIED')}>DENY</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>

      {/* Request modal */}
      {reqModal && (
        <Modal title={`REQUEST — ${reqModal.vessel_name}`} onClose={() => setReqModal(null)}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>Requesting <strong>{reqModal.vessel_name}</strong> ({reqModal.ship_class}). An officer will review.</p>
          <div className="form-group">
            <label className="form-label">REASON / OPERATION</label>
            <textarea className="form-textarea" value={reqReason} onChange={e => setReqReason(e.target.value)} placeholder="What operation is this for?" />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setReqModal(null)}>CANCEL</button>
            <button className="btn btn-primary" onClick={() => submitRequest(reqModal)} disabled={saving || !reqReason.trim()}>{saving ? 'SUBMITTING...' : 'SUBMIT REQUEST'}</button>
          </div>
        </Modal>
      )}

      {/* Add/Edit vessel modal */}
      {(modal === 'add' || (modal && typeof modal === 'object')) && (
        <Modal title={modal === 'add' ? 'REGISTER VESSEL' : 'EDIT VESSEL'} onClose={() => setModal(null)} size="modal-lg">
          {/* VESSEL NAME — the only thing the user types */}
          <div className="form-group">
            <label className="form-label">VESSEL NAME *</label>
            <input className="form-input" value={form.vessel_name}
              onChange={e => setForm(f => ({ ...f, vessel_name: e.target.value }))}
              placeholder="e.g. GVC Shadow, Spectre, Grayveil-01" autoFocus />
            <div className="form-hint">Your custom name for this vessel.</div>
          </div>

          {/* SHIP SELECTOR — searchable dropdown auto-fills class, manufacturer, role */}
          <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label">SHIP *</label>
            <input className="form-input" value={shipSearch}
              onChange={e => { setShipSearch(e.target.value); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search ships... e.g. Cutlass, Carrack, Aurora"
              autoComplete="off" />
            {form.ship_class && (
              <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="badge badge-accent">{form.ship_class}</span>
                <span className="badge badge-muted">{form.manufacturer}</span>
                <span className="badge badge-muted">{form.role}</span>
              </div>
            )}
            {showDropdown && filteredShips.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                background: 'var(--bg-raised)', border: '1px solid var(--border-md)',
                borderRadius: 'var(--radius-sm)', maxHeight: 240, overflowY: 'auto',
                boxShadow: '0 8px 24px rgba(0,0,0,.4)', marginTop: 4,
              }}>
                {filteredShips.map(s => (
                  <div key={s.name} onClick={() => selectShip(s)}
                    style={{
                      padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      transition: 'background .1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.manufacturer} · {s.role}</div>
                    </div>
                    <span className="badge badge-muted" style={{ fontSize: 9 }}>{s.size}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">ASSIGNED TO</label>
              <select className="form-select" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
                <option value="">Unassigned</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.handle}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">STATUS</label>
              <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {SHIP_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">NOTES</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Loadout, insurance tier, special equipment..." />
          </div>

          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'SAVING...' : 'CONFIRM'}</button>
          </div>
        </Modal>
      )}
    </>
  )
}
