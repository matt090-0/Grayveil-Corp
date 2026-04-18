import { discordApplication } from '../lib/discord'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import GrayveilLogo from '../components/GrayveilLogo'
import { useSeo } from '../lib/useSeo'

const PLAYSTYLES = [
  { key: 'combat',      label: 'COMBAT' },
  { key: 'mining',      label: 'MINING' },
  { key: 'trade',       label: 'TRADE' },
  { key: 'medical',     label: 'MEDICAL' },
  { key: 'exploration', label: 'EXPLORATION' },
  { key: 'salvage',     label: 'SALVAGE' },
  { key: 'logistics',   label: 'LOGISTICS' },
  { key: 'intel',       label: 'INTEL / RECON' },
]

const HOURS = [
  { value: '',       label: 'Select…' },
  { value: '<5',     label: 'Under 5 hours / week' },
  { value: '5-10',   label: '5–10 hours / week' },
  { value: '10-20',  label: '10–20 hours / week' },
  { value: '20+',    label: '20+ hours / week' },
]

const SOURCES = [
  { value: '',         label: 'Select…' },
  { value: 'referral', label: 'Referred by a member' },
  { value: 'discord',  label: 'Discord' },
  { value: 'reddit',   label: 'Reddit' },
  { value: 'rsi',      label: 'RSI / Spectrum' },
  { value: 'youtube',  label: 'YouTube / Twitch' },
  { value: 'search',   label: 'Search engine' },
  { value: 'friend',   label: 'Friend told me' },
  { value: 'other',    label: 'Other' },
]

export default function Apply() {
  const [searchParams] = useSearchParams()
  const refCode = searchParams.get('ref') || ''

  useSeo({
    title: 'Apply to Grayveil Corporation',
    description: 'Apply for membership in Grayveil Corporation. Star Citizen PMC & commercial enterprise in Stanton. Two-minute application, every one reviewed.',
    path: '/apply',
  })

  const [form, setForm] = useState({
    handle: '', discord: '', email: '', timezone: '',
    experience: '', referral_code: refCode,
    playstyles: [], hours_per_week: '',
    voice_comms: '', source: refCode ? 'referral' : '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  function togglePlaystyle(key) {
    setForm(f => ({
      ...f,
      playstyles: f.playstyles.includes(key)
        ? f.playstyles.filter(k => k !== key)
        : [...f.playstyles, key],
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.handle.trim()) { setError('SC Handle is required.'); return }
    setLoading(true)

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
      playstyles: form.playstyles.length ? form.playstyles : null,
      hours_per_week: form.hours_per_week || null,
      voice_comms: form.voice_comms || null,
      source: form.source || null,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
    discordApplication(form.handle.trim(), form.experience || '')
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
      <div className="auth-card" style={{ maxWidth: 560 }}>
        <div className="auth-logo">
          <GrayveilLogo size={48} />
          <div className="auth-logo-name">GRAYVEIL</div>
          <div className="auth-logo-motto">Apply for membership</div>
        </div>

        <p style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
          Grayveil Corporation is a private organization operating across the Stanton system.
          Complete this form to be considered for membership. Every application is reviewed.
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
            <label className="form-label">PLAYSTYLES (SELECT ALL THAT APPLY)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {PLAYSTYLES.map(p => {
                const on = form.playstyles.includes(p.key)
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => togglePlaystyle(p.key)}
                    style={{
                      padding: '7px 14px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11, letterSpacing: '.1em',
                      background: on ? 'var(--accent-dim)' : 'transparent',
                      color: on ? 'var(--accent)' : 'var(--text-2)',
                      border: `1px solid ${on ? 'var(--accent)' : 'var(--border-md)'}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'all .15s',
                    }}
                  >{p.label}</button>
                )
              })}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">HOURS PER WEEK</label>
              <select className="form-select" value={form.hours_per_week}
                onChange={e => setForm(f => ({ ...f, hours_per_week: e.target.value }))}>
                {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">VOICE COMMS</label>
              <select className="form-select" value={form.voice_comms}
                onChange={e => setForm(f => ({ ...f, voice_comms: e.target.value }))}>
                <option value="">Select…</option>
                <option value="yes">Yes, comfortable on voice</option>
                <option value="listen">Listen-only to start</option>
                <option value="no">Prefer text only</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">HOW DID YOU FIND US?</label>
            <select className="form-select" value={form.source}
              onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
              {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
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
