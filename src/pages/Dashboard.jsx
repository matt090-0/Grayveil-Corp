import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatCredits } from '../lib/ranks'
import { timeAgo } from '../lib/dates'
import RankBadge from '../components/RankBadge'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { confirmAction } from '../lib/dialogs'

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1a1a24', border: '1px solid #333344', borderRadius: 6, padding: '6px 10px', fontSize: 11 }}>
      <div style={{ color: '#8888a0' }}>{label}</div>
      <div style={{ color: '#d4d8e0', fontWeight: 600 }}>{payload[0].value}</div>
    </div>
  )
}

const ACTION_LABELS = {
  contract_claimed:   { icon: '◆', verb: 'claimed contract' },
  contract_posted:    { icon: '◆', verb: 'posted contract' },
  contract_completed: { icon: '✓', verb: 'completed contract' },
  intel_filed:        { icon: '◍', verb: 'filed intel' },
  member_promoted:    { icon: '⬆', verb: 'was promoted' },
  member_joined:      { icon: '◐', verb: 'joined Grayveil' },
  fleet_added:        { icon: '◎', verb: 'registered vessel' },
  announcement_posted:{ icon: '◈', verb: 'posted announcement' },
  poll_created:       { icon: '◑', verb: 'created poll' },
}

export default function Dashboard() {
  const { profile } = useAuth()
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
      // Fetch top rep separately
      const { data: rep } = await supabase.from('profiles').select('handle, rep_score, avatar_color').eq('status', 'ACTIVE').order('rep_score', { ascending: false }).limit(5)
      setTopRep(rep || [])

      // Anniversaries — members hitting milestone days
      const { data: allMembers } = await supabase.from('profiles').select('id, handle, joined_at, avatar_color').eq('status', 'ACTIVE')
      const today = new Date()
      const milestones = [30, 90, 180, 365, 730]
      const anniv = []
      ;(allMembers || []).forEach(m => {
        const joined = new Date(m.joined_at)
        const daysAgo = Math.floor((today - joined) / 86400000)
        milestones.forEach(ms => {
          // Within last 7 days of hitting this milestone
          if (daysAgo >= ms && daysAgo < ms + 7) {
            anniv.push({ ...m, milestone: ms, daysAgo })
          }
        })
      })
      setAnniversaries(anniv.slice(0, 6))
      setLoading(false)
    }
    load()

    const channel = supabase.channel('dashboard-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, async (payload) => {
        const { data } = await supabase.from('activity_log').select('*, actor:profiles(handle)').eq('id', payload.new.id).maybeSingle()
        if (data) setActivity(prev => [data, ...prev.slice(0, 14)])
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, () => {
        supabase.from('announcements').select('*, posted_by:profiles(handle, tier)').order('created_at', { ascending: false }).limit(5).then(({ data }) => { if (data) setAnn(data) })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile.id])

  const initials = profile.handle.slice(0, 2).toUpperCase()
  const navigate = useNavigate()
  const isOfficer = profile.tier <= 4
  const mySignups = new Set(eventSignups.filter(s => s.member_id === profile.id).map(s => s.event_id))
  const opsIn72h = upcomingOps.filter(op => (new Date(op.starts_at) - Date.now()) <= 72 * 3600000).length

  function opBadge(status) {
    if (status === 'LIVE') return 'badge-green'
    if (status === 'SCHEDULED') return 'badge-blue'
    return 'badge-muted'
  }

  function opTiming(startsAt) {
    const diff = new Date(startsAt) - Date.now()
    if (diff <= 0) return 'NOW'
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    return `${minutes}m`
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="page-title">SITREP</div>
            <div className="page-subtitle">Situation Report — Grayveil Corporation</div>
          </div>
          <div className="flex items-center gap-12">
            <div className="avatar avatar-lg">{initials}</div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600 }}>{profile.handle}</div>
              <RankBadge tier={profile.tier} />
            </div>
          </div>
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING SITREP...</div> : (
          <>
            <div className="stat-grid">
              {[
                { label: 'ACTIVE MEMBERS', value: stats.members, sub: 'operatives registered' },
                { label: 'OPEN CONTRACTS', value: stats.contracts, sub: 'available for assignment', color: 'var(--accent)' },
                { label: 'FLEET STRENGTH', value: stats.fleet, sub: 'vessels on record' },
                { label: 'OPS NEXT 72H', value: opsIn72h, sub: 'scheduled mission tempo', color: opsIn72h > 0 ? 'var(--green)' : undefined },
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value" style={s.color ? { color: s.color } : {}}>{s.value}</div>
                  <div className="stat-sub">{s.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 20 }}>
              <div className="section-header">
                <div className="section-title">OPERATIONAL READINESS</div>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/events')}>OPEN BOARD</button>
              </div>
              {upcomingOps.length === 0 ? (
                <div className="empty-state" style={{ padding: '16px 0' }}>NO UPCOMING OPERATIONS</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {upcomingOps.slice(0, 3).map(op => {
                    const signups = eventSignups.filter(s => s.event_id === op.id)
                    const confirmed = signups.filter(s => s.status === 'CONFIRMED').length
                    const tentative = signups.filter(s => s.status === 'TENTATIVE').length
                    const remaining = op.max_slots ? Math.max(op.max_slots - confirmed, 0) : null
                    const needsCrew = remaining !== null && remaining > 0
                    return (
                      <div key={op.id} className="card" style={{ padding: 12, cursor: 'pointer' }} onClick={() => navigate('/events')}>
                        <div className="flex items-center gap-8 mb-4">
                          <span className={`badge ${opBadge(op.status)}`}>{op.status}</span>
                          <span className="badge badge-muted" style={{ fontSize: 9 }}>{op.event_type}</span>
                          {mySignups.has(op.id) && <span className="badge badge-accent" style={{ fontSize: 9 }}>RSVP&apos;D</span>}
                          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{opTiming(op.starts_at)}</span>
                        </div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{op.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>
                          {new Date(op.starts_at).toLocaleString()} {op.location ? `• ${op.location}` : ''}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
                          {confirmed} going{tentative > 0 ? ` • ${tentative} maybe` : ''}
                          {remaining !== null ? ` • ${remaining} slots open` : ''}
                          {needsCrew ? ' • NEED CREW' : ''}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            {isOfficer && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                  { label: '+ CONTRACT', to: '/contracts', icon: '◆' },
                  { label: '+ SCHEDULE OP', to: '/events', icon: '📅' },
                  { label: '+ FILE INTEL', to: '/intelligence', icon: '◍' },
                  { label: '+ LOG KILL', to: '/killboard', icon: '⚔' },
                  { label: '+ POST BOUNTY', to: '/bounties', icon: '✕' },
                  { label: '+ FILE AAR', to: '/aars', icon: '✓' },
                ].map(a => (
                  <button key={a.label} className="btn btn-ghost btn-sm" onClick={() => navigate(a.to)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{a.icon}</span> {a.label}
                  </button>
                ))}
              </div>
            )}

            <div className="grid-2" style={{ gap: 20 }}>
              <div>
                <div className="section-header"><div className="section-title">COMMAND TRANSMISSIONS</div></div>
                {announcements.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px 0' }}>NO TRANSMISSIONS</div>
                ) : announcements.map(a => (
                  <div key={a.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-8 mb-4">
                      <span className={`priority-dot ${a.priority?.toLowerCase()}`} />
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.1em' }}>{a.priority}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>{timeAgo(a.created_at)}</span>
                    </div>
                    <div style={{ fontWeight: 500, marginBottom: 4, fontSize: 13 }}>{a.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65 }}>{a.content}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>— {a.posted_by?.handle || 'UNKNOWN'}</div>
                  </div>
                ))}

                <div className="section-header" style={{ marginTop: 24 }}><div className="section-title">MY ACTIVE CONTRACTS</div></div>
                {myClaims.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px 0' }}>NO ACTIVE ASSIGNMENTS</div>
                ) : myClaims.map(c => (
                  <div key={c.id} className="contract-card mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{c.contract.title}</span>
                      <span className={`badge badge-${c.contract.status === 'ACTIVE' ? 'green' : 'amber'}`}>{c.contract.status}</span>
                    </div>
                    <div className="flex gap-16">
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.contract.contract_type}</span>
                      {c.contract.location && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{c.contract.location}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 6 }}>{formatCredits(c.contract.reward)}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="section-header">
                  <div className="section-title">ACTIVITY FEED</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {activity.length > 0 && profile.is_founder && (
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 9, padding: '2px 8px', color: 'var(--text-3)' }}
                        onClick={async () => {
                          if (!(await confirmAction('Clear entire activity feed?'))) return
                          await supabase.from('activity_log').delete().neq('id', '00000000-0000-0000-0000-000000000000')
                          setActivity([])
                        }}>CLEAR</button>
                    )}
                    <span style={{ fontSize: 10, color: 'var(--green)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em' }}>● LIVE</span>
                  </div>
                </div>
                {activity.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px 0' }}>NO RECENT ACTIVITY</div>
                ) : activity.map(a => {
                  const info = ACTION_LABELS[a.action] || { icon: '●', verb: a.action }
                  const det = a.details || {}
                  return (
                    <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ fontSize: 14, color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>{info.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                          <span style={{ fontWeight: 500 }}>{a.actor?.handle || 'System'}</span>{' '}
                          <span style={{ color: 'var(--text-2)' }}>{info.verb}</span>
                          {det.title && <span style={{ fontWeight: 500 }}> — {det.title}</span>}
                          {det.new_rank && <span style={{ color: 'var(--accent)' }}> → {det.new_rank}</span>}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{timeAgo(a.created_at)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Activity Chart */}
            {activity.length > 3 && (() => {
              const typeCounts = {}
              activity.forEach(a => {
                const label = (a.action || 'other').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
                typeCounts[label] = (typeCounts[label] || 0) + 1
              })
              const chartData = Object.entries(typeCounts).map(([name, count]) => ({ name: name.length > 16 ? name.slice(0, 14) + '…' : name, count })).sort((a, b) => b.count - a.count).slice(0, 8)
              return (
                <div style={{ marginTop: 20 }}>
                  <div className="section-header"><div className="section-title">ACTIVITY BREAKDOWN</div></div>
                  <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 16px 12px' }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData} margin={{ top: 20, right: 16, left: 0, bottom: 0 }} barCategoryGap="25%">
                        <XAxis dataKey="name" tick={{ fill: '#8a8f9c', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} axisLine={{ stroke: '#333344' }} tickLine={false} tickMargin={8} />
                        <YAxis tick={{ fill: '#555566', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(212,216,224,0.04)' }} />
                        <Bar dataKey="count" fill="#8ba7d4" radius={[4, 4, 0, 0]} maxBarSize={64} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            })()}

            {/* Anniversaries */}
            {anniversaries.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div className="section-header"><div className="section-title">MILESTONES THIS WEEK</div></div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {anniversaries.map(a => (
                    <div key={`${a.id}-${a.milestone}`} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'linear-gradient(135deg, rgba(212,216,224,0.08), rgba(212,216,224,0.03))',
                      border: '1px solid rgba(212,216,224,0.2)',
                      borderRadius: 8, padding: '8px 14px', flex: '1 1 auto', minWidth: 160,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        border: `1.5px solid ${a.avatar_color || '#d4d8e0'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: a.avatar_color || '#d4d8e0',
                      }}>{a.handle?.slice(0, 2).toUpperCase()}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{a.handle}</div>
                        <div style={{ fontSize: 9, color: 'var(--accent)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em' }}>
                          {a.milestone === 30 ? '1 MONTH' : a.milestone === 90 ? '3 MONTHS' : a.milestone === 180 ? '6 MONTHS' : a.milestone === 365 ? '1 YEAR' : '2 YEARS'}
                        </div>
                      </div>
                      <span style={{ fontSize: 18 }}>🎖</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rep Leaderboard */}
            {topRep.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div className="section-header"><div className="section-title">TOP REPUTATION</div></div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {topRep.map((m, i) => (
                    <div key={m.handle} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'var(--bg-raised)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '8px 14px', flex: '1 1 auto', minWidth: 140,
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
                        color: i === 0 ? 'var(--accent)' : 'var(--text-3)', width: 24,
                      }}>{i + 1}</span>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        border: `1.5px solid ${m.avatar_color || '#d4d8e0'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700, color: m.avatar_color || '#d4d8e0',
                      }}>{m.handle?.slice(0, 2).toUpperCase()}</div>
                      <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{m.handle}</span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--accent)' }}>{m.rep_score || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
