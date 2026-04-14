import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function LoadingScreen() {
  return (
    <div style={{
      height: '100vh',
      background: '#080809',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    }}>
      <div style={{
        fontFamily: "'Syne', sans-serif",
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: '.15em',
        color: '#c4ae82',
      }}>GRAYVEIL</div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        letterSpacing: '.25em',
        color: '#50506a',
      }}>CORPORATION</div>
    </div>
  )
}

export default function ProtectedRoute({ children, minTier }) {
  const { session, profile, loading } = useAuth()

  if (loading)   return <LoadingScreen />
  if (!session)  return <Navigate to="/auth" replace />
  if (!profile)  return <Navigate to="/setup" replace />
  if (minTier && profile.tier > minTier) return <Navigate to="/" replace />

  return children
}
