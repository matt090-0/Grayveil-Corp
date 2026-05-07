import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import GrayveilLogo from '../components/GrayveilLogo'

export default function PublicOrg() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data } = await supabase.rpc('get_public_org_stats')
      setStats(data); setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#0a0b0f', color: '#ededf2', fontFamily: 'Inter, sans-serif', position: 'relative', overflow: 'hidden' }}>
      {/* Background */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url(/brand/background.png)',
        backgroundSize: 'cover', backgroundPosition: 'center',
        opacity: 0.35, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, transparent 0%, rgba(10,11,15,0.8) 60%, rgba(10,11,15,1) 100%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', maxWidth: 1100, margin: '0 auto', padding: '60px 24px' }}>

        {/* ═══ HERO ═══ */}
        <div style={{ textAlign: 'center', marginBottom: 80 }}>
          <div style={{ filter: 'drop-shadow(0 0 24px rgba(212,216,224,0.25))', marginBottom: 28 }}>
            <GrayveilLogo size={96} />
          </div>
          <h1 style={{
            fontFamily: 'Inter Tight, sans-serif', fontSize: 'clamp(48px, 7.5vw, 88px)',
            fontWeight: 800, letterSpacing: '-0.025em', margin: '0 0 14px', lineHeight: 1,
            color: 'var(--text-1)',
          }}>GRAYVEIL</h1>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 'clamp(11px, 2vw, 13px)',
            letterSpacing: '.32em', color: 'var(--text-3)', marginBottom: 32,
          }}>CORPORATION · STANTON SYSTEM</div>
          <p style={{
            fontFamily: 'Inter, sans-serif', fontSize: 'clamp(16px, 2.5vw, 20px)',
            color: 'var(--text-2)', fontStyle: 'italic', fontWeight: 300, letterSpacing: '-0.005em',
            marginBottom: 40, maxWidth: 620, marginLeft: 'auto', marginRight: 'auto',
          }}>"Profit is neutral. Everything else is negotiable."</p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/apply')} className="h-accent-bg" style={{
              background: 'var(--accent)', color: '#0a0a0c', border: 'none', borderRadius: 2,
              padding: '14px 32px', fontSize: 13, fontWeight: 600,
              fontFamily: 'Inter, sans-serif', letterSpacing: '-0.005em',
              cursor: 'pointer', transition: 'background .15s',
            }}>
              Apply for membership →
            </button>
            <button onClick={() => navigate('/auth')} style={{
              background: 'transparent', color: 'var(--text-2)',
              border: '1px solid var(--border-md)', borderRadius: 2,
              padding: '14px 32px', fontSize: 13, fontWeight: 500,
              fontFamily: 'Inter, sans-serif', letterSpacing: '-0.005em',
              cursor: 'pointer',
            }}>Member portal</button>
          </div>
        </div>

        {loading ? <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 40 }}>Loading stats...</div> : stats && (
          <>
            {/* ═══ STATS GRID ═══ */}
            <div style={{ marginBottom: 80 }}>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: 11, letterSpacing: '.32em', color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>ORGANIZATION METRICS</div>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 14,
              }}>
                {[
                  { label: 'OPERATIVES', value: stats.members },
                  { label: 'VESSELS', value: stats.ships },
                  { label: 'CONTRACTS COMPLETE', value: stats.contracts_completed },
                  { label: 'HOSTILES NEUTRALIZED', value: stats.kills },
                  { label: 'BOUNTIES CLAIMED', value: stats.bounties_claimed },
                  { label: 'OPERATIONS RUN', value: stats.operations_run },
                  { label: 'MEDALS AWARDED', value: stats.medals_awarded },
                  { label: 'DIVISIONS', value: (stats.divisions || []).length },
                ].map(s => (
                  <div key={s.label} className="h-border-md" style={{
                    background: 'rgba(11,14,19,0.7)', backdropFilter: 'blur(10px)',
                    border: '1px solid var(--border)', borderRadius: 2,
                    padding: '24px 18px', textAlign: 'center',
                    transition: 'border-color .2s',
                  }}>
                    <div style={{
                      fontFamily: 'Inter Tight, sans-serif', fontSize: 36, fontWeight: 800,
                      letterSpacing: '-0.025em', color: 'var(--text-1)',
                    }}>{s.value || 0}</div>
                    <div style={{ fontSize: 10, letterSpacing: '.24em', color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace', marginTop: 6 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ═══ COMMAND ═══ */}
            {stats.founders && stats.founders.length > 0 && (
              <div style={{ marginBottom: 80 }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                  <div style={{ fontSize: 11, letterSpacing: '.32em', color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>COMMAND AUTHORITY</div>
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {stats.founders.map(f => (
                    <div key={f.handle} style={{
                      background: 'rgba(11,14,19,0.7)',
                      border: '1px solid var(--border-md)', borderRadius: 2,
                      padding: '24px 28px', textAlign: 'center', minWidth: 180,
                    }}>
                      <div style={{
                        width: 56, height: 56, borderRadius: '50%', margin: '0 auto 12px',
                        background: `${f.avatar_color}24`,
                        border: `1px solid ${f.avatar_color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 700, color: f.avatar_color,
                        fontFamily: 'Inter Tight, sans-serif',
                      }}>{f.handle?.slice(0, 2).toUpperCase()}</div>
                      <div style={{ fontFamily: 'Inter Tight, sans-serif', fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em', color: 'var(--text-1)' }}>{f.handle}</div>
                      <div style={{ fontSize: 10, letterSpacing: '.24em', color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', marginTop: 6 }}>{f.rank || 'FOUNDER'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ DIVISIONS ═══ */}
            {stats.divisions && stats.divisions.length > 0 && (
              <div style={{ marginBottom: 80 }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                  <div style={{ fontSize: 11, letterSpacing: '.32em', color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>OPERATIONAL DIVISIONS</div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 800, margin: '0 auto' }}>
                  {stats.divisions.map(d => (
                    <div key={d} style={{
                      background: 'rgba(11,14,19,0.7)',
                      border: '1px solid var(--border-md)', borderRadius: 2,
                      padding: '8px 16px', fontSize: 11, letterSpacing: '.14em',
                      fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-2)',
                    }}>{d}</div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ DISCORD WIDGET ═══ */}
        <div style={{ textAlign: 'center', marginBottom: 80 }}>
          <div style={{ fontSize: 11, letterSpacing: '.32em', color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>JOIN OUR CHANNEL</div>
          <div style={{
            display: 'inline-block', borderRadius: 2, overflow: 'hidden',
            border: '1px solid var(--border-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <iframe
              src="https://discord.com/widget?id=1493915754997878856&theme=dark"
              width="350" height="400" allowTransparency="true" frameBorder="0"
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
              style={{ display: 'block' }}
            />
          </div>
        </div>

        {/* ═══ CTA FOOTER ═══ */}
        <div style={{
          textAlign: 'center', padding: '40px 20px',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 24, lineHeight: 1.7, maxWidth: 600, margin: '0 auto 24px' }}>
            A private military and commercial enterprise operating across the Stanton system.
            We deal in contracts, intelligence, and discretion.
          </div>
          <button onClick={() => navigate('/apply')} className="h-accent-bg" style={{
            background: 'var(--accent)', color: '#0a0a0c', border: 'none', borderRadius: 2,
            padding: '13px 30px', fontSize: 13, fontWeight: 600,
            fontFamily: 'Inter, sans-serif', letterSpacing: '-0.005em',
            cursor: 'pointer', transition: 'background .15s',
          }}>
            Request membership →
          </button>
          <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 40, letterSpacing: '.28em', fontFamily: 'JetBrains Mono, monospace' }}>
            GRAYVEIL CORPORATION · {stats?.founded_date ? `EST. ${new Date(stats.founded_date).getFullYear()}` : 'EST. 2026'}
          </div>
        </div>
      </div>
    </div>
  )
}
