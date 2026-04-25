import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { SC_LOCATIONS } from '../lib/scdata'
import { useToast } from '../components/Toast'
import { discordNewOp } from '../lib/discord'
import { confirmAction } from '../lib/dialogs'
import {
  UEE_AMBER, ClassificationBar, TabStrip, StatCell, Card,
  StatusBadge, Field, EmptyState, UeeModal, SectionHeader, btnMicro,
  fmtDateTime, timeUntil,
} from '../components/uee'

const EVENT_TYPES = ['OPERATION', 'MINING', 'TRADE', 'PVP', 'TRAINING', 'SOCIAL', 'MEETING']
const ROLES = ['Pilot', 'Gunner', 'Turret Operator', 'Medic', 'Ground Infantry', 'Engineer', 'Navigator', 'Recon', 'Command', 'Support', 'Miner', 'Hauler']

const STATUS_META = {
  SCHEDULED: { color: '#5a80d9', glyph: '◉', label: 'SCHEDULED' },
  LIVE:      { color: '#5ce0a1', glyph: '⬢', label: 'LIVE' },
  COMPLETED: { color: '#9099a8', glyph: '✓', label: 'COMPLETED' },
  CANCELLED: { color: '#e05c5c', glyph: '✕', label: 'CANCELLED' },
}

const TYPE_COLOR = {
  OPERATION: UEE_AMBER,
  PVP:       '#e05c5c',
  MINING:    '#5ce0a1',
  TRADE:     '#c8a55a',
  TRAINING:  '#5a80d9',
  SOCIAL:    '#b566d9',
  MEETING:   '#9099a8',
}

const RSVP_META = {
  CONFIRMED: { color: '#5ce0a1', label: 'GOING' },
  TENTATIVE: { color: UEE_AMBER, label: 'MAYBE' },
}

