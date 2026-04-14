import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, minTier }) {
  const { session, profile, loading } = useAuth()

  // Auth still initializing — show loading, do NOT redirect yet
  if (loading) {
    return (
      <div className="auth-shell">
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--font-display, monospace)',
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '.25em',
            color: 'var(--accent, #c8a55a)',
            marginBottom: 16,
          }}>
            GRAYVEIL
          </div>
          <div style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 11,
            letterSpacing: '.15em',
            color: 'var(--text-3, #666)',
          }}>
            ESTABLISHING SECURE CONNECTION...
          </div>
        </div>
      </div>
    )
  }

  if (!session) return <Navigate to="/auth" replace />
  if (!profile) return <Navigate to="/setup" replace />
  if (minTier && profile.tier > minTier) return <Navigate to="/" replace />

  return children
}
