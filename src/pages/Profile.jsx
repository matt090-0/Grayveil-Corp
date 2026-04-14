import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import RankBadge from '../components/RankBadge'
import { getRankByTier } from '../lib/ranks'
import { SC_DIVISIONS, SC_SPECIALITIES } from '../lib/scdata'

export default function Profile() {
  const { profile, refreshProfile } = useAuth()
  const [form, setForm] = useState({
    division:   profile.division  || '',
    speciality: profile.speciality || '',
    bio:        profile.bio        || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState('')

  const rankInfo = getRankByTier(profile.tier)
  const initials = profile.handle.slice(0, 2).toUpperCase()

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error } = await supabase.from('profiles').update({
      division:   form.division   || null,
      speciality: form.speciality || null,
      bio:        form.bio        || null,
    }).eq('id', profile.id)

    if (error) { setError(error.message); setSaving(false); return }
    await refreshProfile()
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    setSaving(false)
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">PROFILE</div>
        <div className="page-subtitle">Your operative record</div>
      </div>

      <div className="page-body" style={{ maxWidth: 600 }}>
        {/* Identity card */}
        <div className="card mb-20">
          <div className="flex items-center gap-16">
            <div className="avatar" style={{ width: 56, height: 56, fontSize: 18 }}>{initials}</div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, marginBottom: 6 }}>
                {profile.handle}
              </div>
              <div className="flex items-center gap-8">
                <RankBadge tier={profile.tier} />
                {profile.is_founder && <span className="badge badge-accent">FOUNDER</span>}
              </div>
            </div>
          </div>
          <div className="divider" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <div className="stat-label">TIER</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: rankInfo.color }}>
                {profile.tier}
              </div>
            </div>
            <div>
              <div className="stat-label">DIVISION</div>
              <div style={{ fontSize: 13 }}>{profile.division || '—'}</div>
            </div>
            <div>
              <div className="stat-label">SPECIALITY</div>
              <div style={{ fontSize: 13 }}>{profile.speciality || '—'}</div>
            </div>
          </div>
          {profile.bio && (
            <>
              <div className="divider" />
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>{profile.bio}</p>
            </>
          )}
        </div>

        {/* Edit form */}
        <div className="card">
          <div className="section-title mb-16">EDIT PROFILE</div>
          <form onSubmit={save}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">DIVISION</label>
                <select className="form-select" value={form.division}
                  onChange={e => setForm(f => ({ ...f, division: e.target.value }))}>
                  <option value="">— Select Division —</option>
                  {SC_DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">SPECIALITY</label>
                <select className="form-select" value={form.speciality}
                  onChange={e => setForm(f => ({ ...f, speciality: e.target.value }))}>
                  <option value="">— Select Speciality —</option>
                  {SC_SPECIALITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">BIO</label>
              <textarea className="form-textarea" value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                placeholder="Brief operative background, skills, areas of operation..." />
            </div>
            {error && <div className="form-error mb-8">{error}</div>}
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'SAVING...' : saved ? '✓ SAVED' : 'SAVE CHANGES'}
            </button>
          </form>
        </div>

        <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          Handle and rank can only be changed by senior Grayveil leadership.
        </div>
      </div>
    </>
  )
}
