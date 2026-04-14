import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'

const STATUSES = ['ALLIED', 'FRIENDLY', 'NEUTRAL', 'UNFRIENDLY', 'HOSTILE', 'KOS']
const STATUS_BADGE = { ALLIED: 'badge-green', FRIENDLY: 'badge-blue', NEUTRAL: 'badge-muted', UNFRIENDLY: 'badge-amber', HOSTILE: 'badge-red', KOS: 'badge-red' }
const STATUS_COLOR = { ALLIED: 'var(--green)', FRIENDLY: 'var(--blue)', NEUTRAL: 'var(--text-3)', UNFRIENDLY: 'var(--amber)', HOSTILE: 'var(--red)', KOS: '#ff2222' }

function fmt(ts) { return ts ? new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' }

export default function Diplomacy() {
  const { profile: me } = useAuth()
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canEdit = me.tier <= 4

  async function load() {
    const { data } = await supabase.from('diplomacy').select('*, editor:profiles(handle)').order('status').order('org_name')
    setOrgs(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = filter === 'ALL' ? orgs : orgs.filter(o => o.status === filter)
  const counts = STATUSES.reduce((a, s) => { a[s] = orgs.filter(o => o.status === s).length; return a }, {})

  async function saveOrg() {
    if (!form.org_name) { setError('Org name required.'); return }
    setSaving(true)
    if (modal === 'add') {
      await supabase.from('diplomacy').insert({ ...form, updated_by: me.id })
    } else {
      await supabase.from('diplomacy').update({ ...form, updated_by: me.id, last_interaction: form.last_interaction || null }).eq('id', modal.id)
    }
    setModal(null); setSaving(false); load()
  }

  async function deleteOrg(id) {
    if (!confirm('Remove this org from the tracker?')) return
    await supabase.from('diplomacy').delete().eq('id', id); load()
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title">DIPLOMACY</div>
            <div className="page-subtitle">{orgs.length} organisations tracked</div>
          </div>
          {canEdit && <button className="btn btn-primary" onClick={() => { setForm({ status: 'NEUTRAL' }); setError(''); setModal('add') }}>+ ADD ORG</button>}
        </div>
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" style={filter === 'ALL' ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}} onClick={() => setFilter('ALL')}>ALL ({orgs.length})</button>
          {STATUSES.map(s => (
            <button key={s} className="btn btn-ghost btn-sm" style={filter === s ? { background: 'var(--accent-dim)', color: STATUS_COLOR[s], borderColor: STATUS_COLOR[s] } : {}} onClick={() => setFilter(s)}>
              {s} ({counts[s] || 0})
            </button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING...</div> : filtered.length === 0 ? <div className="empty-state">NO ORGS TRACKED</div> : (
          <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table className="data-table">
            <thead><tr><th>ORG</th><th>TAG</th><th>SIZE</th><th>STATUS</th><th>CONTACT</th><th>LAST INTERACTION</th><th>NOTES</th><th></th></tr></thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 500 }}>{o.org_name}</td>
                  <td className="mono">{o.org_tag || '—'}</td>
                  <td className="text-muted">{o.org_size || '—'}</td>
                  <td><span className={`badge ${STATUS_BADGE[o.status]}`} style={o.status === 'KOS' ? { background: '#ff2222', color: '#fff' } : {}}>{o.status}</span></td>
                  <td className="text-muted">{o.contact_person || '—'}{o.contact_discord && <span className="mono" style={{ fontSize: 10, marginLeft: 4 }}>({o.contact_discord})</span>}</td>
                  <td className="mono text-muted" style={{ fontSize: 11 }}>{fmt(o.last_interaction)}</td>
                  <td style={{ maxWidth: 200, fontSize: 12, color: 'var(--text-2)' }}><span className="truncate">{o.notes || '—'}</span></td>
                  <td>
                    {canEdit && <div className="flex gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ ...o }); setError(''); setModal(o) }}>EDIT</button>
                      {me.tier <= 3 && <button className="btn btn-danger btn-sm" onClick={() => deleteOrg(o.id)}>✕</button>}
                    </div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div></div>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'ADD ORGANISATION' : `EDIT — ${modal.org_name}`} onClose={() => setModal(null)}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">ORG NAME *</label><input className="form-input" value={form.org_name || ''} onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">TAG</label><input className="form-input" value={form.org_tag || ''} onChange={e => setForm(f => ({ ...f, org_tag: e.target.value }))} placeholder="e.g. [GREY]" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">STATUS</label><select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
            <div className="form-group"><label className="form-label">SIZE</label><select className="form-select" value={form.org_size || ''} onChange={e => setForm(f => ({ ...f, org_size: e.target.value }))}><option value="">—</option><option>SMALL</option><option>MEDIUM</option><option>LARGE</option></select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">CONTACT</label><input className="form-input" value={form.contact_person || ''} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">DISCORD</label><input className="form-input" value={form.contact_discord || ''} onChange={e => setForm(f => ({ ...f, contact_discord: e.target.value }))} /></div>
          </div>
          <div className="form-group"><label className="form-label">NOTES</label><textarea className="form-textarea" value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Relationship history, terms, agreements..." /></div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button><button className="btn btn-primary" onClick={saveOrg} disabled={saving}>{saving ? 'SAVING...' : 'CONFIRM'}</button></div>
        </Modal>
      )}
    </>
  )
}
