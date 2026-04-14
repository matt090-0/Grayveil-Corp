import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import GrayveilLogo from '../components/GrayveilLogo'

export default function Apply() {
  const [searchParams] = useSearchParams()
  const refCode = searchParams.get('ref') || ''
  const [form, setForm] = useState({ handle: '', discord: '', email: '', timezone: '', experience: '', referral_code: refCode })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.handle.trim()) { setError('SC Handle is required.'); return }
    setLoading(true)

    // If referral code provided, increment uses on the invite link
    if (form.referral_code) {
      await supabase.rpc('increment_invite_uses', { invite_code: form.referral_code }).catch(() => {})
    }

    const { error } = await supabase.from('applications').insert({
      handle: form.handle.trim(),
      discord: form.discord || null,
      email: form.email || null,
      timezone: form.timezone || null,
      experience: form.experience || null,
      referral_code: form.referral_code || null,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
  }

  if (done) return (
    <div className="auth-shell">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-logo">
          <GrayveilLogo size={48} />
          <div className="auth-logo-name">GRAYVEIL</div>
        </div>
        <div style={{ color: 'var(--green)', fontSize: 13, marginBottom: 12, fontFamily: 'var(--font-mono)', letterSpacing: '.08em' }}>
          APPLICATION RECEIVED
        </div>
        <p style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.8 }}>
          Your application has been submitted to Grayveil leadership for review. You will be contacted via Discord if approved.
        </p>
      </div>
    </div>
  )

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">
          <GrayveilLogo size={48} />
          <div className="auth-logo-name">GRAYVEIL</div>
          <div className="auth-logo-motto">Apply for membership</div>
        </div>

        <p style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
          Grayveil Corporation is a private organization operating across the Stanton system.
          Complete this form to be considered for membership.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">STAR CITIZEN HANDLE *</label>
            <input className="form-input" value={form.handle}
              onChange={e => setForm(f => ({ ...f, handle: e.target.value }))}
              placeholder="Your RSI handle" required />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">DISCORD</label>
              <input className="form-input" value={form.discord}
                onChange={e => setForm(f => ({ ...f, discord: e.target.value }))}
                placeholder="username" />
            </div>
            <div className="form-group">
              <label className="form-label">EMAIL</label>
              <input className="form-input" type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="optional" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">TIMEZONE</label>
            <input className="form-input" value={form.timezone}
              onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
              placeholder="e.g. GMT, EST, CET" />
          </div>

          <div className="form-group">
            <label className="form-label">EXPERIENCE</label>
            <textarea className="form-textarea" value={form.experience}
              onChange={e => setForm(f => ({ ...f, experience: e.target.value }))}
              placeholder="Tell us about your Star Citizen experience — what you enjoy, what ships you fly, any org history..." />
          </div>

          {refCode && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 16 }}>
              REFERRAL CODE: <span style={{ color: 'var(--accent)' }}>{refCode}</span>
            </div>
          )}

          {error && <div className="form-error mb-16">{error}</div>}

          <button type="submit" className="btn btn-primary w-full" disabled={loading}
            style={{ justifyContent: 'center', padding: '10px' }}>
            {loading ? 'SUBMITTING...' : 'SUBMIT APPLICATION'}
          </button>
        </form>

        <p style={{ marginTop: 14, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
          Already a member? <a href="/auth" style={{ color: 'var(--accent)' }}>Sign in</a>
        </p>
      </div>
    </div>
  )
}