const OPS_BLUE = '#5a80d9'

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

  const canCreate = me.tier <= 4

  async function load() {
    const [{ data: e }, { data: s }] = await Promise.all([
      supabase.from('events').select('*, organizer:profiles(handle)').order('starts_at', { ascending: true }),
      supabase.from('event_signups').select('*, member:profiles(handle)'),
    ])
    setEvents(e || [])
    setSignups(s || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const now = new Date()
  const upcoming = useMemo(() =>
    events.filter(e => new Date(e.starts_at) >= now && e.status !== 'CANCELLED' && e.status !== 'COMPLETED'),
  [events])
  const past = useMemo(() =>
    events.filter(e => new Date(e.starts_at) < now || e.status === 'COMPLETED' || e.status === 'CANCELLED'),
  [events])
  const mySignups = useMemo(() =>
    new Set(signups.filter(s => s.member_id === me.id).map(s => s.event_id)),
  [signups, me.id])

  const liveCount = upcoming.filter(e => e.status === 'LIVE').length
  const next24h = upcoming.filter(e => {
    const diff = new Date(e.starts_at) - Date.now()
    return diff > 0 && diff < 86400000
  }).length

  const listedEvents = useMemo(() => {
    const src = tab === 'past' ? past : (tab === 'mine'
      ? upcoming.filter(e => mySignups.has(e.id))
      : upcoming)
    return src
  }, [tab, upcoming, past, mySignups])

  async function createEvent() {
    if (!form.title || !form.starts_at) { setError('Title and start time required.'); return }
    setSaving(true)
    await supabase.from('events').insert({
      title: form.title, description: form.description || null,
      event_type: form.event_type || 'OPERATION',
      location: form.location || null,
      starts_at: form.starts_at, ends_at: form.ends_at || null,
      min_tier: parseInt(form.min_tier) || 9,
      max_slots: form.max_slots ? parseInt(form.max_slots) : null,
      created_by: me.id,
    })
    await supabase.from('activity_log').insert({
      actor_id: me.id, action: 'event_created',
      target_type: 'event', details: { title: form.title },
    })
    discordNewOp(form.title, form.event_type || 'OPERATION', form.location, form.starts_at ? fmtDateTime(form.starts_at) : 'TBD', me.handle)
    toast('Operation scheduled', 'success')
    setModal(null); setSaving(false); load()
  }

  async function signup(eventId, role, ship, status) {
    const ev = events.find(e => e.id === eventId)
    await supabase.from('event_signups').insert({
      event_id: eventId, member_id: me.id,
      role: role || null, ship_class: ship || null,
      status: status || 'CONFIRMED',
    })
    // Notify the op organizer that someone joined the roster
    if (ev?.created_by && ev.created_by !== me.id) {
      await supabase.from('notifications').insert({
        recipient_id: ev.created_by,
        type: 'op_signup',
        title: `${me.handle} signed up for ${ev.title}`,
        message: `${(status || 'CONFIRMED') === 'CONFIRMED' ? 'Confirmed going' : 'Marked as maybe'}${role ? ' as ' + role : ''}${ship ? ' (' + ship + ')' : ''}.`,
        link: '/events',
      })
    }
    load()
    if (detail && detail.id === eventId) {
      setDetail(events.find(e => e.id === eventId))
    }
  }

  async function withdraw(eventId) {
    await supabase.from('event_signups').delete().eq('event_id', eventId).eq('member_id', me.id)
    load()
  }

  async function updateStatus(id, status) {
    await supabase.from('events').update({ status }).eq('id', id)
    if (detail && detail.id === id) setDetail({ ...detail, status })
    // Notify everyone on the roster when an op flips state
    if (status === 'CANCELLED' || status === 'LIVE') {
      const ev = events.find(e => e.id === id)
      const roster = signups.filter(s => s.event_id === id).map(s => s.member_id)
      const recipients = [...new Set(roster.filter(rid => rid && rid !== me.id))]
      if (recipients.length > 0 && ev) {
        await supabase.from('notifications').insert(recipients.map(rid => ({
          recipient_id: rid,
          type: status === 'LIVE' ? 'op_reminder' : 'op_signup',
          title: status === 'LIVE'
            ? `${ev.title} is LIVE`
            : `${ev.title} cancelled`,
          message: status === 'LIVE'
            ? `Op went live. Get to your stations.`
            : `${me.handle} cancelled this op. Stand down.`,
          link: '/events',
        })))
      }
    }
    load()
  }

  async function deleteEvent(id, title) {
    if (!(await confirmAction(`Delete "${title}"? This removes the op and all signups. Cannot be undone.`))) return
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) { toast(error.message || 'Delete failed', 'error'); return }
    await supabase.from('activity_log').insert({
      actor_id: me.id, action: 'event_deleted',
      target_type: 'event', details: { title },
    })
    toast('Operation deleted', 'success')
    setDetail(null); load()
  }

  function openDetail(e) {
    setDetail(e)
    setForm({ signupRole: '', signupShip: '', signupStatus: 'CONFIRMED' })
  }

  return (
    <>
      <ClassificationBar
        section="GRAYVEIL OPERATIONS SCHEDULING"
        label={tab === 'upcoming' ? 'ACTIVE BOARD' : tab === 'past' ? 'ARCHIVE' : 'MY ROSTER'}
        accent={OPS_BLUE}
        right={(
          <>
            <span>UPCOMING · {upcoming.length}</span>
            {liveCount > 0 && <span style={{ color: STATUS_META.LIVE.color }}>LIVE · {liveCount}</span>}
            {next24h > 0 && <span style={{ color: UEE_AMBER }}>NEXT 24H · {next24h}</span>}
          </>
        )}
      />

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>OPERATIONS BOARD</h1>
            <div style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 640 }}>
              Scheduled ops and joint exercises. RSVP to lock your slot and bring your loadout to the briefing window.
            </div>
          </div>
          {canCreate && (
            <button className="btn btn-primary" onClick={() => {
              setForm({ event_type: 'OPERATION', min_tier: 9 })
              setError(''); setModal('create')
            }}>+ SCHEDULE OP</button>
          )}
        </div>

        <TabStrip
          active={tab} onChange={setTab}
          tabs={[
            { key: 'upcoming', label: 'UPCOMING', color: OPS_BLUE, glyph: '◉', count: upcoming.length },
            { key: 'mine',     label: 'MY RSVP',  color: UEE_AMBER, glyph: '◆', count: mySignups.size },
            { key: 'past',     label: 'ARCHIVE',  color: '#9099a8', glyph: '✓', count: past.length },
          ]}
        />
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING OPERATIONS BOARD...</div> : (
          <>
            {tab === 'upcoming' && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 10, marginBottom: 16,
              }}>
                <StatCell label="UPCOMING"   value={upcoming.length}  color={OPS_BLUE}             glyph="◉" desc="scheduled ops" />
                <StatCell label="LIVE NOW"   value={liveCount}        color={STATUS_META.LIVE.color} glyph="⬢" desc="ops underway" />
                <StatCell label="NEXT 24H"   value={next24h}          color={UEE_AMBER}            glyph="◆" desc="imminent" />
                <StatCell label="MY RSVPS"   value={mySignups.size}   color="#b566d9"              glyph="✦" desc="you're on roster" />
              </div>
            )}

            {listedEvents.length === 0 ? (
              <EmptyState>
                {tab === 'mine'
                  ? 'You have no active RSVPs. Browse the board and sign up for an op.'
                  : tab === 'past'
                    ? 'Archive is empty — no completed or cancelled ops yet.'
                    : canCreate
                      ? <>No ops on the board. <a onClick={() => { setForm({ event_type: 'OPERATION', min_tier: 9 }); setError(''); setModal('create') }} style={{ color: OPS_BLUE, cursor: 'pointer', textDecoration: 'underline' }}>Schedule one</a>.</>
                      : 'No ops on the board. Check back soon.'}
              </EmptyState>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: 12,
              }}>
                {listedEvents.map(e => {
                  const evSignups = signups.filter(s => s.event_id === e.id)
                  return (
                    <EventCard
                      key={e.id} event={e}
                      eventSignups={evSignups}
                      isSigned={mySignups.has(e.id)}
                      onOpen={() => openDetail(e)}
                    />
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* EVENT DETAIL */}
      {detail && (
        <EventDetail
          event={detail}
          eventSignups={signups.filter(s => s.event_id === detail.id)}
          isSigned={mySignups.has(detail.id)}
          canCreate={canCreate}
          isFounder={me.is_founder}
          form={form}
          setForm={setForm}
          onSignup={(role, ship, status) => signup(detail.id, role, ship, status)}
          onWithdraw={() => withdraw(detail.id)}
          onUpdateStatus={status => updateStatus(detail.id, status)}
          onDelete={() => deleteEvent(detail.id, detail.title)}
          onClose={() => setDetail(null)}
        />
      )}

      {/* CREATE EVENT */}
      {modal === 'create' && (
        <UeeModal
          accent={OPS_BLUE}
          kicker="◆ NEW OPERATION · OPS SCHEDULING"
          title="SCHEDULE OPERATION"
          onClose={() => setModal(null)}
          maxWidth={680}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
              <button className="btn btn-primary" onClick={createEvent} disabled={saving}>
                {saving ? 'SCHEDULING...' : 'SCHEDULE OP'}
              </button>
            </>
          )}
        >
          <div className="form-group">
            <label className="form-label">OPERATION NAME *</label>
            <input className="form-input" value={form.title || ''}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Siege of Jumptown" autoFocus />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">TYPE</label>
              <select className="form-select" value={form.event_type}
                onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}>
                {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">LOCATION</label>
              <select className="form-select" value={form.location || ''}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}>
                <option value="">—</option>
                {SC_LOCATIONS.map(l => <option key={l.name} value={l.name}>{l.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">STARTS AT *</label>
              <input className="form-input" type="datetime-local"
                value={form.starts_at || ''}
                onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">ENDS AT</label>
              <input className="form-input" type="datetime-local"
                value={form.ends_at || ''}
                onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">MAX SLOTS</label>
              <input className="form-input" type="number"
                value={form.max_slots || ''}
                onChange={e => setForm(f => ({ ...f, max_slots: e.target.value }))}
                placeholder="Unlimited" />
            </div>
            <div className="form-group">
              <label className="form-label">MIN TIER</label>
              <input className="form-input" type="number" min="1" max="9"
                value={form.min_tier}
                onChange={e => setForm(f => ({ ...f, min_tier: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">BRIEFING</label>
            <textarea className="form-textarea" value={form.description || ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Operation objectives, required equipment, rules of engagement..." />
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
        </UeeModal>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
function EventCard({ event: e, eventSignups, isSigned, onOpen }) {
  const meta = STATUS_META[e.status] || STATUS_META.SCHEDULED
  const typeColor = TYPE_COLOR[e.event_type] || UEE_AMBER
  const confirmed = eventSignups.filter(s => s.status === 'CONFIRMED').length
  const tentative = eventSignups.filter(s => s.status === 'TENTATIVE').length
  const remaining = e.max_slots ? Math.max(e.max_slots - confirmed, 0) : null
  const countdown = timeUntil(e.starts_at)
  const soon = (new Date(e.starts_at) - Date.now()) < 3600000 && (new Date(e.starts_at) - Date.now()) > 0
  const isLive = e.status === 'LIVE'

  return (
    <Card accent={meta.color} onClick={onOpen} minHeight={180}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600,
            color: 'var(--text-1)', lineHeight: 1.25,
          }}>
            {e.title}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.2em',
              color: typeColor, border: `1px solid ${typeColor}55`, padding: '1px 6px', borderRadius: 3,
            }}>{e.event_type}</span>
            {e.min_tier < 9 && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.2em',
                color: '#b566d9', border: '1px solid #b566d955', padding: '1px 6px', borderRadius: 3,
              }}>TIER {e.min_tier}+</span>
            )}
            {isSigned && <StatusBadge color="#5ce0a1" glyph="◆" label="ROSTERED" />}
          </div>
        </div>
        <StatusBadge color={meta.color} glyph={meta.glyph} label={meta.label} />
      </div>

      {e.description && (
        <div style={{
          fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {e.description}
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        paddingTop: 8, borderTop: '1px dashed var(--border)',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, lineHeight: 1,
            color: isLive ? STATUS_META.LIVE.color : soon ? UEE_AMBER : OPS_BLUE,
            textShadow: isLive || soon ? `0 0 10px ${isLive ? STATUS_META.LIVE.color : UEE_AMBER}66` : 'none',
          }}>
            {isLive ? 'LIVE' : countdown}
          </div>
          <div style={{ fontSize: 9, letterSpacing: '.15em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {isLive ? 'UNDERWAY' : 'UNTIL LAUNCH'}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', color: 'var(--text-3)' }}>
          <div>{fmtDateTime(e.starts_at)}</div>
          {e.location && <div>◈ {e.location.toUpperCase()}</div>}
          <div>
            <span style={{ color: confirmed > 0 ? '#5ce0a1' : 'var(--text-3)' }}>{confirmed}</span>
            {e.max_slots ? <span>/{e.max_slots}</span> : ''}
            {tentative > 0 && <span style={{ color: UEE_AMBER }}> · {tentative} maybe</span>}
            {remaining === 0 && <span style={{ color: '#e05c5c' }}> · FULL</span>}
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
function EventDetail({ event: e, eventSignups, isSigned, canCreate, isFounder, form, setForm, onSignup, onWithdraw, onUpdateStatus, onDelete, onClose }) {
  const meta = STATUS_META[e.status] || STATUS_META.SCHEDULED
  const typeColor = TYPE_COLOR[e.event_type] || UEE_AMBER
  const confirmed = eventSignups.filter(s => s.status === 'CONFIRMED').length
  const tentative = eventSignups.filter(s => s.status === 'TENTATIVE').length
  const canSignup = e.status === 'SCHEDULED' || e.status === 'LIVE'

  return (
    <UeeModal
      accent={meta.color}
      kicker={`◆ OPERATION FILE · ${e.event_type}`}
      title={e.title}
      onClose={onClose}
      maxWidth={720}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <StatusBadge color={meta.color} glyph={meta.glyph} label={meta.label} />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em',
          color: typeColor, border: `1px solid ${typeColor}55`, padding: '2px 7px', borderRadius: 3,
        }}>{e.event_type}</span>
        {e.min_tier < 9 && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em',
            color: '#b566d9', border: '1px solid #b566d955', padding: '2px 7px', borderRadius: 3,
          }}>TIER {e.min_tier}+</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
          ORGANIZER · {(e.organizer?.handle || '—').toUpperCase()}
        </span>
      </div>

      {e.description && (
        <div style={{
          fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7,
          whiteSpace: 'pre-wrap', marginBottom: 16,
        }}>
          {e.description}
        </div>
      )}

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10,
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border)',
        borderRadius: 3, marginBottom: 18,
      }}>
        <Field label="LAUNCH"   value={fmtDateTime(e.starts_at)} mono />
        <Field label="T-MINUS"  value={e.status === 'LIVE' ? 'LIVE' : timeUntil(e.starts_at)} mono color={e.status === 'LIVE' ? STATUS_META.LIVE.color : OPS_BLUE} />
        <Field label="LOCATION" value={e.location || '—'} />
        <Field label="SLOTS"    value={`${confirmed}${e.max_slots ? `/${e.max_slots}` : ''}${tentative > 0 ? ` · ${tentative} maybe` : ''}`} mono />
      </div>

      <SectionHeader label={`ROSTER · ${eventSignups.length}`} color={OPS_BLUE} />
      {eventSignups.length === 0 ? (
        <div style={{ padding: 14, textAlign: 'center', fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
          Roster empty. Be the first to commit.
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {eventSignups.map(s => {
            const r = RSVP_META[s.status] || { color: '#9099a8', label: s.status || 'PENDING' }
            return (
              <div key={s.id} style={{
                padding: '8px 10px', marginBottom: 4,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border)',
                borderLeft: `2px solid ${r.color}`,
                borderRadius: 3,
                display: 'flex', alignItems: 'center', gap: 10, fontSize: 12,
              }}>
                <span style={{ fontWeight: 500, minWidth: 110, color: 'var(--text-1)' }}>{s.member?.handle || '—'}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em',
                  color: 'var(--text-3)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: 3,
                }}>{s.role || 'ANY'}</span>
                {s.ship_class && (
                  <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em' }}>
                    {s.ship_class}
                  </span>
                )}
                <StatusBadge color={r.color} label={r.label} />
              </div>
            )
          })}
        </div>
      )}

      {canSignup && (
        <>
          {isSigned ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <button onClick={onWithdraw} style={btnMicro('#e05c5c')}>✕ WITHDRAW FROM ROSTER</button>
            </div>
          ) : (
            <>
              <SectionHeader label="LOCK IN SLOT" color="#5ce0a1" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'flex-end', marginBottom: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">ROLE</label>
                  <select className="form-select" value={form.signupRole || ''}
                    onChange={ev => setForm(f => ({ ...f, signupRole: ev.target.value }))}>
                    <option value="">Any</option>
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">SHIP</label>
                  <input className="form-input" value={form.signupShip || ''}
                    onChange={ev => setForm(f => ({ ...f, signupShip: ev.target.value }))}
                    placeholder="Ship class" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">RSVP</label>
                  <select className="form-select" value={form.signupStatus || 'CONFIRMED'}
                    onChange={ev => setForm(f => ({ ...f, signupStatus: ev.target.value }))}>
                    <option value="CONFIRMED">Going</option>
                    <option value="TENTATIVE">Maybe</option>
                  </select>
                </div>
                <button
                  onClick={() => onSignup(form.signupRole, form.signupShip, form.signupStatus)}
                  style={{ ...btnMicro('#5ce0a1'), padding: '8px 14px', fontSize: 11 }}
                >
                  ✓ SIGN UP
                </button>
              </div>
            </>
          )}
        </>
      )}

      {(canCreate || isFounder) && (
        <div style={{
          display: 'flex', gap: 6, flexWrap: 'wrap',
          paddingTop: 12, borderTop: '1px dashed var(--border)', marginTop: 12,
        }}>
          {canCreate && e.status === 'SCHEDULED' && (
            <button onClick={() => onUpdateStatus('LIVE')} style={btnMicro(STATUS_META.LIVE.color)}>
              ⬢ GO LIVE
            </button>
          )}
          {canCreate && e.status === 'LIVE' && (
            <button onClick={() => onUpdateStatus('COMPLETED')} style={btnMicro('#5a80d9')}>
              ✓ COMPLETE
            </button>
          )}
          {canCreate && e.status !== 'CANCELLED' && e.status !== 'COMPLETED' && (
            <button onClick={() => onUpdateStatus('CANCELLED')} style={btnMicro('#e05c5c')}>
              ✕ CANCEL
            </button>
          )}
          {isFounder && (
            <button onClick={onDelete} style={{ ...btnMicro('#e05c5c'), marginLeft: 'auto' }}>
              ⛔ DELETE OP
            </button>
          )}
        </div>
      )}
    </UeeModal>
  )
}
