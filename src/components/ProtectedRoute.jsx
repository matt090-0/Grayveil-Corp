import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import GrayveilLogo from './GrayveilLogo'
import BanScreen from './BanScreen'

export default function ProtectedRoute({ children }) {
  const { session, profile, loading, refreshProfile } = useAuth()
  const [healing, setHealing] = useState(false)
  const healedRef = useRef(false)

  const needsExpiryHeal =
    profile?.status === 'SUSPENDED' &&
    profile?.suspended_until &&
    new Date(profile.suspended_until).getTime() <= Date.now()

  useEffect(() => {
    if (!needsExpiryHeal || healedRef.current) return
    healedRef.current = true
    setHealing(true)
    ;(async () => {
      try { await supabase.rpc('clear_expired_suspension') } catch {}
      await refreshProfile()
      setHealing(false)
    })()
  }, [needsExpiryHeal, refreshProfile])

  if (loading || healing) return (
    <div style={{
      minHeight: '100vh', background: '#0a0b0f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 20, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(212,216,224,0.05) 0%, transparent 70%)',
      }} />
      <div style={{
        animation: 'pulse 2s ease-in-out infinite',
        filter: 'drop-shadow(0 0 20px rgba(212,216,224,0.25))',
      }}>
        <GrayveilLogo size={80} />
      </div>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
        letterSpacing: '.3em', color: '#6a7280',
      }}>
        ESTABLISHING SECURE CONNECTION...
      </div>
    </div>
  )

  if (!session) return <Navigate to="/welcome" replace />
  if (!profile) return <Navigate to="/setup" replace />

  if (profile.status === 'BANNED') return <BanScreen profile={profile} />
  if (profile.status === 'SUSPENDED' && !needsExpiryHeal) return <BanScreen profile={profile} />

  return children
}
