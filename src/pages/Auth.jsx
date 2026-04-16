import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import GrayveilLogo from '../components/GrayveilLogo'

export default function Auth() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate('/dashboard')
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setError('Check your email to confirm your account.')
      }
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0b0f', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Circuit background */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url(/brand/background.png)',
        backgroundSize: 'cover', backgroundPosition: 'center',
        opacity: 0.35,
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(212,216,224,0.04) 0%, transparent 70%)',
      }} />

      <div style={{
        position: 'relative', width: '100%', maxWidth: 420,
        background: 'rgba(15,16,21,0.85)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(212,216,224,0.15)', borderRadius: 14,
        padding: '36px 32px', boxShadow: '0 16px 64px rgba(0,0,0,0.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ filter: 'drop-shadow(0 0 16px rgba(212,216,224,0.2))' }}>
            <GrayveilLogo size={64} />
          </div>
          <h1 style={{
            fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 700, letterSpacing: '.15em',
            background: 'linear-gradient(180deg, #ffffff 0%, #b8bcc8 80%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            margin: '16px 0 4px',
          }}>GRAYVEIL</h1>
          <div style={{ fontSize: 10, letterSpacing: '.3em', color: '#6a7280', fontFamily: 'JetBrains Mono, monospace' }}>
            {mode === 'signin' ? 'OPERATIVE ACCESS' : 'APPLICANT CREDENTIALS'}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">EMAIL</label>
            <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">PASSWORD</label>
            <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
          <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ justifyContent: 'center', marginTop: 8 }}>
            {loading ? 'AUTHENTICATING...' : mode === 'signin' ? 'ENTER GRAYVEIL' : 'REGISTER'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError('') }}
            style={{ background: 'none', border: 'none', color: '#8a8f9c', fontSize: 11, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.08em' }}>
            {mode === 'signin' ? 'NO ACCESS? REQUEST CREDENTIALS' : 'ALREADY AN OPERATIVE? SIGN IN'}
          </button>
        </div>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(212,216,224,0.08)', textAlign: 'center' }}>
          <Link to="/apply" style={{ fontSize: 10, color: '#6a7280', textDecoration: 'none', letterSpacing: '.1em', fontFamily: 'JetBrains Mono, monospace' }}>
            OR APPLY FOR MEMBERSHIP →
          </Link>
        </div>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 9, color: '#4a4f5c', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.2em' }}>
          PROFIT IS NEUTRAL · EVERYTHING ELSE IS NEGOTIABLE
        </div>
      </div>
    </div>
  )
}
