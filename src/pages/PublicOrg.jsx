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
            fontFamily: 'Syne, sans-serif', fontSize: 'clamp(40px, 7vw, 72px)',
            fontWeight: 700, letterSpacing: '.15em', margin: '0 0 12px',
            background: 'linear-gradient(180deg, #ffffff 0%, #b8bcc8 60%, #6a7280 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>GRAYVEIL</h1>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 'clamp(11px, 2vw, 14px)',
            letterSpacing: '.35em', color: '#6a7280', marginBottom: 32,
          }}>CORPORATION · STANTON SYSTEM</div>
          <p style={{
            fontFamily: 'Inter, sans-serif', fontSize: 'clamp(15px, 2.5vw, 20px)',
            color: '#b8bcc8', fontStyle: 'italic', fontWeight: 300, letterSpacing: '.02em',
            marginBottom: 40, maxWidth: 620, marginLeft: 'auto', marginRight: 'auto',
          }}>"Profit is neutral. Everything else is negotiable."</p>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/apply')} style={{
              background: 'linear-gradient(180deg, #e8ecf2 0%, #b8bcc8 60%, #6a7280 100%)',
              color: '#0a0b0f', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
              padding: '14px 36px', fontSize: 13, fontWeight: 700,
              fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.1em',
              cursor: 'pointer', transition: 'transform .15s, box-shadow .15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(212,216,224,0.25)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>
              APPLY FOR MEMBERSHIP
            </button>
            <button onClick={() => navigate('/auth')} style={{
              background: 'transparent', color: '#8a8f9c',
              border: '1px solid #333344', borderRadius: 8,
              padding: '14px 36px', fontSize: 13, fontWeight: 500,
              fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.08em',
              cursor: 'pointer',
            }}>MEMBER PORTAL</button>
          </div>
        </div>

        {loading ? <div style={{ textAlign: 'center', color: '#6a7280', padding: 40 }}>Loading stats...</div> : stats && (
          <>
            {/* ═══ STATS GRID ═══ */}
            <div style={{ marginBottom: 80 }}>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: 11, letterSpacing: '.3em', color: '#6a7280', fontFamily: 'JetBrains Mono, monospace' }}>ORGANIZATION METRICS</div>
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
                  <div key={s.label} style={{
                    background: 'rgba(15,16,21,0.7)', backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(212,216,224,0.1)', borderRadius: 10,
                    padding: '20px 16px', textAlign: 'center',
                    transition: 'border-color .2s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(212,216,224,0.3)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(212,216,224,0.1)'}>
                    <div style={{
                      fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 700,
                      background: 'linear-gradient(180deg, #ffffff 0%, #b8bcc8 80%)',
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>{s.value || 0}</div>
                    <div style={{ fontSize: 10, letterSpacing: '.15em', color: '#6a7280', fontFamily: 'JetBrains Mono, monospace', marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ═══ COMMAND ═══ */}
            {stats.founders && stats.founders.length > 0 && (
              <div style={{ marginBottom: 80 }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                  <div style={{ fontSize: 11, letterSpacing: '.3em', color: '#6a7280', fontFamily: 'JetBrains Mono, monospace' }}>COMMAND AUTHORITY</div>
                </div>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {stats.founders.map(f => (
                    <div key={f.handle} style={{
                      background: 'linear-gradient(135deg, rgba(212,216,224,0.08), rgba(212,216,224,0.02))',
                      border: '1px solid rgba(212,216,224,0.25)', borderRadius: 12,
                      padding: '20px 28px', textAlign: 'center', minWidth: 180,
                    }}>
                      <div style={{
                        width: 56, height: 56, borderRadius: '50%', margin: '0 auto 10px',
                        background: `linear-gradient(135deg, ${f.avatar_color}20, ${f.avatar_color}40)`,
                        border: `2px solid ${f.avatar_color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 700, color: f.avatar_color,
                        fontFamily: 'Syne, sans-serif',
                      }}>{f.handle?.slice(0, 2).toUpperCase()}</div>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, letterSpacing: '.03em' }}>{f.handle}</div>
                      <div style={{ fontSize: 10, letterSpacing: '.2em', color: '#d4d8e0', fontFamily: 'JetBrains Mono, monospace', marginTop: 4 }}>{f.rank || 'FOUNDER'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ DIVISIONS ═══ */}
            {stats.divisions && stats.divisions.length > 0 && (
              <div style={{ marginBottom: 80 }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                  <div style={{ fontSize: 11, letterSpacing: '.3em', color: '#6a7280', fontFamily: 'JetBrains Mono, monospace' }}>OPERATIONAL DIVISIONS</div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 800, margin: '0 auto' }}>
                  {stats.divisions.map(d => (
                    <div key={d} style={{
                      background: 'rgba(15,16,21,0.7)', backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(212,216,224,0.15)', borderRadius: 6,
                      padding: '8px 16px', fontSize: 11, letterSpacing: '.1em',
                      fontFamily: 'JetBrains Mono, monospace', color: '#b8bcc8',
                    }}>{d}</div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ DISCORD WIDGET ═══ */}
        <div style={{ textAlign: 'center', marginBottom: 80 }}>
          <div style={{ fontSize: 11, letterSpacing: '.3em', color: '#6a7280', fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>JOIN OUR CHANNEL</div>
          <div style={{
            display: 'inline-block', borderRadius: 12, overflow: 'hidden',
            border: '1px solid rgba(212,216,224,0.15)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
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
          borderTop: '1px solid rgba(212,216,224,0.1)',
        }}>
          <div style={{ fontSize: 13, color: '#8a8f9c', marginBottom: 20, lineHeight: 1.8, maxWidth: 600, margin: '0 auto 20px' }}>
            A private military and commercial enterprise operating across the Stanton system.
            We deal in contracts, intelligence, and discretion.
          </div>
          <button onClick={() => navigate('/apply')} style={{
            background: 'transparent', color: '#d4d8e0',
            border: '1px solid rgba(212,216,224,0.3)', borderRadius: 8,
            padding: '12px 32px', fontSize: 12, fontWeight: 600,
            fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.1em',
            cursor: 'pointer', transition: 'all .2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#d4d8e0'; e.currentTarget.style.background = 'rgba(212,216,224,0.05)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(212,216,224,0.3)'; e.currentTarget.style.background = 'transparent' }}>
            REQUEST MEMBERSHIP →
          </button>
          <div style={{ fontSize: 9, color: '#4a4f5c', marginTop: 40, letterSpacing: '.2em', fontFamily: 'JetBrains Mono, monospace' }}>
            GRAYVEIL CORPORATION · {stats?.founded_date ? `EST. ${new Date(stats.founded_date).getFullYear()}` : 'EST. 2026'}
          </div>
        </div>
      </div>
    </div>
  )
}
