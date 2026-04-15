import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { getRankByTier, formatCredits } from '../lib/ranks'
import { SC_DIVISIONS } from '../lib/scdata'
import RankBadge from '../components/RankBadge'

const TRAINING_PATHS = [
  { role: 'Bengal Bridge Crew', certs: ['Capital Ship Crew', 'Fleet Navigation', 'Electronic Warfare'], minTier: 5, repReq: 200 },
  { role: 'Bengal Weapons Officer', certs: ['Capital Ship Crew', 'Torpedo Systems', 'Turret Gunnery'], minTier: 5, repReq: 150 },
  { role: 'Bengal Engineering', certs: ['Capital Ship Crew', 'Damage Control Systems'], minTier: 6, repReq: 100 },
  { role: 'Fighter Pilot', certs: ['Turret Gunnery', 'Fleet Navigation'], minTier: 7, repReq: 80 },
  { role: 'Mining Foreman', certs: ['Mining Foreman'], minTier: 6, repReq: 100 },
  { role: 'Combat Medic', certs: ['Combat Medic'], minTier: 7, repReq: 50 },
  { role: 'Recon Operative', certs: ['Electronic Warfare', 'Fleet Navigation'], minTier: 6, repReq: 120 },
  { role: 'Trade Director', certs: ['Fleet Navigation'], minTier: 5, repReq: 150 },
]

