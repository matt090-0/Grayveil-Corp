import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'

const STAGES = ['PENDING', 'VETTING', 'APPROVED', 'REJECTED']
const STAGE_BADGE = { PENDING: 'badge-muted', VETTING: 'badge-amber', APPROVED: 'badge-green', REJECTED: 'badge-red' }
const APP_BADGE = { PENDING: 'badge-muted', REVIEWING: 'badge-amber', APPROVED: 'badge-green', REJECTED: 'badge-red' }

function fmt(ts) { return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) }
function genCode() { return Math.random().toString(36).substring(2, 10).toUpperCase() }

export default function Recruitment() {
  const { profile: me } = useAuth()
  const [tab, setTab]           = useState('prospects')
  const [prospects, setProspects] = useState([])
  const [members, setMembers]     = useState([])
  const [applications, setApps]   = useState([])
  const [invites, setInvites]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [stage, setStage]         = useState('ALL')
  const [modal, setModal]         = useState(null)
  const [form, setForm]           = useState({})
  const [editTarget, setEditTarget] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const canManage = me.tier <= 4

  async function load() {
    const [{ data: p }, { data: m }, { data: a }, { data: inv }] = await Promise.all([
      supabase.from('recruitment').select('*, referred_by:profiles!recruitment_referred_by_fkey(handle), updated_by:profiles!recruitment_updated_by_fkey(handle)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, handle').eq('status', 'ACTIVE').order('handle'),
      supabase.from('applications').select('*').order('created_at', { ascending: false }),
      supabase.from('invite_links').select('*, creator:profiles(handle)').order('created_at', { ascending: false }),
    ])
    setProspects(p || []); setMembers(m || []); setApps(a || []); setInvites(inv || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = prospects.filter(p => stage === 'ALL' || p.status === stage)
  const counts = STAGES.reduce((acc, s) => { acc[s] = prospects.filter(p => p.status === s).length; return acc }, {})
  const pendingApps = applications.filter(a => a.status === 'PENDING').length

  // Prospect CRUD
  function openAdd() { setForm({ handle: '', discord: '', referred_by: '', notes: '' }); setError(''); setModal('add') }
  function openEdit(p) { setEditTarget(p); setForm({ status: p.status, notes: p.notes || '' }); setError(''); setModal('edit') }

  async function saveAdd() {
    if (!form.handle) { setError('Handle is required.'); return }
    setSaving(true)
    const { error } = await supabase.from('recruitment').insert({ handle: form.handle.trim(), discord: form.discord || null, referred_by: form.referred_by || null, notes: form.notes || null })
    if (error) { setError(error.message); setSaving(false); return }
    setModal(null); setSaving(false); load()
  }

  async function saveEdit() {
    setSaving(true)
    const { error } = await supabase.from('recruitment').update({ status: form.status, notes: form.notes || null, updated_by: me.id }).eq('id', editTarget.id)
    if (error) { setError(error.message); setSaving(false); return }
    setModal(null); setSaving(false); load()
  }

  async function deleteProspect(id) {
    if (!confirm('Remove this prospect?')) return
    await supabase.from('recruitment').delete().eq('id', id); load()
  }

  // Invite links
  async function createInvite() {
    const code = genCode()
    await supabase.from('invite_links').insert({ code, created_by: me.id, label: form.inviteLabel || null, max_uses: form.inviteMax ? parseInt(form.inviteMax) : null })
    setModal(null); load()
  }

  async function deleteInvite(id) {
    if (!confirm('Delete this invite link?')) return
    await supabase.from('invite_links').delete().eq('id', id); load()
  }

  // Application review
  async function reviewApp(app, status) {
    await supabase.from('applications').update({ status, reviewed_by: me.id }).eq('id', app.id)
    load()
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title">RECRUITMENT</div>
            <div className="page-subtitle">Pipeline, applications, and invite links</div>
          </div>
          <div className="flex gap-8">
            {tab === 'prospects' && <button className="btn btn-primary" onClick={openAdd}>+ ADD PROSPECT</button>}
            {tab === 'invites' && canManage && <button className="btn btn-primary" onClick={() => { setForm({ inviteLabel: '', inviteMax: '' }); setModal('invite') }}>+ CREATE LINK</button>}
          </div>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-ghost btn-sm" style={tab === 'prospects' ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}} onClick={() => setTab('prospects')}>PROSPECTS</button>
          <button className="btn btn-ghost btn-sm" style={tab === 'applications' ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}} onClick={() => setTab('applications')}>
            APPLICATIONS {pendingApps > 0 && <span style={{ color: 'var(--amber)', marginLeft: 4 }}>({pendingApps})</span>}
          </button>
          <button className="btn btn-ghost btn-sm" style={tab === 'invites' ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}} onClick={() => setTab('invites')}>INVITE LINKS</button>
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING...</div> : tab === 'prospects' ? (
          <>
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))', marginBottom: 20 }}>
              {STAGES.map(s => <div key={s} className="stat-card"><div className="stat-label">{s}</div><div className="stat-value" style={{ fontSize: 22 }}>{counts[s] || 0}</div></div>)}
            </div>
            <div className="flex gap-8 mb-16">
              {['ALL', ...STAGES].map(s => (
                <button key={s} className="btn btn-ghost btn-sm" style={stage === s ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}} onClick={() => setStage(s)}>
                  {s} {s !== 'ALL' && <span style={{ opacity: .6 }}>({counts[s] || 0})</span>}
                </button>
              ))}
            </div>
            {filtered.length === 0 ? <div className="empty-state">NO PROSPECTS</div> : (
              <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table className="data-table"><thead><tr><th>HANDLE</th><th>DISCORD</th><th>REFERRED BY</th><th>STATUS</th><th>NOTES</th><th>ADDED</th><th></th></tr></thead><tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.handle}</td>
                    <td className="text-muted mono">{p.discord || '—'}</td>
                    <td className="text-muted">{p.referred_by?.handle || '—'}</td>
                    <td><span className={`badge ${STAGE_BADGE[p.status]}`}>{p.status}</span></td>
                    <td style={{ maxWidth: 200 }}><span style={{ fontSize: 12, color: 'var(--text-2)' }} className="truncate">{p.notes || '—'}</span></td>
                    <td className="mono text-muted">{fmt(p.created_at)}</td>
                    <td><div className="flex gap-8">
                      {canManage && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>EDIT</button>}
                      {me.tier <= 3 && <button className="btn btn-danger btn-sm" onClick={() => deleteProspect(p.id)}>✕</button>}
                    </div></td>
                  </tr>
                ))}
              </tbody></table></div></div>
            )}
          </>
        ) : tab === 'applications' ? (
          applications.length === 0 ? <div className="empty-state">NO APPLICATIONS</div> : (
            <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table className="data-table"><thead><tr><th>HANDLE</th><th>DISCORD</th><th>EMAIL</th><th>TIMEZONE</th><th>REFERRAL</th><th>STATUS</th><th>DATE</th><th></th></tr></thead><tbody>
              {applications.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 500 }}>{a.handle}</td>
                  <td className="text-muted mono">{a.discord || '—'}</td>
                  <td className="text-muted">{a.email || '—'}</td>
                  <td className="text-muted">{a.timezone || '—'}</td>
                  <td className="text-muted mono">{a.referral_code || '—'}</td>
                  <td><span className={`badge ${APP_BADGE[a.status]}`}>{a.status}</span></td>
                  <td className="mono text-muted">{fmt(a.created_at)}</td>
                  <td>
                    {canManage && a.status === 'PENDING' && (
                      <div className="flex gap-8">
                        <button className="btn btn-primary btn-sm" onClick={() => reviewApp(a, 'APPROVED')}>APPROVE</button>
                        <button className="btn btn-danger btn-sm" onClick={() => reviewApp(a, 'REJECTED')}>REJECT</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody></table></div></div>
          )
        ) : (
          /* INVITES TAB */
          <>
            <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>
              Share invite links with prospects. The application form URL is: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{window.location.origin}/apply</span>
            </p>
            {invites.length === 0 ? <div className="empty-state">NO INVITE LINKS</div> : (
              <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table className="data-table"><thead><tr><th>CODE</th><th>LABEL</th><th>CREATED BY</th><th>USES</th><th>EXPIRES</th><th></th></tr></thead><tbody>
                {invites.map(inv => (
                  <tr key={inv.id}>
                    <td>
                      <span className="mono" style={{ color: 'var(--accent)', cursor: 'pointer' }}
                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/apply?ref=${inv.code}`); alert('Copied!') }}>
                        {inv.code}
                      </span>
                    </td>
                    <td className="text-muted">{inv.label || '—'}</td>
                    <td className="text-muted">{inv.creator?.handle || '—'}</td>
                    <td className="mono">{inv.uses}{inv.max_uses ? ` / ${inv.max_uses}` : ''}</td>
                    <td className="text-muted mono">{inv.expires_at ? fmt(inv.expires_at) : 'NEVER'}</td>
                    <td>
                      <div className="flex gap-8">
                        <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/apply?ref=${inv.code}`); alert('Link copied!') }}>COPY LINK</button>
                        {(inv.created_by === me.id || me.tier <= 3) && <button className="btn btn-danger btn-sm" onClick={() => deleteInvite(inv.id)}>✕</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody></table></div></div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {modal === 'add' && (
        <Modal title="ADD PROSPECT" onClose={() => setModal(null)}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">SC HANDLE *</label><input className="form-input" value={form.handle} onChange={e => setForm(f => ({ ...f, handle: e.target.value }))} placeholder="StarCitizen handle" /></div>
            <div className="form-group"><label className="form-label">DISCORD</label><input className="form-input" value={form.discord} onChange={e => setForm(f => ({ ...f, discord: e.target.value }))} placeholder="username" /></div>
          </div>
          <div className="form-group"><label className="form-label">REFERRED BY</label><select className="form-select" value={form.referred_by} onChange={e => setForm(f => ({ ...f, referred_by: e.target.value }))}><option value="">None</option>{members.map(m => <option key={m.id} value={m.id}>{m.handle}</option>)}</select></div>
          <div className="form-group"><label className="form-label">NOTES</label><textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Initial assessment..." /></div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button><button className="btn btn-primary" onClick={saveAdd} disabled={saving}>{saving ? 'ADDING...' : 'ADD TO PIPELINE'}</button></div>
        </Modal>
      )}

      {modal === 'edit' && editTarget && (
        <Modal title={`UPDATE — ${editTarget.handle}`} onClose={() => setModal(null)}>
          <div className="form-group"><label className="form-label">STATUS</label><select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>{STAGES.map(s => <option key={s}>{s}</option>)}</select></div>
          <div className="form-group"><label className="form-label">NOTES</label><textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Vetting notes..." /></div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button><button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'SAVING...' : 'UPDATE STATUS'}</button></div>
        </Modal>
      )}

      {modal === 'invite' && (
        <Modal title="CREATE INVITE LINK" onClose={() => setModal(null)}>
          <div className="form-group"><label className="form-label">LABEL (optional)</label><input className="form-input" value={form.inviteLabel} onChange={e => setForm(f => ({ ...f, inviteLabel: e.target.value }))} placeholder="e.g. Reddit campaign, Discord promo" /></div>
          <div className="form-group"><label className="form-label">MAX USES (leave empty for unlimited)</label><input className="form-input" type="number" value={form.inviteMax} onChange={e => setForm(f => ({ ...f, inviteMax: e.target.value }))} placeholder="∞" /></div>
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button><button className="btn btn-primary" onClick={createInvite} disabled={saving}>{saving ? 'CREATING...' : 'CREATE LINK'}</button></div>
        </Modal>
      )}
    </>
  )
}
