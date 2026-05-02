import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import { ClassificationBar, EmptyState, StatusBadge, fmtDateTime, timeUntil } from '../components/uee'
import { get501stConfig, is501stChosen, is501stUnlocked } from '../lib/fleet501st'

const ACCENT = '#7b66c8'
const DOCTRINE = [
  { code: 'GHOST ENTRY', brief: 'Silent insertion, comms discipline, zero signature at approach.' },
  { code: 'HARD SNAP', brief: 'Rapid objective pressure with synchronized strike windows.' },
  { code: 'COLD EXIT', brief: 'Clean disengage, no stragglers, no open-spectrum chatter.' },
]
const ASSETS = ['Aegis Vanguard', 'Anvil Arrow', 'Drake Cutlass Red', 'RSI Scorpius', 'MISC Freelancer MIS']

export default function Fleet501st() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [intelLoading, setIntelLoading] = useState(true)
  const [cellMembers, setCellMembers] = useState([])
  const [ops, setOps] = useState([])

  useEffect(() => {
    async function run() {
      const { config } = await get501stConfig()
      const chosen = is501stChosen(profile, config)
      const open = is501stUnlocked(profile)
      setAllowed(chosen)
      setUnlocked(open)
      setLoading(false)

      if (!chosen || !open) return
      setIntelLoading(true)

      const ids = [...(config?.memberIds || [])]
      const handles = [...(config?.handles || [])]
      let members = []

      if (ids.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, handle, rank, tier, status, last_seen_at, division, speciality')
          .in('id', ids)
        members = [...members, ...(data || [])]
      }
      if (handles.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, handle, rank, tier, status, last_seen_at, division, speciality')
          .in('handle', handles)
        members = [...members, ...(data || [])]
      }
      if (profile?.is_founder && config?.allowFounders) {
        members = [
          ...members,
          {
            id: profile.id,
            handle: profile.handle,
            rank: profile.rank,
            tier: profile.tier,
            status: profile.status,
            last_seen_at: profile.last_seen_at,
            division: profile.division,
            speciality: profile.speciality,
          },
        ]
      }

      const deduped = []
      const seen = new Set()
      members.forEach(m => {
        if (!m?.id || seen.has(m.id)) return
        seen.add(m.id)
        deduped.push(m)
      })
      deduped.sort((a, b) => a.tier - b.tier || a.handle.localeCompare(b.handle))
      setCellMembers(deduped)

      const { data: upcomingOps } = await supabase
        .from('events')
        .select('id, title, event_type, location, starts_at, status')
        .in('status', ['SCHEDULED', 'LIVE'])
        .order('starts_at', { ascending: true })
        .limit(5)
      setOps(upcomingOps || [])
      setIntelLoading(false)
    }
    run()
  }, [profile?.id])

  if (loading) return <div className="page-body"><div className="loading">AUTHORIZING 501ST ACCESS...</div></div>

  if (!allowed) {
    return (
      <div className="page-body">
        <EmptyState>ACCESS RESTRICTED — 501ST invitation required.</EmptyState>
      </div>
    )
  }

  if (!unlocked) {
    return (
      <div className="page-body">
        <EmptyState>CLEARANCE REQUIRED — click the Grayveil logo and enter your issued passcode.</EmptyState>
      </div>
    )
  }

  const activeCount = cellMembers.filter(m => m.status === 'ACTIVE').length
  const onlineCount = cellMembers.filter(m => m.last_seen_at && (Date.now() - new Date(m.last_seen_at).getTime()) < 5 * 60 * 1000).length
  const nextLaunch = ops.find(o => o.status !== 'LIVE')?.starts_at || null
  const liveOps = ops.filter(o => o.status === 'LIVE').length

  return (
    <>
      <ClassificationBar
        section="GRAYVEIL BLACK FLEET"
        label="501ST CELL"
        accent={ACCENT}
        right={
          <>
            <span>EYES ONLY</span>
            <span>CELL · {cellMembers.length || 0}</span>
            {liveOps > 0 && <span style={{ color: '#6fc29b' }}>LIVE OPS · {liveOps}</span>}
          </>
        }
      />
      <div className="page-header">
        <h1 className="page-title">THE 501ST</h1>
        <div className="page-subtitle">Grayveil black-cell strike wing for deniable, high-precision operations in Stanton and beyond.</div>
      </div>
      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <SecretStat label="CELL STATUS" value={intelLoading ? 'SYNCING' : 'ONLINE'} color="#6fc29b" />
          <SecretStat label="ACCESS LEVEL" value="BLACK" color={ACCENT} />
          <SecretStat label="OPERATORS ONLINE" value={intelLoading ? '—' : `${onlineCount}/${cellMembers.length || 0}`} color="#6e86ae" />
          <SecretStat label="NEXT LAUNCH" value={nextLaunch ? timeUntil(nextLaunch) : 'STANDBY'} color="#b89d6d" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 12, marginTop: 14 }}>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em', color: ACCENT }}>BLACK FLEET DIRECTIVE</div>
              <StatusBadge color={ACCENT} glyph="◆" label="501ST" />
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-2)' }}>
              The 501st executes high-sensitivity operations where command discretion is mandatory.
              Mission profile favors precision strikes, convoy interdiction, black-box recoveries, and rapid exfil.
              Keep this channel compartmentalized. No external references. No open-board chatter.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/events')}>OPEN OPS BOARD</button>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/messages')}>SECURE COMMS</button>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/roster')}>ROSTER LINK</button>
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em', color: '#b89d6d', marginBottom: 8 }}>
              CELL READINESS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <MiniReadout label="ACTIVE" value={activeCount} tone="#6fc29b" />
              <MiniReadout label="LIVE OPS" value={liveOps} tone={liveOps > 0 ? '#6fc29b' : 'var(--text-2)'} />
              <MiniReadout label="ASSET PACKAGE" value={ASSETS.length} tone={ACCENT} />
              <MiniReadout label="DOCTRINE NODES" value={DOCTRINE.length} tone="#b89d6d" />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em', color: '#6e86ae', marginBottom: 8 }}>MISSION SLATE</div>
            {ops.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>No active operations in queue.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ops.map(op => (
                  <div key={op.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', background: 'var(--bg-surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{op.title}</div>
                      <StatusBadge color={op.status === 'LIVE' ? '#6fc29b' : '#6e86ae'} label={op.status} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                      {op.event_type} · {op.location || 'TBD'} · {fmtDateTime(op.starts_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em', color: ACCENT, marginBottom: 8 }}>STRIKE DOCTRINE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {DOCTRINE.map(node => (
                <div key={node.code} style={{ borderLeft: `2px solid ${ACCENT}`, paddingLeft: 8 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', color: ACCENT }}>{node.code}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{node.brief}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              Preferred theaters: Crusader perimeter · Yela belt · Pyro relay lanes
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 12, padding: 14 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em', color: '#6fc29b', marginBottom: 8 }}>
            501ST OPERATIVE ROSTER
          </div>
          {intelLoading ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Syncing chosen operator roster...</div>
          ) : cellMembers.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
              No chosen members configured yet. Add `member_ids` or `handles` in `org_settings` for `fleet_501st_members`.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {cellMembers.map(m => (
                <div key={m.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 9, background: 'var(--bg-surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600 }}>{m.handle}</div>
                    <StatusBadge color={m.status === 'ACTIVE' ? '#6fc29b' : '#b89d6d'} label={m.status || 'ACTIVE'} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 3 }}>
                    {m.rank || 'OPERATIVE'} · T{m.tier} · {m.speciality || 'UNSPEC'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function SecretStat({ label, value, color }) {
  return (
    <div className="card" style={{ padding: 12, borderLeft: `2px solid ${color}` }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.16em', color: 'var(--text-3)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginTop: 4, color }}>{value}</div>
    </div>
  )
}

function MiniReadout({ label, value, tone }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8, background: 'var(--bg-surface)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)', letterSpacing: '.12em' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: tone, marginTop: 2 }}>{value}</div>
    </div>
  )
}