export default function Reputation() {
  const { profile: me } = useAuth()
  const [members, setMembers] = useState([])
  const [myCerts, setMyCerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('leaderboard')

  useEffect(() => {
    async function load() {
      const [{ data: mem }, { data: mc }] = await Promise.all([
        supabase.from('profiles').select('id, handle, tier, rank, division, speciality, rep_score, rep_streak, avatar_color, wallet_balance, status').eq('status', 'ACTIVE').order('rep_score', { ascending: false }),
        supabase.from('member_certifications').select('cert:certifications(name)').eq('member_id', me.id),
      ])
      setMembers(mem || [])
      setMyCerts((mc || []).map(c => c.cert?.name))
      setLoading(false)
    }
    load()
  }, [me.id])

  const myRank = members.findIndex(m => m.id === me.id) + 1

  // Division stats
  const divStats = SC_DIVISIONS.map(d => {
    const divMembers = members.filter(m => m.division === d)
    return {
      name: d, count: divMembers.length,
      totalRep: divMembers.reduce((s, m) => s + (m.rep_score || 0), 0),
      topMember: divMembers[0]?.handle || '—',
      totalWealth: divMembers.reduce((s, m) => s + (m.wallet_balance || 0), 0),
    }
  }).filter(d => d.count > 0).sort((a, b) => b.totalRep - a.totalRep)

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title">REPUTATION</div>
            <div className="page-subtitle">Your rep: {me.rep_score || 0} · Rank #{myRank || '—'} of {members.length}</div>
          </div>
          <div style={{
            background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 8,
            padding: '10px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 9, letterSpacing: '.1em', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>YOUR REP</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{me.rep_score || 0}</div>
          </div>
        </div>
        <div className="flex gap-8">
          {['leaderboard', 'divisions', 'training'].map(t => (
            <button key={t} className="btn btn-ghost btn-sm" style={tab === t ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}} onClick={() => setTab(t)}>{t.toUpperCase()}</button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING...</div> : (
          <>
            {/* ── LEADERBOARD ── */}
            {tab === 'leaderboard' && (
              <>
                <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>HOW TO EARN REP</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.8 }}>
                  Complete contracts (+10) · Claim bounties (+15) · Attend operations (+5 per AAR) · Get awarded medals · Contribute to org operations
                </div>
                <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table className="data-table">
                  <thead><tr><th style={{ width: 50 }}>#</th><th>OPERATIVE</th><th>RANK</th><th>DIVISION</th><th style={{ textAlign: 'right' }}>REP</th></tr></thead>
                  <tbody>
                    {members.map((m, i) => (
                      <tr key={m.id} style={{ background: m.id === me.id ? 'var(--accent-glow)' : i < 3 ? 'rgba(200,165,90,0.03)' : undefined }}>
                        <td style={{ fontFamily: 'var(--font-display)', fontSize: i < 3 ? 18 : 14, fontWeight: 600, color: i === 0 ? 'var(--accent)' : i < 3 ? 'var(--text-1)' : 'var(--text-3)' }}>
                          {i + 1}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 24, height: 24, borderRadius: '50%',
                              border: `1.5px solid ${m.avatar_color || '#c8a55a'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 9, fontWeight: 700, color: m.avatar_color || '#c8a55a',
                            }}>{m.handle?.slice(0, 2).toUpperCase()}</div>
                            <span style={{ fontWeight: 500 }}>{m.handle}</span>
                          </div>
                        </td>
                        <td><RankBadge tier={m.tier} /></td>
                        <td className="text-muted">{m.division || '—'}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: i < 3 ? 'var(--accent)' : 'var(--text-1)' }}>{m.rep_score || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div></div>
              </>
            )}

            {/* ── DIVISIONS ── */}
            {tab === 'divisions' && (
              <>
                {divStats.length === 0 ? <div className="empty-state">NO DIVISIONS ASSIGNED YET</div> : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {divStats.map(d => (
                      <div key={d.name} className="card">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{d.name}</span>
                          <span className="badge badge-accent">{d.count} members</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 8, letterSpacing: '.1em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>TOTAL REP</div>
                            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent)' }}>{d.totalRep}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 8, letterSpacing: '.1em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>TOTAL WEALTH</div>
                            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--green)' }}>{formatCredits(d.totalWealth)}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>TOP: {d.topMember}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 24, fontSize: 10, letterSpacing: '.15em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>ALL MEMBERS BY DIVISION</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {members.map(m => (
                    <span key={m.id} style={{
                      padding: '4px 10px', fontSize: 10, borderRadius: 4,
                      background: 'var(--bg-surface)', border: '1px solid var(--border)',
                    }}>
                      <span style={{ fontWeight: 500 }}>{m.handle}</span>
                      <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>{m.division || 'UNASSIGNED'}</span>
                    </span>
                  ))}
                </div>
              </>
            )}

            {/* ── TRAINING PATHWAYS ── */}
            {tab === 'training' && (
              <>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.8 }}>
                  Each role requires specific certifications and minimum rank. Green checkmarks show requirements you already meet. Complete all requirements to qualify for the role.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                  {TRAINING_PATHS.map(path => {
                    const certsMet = path.certs.filter(c => myCerts.includes(c)).length
                    const tierMet = me.tier <= path.minTier
                    const repMet = (me.rep_score || 0) >= path.repReq
                    const allMet = certsMet === path.certs.length && tierMet && repMet
                    return (
                      <div key={path.role} className="card" style={{ borderColor: allMet ? 'var(--green)' : 'var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: allMet ? 'var(--green)' : 'var(--text-1)' }}>{path.role}</span>
                          {allMet && <span className="badge badge-green">QUALIFIED</span>}
                        </div>

                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 9, letterSpacing: '.1em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>CERTIFICATIONS ({certsMet}/{path.certs.length})</div>
                          {path.certs.map(c => (
                            <div key={c} style={{ fontSize: 12, padding: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: myCerts.includes(c) ? 'var(--green)' : 'var(--red)', fontSize: 10 }}>{myCerts.includes(c) ? '✓' : '✕'}</span>
                              <span style={{ color: myCerts.includes(c) ? 'var(--text-1)' : 'var(--text-3)' }}>{c}</span>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
                          <div>
                            <span style={{ color: tierMet ? 'var(--green)' : 'var(--red)', marginRight: 4 }}>{tierMet ? '✓' : '✕'}</span>
                            <span style={{ color: 'var(--text-3)' }}>Min Tier {path.minTier}</span>
                          </div>
                          <div>
                            <span style={{ color: repMet ? 'var(--green)' : 'var(--red)', marginRight: 4 }}>{repMet ? '✓' : '✕'}</span>
                            <span style={{ color: 'var(--text-3)' }}>{path.repReq} rep required</span>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div style={{ marginTop: 8, height: 4, background: 'var(--bg-surface)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 2,
                            background: allMet ? 'var(--green)' : 'var(--accent)',
                            width: `${Math.round(((certsMet + (tierMet ? 1 : 0) + (repMet ? 1 : 0)) / (path.certs.length + 2)) * 100)}%`,
                            transition: 'width .3s',
                          }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
