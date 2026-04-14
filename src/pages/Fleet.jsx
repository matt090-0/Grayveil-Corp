import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { SHIP_STATUSES } from '../lib/ranks'
import Modal from '../components/Modal'

const STATUS_BADGE = {
  AVAILABLE:   'badge-green',
  DEPLOYED:    'badge-amber',
  MAINTENANCE: 'badge-red',
  RESERVED:    'badge-blue',
}

export default function Fleet() {
  const { profile: me } = useAuth()
  const [ships, setShips]   = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState(null) // null | 'add' | ship object
  const [form, setForm]     = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const canManage = me.tier <= 4

  async function load() {
    const [{ data: ships }, { data: members }] = await Promise.all([
      supabase.from('fleet').select('*, assigned:profiles(id, handle)').order('vessel_name'),
      supabase.from('profiles').select('id, handle').eq('status', 'ACTIVE').order('handle'),
    ])
    setShips(ships || [])
    setMembers(members || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setForm({ vessel_name: '', ship_class: '', manufacturer: '', role: '', assigned_to: '', status: 'AVAILABLE', notes: '' })
    setError('')
    setModal('add')
  }

  function openEdit(s) {
    setForm({ vessel_name: s.vessel_name, ship_class: s.ship_class, manufacturer: s.manufacturer||'', role: s.role||'', assigned_to: s.assigned_to||'', status: s.status, notes: s.notes||'' })
    setError('')
    setModal(s)
  }

  async function save() {
    if (!form.vessel_name || !form.ship_class) { setError('Vessel name and class are required.'); return }
    setSaving(true)
    const payload = { ...form, assigned_to: form.assigned_to || null }
    const { error } = modal === 'add'
      ? await supabase.from('fleet').insert(payload)
      : await supabase.from('fleet').update(payload).eq('id', modal.id)
    if (error) { setError(error.message); setSaving(false); return }
    setModal(null); setSaving(false); load()
  }

  async function deleteShip(id) {
    if (!confirm('Remove this vessel from the registry?')) return
    await supabase.from('fleet').delete().eq('id', id)
    load()
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 20 }}>
          <div>
            <div className="page-title">FLEET REGISTRY</div>
            <div className="page-subtitle">{ships.length} vessels on record</div>
          </div>
          {canManage && (
            <button className="btn btn-primary" onClick={openAdd}>+ ADD VESSEL</button>
          )}
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING FLEET DATA...</div> : ships.length === 0 ? (
          <div className="empty-state">NO VESSELS REGISTERED</div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>VESSEL NAME</th>
                    <th>CLASS</th>
                    <th>MANUFACTURER</th>
                    <th>ROLE</th>
                    <th>ASSIGNED TO</th>
                    <th>STATUS</th>
                    {canManage && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {ships.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500 }}>{s.vessel_name}</td>
                      <td className="mono">{s.ship_class}</td>
                      <td className="text-muted">{s.manufacturer || '—'}</td>
                      <td className="text-muted">{s.role || '—'}</td>
                      <td>{s.assigned?.handle || <span className="text-muted">—</span>}</td>
                      <td><span className={`badge ${STATUS_BADGE[s.status] || 'badge-muted'}`}>{s.status}</span></td>
                      {canManage && (
                        <td>
                          <div className="flex gap-8">
                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>EDIT</button>
                            {me.tier <= 3 && (
                              <button className="btn btn-danger btn-sm" onClick={() => deleteShip(s.id)}>✕</button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {modal !== null && (
        <Modal title={modal === 'add' ? 'REGISTER VESSEL' : 'EDIT VESSEL'} onClose={() => setModal(null)}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">VESSEL NAME *</label>
              <input className="form-input" value={form.vessel_name} onChange={e => setForm(f => ({ ...f, vessel_name: e.target.value }))} placeholder="GVC Spectre" />
            </div>
            <div className="form-group">
              <label className="form-label">SHIP CLASS *</label>
              <input className="form-input" value={form.ship_class} onChange={e => setForm(f => ({ ...f, ship_class: e.target.value }))} placeholder="Constellation Andromeda" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">MANUFACTURER</label>
              <input className="form-input" value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} placeholder="RSI" />
            </div>
            <div className="form-group">
              <label className="form-label">ROLE</label>
              <input className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Multi-crew Combat" />
            </div>
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
            <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." />
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'SAVING...' : 'CONFIRM'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
