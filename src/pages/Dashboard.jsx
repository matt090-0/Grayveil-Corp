import { useEffect, useState } from 'react'
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

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats]   = useState({ members: 0, contracts: 0, fleet: 0, intel: 0 })
  const [announcements, setAnn] = useState([])
  const [myClaims, setMyClaims] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const [
        { count: members },
        { count: contracts },
        { count: fleet },
        { count: intel },
        { data: ann },
        { data: claims },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'OPEN'),
        supabase.from('fleet').select('*', { count: 'exact', head: true }),
        supabase.from('intelligence').select('*', { count: 'exact', head: true }),
        supabase.from('announcements').select('*, posted_by:profiles(handle, tier)').order('created_at', { ascending: false }).limit(5),
        supabase.from('contract_claims')
          .select('*, contract:contracts(id, title, contract_type, status, reward, location)')
          .eq('member_id', profile.id)
          .limit(5),
      ])
      setStats({ members: members||0, contracts: contracts||0, fleet: fleet||0, intel: intel||0 })
      setAnn(ann || [])
      setMyClaims(claims?.filter(c => c.contract?.status !== 'COMPLETE') || [])
      setLoading(false)
    }
    load()
  }, [profile.id])

  const rankInfo = getRankByTier(profile.tier)
  const initials = profile.handle.slice(0, 2).toUpperCase()

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
              <div className="stat-card">
                <div className="stat-label">ACTIVE MEMBERS</div>
                <div className="stat-value">{stats.members}</div>
                <div className="stat-sub">operatives registered</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">OPEN CONTRACTS</div>
                <div className="stat-value" style={{ color: 'var(--accent)' }}>{stats.contracts}</div>
                <div className="stat-sub">available for assignment</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">FLEET STRENGTH</div>
                <div className="stat-value">{stats.fleet}</div>
                <div className="stat-sub">vessels on record</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">INTELLIGENCE FILES</div>
                <div className="stat-value">{stats.intel}</div>
                <div className="stat-sub">cleared for your access</div>
              </div>
            </div>

            <div className="grid-2" style={{ gap: 20 }}>
              <div>
                <div className="section-header">
                  <div className="section-title">COMMAND TRANSMISSIONS</div>
                </div>
                {announcements.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px 0' }}>NO TRANSMISSIONS</div>
                ) : announcements.map(a => (
                  <div key={a.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-8 mb-4">
                      <span className={`priority-dot ${a.priority?.toLowerCase()}`}></span>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', letterSpacing: '.1em' }}>
                        {a.priority}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>{timeAgo(a.created_at)}</span>
                    </div>
                    <div style={{ fontWeight: 500, marginBottom: 4, fontSize: 13 }}>{a.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65 }}>{a.content}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
                      — {a.posted_by?.handle || 'UNKNOWN'}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <div className="section-header">
                  <div className="section-title">MY ACTIVE CONTRACTS</div>
                </div>
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
            </div>
          </>
        )}
      </div>
    </>
  )
}
