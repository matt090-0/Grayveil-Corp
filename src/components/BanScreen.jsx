import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import GrayveilLogo from './GrayveilLogo'

function formatCountdown(ms) {
  if (ms <= 0) return 'now'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${sec}s`
  return `${m}m ${sec}s`
}

export default function BanScreen({ profile }) {
  const { signOut } = useAuth()
  const [now, setNow] = useState(Date.now())

  const isBanned = profile.status === 'BANNED'
  const until = profile.suspended_until ? new Date(profile.suspended_until) : null
  const permanent = isBanned && !until
  const msRemaining = until ? until.getTime() - now : 0

  useEffect(() => {
    if (!until || permanent) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [until, permanent])

  const accent = isBanned ? '#d64545' : '#d48b3a'
  const glow = isBanned ? 'rgba(214,69,69,0.25)' : 'rgba(212,139,58,0.25)'
  const label = isBanned ? 'ACCESS REVOKED' : 'ACCOUNT SUSPENDED'
  const sub = isBanned ? 'You have been banned from Grayveil Corporation.' : 'Your account is temporarily locked.'

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0b0f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, position: 'relative', overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at center, ${glow.replace('0.25', '0.08')} 0%, transparent 70%)`,
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
          {label}
        </div>

        <div style={{
          textAlign: 'center', color: '#d4d8e0',
          fontSize: 15, lineHeight: 1.5, marginBottom: 28,
        }}>
          {sub}
        </div>

        <div style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, padding: '16px 18px',
          marginBottom: 18,
        }}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9, letterSpacing: '.2em',
            color: '#6a7280', marginBottom: 8,
          }}>
            REASON
          </div>
          <div style={{ color: '#d4d8e0', fontSize: 14, lineHeight: 1.5 }}>
            {profile.status_reason || 'No reason recorded.'}
          </div>
        </div>

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
            {isBanned ? 'LIFTS' : 'REINSTATED'}
          </div>
          {permanent ? (
            <div style={{ color: accent, fontSize: 14, fontWeight: 500 }}>
              Permanent — contact a Grayveil leader to appeal.
            </div>
          ) : until ? (
            <>
              <div style={{ color: '#d4d8e0', fontSize: 14 }}>
                {until.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}
              </div>
              <div style={{
                marginTop: 6,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11, color: accent,
              }}>
                {msRemaining > 0 ? `in ${formatCountdown(msRemaining)}` : 'expired — log out and back in'}
              </div>
            </>
          ) : (
            <div style={{ color: '#d4d8e0', fontSize: 14 }}>
              Indefinite — contact a Grayveil leader.
            </div>
          )}
        </div>

        <button
          onClick={signOut}
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
          DISCONNECT
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
