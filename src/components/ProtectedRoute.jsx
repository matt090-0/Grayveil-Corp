import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, minTier }) {
  const { session, profile, loading } = useAuth()

  // While checking session, show nothing (avoids flash)
  if (loading) return null

  if (!session) return <Navigate to="/auth" replace />
  if (!profile) return <Navigate to="/setup" replace />
  if (minTier && profile.tier > minTier) return <Navigate to="/" replace />

  return children
}
