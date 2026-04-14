import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Auth() {
  const { session, profile, profileLoaded } = useAuth()
  const [tab, setTab]           = useState('login')
  const [email, setEmail]       = useState('')
  const [pass, setPass]         = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)
  const navigate = useNavigate()

  // Pre-fill remembered email
  useEffect(() => {
    const saved = localStorage.getItem('gv_remembered_email')
    if (saved) setEmail(saved)
  }, [])

  // Redirect once auth context has session + profile resolved
  useEffect(() => {
    if (session && profileLoaded) {
      if (profile) {
        navigate('/', { replace: true })
      } else {
        navigate('/setup', { replace: true })
      }
    }
  }, [session, profile, profileLoaded, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (tab === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
      if (error) { setError(error.message); setLoading(false); return }

      if (remember) {
        localStorage.setItem('gv_remembered_email', email)
      } else {
        localStorage.removeItem('gv_remembered_email')
        window.addEventListener('beforeunload', () => supabase.auth.signOut(), { once: true })
      }
      // Do NOT navigate here — let the useEffect above handle it
      // once onAuthStateChange fires and profile is loaded
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
        <div style={{ color: 'var(--green)', fontSize: 13, marginBottom: 12, fontFamily: 'var(--font-mono)', letterSpacing: '.08em' }}>
          ACCESS REQUEST RECEIVED
        </div>
        <p style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.8 }}>
          Check your email to confirm your account, then return here to sign in and complete your profile.
        </p>
        <button className="btn btn-ghost w-full mt-16" style={{ justifyContent: 'center' }} onClick={() => setDone(false)}>
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
              placeholder="operative@grayveil.net"
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

          {tab === 'login' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div
                onClick={() => setRemember(r => !r)}
                style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
                  border: `1.5px solid ${remember ? 'var(--accent)' : 'var(--border-md)'}`,
                  background: remember ? 'var(--accent-dim)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all .15s'
                }}
              >
                {remember && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span
                onClick={() => setRemember(r => !r)}
                style={{ fontSize: 12, color: 'var(--text-2)', cursor: 'pointer', userSelect: 'none' }}
              >
                Remember me on this device
              </span>
            </div>
          )}

          {error && <div className="form-error mb-16">{error}</div>}

          <button type="submit" className="btn btn-primary w-full" disabled={loading}
            style={{ justifyContent: 'center', padding: '11px' }}>
            {loading ? 'AUTHENTICATING...' : tab === 'login' ? 'SIGN IN' : 'SUBMIT REQUEST'}
          </button>
        </form>

        {tab === 'login' && (
          <p style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: 'var(--text-3)' }}>
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
