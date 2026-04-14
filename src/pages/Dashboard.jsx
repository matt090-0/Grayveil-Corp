import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatCredits, getRankByTier } from '../lib/ranks'
import RankBadge from '../components/RankBadge'

function timeAgo(ts) {
  const d = new Date(ts)
  const diff = Math.floor((Date.now() - d) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
  return `${Math.floor(diff/86400)}d ago`
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
                  <span style={{ fontSize: 10, color: 'var(--green)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em' }}>● LIVE</span>
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
          </>
        )}
      </div>
    </>
  )
}
