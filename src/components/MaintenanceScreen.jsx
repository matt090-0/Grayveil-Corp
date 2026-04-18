import { useNavigate } from 'react-router-dom'
import GrayveilLogo from './GrayveilLogo'

export default function MaintenanceScreen({ label, note }) {
  const navigate = useNavigate()
  const accent = '#d48b3a'
  const glow = 'rgba(212,139,58,0.25)'

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0b0f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, position: 'relative', overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at center, rgba(212,139,58,0.08) 0%, transparent 70%)`,
      }} />

      <div style={{
        position: 'relative', maxWidth: 520, width: '100%',
        background: 'rgba(15,16,21,0.85)',
        border: `1px solid ${accent}33`,
        borderRadius: 12, padding: '40px 36px',
        backdropFilter: 'blur(20px)',
        boxShadow: `0 0 60px ${glow}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24, filter: `drop-shadow(0 0 16px ${glow})` }}>
          <GrayveilLogo size={56} />
        </div>

        <div style={{
          textAlign: 'center',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10, letterSpacing: '.3em',
          color: accent, marginBottom: 10,
        }}>
          SECTION UNDER MAINTENANCE
        </div>

        <div style={{
          textAlign: 'center', color: '#d4d8e0',
          fontSize: 15, lineHeight: 1.5, marginBottom: 28,
        }}>
          {label ? `${label} is temporarily offline.` : 'This section is temporarily offline.'}
          <br />
          Command is performing scheduled work. Check back shortly.
        </div>

        {note && (
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '16px 18px',
            marginBottom: 28,
          }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9, letterSpacing: '.2em',
              color: '#6a7280', marginBottom: 8,
            }}>
              NOTE FROM COMMAND
            </div>
            <div style={{ color: '#d4d8e0', fontSize: 14, lineHeight: 1.5 }}>
              {note}
            </div>
          </div>
        )}

        <button
          onClick={() => navigate('/')}
          style={{
            width: '100%', padding: '12px 16px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            color: '#d4d8e0',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11, letterSpacing: '.2em',
            cursor: 'pointer',
            transition: 'all .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#d4d8e0' }}
        >
          RETURN TO SITREP
        </button>

        <div style={{
          marginTop: 20, textAlign: 'center',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9, letterSpacing: '.2em', color: '#4a5060',
        }}>
          GRAYVEIL CORPORATION
        </div>
      </div>
    </div>
  )
}
