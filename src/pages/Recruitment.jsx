import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'

const STAGES = ['PENDING', 'VETTING', 'APPROVED', 'REJECTED']
const STAGE_BADGE = {
  PENDING:  'badge-muted',
  VETTING:  'badge-amber',
  APPROVED: 'badge-green',
  REJECTED: 'badge-red',
}

function fmt(ts) {
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export default function Recruitment() {
  const { profile: me } = useAuth()
  const [prospects, setProspects] = useState([])
  const [members, setMembers]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [stage, setStage]         = useState('ALL')
  const [modal, setModal]         = useState(null)
  const [form, setForm]           = useState({})
  const [editTarget, setEditTarget] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const canManage = me.tier <= 4

  async function load() {
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from('recruitment')
        .select('*, referred_by:profiles!recruitment_referred_by_fkey(handle), updated_by:profiles!recruitment_updated_by_fkey(handle)')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, handle').eq('status', 'ACTIVE').order('handle'),
    ])
    setProspects(p || [])
    setMembers(m || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = prospects.filter(p => stage === 'ALL' || p.status === stage)

  function openAdd() {
    setForm({ handle: '', discord: '', referred_by: '', notes: '' })
    setError('')
    setModal('add')
  }

  function openEdit(p) {
    setEditTarget(p)
    setForm({ status: p.status, notes: p.notes || '' })
    setError('')
    setModal('edit')
  }

  async function saveAdd() {
    if (!form.handle) { setError('Handle is required.'); return }
    setSaving(true)
    const { error } = await supabase.from('recruitment').insert({
      handle: form.handle.trim(),
      discord: form.discord || null,
      referred_by: form.referred_by || null,
      notes: form.notes || null,
    })
    if (error) { setError(error.message); setSaving(false); return }
    setModal(null); setSaving(false); load()
  }

  async function saveEdit() {
    setSaving(true)
    const { error } = await supabase.from('recruitment')
      .update({ status: form.status, notes: form.notes || null, updated_by: me.id })
      .eq('id', editTarget.id)
    if (error) { setError(error.message); setSaving(false); return }
    setModal(null); setSaving(false); load()
  }

  async function deleteProspect(id) {
    if (!confirm('Remove this prospect from the pipeline?')) return
    await supabase.from('recruitment').delete().eq('id', id)
    load()
  }

  const counts = STAGES.reduce((acc, s) => {
    acc[s] = prospects.filter(p => p.status === s).length
    return acc
  }, {})

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title">RECRUITMENT</div>
            <div className="page-subtitle">Prospect pipeline — {prospects.length} on record</div>
          </div>
          <button className="btn btn-primary" onClick={openAdd}>+ ADD PROSPECT</button>
        </div>
        <div className="flex gap-8" style={{ paddingBottom: 0 }}>
          {['ALL', ...STAGES].map(s => (
            <button key={s} className="btn btn-ghost btn-sm"
              style={stage === s ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
              onClick={() => setStage(s)}>
              {s} {s !== 'ALL' && <span style={{ opacity: .6 }}>({counts[s] || 0})</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {/* Pipeline summary */}
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))', marginBottom: 20 }}>
          {STAGES.map(s => (
            <div key={s} className="stat-card">
              <div className="stat-label">{s}</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{counts[s] || 0}</div>
            </div>
          ))}
        </div>

        {loading ? <div className="loading">LOADING PIPELINE...</div> : filtered.length === 0 ? (
          <div className="empty-state">NO PROSPECTS IN THIS STAGE</div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>HANDLE</th>
                    <th>DISCORD</th>
                    <th>REFERRED BY</th>
                    <th>STATUS</th>
                    <th>NOTES</th>
                    <th>ADDED</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>{p.handle}</td>
                      <td className="text-muted mono">{p.discord || '—'}</td>
                      <td className="text-muted">{p.referred_by?.handle || '—'}</td>
                      <td><span className={`badge ${STAGE_BADGE[p.status]}`}>{p.status}</span></td>
                      <td style={{ maxWidth: 200 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-2)' }} className="truncate">
                          {p.notes || '—'}
                        </span>
                      </td>
                      <td className="mono text-muted">{fmt(p.created_at)}</td>
                      <td>
                        <div className="flex gap-8">
                          {canManage && (
                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>EDIT</button>
                          )}
                          {me.tier <= 3 && (
                            <button className="btn btn-danger btn-sm" onClick={() => deleteProspect(p.id)}>✕</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {modal === 'add' && (
        <Modal title="ADD PROSPECT" onClose={() => setModal(null)}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">SC HANDLE *</label>
              <input className="form-input" value={form.handle}
                onChange={e => setForm(f => ({ ...f, handle: e.target.value }))} placeholder="StarCitizen handle" />
            </div>
            <div className="form-group">
              <label className="form-label">DISCORD</label>
              <input className="form-input" value={form.discord}
                onChange={e => setForm(f => ({ ...f, discord: e.target.value }))} placeholder="username" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">REFERRED BY</label>
            <select className="form-select" value={form.referred_by}
              onChange={e => setForm(f => ({ ...f, referred_by: e.target.value }))}>
              <option value="">None</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.handle}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">NOTES</label>
            <textarea className="form-textarea" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Initial assessment, skills, how they were encountered..." />
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
            <button className="btn btn-primary" onClick={saveAdd} disabled={saving}>
              {saving ? 'ADDING...' : 'ADD TO PIPELINE'}
            </button>
          </div>
        </Modal>
      )}

      {modal === 'edit' && editTarget && (
        <Modal title={`UPDATE — ${editTarget.handle}`} onClose={() => setModal(null)}>
          <div className="form-group">
            <label className="form-label">PIPELINE STATUS</label>
            <select className="form-select" value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">NOTES</label>
            <textarea className="form-textarea" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Vetting notes, assessment, decision rationale..." />
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
            <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
              {saving ? 'SAVING...' : 'UPDATE STATUS'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
