import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { timeAgo, fmtDateTime } from '../lib/dates'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { confirmAction } from '../lib/dialogs'

function formatDateInput(d) {
  return new Date(d).toISOString().slice(0, 16)
}

function isOverlapping(aStart, aEnd, bStart, bEnd) {
  return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart)
}

export default function ShipCalendar() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const [ships, setShips] = useState([])
  const [reservations, setReservations] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedShip, setSelectedShip] = useState(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [filter, setFilter] = useState('all') // all | mine | available

  async function load() {
    const [{ data: sh }, { data: res }, { data: ev }] = await Promise.all([
      supabase.from('fleet').select('id, name, class, role, owner:profiles(id, handle)').order('name'),
      supabase.from('ship_reservations').select('*, member:profiles(handle, avatar_color), event:events(title)').eq('status', 'CONFIRMED').order('starts_at'),
      supabase.from('events').select('id, title, starts_at').eq('status', 'SCHEDULED'),
    ])
    setShips(sh || []); setReservations(res || []); setEvents(ev || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() + weekOffset * 7)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i)
    return d
  })

  function getReservationsForShipDay(shipId, day) {
    const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999)
    return reservations.filter(r =>
      r.ship_id === shipId &&
      isOverlapping(r.starts_at, r.ends_at, dayStart, dayEnd)
    )
  }

  function isShipReservedNow(shipId) {
    const now = new Date()
    return reservations.some(r =>
      r.ship_id === shipId &&
      new Date(r.starts_at) <= now &&
      new Date(r.ends_at) >= now
    )
  }

  function openReserve(ship, day = null) {
    const start = day ? new Date(day) : new Date()
    start.setHours(Math.max(start.getHours(), new Date().getHours()), 0, 0, 0)
    const end = new Date(start); end.setHours(end.getHours() + 2)
    setSelectedShip(ship)
    setForm({
      starts_at: formatDateInput(start),
      ends_at: formatDateInput(end),
      purpose: '',
      event_id: '',
    })
    setModal(true)
  }

  async function saveReservation() {
    if (!selectedShip || !form.starts_at || !form.ends_at) return
    if (new Date(form.ends_at) <= new Date(form.starts_at)) {
      toast('End time must be after start time', 'error'); return
    }
    // Check for conflicts
    const conflicts = reservations.filter(r =>
      r.ship_id === selectedShip.id &&
      isOverlapping(r.starts_at, r.ends_at, form.starts_at, form.ends_at)
    )
    if (conflicts.length > 0) {
      toast(`Conflict with ${conflicts[0].member?.handle}'s reservation`, 'error'); return
    }
    setSaving(true)
    const { error } = await supabase.from('ship_reservations').insert({
      ship_id: selectedShip.id, member_id: me.id,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      purpose: form.purpose || null,
      event_id: form.event_id || null,
    })
    if (error) { toast(error.message, 'error'); setSaving(false); return }
    toast(`${selectedShip.name} reserved`, 'success')
    setModal(false); setSaving(false); load()
  }

  async function cancelReservation(id) {
    if (!(await confirmAction('Cancel this reservation?'))) return
    await supabase.from('ship_reservations').update({ status: 'CANCELLED' }).eq('id', id)
    toast('Reservation cancelled', 'info'); load()
  }

  // Filter ships
  const filteredShips = filter === 'mine'
    ? ships.filter(s => reservations.some(r => r.ship_id === s.id && r.member_id === me.id))
    : filter === 'available'
      ? ships.filter(s => !isShipReservedNow(s.id))
      : ships

  const myReservations = reservations.filter(r => r.member_id === me.id && new Date(r.ends_at) > new Date())

  return (
    <>
      <div className="page-header">
        <div className="page-title">SHIP CALENDAR</div>
        <div className="page-subtitle">Reserve fleet vessels for operations · {reservations.length} active reservation{reservations.length !== 1 ? 's' : ''}</div>
      </div>

      <div className="page-body">
        {/* My reservations summary */}
        {myReservations.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div className="section-header"><div className="section-title">MY UPCOMING RESERVATIONS</div></div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {myReservations.map(r => {
                const ship = ships.find(s => s.id === r.ship_id)
                return (
                  <div key={r.id} style={{
                    background: 'var(--accent-dim)', border: '1px solid rgba(212,216,224,0.3)',
                    borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13 }}>{ship?.name || 'Unknown'}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        {fmtDateTime(r.starts_at)} → {fmtDateTime(r.ends_at)}
                      </div>
                      {r.purpose && <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>{r.purpose}</div>}
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => cancelReservation(r.id)} style={{ color: 'var(--red)' }}>CANCEL</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Week navigation + filter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w - 1)}>← PREV</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(0)} style={weekOffset === 0 ? { background: 'var(--accent-dim)', color: 'var(--accent)' } : {}}>THIS WEEK</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(w => w + 1)}>NEXT →</button>
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginLeft: 10 }}>
              {weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} — {new Date(weekEnd - 1).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['all', 'mine', 'available'].map(f => (
              <button key={f} className="btn btn-ghost btn-sm" onClick={() => setFilter(f)}
                style={filter === f ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}}>
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar grid */}
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Loading...</div> :
        filteredShips.length === 0 ? <div className="empty-state">No ships match the filter.</div> : (
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, letterSpacing: '.15em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', minWidth: 200, position: 'sticky', left: 0, background: 'var(--bg-raised)', zIndex: 2 }}>SHIP</th>
                  {days.map(d => {
                    const isToday = d.toDateString() === new Date().toDateString()
                    return (
                      <th key={d.toISOString()} style={{
                        padding: '10px 8px', textAlign: 'center', fontSize: 10, letterSpacing: '.1em', fontFamily: 'var(--font-mono)',
                        color: isToday ? 'var(--accent)' : 'var(--text-3)',
                        minWidth: 100, background: isToday ? 'var(--accent-glow)' : 'transparent',
                      }}>
                        <div>{d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', marginTop: 2 }}>{d.getDate()}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredShips.map(ship => {
                  const isOwner = ship.owner?.id === me.id
                  return (
                    <tr key={ship.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', position: 'sticky', left: 0, background: 'var(--bg-raised)', zIndex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div>
                            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13 }}>{ship.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                              {ship.class || '—'}{ship.role ? ` · ${ship.role}` : ''}
                              {isOwner && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>(YOURS)</span>}
                            </div>
                          </div>
                          <button className="btn btn-primary btn-sm" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => openReserve(ship)}>RESERVE</button>
                        </div>
                      </td>
                      {days.map(d => {
                        const dayRes = getReservationsForShipDay(ship.id, d)
                        return (
                          <td key={d.toISOString()} style={{ padding: 4, verticalAlign: 'top', minHeight: 50 }}
                            onClick={e => { if (dayRes.length === 0) openReserve(ship, d) }}>
                            {dayRes.length === 0 ? (
                              <div style={{ minHeight: 36, cursor: 'pointer', borderRadius: 4, transition: 'background .1s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'} />
                            ) : dayRes.map(r => {
                              const isMine = r.member_id === me.id
                              return (
                                <div key={r.id} onClick={e => { e.stopPropagation(); if (isMine) cancelReservation(r.id) }}
                                  title={`${r.member?.handle}: ${fmtDateTime(r.starts_at)} → ${fmtDateTime(r.ends_at)}${r.purpose ? ` — ${r.purpose}` : ''}`}
                                  style={{
                                    background: isMine ? 'var(--accent-dim)' : 'rgba(74,144,217,0.1)',
                                    border: `1px solid ${isMine ? 'var(--accent)' : 'var(--blue)'}`,
                                    borderRadius: 4, padding: '3px 6px', marginBottom: 2,
                                    fontSize: 10, color: isMine ? 'var(--accent)' : 'var(--blue)',
                                    cursor: isMine ? 'pointer' : 'default',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  }}>
                                  <div style={{ fontWeight: 600 }}>{new Date(r.starts_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                                  <div style={{ color: 'var(--text-2)', fontSize: 9 }}>{r.member?.handle}</div>
                                </div>
                              )
                            })}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && selectedShip && (
        <Modal title={`RESERVE ${selectedShip.name}`} onClose={() => setModal(false)}>
          <div className="form-group">
            <label className="form-label">START</label>
            <input className="form-input" type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">END</label>
            <input className="form-input" type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">PURPOSE (optional)</label>
            <input className="form-input" value={form.purpose || ''} onChange={e => setForm({ ...form, purpose: e.target.value })} placeholder="Solo mining run, cargo haul, etc." />
          </div>
          {events.length > 0 && (
            <div className="form-group">
              <label className="form-label">LINK TO OPERATION (optional)</label>
              <select className="form-select" value={form.event_id || ''} onChange={e => setForm({ ...form, event_id: e.target.value })}>
                <option value="">— None —</option>
                {events.map(e => <option key={e.id} value={e.id}>{e.title} — {fmtDateTime(e.starts_at)}</option>)}
              </select>
            </div>
          )}
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setModal(false)}>CANCEL</button>
            <button className="btn btn-primary" onClick={saveReservation} disabled={saving}>{saving ? 'RESERVING...' : 'CONFIRM RESERVATION'}</button>
          </div>
        </Modal>
      )}
    </>
  )
}
