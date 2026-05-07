import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatCredits } from '../lib/ranks'
import RankBadge from '../components/RankBadge'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { confirmAction } from '../lib/dialogs'
import AnnualReportButton from '../components/AnnualReportButton'
import PromotionChecklist from '../components/PromotionChecklist'

// ─────────────────────────────────────────────────────────────
// RecruitHero — only renders for tier-9 members. Pairs a "welcome"
// panel (intro + quick-action chips) with the promotion checklist
// so a recruit hits a clear, single-screen onboarding view.
// ─────────────────────────────────────────────────────────────
function RecruitHero({ profile, navigate }) {
  const Chip = ({ to, children }) => (
    <button
      onClick={() => navigate(to)}
      className="h-accent-edge"
      style={{
        background: 'transparent', color: 'var(--text-1)',
        border: '1px solid var(--border-md)', borderRadius: 2,
        padding: '8px 14px', fontSize: 12, fontWeight: 500,
        fontFamily: 'Inter, sans-serif', letterSpacing: '-0.005em',
        cursor: 'pointer', transition: 'border-color .15s, color .15s',
      }}
    >{children}</button>
  )
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
      gap: 14, marginBottom: 24,
    }}>
      {/* Welcome panel */}
      <div style={{
        padding: '22px 22px',
        border: '1px solid var(--border-md)',
        background: 'var(--bg-surface)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Tan accent stripe down the left edge — flags this as the recruit-only block */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          background: 'var(--accent)',
        }} />
        <div style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
          letterSpacing: '.28em', color: 'var(--accent)',
          textTransform: 'uppercase', marginBottom: 10,
        }}>WELCOME ABOARD</div>
        <div style={{
          fontFamily: 'Inter Tight, sans-serif', fontSize: 22,
          fontWeight: 700, letterSpacing: '-0.02em',
          color: 'var(--text-1)', marginBottom: 10,
        }}>You're a Recruit.</div>
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 13.5,
          color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 18,
        }}>
          Standard access to ops, contracts, intel filing, and the wiki.
          Clear the four checks on the right to become eligible for promotion
          to Ensign — an officer will action it once you're ready.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip to="/profile">Set up profile →</Chip>
          <Chip to="/wiki">Read the SOP →</Chip>
          <Chip to="/intelligence">File intel →</Chip>
          <Chip to="/contracts">Browse contracts →</Chip>
        </div>
      </div>

      {/* Promotion checklist */}
      <PromotionChecklist profile={profile} />
    </div>
  )
}
import {
  UEE_AMBER, ClassificationBar, StatCell, Card,
  StatusBadge, EmptyState, SectionHeader,
  timeAgo, fmtDateTime, timeUntil,
} from '../components/uee'

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#0e0f14', border: `1px solid ${UEE_AMBER}55`, borderRadius: 3,
      padding: '6px 10px', fontSize: 11,
      fontFamily: 'var(--font-mono)', letterSpacing: '.05em',
    }}>
      <div style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: '.18em' }}>{label}</div>
      <div style={{ color: UEE_AMBER, fontWeight: 600 }}>{payload[0].value}</div>
    </div>
  )
}

const ACTION_LABELS = {
  contract_claimed:    { glyph: '◆', verb: 'claimed contract',  color: '#5a80d9' },
  contract_posted:     { glyph: '◆', verb: 'posted contract',   color: UEE_AMBER },
  contract_completed:  { glyph: '✓', verb: 'completed contract', color: '#5ce0a1' },
  intel_filed:         { glyph: '◍', verb: 'filed intel',        color: '#b566d9' },
  member_promoted:     { glyph: '⬆', verb: 'was promoted',       color: '#5ce0a1' },
  member_joined:       { glyph: '◐', verb: 'joined Grayveil',    color: UEE_AMBER },
  fleet_added:         { glyph: '◎', verb: 'registered vessel',  color: '#5a80d9' },
  announcement_posted: { glyph: '◈', verb: 'posted transmission', color: UEE_AMBER },
  poll_created:        { glyph: '◑', verb: 'created poll',       color: '#5a80d9' },
  event_created:       { glyph: '◉', verb: 'scheduled op',       color: '#5a80d9' },
  bounty_posted:       { glyph: '✕', verb: 'posted bounty',      color: '#e05c5c' },
  kill_logged:         { glyph: '⚔', verb: 'logged engagement',  color: '#e05c5c' },
  aar_filed:           { glyph: '✓', verb: 'filed AAR',          color: '#5ce0a1' },
}

