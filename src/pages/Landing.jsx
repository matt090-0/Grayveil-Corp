import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import GrayveilLogo from '../components/GrayveilLogo'

export default function Landing() {
  const [stats, setStats] = useState({ members: 0, ships: 0, contracts: 0 })
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const [{ count: m }, { count: s }, { count: c }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('fleet').select('*', { count: 'exact', head: true }),
        supabase.from('contracts').select('*', { count: 'exact', head: true }),
      ])
      setStats({ members: m || 0, ships: s || 0, contracts: c || 0 })
    }
    load()
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0b0f',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '40px 20px', position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background: brand circuit overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url(/brand/background.png)',
        backgroundSize: 'cover', backgroundPosition: 'center',
        opacity: 0.5,
      }} />

      {/* Radial glow (cool chrome) */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(212,216,224,0.04) 0%, transparent 70%)',
      }} />

      <div style={{ position: 'relative', textAlign: 'center', maxWidth: 700 }}>
        {/* Logo */}
        <div style={{ marginBottom: 24, filter: 'drop-shadow(0 0 20px rgba(212,216,224,0.2))' }}>
          <GrayveilLogo size={110} />
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: 'Syne, sans-serif', fontSize: 'clamp(36px, 6vw, 56px)',
          fontWeight: 700, letterSpacing: '.15em',
          background: 'linear-gradient(180deg, #ffffff 0%, #b8bcc8 60%, #6a7280 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          margin: '0 0 8px',
        }}>
          GRAYVEIL
        </h1>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 'clamp(10px, 2vw, 13px)',
          letterSpacing: '.3em', color: '#6a7280', marginBottom: 32,
        }}>
          CORPORATION
        </div>

        {/* Tagline */}
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 'clamp(14px, 2.5vw, 18px)',
          color: '#b8bcc8', lineHeight: 1.8, marginBottom: 8,
          fontStyle: 'italic', fontWeight: 300, letterSpacing: '.02em',
        }}>
          "Profit is neutral. Everything else is negotiable."
        </p>

        {/* Description */}
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 'clamp(12px, 2vw, 15px)',
          color: '#6a7280', lineHeight: 1.8, marginBottom: 40,
          maxWidth: 520, margin: '0 auto 40px',
        }}>
          A private military and commercial enterprise operating across the Stanton system.
          We deal in contracts, intelligence, and discretion.
        </p>

        {/* Stats */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 'clamp(24px, 5vw, 60px)',
          marginBottom: 48,
        }}>
          {[
            { label: 'OPERATIVES', value: stats.members },
            { label: 'VESSELS', value: stats.ships },
            { label: 'CONTRACTS', value: stats.contracts },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: 'Syne, sans-serif', fontSize: 'clamp(24px, 4vw, 36px)',
                fontWeight: 700,
                background: 'linear-gradient(180deg, #ffffff 0%, #b8bcc8 80%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>{s.value}</div>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 'clamp(8px, 1.5vw, 10px)',
                letterSpacing: '.2em', color: '#4a4f5c', marginTop: 4,
              }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/apply')} style={{
            background: 'linear-gradient(180deg, #e8ecf2 0%, #b8bcc8 60%, #6a7280 100%)',
            color: '#0a0b0f', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
            padding: '14px 36px', fontSize: 13, fontWeight: 700,
            fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.1em',
            cursor: 'pointer', transition: 'transform .15s, box-shadow .15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(212,216,224,0.25)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
          >
            APPLY FOR MEMBERSHIP
          </button>
          <button onClick={() => navigate('/auth')} style={{
            background: 'transparent', color: '#8a8f9c',
            border: '1px solid #333344', borderRadius: 8,
            padding: '14px 36px', fontSize: 13, fontWeight: 500,
            fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.08em',
            cursor: 'pointer', transition: 'border-color .15s, color .15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#d4d8e0'; e.currentTarget.style.color = '#d4d8e0' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#333344'; e.currentTarget.style.color = '#8a8f9c' }}
          >
            MEMBER LOGIN
          </button>
        </div>

        {/* Discord Widget */}
        <div style={{ marginTop: 60, textAlign: 'center' }}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 'clamp(8px, 1.5vw, 10px)',
            letterSpacing: '.3em', color: '#44445a', marginBottom: 16,
          }}>
            JOIN OUR DISCORD
          </div>
          <div style={{
            display: 'inline-block', borderRadius: 12, overflow: 'hidden',
            border: '1px solid #222233', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <iframe
              src="https://discord.com/widget?id=1493915754997878856&theme=dark"
              width="350"
              height="400"
              allowTransparency="true"
              frameBorder="0"
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
              style={{ display: 'block' }}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <a href="https://discord.gg/YOUR_INVITE_CODE" target="_blank" rel="noopener noreferrer"
              style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                color: '#8888a0', textDecoration: 'none', letterSpacing: '.08em',
                transition: 'color .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#d4d8e0'}
              onMouseLeave={e => e.currentTarget.style.color = '#8888a0'}
            >
              DISCORD.GG/GRAYVEIL →
            </a>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 80, fontSize: 10, color: '#333344',
          fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.15em',
        }}>
          GRAYVEIL CORPORATION · STANTON SYSTEM · EST. 2026
        </div>
      </div>
    </div>
  )
}
