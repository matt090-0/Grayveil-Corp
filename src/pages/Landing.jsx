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
      minHeight: '100vh', background: '#0a0a10',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '40px 20px', position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background grid effect */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.03,
        backgroundImage: 'linear-gradient(rgba(200,165,90,1) 1px, transparent 1px), linear-gradient(90deg, rgba(200,165,90,1) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* Radial glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(200,165,90,0.06) 0%, transparent 70%)',
      }} />

      <div style={{ position: 'relative', textAlign: 'center', maxWidth: 700 }}>
        {/* Logo */}
        <div style={{ marginBottom: 24 }}>
          <GrayveilLogo size={100} />
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: 'Syne, sans-serif', fontSize: 'clamp(36px, 6vw, 56px)',
          fontWeight: 700, letterSpacing: '.15em', color: '#c8a55a',
          margin: '0 0 8px',
        }}>
          GRAYVEIL
        </h1>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 'clamp(10px, 2vw, 13px)',
          letterSpacing: '.3em', color: '#555566', marginBottom: 32,
        }}>
          CORPORATION
        </div>

        {/* Tagline */}
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 'clamp(14px, 2.5vw, 18px)',
          color: '#8888a0', lineHeight: 1.8, marginBottom: 8,
          fontStyle: 'italic',
        }}>
          "Profit is neutral. Everything else is negotiable."
        </p>

        {/* Description */}
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 'clamp(12px, 2vw, 15px)',
          color: '#555566', lineHeight: 1.8, marginBottom: 40,
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
                fontWeight: 700, color: '#c8a55a',
              }}>{s.value}</div>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 'clamp(8px, 1.5vw, 10px)',
                letterSpacing: '.2em', color: '#44445a', marginTop: 4,
              }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/apply')} style={{
            background: 'linear-gradient(135deg, #c8a55a, #a08040)',
            color: '#0a0a10', border: 'none', borderRadius: 8,
            padding: '14px 36px', fontSize: 13, fontWeight: 700,
            fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.1em',
            cursor: 'pointer', transition: 'transform .15s, box-shadow .15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(200,165,90,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
          >
            APPLY FOR MEMBERSHIP
          </button>
          <button onClick={() => navigate('/auth')} style={{
            background: 'transparent', color: '#8888a0',
            border: '1px solid #333344', borderRadius: 8,
            padding: '14px 36px', fontSize: 13, fontWeight: 500,
            fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.08em',
            cursor: 'pointer', transition: 'border-color .15s, color .15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#c8a55a'; e.currentTarget.style.color = '#c8a55a' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#333344'; e.currentTarget.style.color = '#8888a0' }}
          >
            MEMBER LOGIN
          </button>
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