const PRIORITY_META = {
  CRITICAL: { color: '#e05c5c', glyph: '⬢' },
  HIGH:     { color: UEE_AMBER, glyph: '◉' },
  MEDIUM:   { color: '#5a80d9', glyph: '◆' },
  LOW:      { color: '#9099a8', glyph: '○' },
}

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // ── RECRUIT-VIEW PREVIEW (founder-only) ──
  // Lets the founder see what tier-9 members see without being demoted.
  // URL flag + is_founder gate; `?preview=recruit` is honored only for
  // the founder so a copy-pasted link can't trick a regular member.
  const isFounder = !!profile.is_founder
  const previewRecruit = isFounder && searchParams.get('preview') === 'recruit'
  function togglePreviewRecruit() {
    const next = new URLSearchParams(searchParams)
    if (previewRecruit) next.delete('preview')
    else next.set('preview', 'recruit')
    setSearchParams(next, { replace: true })
  }
  const showRecruitHero = profile.tier === 9 || previewRecruit

  const canViewGlobalActivity = profile.tier <= 4
  const [stats, setStats]       = useState({ members: 0, contracts: 0, fleet: 0, intel: 0 })
  const [announcements, setAnn] = useState([])
  const [myClaims, setMyClaims] = useState([])
  const [upcomingOps, setUpcomingOps] = useState([])
  const [eventSignups, setEventSignups] = useState([])
  const [activity, setActivity] = useState([])
  const [topRep, setTopRep]     = useState([])
  const [anniversaries, setAnniversaries] = useState([])
  // Officers see a callout when recruits hit 4/4 — computed in load() below.
  const [readyRecruits, setReadyRecruits] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const [
        { count: members }, { count: contracts }, { count: fleet }, { count: intel },
        { data: ann }, { data: claims }, { data: act }, { data: ops }, { data: signups },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'OPEN'),
        supabase.from('fleet').select('*', { count: 'exact', head: true }),
        supabase.from('intelligence').select('*', { count: 'exact', head: true }),
        supabase.from('announcements').select('*, posted_by:profiles(handle, tier)').order('created_at', { ascending: false }).limit(5),
        supabase.from('contract_claims').select('*, contract:contracts(id, title, contract_type, status, reward, location)').eq('member_id', profile.id).limit(5),
        (canViewGlobalActivity
          ? supabase.from('activity_log').select('*, actor:profiles(handle)').order('created_at', { ascending: false }).limit(15)
          : supabase.from('activity_log').select('*, actor:profiles(handle)').eq('actor_id', profile.id).order('created_at', { ascending: false }).limit(15)),
        supabase.from('events').select('id, title, starts_at, location, status, event_type, max_slots').in('status', ['SCHEDULED', 'LIVE']).order('starts_at', { ascending: true }).limit(6),
        supabase.from('event_signups').select('event_id, member_id, status'),
      ])
      setStats({ members: members||0, contracts: contracts||0, fleet: fleet||0, intel: intel||0 })
      setAnn(ann || [])
      setMyClaims(claims?.filter(c => c.contract?.status !== 'COMPLETE') || [])
      setActivity(act || [])
      setUpcomingOps((ops || []).filter(op => new Date(op.starts_at) >= new Date()))
      setEventSignups(signups || [])

      const { data: rep } = await supabase.from('profiles')
        .select('handle, rep_score, avatar_color').eq('status', 'ACTIVE')
        .order('rep_score', { ascending: false }).limit(5)
      setTopRep(rep || [])

      const { data: allMembers } = await supabase.from('profiles')
        .select('id, handle, joined_at, avatar_color').eq('status', 'ACTIVE')
      const today = new Date()
      const milestones = [30, 90, 180, 365, 730]
      const anniv = []
      ;(allMembers || []).forEach(m => {
        const joined = new Date(m.joined_at)
        const daysAgo = Math.floor((today - joined) / 86400000)
        milestones.forEach(ms => {
          if (daysAgo >= ms && daysAgo < ms + 7) anniv.push({ ...m, milestone: ms, daysAgo })
        })
      })
      setAnniversaries(anniv.slice(0, 6))

      // Officer callout: tier-9 recruits who've cleared all 4 promotion
      // criteria. Two scoped queries (intel + claims filtered by recruit
      // ids) so we don't pull the whole tables. Skipped for non-officers.
      if (profile.tier <= 4) {
        const { data: r9 } = await supabase.from('profiles')
          .select('id, handle, division, speciality, bio, joined_at, avatar_color')
          .eq('status', 'ACTIVE').eq('tier', 9)
        const r9Ids = (r9 || []).map(r => r.id)
        if (r9Ids.length === 0) {
          setReadyRecruits([])
        } else {
          const [{ data: intelRows }, { data: claimRows }] = await Promise.all([
            supabase.from('intelligence').select('posted_by').in('posted_by', r9Ids),
            supabase.from('contract_claims').select('claimed_by').in('claimed_by', r9Ids),
          ])
          const intelByUser = (intelRows || []).reduce((acc, x) => { acc[x.posted_by] = (acc[x.posted_by] || 0) + 1; return acc }, {})
          const claimsByUser = (claimRows || []).reduce((acc, x) => { acc[x.claimed_by] = (acc[x.claimed_by] || 0) + 1; return acc }, {})
          const ready = (r9 || []).filter(r => {
            if (!(r.division && r.speciality && r.bio)) return false
            const tenure = Math.floor((Date.now() - new Date(r.joined_at).getTime()) / 86400000)
            if (tenure < 7) return false
            if ((intelByUser[r.id]  || 0) < 1) return false
            if ((claimsByUser[r.id] || 0) < 1) return false
            return true
          })
          setReadyRecruits(ready)
        }
      }

      setLoading(false)
    }
    load()

    const channel = supabase.channel('dashboard-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, async (payload) => {
        if (!canViewGlobalActivity && payload.new.actor_id !== profile.id) return
        const { data } = await supabase.from('activity_log')
          .select('*, actor:profiles(handle)').eq('id', payload.new.id).maybeSingle()
        if (data) setActivity(prev => [data, ...prev.slice(0, 14)])
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, () => {
        supabase.from('announcements')
          .select('*, posted_by:profiles(handle, tier)')
          .order('created_at', { ascending: false }).limit(5)
          .then(({ data }) => { if (data) setAnn(data) })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile.id, canViewGlobalActivity])

  const isOfficer = profile.tier <= 4
  const mySignups = new Set(eventSignups.filter(s => s.member_id === profile.id).map(s => s.event_id))
  const opsIn72h = upcomingOps.filter(op => (new Date(op.starts_at) - Date.now()) <= 72 * 3600000).length
  const liveOps = upcomingOps.filter(op => op.status === 'LIVE').length
  const initials = profile.handle.slice(0, 2).toUpperCase()

  return (
    <>
      <ClassificationBar
        section="GRAYVEIL CORPORATION · SITREP"
        label={`OPERATIVE ${profile.handle.toUpperCase()}`}
        right={(
          <>
            <span>T-{profile.tier}</span>
            <span style={{ color: liveOps > 0 ? '#5ce0a1' : 'var(--text-3)' }}>
              {liveOps > 0 ? `LIVE OPS · ${liveOps}` : 'STANDING DOWN'}
            </span>
            <span>{new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase()}</span>
          </>
        )}
      />

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>SITUATION REPORT</h1>
            <div style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 640 }}>
              Live snapshot of corporation tempo — open contracts, scheduled ops, command transmissions, recent activity.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Founder-only: toggle the recruit-view preview. Hidden for everyone else. */}
            {isFounder && (
              <button
                onClick={togglePreviewRecruit}
                title={previewRecruit ? 'Return to your normal Dashboard view' : 'Render the tier-9 recruit Dashboard for testing'}
                style={{
                  background: previewRecruit ? 'var(--accent)' : 'transparent',
                  color: previewRecruit ? '#0a0a0c' : 'var(--text-2)',
                  border: previewRecruit ? 'none' : '1px dashed var(--border-md)',
                  borderRadius: 2,
                  padding: '7px 12px',
                  fontSize: 10, fontWeight: 600, letterSpacing: '.18em',
                  fontFamily: 'JetBrains Mono, monospace',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'background .15s, color .15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {previewRecruit ? '✕ EXIT PREVIEW' : '◇ PREVIEW RECRUIT'}
              </button>
            )}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 12px',
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              borderLeft: `3px solid ${UEE_AMBER}`,
              borderRadius: 3,
            }}>
              <div className="avatar avatar-lg" style={{ width: 38, height: 38 }}>{initials}</div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600 }}>{profile.handle}</div>
                <RankBadge tier={profile.tier} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING SITREP...</div> : (
          <>
            {/* RECRUIT ONBOARDING — tier 9, or founder preview */}
            {showRecruitHero && (
              <>
                {previewRecruit && (
                  <div style={{
                    marginBottom: 12, padding: '8px 14px',
                    border: '1px dashed var(--accent)',
                    background: 'var(--accent-dim)',
                    color: 'var(--accent)',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 10, letterSpacing: '.24em',
                    textTransform: 'uppercase',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                  }}>
                    <span>● PREVIEW MODE — RENDERING TIER-9 RECRUIT VIEW</span>
                    <span style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: '.2em' }}>
                      Visible only to founder · click EXIT PREVIEW to return
                    </span>
                  </div>
                )}
                <RecruitHero profile={profile} navigate={navigate} />
              </>
            )}

            {/* OFFICER CALLOUT — recruits ready for promotion */}
            {!previewRecruit && profile.tier <= 4 && readyRecruits.length > 0 && (
              <div style={{
                marginBottom: 20,
                padding: '18px 22px',
                border: '1px solid var(--accent)',
                borderLeft: '3px solid var(--accent)',
                background: 'var(--accent-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 16, flexWrap: 'wrap',
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                    letterSpacing: '.28em', color: 'var(--accent)',
                    textTransform: 'uppercase', marginBottom: 6,
                  }}>● PROMOTION QUEUE</div>
                  <div style={{
                    fontFamily: 'Inter Tight, sans-serif',
                    fontSize: 17, fontWeight: 700,
                    color: 'var(--text-1)', letterSpacing: '-0.01em',
                    marginBottom: 4,
                  }}>
                    {readyRecruits.length} recruit{readyRecruits.length === 1 ? ' is' : 's are'} ready for promotion to Ensign.
                  </div>
                  <div style={{
                    fontFamily: 'Inter, sans-serif', fontSize: 13,
                    color: 'var(--text-2)', lineHeight: 1.5,
                  }}>
                    {readyRecruits.slice(0, 3).map(r => r.handle).join(' · ')}
                    {readyRecruits.length > 3 && ` · +${readyRecruits.length - 3} more`}
                  </div>
                </div>
                <button
                  onClick={() => navigate('/recruitment?tab=recruits')}
                  className="h-accent-bg"
                  style={{
                    background: 'var(--accent)', color: '#0a0a0c', border: 'none', borderRadius: 2,
                    padding: '10px 18px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
                    fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase',
                    cursor: 'pointer', transition: 'background .15s', whiteSpace: 'nowrap',
                  }}
                >Review Roster →</button>
              </div>
            )}

            {/* STAT GRID */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 10, marginBottom: 20,
            }}>
              <StatCell label="ACTIVE MEMBERS" value={stats.members}   color={UEE_AMBER}    glyph="◆" desc="operatives registered"
                onClick={() => navigate('/roster')} />
              <StatCell label="OPEN CONTRACTS" value={stats.contracts} color="#5a80d9"      glyph="◉" desc="available for assignment"
                onClick={() => navigate('/contracts')} />
              <StatCell label="FLEET STRENGTH" value={stats.fleet}     color="#9099a8"      glyph="◎" desc="vessels on record"
                onClick={() => navigate('/fleet')} />
              <StatCell label="OPS NEXT 72H"   value={opsIn72h}        color={opsIn72h > 0 ? '#5ce0a1' : '#9099a8'} glyph="⬢" desc="scheduled mission tempo"
                onClick={() => navigate('/events')} />
            </div>

            {/* OPERATIONAL READINESS */}
            <div style={{ marginBottom: 22 }}>
              <SectionHeader label="OPERATIONAL READINESS" color="#5a80d9">
                <button
                  onClick={() => navigate('/events')}
                  style={{
                    background: 'transparent', border: 'none',
                    color: '#5a80d9', cursor: 'pointer',
                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.2em',
                  }}>
                  OPEN BOARD →
                </button>
              </SectionHeader>
              {upcomingOps.length === 0 ? (
                <EmptyState>NO UPCOMING OPERATIONS</EmptyState>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: 10,
                }}>
                  {upcomingOps.slice(0, 3).map(op => {
                    const ss = eventSignups.filter(s => s.event_id === op.id)
                    const confirmed = ss.filter(s => s.status === 'CONFIRMED').length
                    const tentative = ss.filter(s => s.status === 'TENTATIVE').length
                    const remaining = op.max_slots ? Math.max(op.max_slots - confirmed, 0) : null
                    const isLive = op.status === 'LIVE'
                    const accent = isLive ? '#5ce0a1' : '#5a80d9'
                    return (
                      <Card key={op.id} accent={accent} onClick={() => navigate('/events')} minHeight={120}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>
                              {op.title}
                            </div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                              <span style={{
                                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em',
                                color: 'var(--text-3)', border: '1px solid var(--border)',
                                padding: '1px 6px', borderRadius: 3,
                              }}>{op.event_type}</span>
                              {mySignups.has(op.id) && <StatusBadge color="#5ce0a1" glyph="◆" label="ROSTERED" />}
                            </div>
                          </div>
                          <StatusBadge color={accent} glyph={isLive ? '⬢' : '◉'} label={isLive ? 'LIVE' : timeUntil(op.starts_at)} />
                        </div>
                        <div style={{ flex: 1 }} />
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', gap: 8,
                          paddingTop: 6, borderTop: '1px dashed var(--border)',
                          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em',
                          color: 'var(--text-3)',
                        }}>
                          <span>{fmtDateTime(op.starts_at)}{op.location ? ` · ${op.location.toUpperCase()}` : ''}</span>
                          <span>
                            <span style={{ color: confirmed > 0 ? '#5ce0a1' : 'var(--text-3)' }}>{confirmed}</span>
                            {op.max_slots ? `/${op.max_slots}` : ''}
                            {tentative > 0 && <span style={{ color: UEE_AMBER }}> · {tentative}M</span>}
                            {remaining !== null && remaining > 0 && remaining <= 2 && <span style={{ color: '#e05c5c' }}> · {remaining} LEFT</span>}
                          </span>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>

            {/* QUICK ACTIONS */}
            {isOfficer && (
              <div style={{
                display: 'flex', gap: 6, marginBottom: 22, flexWrap: 'wrap',
                padding: '10px 12px',
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                borderLeft: `3px solid ${UEE_AMBER}`,
                borderRadius: 3,
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em',
                  color: UEE_AMBER, alignSelf: 'center', marginRight: 6,
                }}>◆ OFFICER ACTIONS ·</span>
                {[
                  { label: 'CONTRACT', to: '/contracts',   color: UEE_AMBER },
                  { label: 'OP',       to: '/events',      color: '#5a80d9' },
                  { label: 'INTEL',    to: '/intelligence', color: '#b566d9' },
                  { label: 'KILL',     to: '/killboard',   color: '#e05c5c' },
                  { label: 'BOUNTY',   to: '/bounties',    color: '#e05c5c' },
                  { label: 'AAR',      to: '/aars',        color: '#5ce0a1' },
                ].map(a => (
                  <button
                    key={a.label}
                    onClick={() => navigate(a.to)}
                    style={{
                      background: `${a.color}10`,
                      border: `1px solid ${a.color}55`,
                      color: a.color,
                      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', fontWeight: 600,
                      padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
                    }}
                  >+ {a.label}</button>
                ))}
                <span style={{ flex: 1 }} />
                <AnnualReportButton />
              </div>
            )}

            {/* TWO-COL: TRANSMISSIONS+CLAIMS / ACTIVITY */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: 20,
            }}>
              {/* LEFT: COMMAND TRANSMISSIONS + MY CONTRACTS */}
              <div>
                <SectionHeader label="COMMAND TRANSMISSIONS" />
                {announcements.length === 0 ? (
                  <EmptyState>NO TRANSMISSIONS</EmptyState>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                    {announcements.map(a => {
                      const pm = PRIORITY_META[a.priority] || PRIORITY_META.MEDIUM
                      return (
                        <Card key={a.id} accent={pm.color}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                            <StatusBadge color={pm.color} glyph={pm.glyph} label={a.priority || 'MEDIUM'} />
                            <span style={{
                              fontSize: 10, color: 'var(--text-3)',
                              fontFamily: 'var(--font-mono)', letterSpacing: '.1em',
                            }}>{timeAgo(a.created_at)}</span>
                          </div>
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: 'var(--text-1)' }}>
                            {a.title}
                          </div>
                          <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                            {a.content}
                          </div>
                          <div style={{
                            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em',
                            color: 'var(--text-3)', paddingTop: 4,
                            borderTop: '1px dashed var(--border)',
                          }}>
                            — {(a.posted_by?.handle || 'UNKNOWN').toUpperCase()}
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}

                <SectionHeader label="MY ACTIVE CONTRACTS" color="#5a80d9" />
                {myClaims.length === 0 ? (
                  <EmptyState>NO ACTIVE ASSIGNMENTS</EmptyState>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {myClaims.map(c => {
                      const accent = c.contract.status === 'ACTIVE' ? UEE_AMBER : '#5ce0a1'
                      return (
                        <Card key={c.id} accent={accent} onClick={() => navigate('/contracts')}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13.5 }}>
                              {c.contract.title}
                            </span>
                            <StatusBadge color={accent} glyph={c.contract.status === 'ACTIVE' ? '◎' : '◉'} label={c.contract.status} />
                          </div>
                          <div style={{
                            display: 'flex', justifyContent: 'space-between', gap: 8,
                            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em',
                            color: 'var(--text-3)',
                          }}>
                            <span>{c.contract.contract_type}{c.contract.location ? ` · ${c.contract.location.toUpperCase()}` : ''}</span>
                            <span style={{ color: UEE_AMBER, fontWeight: 600 }}>{formatCredits(c.contract.reward)}</span>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* RIGHT: ACTIVITY FEED */}
              <div>
                <SectionHeader label="ACTIVITY FEED">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {activity.length > 0 && profile.is_founder && (
                      <button
                        onClick={async () => {
                          if (!(await confirmAction('Clear entire activity feed?'))) return
                          await supabase.from('activity_log').delete().neq('id', '00000000-0000-0000-0000-000000000000')
                          setActivity([])
                        }}
                        style={{
                          background: 'transparent', border: 'none',
                          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.2em',
                          color: 'var(--text-3)', cursor: 'pointer',
                        }}>
                        CLEAR
                      </button>
                    )}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 9, color: '#5ce0a1',
                      fontFamily: 'var(--font-mono)', letterSpacing: '.2em',
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', background: '#5ce0a1',
                        boxShadow: '0 0 6px #5ce0a1',
                        animation: 'pulse 2s ease-in-out infinite',
                      }} />
                      LIVE
                    </span>
                  </div>
                </SectionHeader>
                {activity.length === 0 ? (
                  <EmptyState>NO RECENT ACTIVITY</EmptyState>
                ) : (
                  <div style={{
                    background: 'var(--bg-raised)', border: '1px solid var(--border)',
                    borderRadius: 3, padding: '4px 12px',
                  }}>
                    {activity.map(a => {
                      const info = ACTION_LABELS[a.action] || { glyph: '●', verb: a.action.replace(/_/g, ' '), color: 'var(--text-3)' }
                      const det = a.details || {}
                      return (
                        <div key={a.id} style={{
                          padding: '8px 0', borderBottom: '1px solid var(--border)',
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                        }}>
                          <span style={{
                            fontSize: 13, color: info.color, flexShrink: 0, marginTop: 1,
                            width: 16, textAlign: 'center',
                          }}>{info.glyph}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{a.actor?.handle || 'System'}</span>{' '}
                              <span style={{ color: 'var(--text-2)' }}>{info.verb}</span>
                              {det.title && <span style={{ fontWeight: 500, color: info.color }}> — {det.title}</span>}
                              {det.new_rank && <span style={{ color: UEE_AMBER }}> → {det.new_rank}</span>}
                            </div>
                            <div style={{
                              fontSize: 9, color: 'var(--text-3)',
                              fontFamily: 'var(--font-mono)', letterSpacing: '.15em', marginTop: 2,
                            }}>{timeAgo(a.created_at)}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ACTIVITY CHART */}
            {activity.length > 3 && (() => {
              const typeCounts = {}
              activity.forEach(a => {
                const label = (a.action || 'other').replace(/_/g, ' ').toUpperCase()
                typeCounts[label] = (typeCounts[label] || 0) + 1
              })
              const chartData = Object.entries(typeCounts)
                .map(([name, count]) => ({ name: name.length > 14 ? name.slice(0, 12) + '…' : name, count }))
                .sort((a, b) => b.count - a.count).slice(0, 8)
              return (
                <div style={{ marginTop: 24 }}>
                  <SectionHeader label="ACTIVITY BREAKDOWN" />
                  <div style={{
                    background: 'var(--bg-raised)', border: '1px solid var(--border)',
                    borderLeft: `3px solid ${UEE_AMBER}`,
                    borderRadius: 3, padding: '20px 16px 12px',
                  }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData} margin={{ top: 20, right: 16, left: 0, bottom: 0 }} barCategoryGap="25%">
                        <XAxis dataKey="name" tick={{ fill: '#8a8478', fontSize: 9, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}
                          axisLine={{ stroke: '#333344' }} tickLine={false} tickMargin={8} />
                        <YAxis tick={{ fill: '#555566', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
                          axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(200,165,90,0.06)' }} />
                        <Bar dataKey="count" fill={UEE_AMBER} radius={[2, 2, 0, 0]} maxBarSize={60} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            })()}

            {/* ANNIVERSARIES */}
            {anniversaries.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <SectionHeader label="MILESTONES THIS WEEK" color="#5ce0a1" />
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 8,
                }}>
                  {anniversaries.map(a => (
                    <div key={`${a.id}-${a.milestone}`} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border)',
                      borderLeft: `3px solid ${UEE_AMBER}`,
                      borderRadius: 3, padding: '8px 12px',
                    }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        border: `1.5px solid ${a.avatar_color || UEE_AMBER}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: a.avatar_color || UEE_AMBER,
                        flexShrink: 0,
                      }}>{a.handle?.slice(0, 2).toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-1)' }}>{a.handle}</div>
                        <div style={{
                          fontSize: 9, color: UEE_AMBER, fontFamily: 'var(--font-mono)',
                          letterSpacing: '.18em', fontWeight: 600,
                        }}>
                          {a.milestone === 30 ? '◆ 1 MONTH' : a.milestone === 90 ? '◆ 3 MONTHS' : a.milestone === 180 ? '◆ 6 MONTHS' : a.milestone === 365 ? '✦ 1 YEAR' : '✦ 2 YEARS'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TOP REP */}
            {topRep.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <SectionHeader label="REPUTATION LEADERBOARD" color={UEE_AMBER} />
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 8,
                }}>
                  {topRep.map((m, i) => {
                    const accent = i === 0 ? UEE_AMBER : i < 3 ? '#5ce0a1' : '#9099a8'
                    return (
                      <div key={m.handle} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: 'var(--bg-raised)',
                        border: '1px solid var(--border)',
                        borderLeft: `3px solid ${accent}`,
                        borderRadius: 3, padding: '8px 12px',
                      }}>
                        <span style={{
                          fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
                          color: accent, width: 22, lineHeight: 1, flexShrink: 0,
                        }}>{i + 1}</span>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%',
                          border: `1.5px solid ${m.avatar_color || UEE_AMBER}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 700, color: m.avatar_color || UEE_AMBER,
                          flexShrink: 0,
                        }}>{m.handle?.slice(0, 2).toUpperCase()}</div>
                        <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1, minWidth: 0,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{m.handle}</span>
                        <span style={{
                          fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
                          color: accent, flexShrink: 0,
                        }}>{m.rep_score || 0}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
