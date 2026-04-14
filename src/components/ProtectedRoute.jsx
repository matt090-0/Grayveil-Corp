import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, minTier }) {
  const { session, profile, loading } = useAuth()

  // Show nothing while auth resolves — avoids redirect loops
  if (loading) return <div style={{ height: '100vh', background: '#080809' }} />

  if (!session) return <Navigate to="/auth" replace />
  if (!profile) return <Navigate to="/setup" replace />
  if (minTier && profile.tier > minTier) return <Navigate to="/" replace />

  return children
}
