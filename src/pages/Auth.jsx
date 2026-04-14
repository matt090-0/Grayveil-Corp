import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Auth() {
  const [tab, setTab]       = useState('login')
  const [email, setEmail]   = useState('')
  const [pass, setPass]     = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]     = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (tab === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
      if (error) { setError(error.message); setLoading(false); return }
      navigate('/')
    } else {
      const { error } = await supabase.auth.signUp({ email, password: pass })
      if (error) { setError(error.message); setLoading(false); return }
      setDone(true)
    }

    setLoading(false)
  }

  if (done) return (
    <div className="auth-shell">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-logo">
          <div className="auth-logo-name">GRAYVEIL</div>
        </div>
        <div style={{ color: 'var(--green)', fontSize: 13, marginBottom: 12 }}>ACCESS REQUEST RECEIVED</div>
        <p style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.7 }}>
          Check your email to confirm your account, then return here to sign in and complete your profile.
        </p>
        <button className="btn btn-ghost w-full mt-16" onClick={() => setDone(false)}>
          RETURN TO LOGIN
        </button>
      </div>
    </div>
  )

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-name">GRAYVEIL</div>
          <div className="auth-logo-motto">"Profit is neutral. Everything else is negotiable."</div>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab${tab === 'login' ? ' active' : ''}`} onClick={() => setTab('login')}>
            SIGN IN
          </button>
          <button className={`auth-tab${tab === 'signup' ? ' active' : ''}`} onClick={() => setTab('signup')}>
            REQUEST ACCESS
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">EMAIL</label>
            <input
              type="email"
              className="form-input"
              placeholder="operative@grayveil.corp"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label">PASSPHRASE</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={pass}
              onChange={e => setPass(e.target.value)}
              required
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              minLength={8}
            />
            {tab === 'signup' && (
              <div className="form-hint">Minimum 8 characters. You will set your handle after confirming.</div>
            )}
          </div>

          {error && <div className="form-error mb-16">{error}</div>}

          <button type="submit" className="btn btn-primary w-full" disabled={loading}
            style={{ justifyContent: 'center', padding: '10px' }}>
            {loading ? 'PROCESSING...' : tab === 'login' ? 'AUTHENTICATE' : 'SUBMIT REQUEST'}
          </button>
        </form>

        {tab === 'login' && (
          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-3)' }}>
            No account?{' '}
            <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setTab('signup')}>
              Request access
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
