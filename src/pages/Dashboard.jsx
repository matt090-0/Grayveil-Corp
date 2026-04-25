import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatCredits } from '../lib/ranks'
import RankBadge from '../components/RankBadge'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { confirmAction } from '../lib/dialogs'
import AnnualReportButton from '../components/AnnualReportButton'
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
  const [stats, setStats]       = useState({ members: 0, contracts: 0, fleet: 0, intel: 0 })
  const [announcements, setAnn] = useState([])
  const [myClaims, setMyClaims] = useState([])
  const [upcomingOps, setUpcomingOps] = useState([])
  const [eventSignups, setEventSignups] = useState([])
  const [activity, setActivity] = useState([])
  const [topRep, setTopRep]     = useState([])
  const [anniversaries, setAnniversaries] = useState([])
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
        supabase.from('activity_log').select('*, actor:profiles(handle)').order('created_at', { ascending: false }).limit(15),
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
      setLoading(false)
    }
    load()

    const channel = supabase.channel('dashboard-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, async (payload) => {
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
  }, [profile.id])

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

      <div className="page-body">
        {loading ? <div className="loading">LOADING SITREP...</div> : (
          <>
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
                        <XAxis dataKey="name" tick={{ fill: '#8a8f9c', fontSize: 9, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}
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
