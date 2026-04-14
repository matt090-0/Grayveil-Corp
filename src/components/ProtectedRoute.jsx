import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, minTier }) {
  const { session, profile, loading, profileLoaded } = useAuth()

  // Show spinner while initial load or while profile is being fetched
  if (loading || !profileLoaded) return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', flexDirection: 'column', gap: 16
    }}>
      <div className="spinner" style={{ width: 28, height: 28, borderWidth: 2.5 }} />
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.2em', color: 'var(--text-3)' }}>
        INITIALISING
      </div>
    </div>
  )

  if (!session) return <Navigate to="/auth" replace />
  if (!profile) return <Navigate to="/setup" replace />
  if (minTier && profile.tier > minTier) return <Navigate to="/" replace />

  return children
}
