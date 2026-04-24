import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { SC_LOCATIONS } from '../lib/scdata'
import { useToast } from '../components/Toast'
import { discordKill } from '../lib/discord'
import {
  UEE_AMBER, ClassificationBar, TabStrip, StatCell, FilterRow, Card,
  StatusBadge, Field, EmptyState, UeeModal, SectionHeader, btnMicro, fmtDateTime,
} from '../components/uee'

const TYPES    = ['PVP', 'PVE', 'BOUNTY', 'DEFENSE']
const OUTCOMES = ['KILL', 'ASSIST', 'DEATH']

const OUTCOME_META = {
  KILL:   { color: '#5ce0a1', glyph: '◉', label: 'KILL' },
  ASSIST: { color: '#5a80d9', glyph: '◎', label: 'ASSIST' },
  DEATH:  { color: '#e05c5c', glyph: '✕', label: 'DEATH' },
}
const TYPE_COLOR = {
  PVP:     '#e05c5c',
  PVE:     '#c8a55a',
  BOUNTY:  '#b566d9',
  DEFENSE: '#5a80d9',
}

const RED = '#e05c5c'

export default function KillBoard() {
  const { profile: me } = useAuth()
  const toast = useToast()

  const [kills, setKills]   = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]       = useState('feed')
  const [outcomeFilter, setOutcomeFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(false)
  const [form, setForm]     = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function load() {
    const { data } = await supabase
      .from('kill_log')
      .select('*, reporter:profiles(handle)')
      .order('created_at', { ascending: false })
      .limit(200)
    setKills(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const killCount   = useMemo(() => kills.filter(k => k.outcome === 'KILL').length,   [kills])
  const assistCount = useMemo(() => kills.filter(k => k.outcome === 'ASSIST').length, [kills])
  const deathCount  = useMemo(() => kills.filter(k => k.outcome === 'DEATH').length,  [kills])
  const orgKD       = deathCount > 0 ? (killCount / deathCount).toFixed(2) : killCount > 0 ? '∞' : '—'

  const filteredFeed = useMemo(() => {
    const q = search.trim().toLowerCase()
    return kills
      .filter(k => outcomeFilter === 'ALL' || k.outcome === outcomeFilter)
      .filter(k => !q
        || (k.target_name || '').toLowerCase().includes(q)
        || (k.target_org || '').toLowerCase().includes(q)
        || (k.location || '').toLowerCase().includes(q)
        || (k.ship_used || '').toLowerCase().includes(q)
        || (k.target_ship || '').toLowerCase().includes(q)
        || (k.reporter?.handle || '').toLowerCase().includes(q))
  }, [kills, outcomeFilter, search])

  const leaderboard = useMemo(() => {
    const map = {}
    kills.forEach(k => {
      if (!map[k.reporter_id]) map[k.reporter_id] = { handle: k.reporter?.handle, kills: 0, assists: 0, deaths: 0 }
      if (k.outcome === 'KILL') map[k.reporter_id].kills++
      else if (k.outcome === 'ASSIST') map[k.reporter_id].assists++
      else if (k.outcome === 'DEATH') map[k.reporter_id].deaths++
    })
    return Object.values(map).sort((a, b) => b.kills - a.kills)
  }, [kills])

  async function logKill() {
    if (!form.target_name) { setError('Target name required.'); return }
    setSaving(true)
    await supabase.from('kill_log').insert({
      reporter_id: me.id,
      target_name: form.target_name,
      target_org: form.target_org || null,
      location: form.location || null,
      ship_used: form.ship_used || null,
      target_ship: form.target_ship || null,
      engagement_type: form.engagement_type || 'PVP',
      outcome: form.outcome || 'KILL',
      notes: form.notes || null,
    })
    discordKill(me.handle, form.target_name, form.target_org, form.ship_used, form.location, form.outcome || 'KILL')
    toast('Engagement logged', 'success')
    setModal(false); setSaving(false); setForm({}); load()
  }

  return (
    <>
      <ClassificationBar
        section="GRAYVEIL ENGAGEMENT ARCHIVE"
        label={tab === 'feed' ? 'COMBAT FEED' : 'LEADERBOARD'}
        accent={RED}
        right={(
          <>
            <span style={{ color: OUTCOME_META.KILL.color }}>{killCount}K</span>
            <span style={{ color: OUTCOME_META.ASSIST.color }}>{assistCount}A</span>
            <span style={{ color: OUTCOME_META.DEATH.color }}>{deathCount}D</span>
            <span style={{ color: UEE_AMBER }}>K/D · {orgKD}</span>
          </>
        )}
      />

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>KILL BOARD</h1>
            <div style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 620 }}>
              Confirmed engagements across the fleet. Log every contact — kills, assists, and deaths count toward unit reputation.
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => {
            setForm({ engagement_type: 'PVP', outcome: 'KILL' }); setError(''); setModal(true)
          }}>+ LOG ENGAGEMENT</button>
        </div>

        <TabStrip
          active={tab} onChange={setTab}
          tabs={[
            { key: 'feed',        label: 'COMBAT FEED',  color: RED,       glyph: '◆', count: kills.length },
            { key: 'leaderboard', label: 'LEADERBOARD',  color: UEE_AMBER, glyph: '▲', count: leaderboard.length },
          ]}
        />
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING ARCHIVE...</div> : tab === 'feed' ? (
          <>
            {/* Stat strip */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 10, marginBottom: 18,
            }}>
              <StatCell label="KILLS"   value={killCount}   color={OUTCOME_META.KILL.color}   glyph="◉"
                onClick={() => setOutcomeFilter(outcomeFilter === 'KILL' ? 'ALL' : 'KILL')}
                active={outcomeFilter === 'KILL'} />
              <StatCell label="ASSISTS" value={assistCount} color={OUTCOME_META.ASSIST.color} glyph="◎"
                onClick={() => setOutcomeFilter(outcomeFilter === 'ASSIST' ? 'ALL' : 'ASSIST')}
                active={outcomeFilter === 'ASSIST'} />
              <StatCell label="DEATHS"  value={deathCount}  color={OUTCOME_META.DEATH.color}  glyph="✕"
                onClick={() => setOutcomeFilter(outcomeFilter === 'DEATH' ? 'ALL' : 'DEATH')}
                active={outcomeFilter === 'DEATH'} />
              <StatCell label="K/D RATIO" value={orgKD} color={UEE_AMBER} glyph="◆" desc="Organisation-wide" />
            </div>

            <FilterRow
              search={search} setSearch={setSearch}
              placeholder="Search target, org, ship, location, operative..."
              pills={[
                { key: 'ALL',    label: 'ALL',     color: '#d4d8e0', count: kills.length },
                { key: 'KILL',   label: 'KILLS',   color: OUTCOME_META.KILL.color,   glyph: '◉', count: killCount },
                { key: 'ASSIST', label: 'ASSISTS', color: OUTCOME_META.ASSIST.color, glyph: '◎', count: assistCount },
                { key: 'DEATH',  label: 'DEATHS',  color: OUTCOME_META.DEATH.color,  glyph: '✕', count: deathCount },
              ]}
              active={outcomeFilter} setActive={setOutcomeFilter}
            />

            {filteredFeed.length === 0 ? (
              <EmptyState>No engagements match — clear a filter or log the next one.</EmptyState>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredFeed.map(k => <KillRow key={k.id} kill={k} />)}
              </div>
            )}
          </>
        ) : (
          <LeaderboardView leaderboard={leaderboard} />
        )}
      </div>

      {modal && (
        <UeeModal
          accent={RED}
          kicker="◆ COMBAT REPORT · NEW ENTRY"
          title="LOG ENGAGEMENT"
          onClose={() => setModal(false)}
          maxWidth={640}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setModal(false)}>CANCEL</button>
              <button className="btn btn-primary" onClick={logKill} disabled={saving}>
                {saving ? 'LOGGING...' : 'LOG ENGAGEMENT'}
              </button>
            </>
          )}
        >
          {/* Outcome selector — big visual buttons */}
          <div className="form-group">
            <label className="form-label">OUTCOME</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {OUTCOMES.map(o => {
                const meta = OUTCOME_META[o]
                const sel = (form.outcome || 'KILL') === o
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, outcome: o }))}
                    style={{
                      textAlign: 'left', cursor: 'pointer',
                      background: sel ? `${meta.color}18` : 'var(--bg-raised)',
                      border: `1px solid ${sel ? meta.color : 'var(--border)'}`,
                      borderLeft: `3px solid ${meta.color}`,
                      borderRadius: 3, padding: '8px 10px',
                    }}
                  >
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.22em', fontWeight: 600,
                      color: meta.color, display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <span>{meta.glyph}</span> {o}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">TARGET NAME *</label>
              <input className="form-input" value={form.target_name || ''}
                onChange={e => setForm(f => ({ ...f, target_name: e.target.value }))}
                placeholder="Player or NPC name" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">TARGET ORG</label>
              <input className="form-input" value={form.target_org || ''}
                onChange={e => setForm(f => ({ ...f, target_org: e.target.value }))}
                placeholder="Org tag" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">YOUR SHIP</label>
              <input className="form-input" value={form.ship_used || ''}
                onChange={e => setForm(f => ({ ...f, ship_used: e.target.value }))}
                placeholder="Ship you were flying" />
            </div>
            <div className="form-group">
              <label className="form-label">TARGET SHIP</label>
              <input className="form-input" value={form.target_ship || ''}
                onChange={e => setForm(f => ({ ...f, target_ship: e.target.value }))}
                placeholder="What they were flying" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">LOCATION</label>
              <select className="form-select" value={form.location || ''}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}>
                <option value="">—</option>
                {SC_LOCATIONS.map(l => <option key={l.name} value={l.name}>{l.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">TYPE</label>
              <select className="form-select" value={form.engagement_type}
                onChange={e => setForm(f => ({ ...f, engagement_type: e.target.value }))}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">NOTES</label>
            <textarea className="form-textarea" value={form.notes || ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Combat details — tactics, wingmates, relevant context..." />
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
        </UeeModal>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
function KillRow({ kill }) {
  const meta = OUTCOME_META[kill.outcome] || OUTCOME_META.KILL
  const typeColor = TYPE_COLOR[kill.engagement_type] || 'var(--text-3)'
  return (
    <Card accent={meta.color}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <StatusBadge color={meta.color} glyph={meta.glyph} label={kill.outcome} />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em',
          color: typeColor, border: `1px solid ${typeColor}55`, padding: '2px 7px', borderRadius: 3,
        }}>{kill.engagement_type}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>
          {kill.reporter?.handle || '—'}
        </span>
        <span style={{ color: 'var(--text-3)', fontSize: 11 }}>vs</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: meta.color }}>
          {kill.target_name}
        </span>
        {kill.target_org && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', color: 'var(--text-3)' }}>
            [{kill.target_org}]
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', color: 'var(--text-3)' }}>
          {fmtDateTime(kill.created_at)}
        </span>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10,
        padding: '8px 10px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border)',
        borderRadius: 3,
      }}>
        <Field label="YOUR SHIP"  value={kill.ship_used || '—'}   mono />
        <Field label="TARGET SHIP" value={kill.target_ship || '—'} mono color={kill.target_ship ? meta.color : undefined} />
        <Field label="LOCATION"    value={kill.location || '—'} />
      </div>
      {kill.notes && (
        <div style={{
          fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5,
          padding: '8px 10px',
          borderLeft: `2px solid ${meta.color}55`,
          background: `${meta.color}08`,
          borderRadius: 2,
          whiteSpace: 'pre-wrap',
        }}>
          {kill.notes}
        </div>
      )}
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
function LeaderboardView({ leaderboard }) {
  if (leaderboard.length === 0) return <EmptyState>No combat data logged yet.</EmptyState>
  const top = leaderboard[0]
  return (
    <div>
      <SectionHeader label="FLEET LEADERBOARD" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
        {leaderboard.map((p, i) => {
          const kd = p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills > 0 ? '∞' : '—'
          const color = i === 0 ? UEE_AMBER : i < 3 ? '#5ce0a1' : 'var(--text-3)'
          const isTop = p.handle === top?.handle
          return (
            <Card key={p.handle} accent={color}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 700,
                  color, background: `${color}14`, border: `1px solid ${color}55`,
                  borderRadius: 3, fontSize: 13,
                }}>
                  #{i + 1}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>
                    {p.handle || '—'}
                    {isTop && <span style={{ marginLeft: 6, color: UEE_AMBER, fontSize: 11 }}>★</span>}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.15em', color: 'var(--text-3)' }}>
                    OPERATIVE
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: UEE_AMBER }}>
                  {kd}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <Field label="KILLS"   value={p.kills}   mono color={OUTCOME_META.KILL.color} />
                <Field label="ASSISTS" value={p.assists} mono color={OUTCOME_META.ASSIST.color} />
                <Field label="DEATHS"  value={p.deaths}  mono color={OUTCOME_META.DEATH.color} />
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
