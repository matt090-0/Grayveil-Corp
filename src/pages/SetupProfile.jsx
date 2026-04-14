import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import GrayveilLogo from '../components/GrayveilLogo'

export default function SetupProfile() {
  const { session, profile, loading: authLoading, refreshProfile } = useAuth()
  const [handle, setHandle] = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Guard: redirect if not logged in or already has profile
  useEffect(() => {
    if (authLoading) return
    if (!session) navigate('/auth', { replace: true })
    else if (profile) navigate('/', { replace: true })
  }, [authLoading, session, profile, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const clean = handle.trim()
    if (clean.length < 3) { setError('Handle must be at least 3 characters.'); return }
    if (!/^[a-zA-Z0-9_\-]+$/.test(clean)) { setError('Handle may only contain letters, numbers, underscores and hyphens.'); return }

    setLoading(true)

    const { error } = await supabase.from('profiles').insert({
      id: session.user.id,
      handle: clean,
    })

    if (error) {
      setError(error.code === '23505' ? 'That handle is already taken.' : error.message)
      setLoading(false)
      return
    }

    await refreshProfile()
    setLoading(false)
    navigate('/', { replace: true })
  }

  // Don't render while auth is loading or if missing session
  if (authLoading || !session) return null

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">
          <GrayveilLogo size={48} />
          <div className="auth-logo-name">GRAYVEIL</div>
          <div className="auth-logo-motto">Establish your identity</div>
        </div>

        <p style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
          Choose your operative handle. This is how you will appear within Grayveil's systems. It cannot be changed without administrative approval.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">OPERATIVE HANDLE</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. ShadowReach"
              value={handle}
              onChange={e => setHandle(e.target.value)}
              required
              maxLength={32}
              autoFocus
            />
            <div className="form-hint">3–32 characters. Letters, numbers, underscores, hyphens.</div>
          </div>

          {error && <div className="form-error mb-16">{error}</div>}

          <button type="submit" className="btn btn-primary w-full" disabled={loading}
            style={{ justifyContent: 'center', padding: '10px' }}>
            {loading ? 'REGISTERING...' : 'CONFIRM IDENTITY'}
          </button>
        </form>

        <p style={{ marginTop: 14, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
          You will be assigned GREY CONTRACT status. An Architect or senior member will review your access.
        </p>
      </div>
    </div>
  )
}
