import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatCredits, getRankByTier } from '../lib/ranks'
import { timeAgo } from '../lib/dates'
import RankBadge from '../components/RankBadge'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts'

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1a1a24', border: '1px solid #333344', borderRadius: 6, padding: '6px 10px', fontSize: 11 }}>
      <div style={{ color: '#8888a0' }}>{label}</div>
      <div style={{ color: '#c8a55a', fontWeight: 600 }}>{payload[0].value}</div>
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
  const [activity, setActivity] = useState([])
  const [topRep, setTopRep]     = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const [
        { count: members }, { count: contracts }, { count: fleet }, { count: intel },
        { data: ann }, { data: claims }, { data: act },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'OPEN'),
        supabase.from('fleet').select('*', { count: 'exact', head: true }),
        supabase.from('intelligence').select('*', { count: 'exact', head: true }),
        supabase.from('announcements').select('*, posted_by:profiles(handle, tier)').order('created_at', { ascending: false }).limit(5),
        supabase.from('contract_claims').select('*, contract:contracts(id, title, contract_type, status, reward, location)').eq('member_id', profile.id).limit(5),
        supabase.from('activity_log').select('*, actor:profiles(handle)').order('created_at', { ascending: false }).limit(15),
      ])
      setStats({ members: members||0, contracts: contracts||0, fleet: fleet||0, intel: intel||0 })
      setAnn(ann || [])
      setMyClaims(claims?.filter(c => c.contract?.status !== 'COMPLETE') || [])
      setActivity(act || [])
      // Fetch top rep separately
      const { data: rep } = await supabase.from('profiles').select('handle, rep_score, avatar_color').eq('status', 'ACTIVE').order('rep_score', { ascending: false }).limit(5)
      setTopRep(rep || [])
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

  const rankInfo = getRankByTier(profile.tier)
  const initials = profile.handle.slice(0, 2).toUpperCase()
  const navigate = useNavigate()
  const isOfficer = profile.tier <= 4

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
                { label: 'INTELLIGENCE FILES', value: stats.intel, sub: 'cleared for your access' },
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value" style={s.color ? { color: s.color } : {}}>{s.value}</div>
                  <div className="stat-sub">{s.sub}</div>
                </div>
              ))}
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
                          if (!confirm('Clear entire activity feed?')) return
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
                  <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 8px 8px' }}>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={chartData} margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fill: '#555566', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="count" fill="#c8a55a" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            })()}

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
                        border: `1.5px solid ${m.avatar_color || '#c8a55a'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700, color: m.avatar_color || '#c8a55a',
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
