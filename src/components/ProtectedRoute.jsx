import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import GrayveilLogo from './GrayveilLogo'

export default function ProtectedRoute({ children, minTier }) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="auth-shell">
        <div style={{ textAlign: 'center' }}>
          <GrayveilLogo size={56} />
          <div style={{
            fontFamily: 'var(--font-display, monospace)',
            fontSize: 28, fontWeight: 700, letterSpacing: '.25em',
            color: 'var(--accent, #c8a55a)', margin: '16px 0 12px',
          }}>
            GRAYVEIL
          </div>
          <div className="loading-pulse" style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 11, letterSpacing: '.15em',
            color: 'var(--text-3, #666)',
          }}>
            ESTABLISHING SECURE CONNECTION...
          </div>
        </div>
      </div>
    )
  }

  if (!session) return <Navigate to="/welcome" replace />
  if (!profile) return <Navigate to="/setup" replace />
  if (minTier && profile.tier > minTier) return <Navigate to="/" replace />

  return children
}
