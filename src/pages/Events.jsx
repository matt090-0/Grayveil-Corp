import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { SC_LOCATIONS } from '../lib/scdata'
import { SC_SHIPS } from '../lib/ships'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'

const EVENT_TYPES = ['OPERATION', 'MINING', 'TRADE', 'PVP', 'TRAINING', 'SOCIAL', 'MEETING']
const EVENT_BADGE = { SCHEDULED: 'badge-blue', LIVE: 'badge-green', COMPLETED: 'badge-muted', CANCELLED: 'badge-red' }
const ROLES = ['Pilot', 'Gunner', 'Turret Operator', 'Medic', 'Ground Infantry', 'Engineer', 'Navigator', 'Recon', 'Command', 'Support', 'Miner', 'Hauler']

function fmt(ts) { return new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
function timeUntil(ts) {
  const diff = new Date(ts) - Date.now()
  if (diff <= 0) return 'NOW'
  const h = Math.floor(diff / 3600000), d = Math.floor(h / 24)
  if (d > 0) return `${d}d ${h % 24}h`
  return `${h}h ${Math.floor((diff % 3600000) / 60000)}m`
}

export default function Events() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const [events, setEvents] = useState([])
  const [signups, setSignups] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [detailSignups, setDetailSignups] = useState([])

  const canCreate = me.tier <= 4

  async function load() {
    const [{ data: e }, { data: s }] = await Promise.all([
      supabase.from('events').select('*, organizer:profiles(handle)').order('starts_at', { ascending: true }),
      supabase.from('event_signups').select('*, member:profiles(handle)'),
    ])
    setEvents(e || []); setSignups(s || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const now = new Date()
  const upcoming = events.filter(e => new Date(e.starts_at) >= now && e.status !== 'CANCELLED' && e.status !== 'COMPLETED')
  const past = events.filter(e => new Date(e.starts_at) < now || e.status === 'COMPLETED' || e.status === 'CANCELLED')
  const mySignups = new Set(signups.filter(s => s.member_id === me.id).map(s => s.event_id))

  async function createEvent() {
    if (!form.title || !form.starts_at) { setError('Title and start time required.'); return }
    setSaving(true)
    await supabase.from('events').insert({ title: form.title, description: form.description || null, event_type: form.event_type || 'OPERATION', location: form.location || null, starts_at: form.starts_at, ends_at: form.ends_at || null, min_tier: parseInt(form.min_tier) || 9, max_slots: form.max_slots ? parseInt(form.max_slots) : null, created_by: me.id })
    await supabase.from('activity_log').insert({ actor_id: me.id, action: 'event_created', target_type: 'event', details: { title: form.title } })
    setModal(null); setSaving(false); load()
  }

  async function signup(eventId, role, ship) {
    await supabase.from('event_signups').insert({ event_id: eventId, member_id: me.id, role: role || null, ship_class: ship || null })
    load(); if (detail) openDetail(events.find(e => e.id === eventId))
  }

  async function withdraw(eventId) {
    await supabase.from('event_signups').delete().eq('event_id', eventId).eq('member_id', me.id)
    load(); if (detail) openDetail(events.find(e => e.id === eventId))
  }

  async function updateStatus(id, status) {
    await supabase.from('events').update({ status }).eq('id', id); load()
  }

  function openDetail(e) {
    setDetail(e)
    setDetailSignups(signups.filter(s => s.event_id === e.id))
    setForm({ signupRole: '', signupShip: '' })
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title">OPERATIONS BOARD</div>
            <div className="page-subtitle">{upcoming.length} upcoming ops</div>
          </div>
          {canCreate && <button className="btn btn-primary" onClick={() => { setForm({ event_type: 'OPERATION', min_tier: 9 }); setError(''); setModal('create') }}>+ SCHEDULE OP</button>}
        </div>
        <div className="flex gap-8">
          <button className="btn btn-ghost btn-sm" style={tab === 'upcoming' ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}} onClick={() => setTab('upcoming')}>UPCOMING ({upcoming.length})</button>
          <button className="btn btn-ghost btn-sm" style={tab === 'past' ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}} onClick={() => setTab('past')}>PAST</button>
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING OPS...</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(tab === 'upcoming' ? upcoming : past).length === 0 ? <div className="empty-state">NO {tab === 'upcoming' ? 'UPCOMING' : 'PAST'} OPERATIONS</div> :
            (tab === 'upcoming' ? upcoming : past).map(e => {
              const evSignups = signups.filter(s => s.event_id === e.id)
              const isSigned = mySignups.has(e.id)
              return (
                <div key={e.id} className="card" style={{ cursor: 'pointer' }} onClick={() => openDetail(e)}>
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-8">
                      <span className={`badge ${EVENT_BADGE[e.status]}`}>{e.status}</span>
                      <span className="badge badge-muted" style={{ fontSize: 9 }}>{e.event_type}</span>
                      {isSigned && <span className="badge badge-accent" style={{ fontSize: 9 }}>SIGNED UP</span>}
                    </div>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: e.status === 'LIVE' ? 'var(--green)' : 'var(--accent)' }}>{timeUntil(e.starts_at)}</span>
                  </div>
                  <div style={{ fontWeight: 500, fontSize: 15, marginBottom: 4 }}>{e.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span>📅 {fmt(e.starts_at)}</span>
                    {e.location && <span>📍 {e.location}</span>}
                    <span>👥 {evSignups.length}{e.max_slots ? `/${e.max_slots}` : ''} signed up</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* EVENT DETAIL */}
      {detail && (
        <Modal title={detail.title} onClose={() => setDetail(null)} size="modal-lg">
          <div className="flex gap-8 mb-12">
            <span className={`badge ${EVENT_BADGE[detail.status]}`}>{detail.status}</span>
            <span className="badge badge-muted">{detail.event_type}</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>by {detail.organizer?.handle}</span>
          </div>
          {detail.description && <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 16 }}>{detail.description}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><div className="stat-label">STARTS</div><div style={{ fontSize: 12 }}>{fmt(detail.starts_at)}</div></div>
            <div><div className="stat-label">LOCATION</div><div style={{ fontSize: 12 }}>{detail.location || '—'}</div></div>
            <div><div className="stat-label">SLOTS</div><div style={{ fontSize: 12 }}>{signups.filter(s => s.event_id === detail.id).length}{detail.max_slots ? ` / ${detail.max_slots}` : ''}</div></div>
          </div>

          <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>◆ ROSTER</div>
          {signups.filter(s => s.event_id === detail.id).length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>No signups yet</div> : (
            <div style={{ marginBottom: 16 }}>
              {signups.filter(s => s.event_id === detail.id).map(s => (
                <div key={s.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <span style={{ fontWeight: 500, width: 100 }}>{s.member?.handle}</span>
                  <span className="badge badge-muted" style={{ fontSize: 9 }}>{s.role || 'ANY'}</span>
                  {s.ship_class && <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{s.ship_class}</span>}
                  <span className={`badge ${s.status === 'CONFIRMED' ? 'badge-green' : s.status === 'TENTATIVE' ? 'badge-amber' : 'badge-red'}`} style={{ fontSize: 9, marginLeft: 'auto' }}>{s.status}</span>
                </div>
              ))}
            </div>
          )}

          {detail.status === 'SCHEDULED' || detail.status === 'LIVE' ? (
            mySignups.has(detail.id) ? (
              <button className="btn btn-danger btn-sm" onClick={() => withdraw(detail.id)}>WITHDRAW</button>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label">ROLE</label>
                  <select className="form-select" value={form.signupRole || ''} onChange={e => setForm(f => ({ ...f, signupRole: e.target.value }))}>
                    <option value="">Any</option>
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label">SHIP</label>
                  <input className="form-input" value={form.signupShip || ''} onChange={e => setForm(f => ({ ...f, signupShip: e.target.value }))} placeholder="Ship class" />
                </div>
                <button className="btn btn-primary" onClick={() => signup(detail.id, form.signupRole, form.signupShip)}>SIGN UP</button>
              </div>
            )
          ) : null}

          {canCreate && (
            <div className="flex gap-8" style={{ marginTop: 16 }}>
              {detail.status === 'SCHEDULED' && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--green)' }} onClick={() => { updateStatus(detail.id, 'LIVE'); setDetail({ ...detail, status: 'LIVE' }) }}>GO LIVE</button>}
              {detail.status === 'LIVE' && <button className="btn btn-ghost btn-sm" onClick={() => { updateStatus(detail.id, 'COMPLETED'); setDetail({ ...detail, status: 'COMPLETED' }) }}>COMPLETE</button>}
              {detail.status !== 'CANCELLED' && detail.status !== 'COMPLETED' && <button className="btn btn-danger btn-sm" onClick={() => { updateStatus(detail.id, 'CANCELLED'); setDetail({ ...detail, status: 'CANCELLED' }) }}>CANCEL</button>}
            </div>
          )}
        </Modal>
      )}

      {/* CREATE EVENT */}
      {modal === 'create' && (
        <Modal title="SCHEDULE OPERATION" onClose={() => setModal(null)} size="modal-lg">
          <div className="form-group"><label className="form-label">OPERATION NAME *</label><input className="form-input" value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Siege of Jumptown" /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">TYPE</label><select className="form-select" value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}>{EVENT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
            <div className="form-group"><label className="form-label">LOCATION</label><select className="form-select" value={form.location || ''} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}><option value="">—</option>{SC_LOCATIONS.map(l => <option key={l.name} value={l.name}>{l.name}</option>)}</select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">STARTS AT *</label><input className="form-input" type="datetime-local" value={form.starts_at || ''} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">ENDS AT</label><input className="form-input" type="datetime-local" value={form.ends_at || ''} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">MAX SLOTS</label><input className="form-input" type="number" value={form.max_slots || ''} onChange={e => setForm(f => ({ ...f, max_slots: e.target.value }))} placeholder="Unlimited" /></div>
            <div className="form-group"><label className="form-label">MIN TIER</label><input className="form-input" type="number" min="1" max="9" value={form.min_tier} onChange={e => setForm(f => ({ ...f, min_tier: e.target.value }))} /></div>
          </div>
          <div className="form-group"><label className="form-label">BRIEFING</label><textarea className="form-textarea" value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Operation objectives, required equipment, rules of engagement..." /></div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button><button className="btn btn-primary" onClick={createEvent} disabled={saving}>{saving ? 'SCHEDULING...' : 'SCHEDULE OP'}</button></div>
        </Modal>
      )}
    </>
  )
}
