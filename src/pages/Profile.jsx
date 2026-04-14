import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { getRankByTier, formatCredits } from '../lib/ranks'
import { SC_DIVISIONS, SC_SPECIALITIES } from '../lib/scdata'
import RankBadge from '../components/RankBadge'
import MedalPatch from '../components/MedalPatch'

const AVATAR_COLORS = [
  '#c8a55a', '#4a90d9', '#d94a4a', '#4ad980', '#d94ad9',
  '#d9904a', '#4ad9d9', '#9060c8', '#60c860', '#c86060',
  '#8888a0', '#ffffff',
]

function fmt(ts) { return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }

export default function Profile() {
  const { profile, refreshProfile } = useAuth()
  const [form, setForm] = useState({
    division: profile.division || '', speciality: profile.speciality || '',
    bio: profile.bio || '', motto: profile.motto || '',
    avatar_color: profile.avatar_color || '#c8a55a',
    preferred_ship: profile.preferred_ship || '', timezone: profile.timezone || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  // Stats
  const [medals, setMedals] = useState([])
  const [certs, setCerts] = useState([])
  const [ships, setShips] = useState([])
  const [stats, setStats] = useState({ kills: 0, deaths: 0, assists: 0, contracts: 0, intel: 0 })
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: mm }, { data: mc }, { data: fl }, { data: kills }, { data: claims }, { data: intel }, { data: act }] = await Promise.all([
        supabase.from('member_medals').select('*, medal:medals(*)').eq('member_id', profile.id).order('awarded_at', { ascending: false }),
        supabase.from('member_certifications').select('*, cert:certifications(*)').eq('member_id', profile.id),
        supabase.from('fleet').select('*').eq('assigned_to', profile.id),
        supabase.from('kill_log').select('outcome').eq('reporter_id', profile.id),
        supabase.from('contract_claims').select('contract_id').eq('member_id', profile.id),
        supabase.from('intelligence').select('id').eq('posted_by', profile.id),
        supabase.from('activity_log').select('*, actor:profiles!activity_log_actor_id_fkey(handle)').eq('actor_id', profile.id).order('created_at', { ascending: false }).limit(10),
      ])
      setMedals(mm || [])
      setCerts(mc || [])
      setShips(fl || [])
      setStats({
        kills: (kills || []).filter(k => k.outcome === 'KILL').length,
        deaths: (kills || []).filter(k => k.outcome === 'DEATH').length,
        assists: (kills || []).filter(k => k.outcome === 'ASSIST').length,
        contracts: (claims || []).length,
        intel: (intel || []).length,
      })
      setActivity(act || [])
      setLoading(false)
    }
    load()
  }, [profile.id])

  const rankInfo = getRankByTier(profile.tier)
  const initials = profile.handle.slice(0, 2).toUpperCase()
  const accentColor = profile.avatar_color || '#c8a55a'
  const kd = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(1) : stats.kills > 0 ? '∞' : '—'

  async function save(e) {
    e.preventDefault()
    setSaving(true); setError('')
    const { error } = await supabase.from('profiles').update({
      division: form.division || null, speciality: form.speciality || null,
      bio: form.bio || null, motto: form.motto || null,
      avatar_color: form.avatar_color || '#c8a55a',
      preferred_ship: form.preferred_ship || null, timezone: form.timezone || null,
    }).eq('id', profile.id)
    if (error) { setError(error.message); setSaving(false); return }
    await refreshProfile()
    setSaved(true); setTimeout(() => setSaved(false), 2500)
    setSaving(false); setEditing(false)
  }

  return (
    <>
      <div className="page-header" style={{ paddingBottom: 0 }}>
        {/* ── HERO SECTION ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 24, padding: '24px 0',
          borderBottom: '1px solid var(--border)',
        }}>
          {/* Avatar */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}44)`,
            border: `2.5px solid ${accentColor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700,
            color: accentColor, flexShrink: 0,
          }}>
            {initials}
          </div>

          {/* Identity */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>{profile.handle}</span>
              {profile.is_founder && <span className="badge badge-accent">FOUNDER</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <RankBadge tier={profile.tier} />
              {profile.division && <span className="badge badge-muted">{profile.division}</span>}
              {profile.speciality && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{profile.speciality}</span>}
            </div>
            {profile.motto && (
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', fontFamily: 'var(--font-mono)' }}>
                "{profile.motto}"
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600, color: 'var(--green)' }}>
              {formatCredits(profile.wallet_balance || 0)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em' }}>WALLET BALANCE</div>
            {profile.preferred_ship && (
              <div style={{ fontSize: 11, color: accentColor, marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                ◎ {profile.preferred_ship}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING DOSSIER...</div> : (
          <>
            {/* ── STAT CARDS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: 24 }}>
              {[
                { label: 'KILLS', value: stats.kills, color: 'var(--green)' },
                { label: 'DEATHS', value: stats.deaths, color: 'var(--red)' },
                { label: 'K/D', value: kd, color: 'var(--accent)' },
                { label: 'CONTRACTS', value: stats.contracts },
                { label: 'INTEL FILED', value: stats.intel },
                { label: 'MEDALS', value: medals.length, color: 'var(--accent)' },
                { label: 'CERTS', value: certs.length },
                { label: 'MEMBER SINCE', value: fmt(profile.joined_at), small: true },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '12px 14px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 9, letterSpacing: '.15em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: s.small ? 13 : 22, fontWeight: 600, color: s.color || 'var(--text-1)' }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div className="grid-2" style={{ gap: 24 }}>
              {/* ── LEFT COLUMN ── */}
              <div>
                {/* Medals */}
                <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>◆</span> COMMENDATIONS ({medals.length})
                </div>
                {medals.length === 0 ? (
                  <div style={{ padding: '16px 0', fontSize: 12, color: 'var(--text-3)' }}>No commendations earned yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
                    {medals.map(mm => (
                      <div key={mm.id} style={{ textAlign: 'center', width: 90 }}>
                        <MedalPatch name={mm.medal?.name} rarity={mm.medal?.rarity} size={72} />
                        <div style={{ fontSize: 9, fontWeight: 600, marginTop: 4, lineHeight: 1.3 }}>{mm.medal?.name}</div>
                        <div style={{ fontSize: 8, color: 'var(--text-3)' }}>{fmt(mm.awarded_at)}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Certifications */}
                <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>◆</span> CERTIFICATIONS ({certs.length})
                </div>
                {certs.length === 0 ? (
                  <div style={{ padding: '16px 0', fontSize: 12, color: 'var(--text-3)' }}>No certifications yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
                    {certs.map(mc => (
                      <span key={mc.id} style={{
                        background: 'var(--bg-raised)', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 500,
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor }} />
                        {mc.cert?.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Ship Hangar */}
                <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>◆</span> SHIP HANGAR ({ships.length})
                </div>
                {ships.length === 0 ? (
                  <div style={{ padding: '16px 0', fontSize: 12, color: 'var(--text-3)' }}>No ships assigned.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
                    {ships.map(s => (
                      <div key={s.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'var(--bg-raised)', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '8px 12px',
                      }}>
                        <div>
                          <span style={{ fontWeight: 500, fontSize: 13 }}>{s.vessel_name}</span>
                          <span style={{ color: 'var(--text-3)', fontSize: 11, marginLeft: 8 }}>{s.ship_class}</span>
                        </div>
                        <span className={`badge ${s.status === 'AVAILABLE' ? 'badge-green' : s.status === 'DEPLOYED' ? 'badge-amber' : 'badge-muted'}`} style={{ fontSize: 9 }}>{s.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── RIGHT COLUMN ── */}
              <div>
                {/* Bio */}
                {profile.bio && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>◆</span> BIO
                    </div>
                    <div style={{
                      background: 'var(--bg-raised)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: 16, fontSize: 13, color: 'var(--text-2)',
                      lineHeight: 1.8, whiteSpace: 'pre-wrap',
                    }}>
                      {profile.bio}
                    </div>
                  </div>
                )}

                {/* Recent Activity */}
                <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>◆</span> RECENT ACTIVITY
                </div>
                {activity.length === 0 ? (
                  <div style={{ padding: '16px 0', fontSize: 12, color: 'var(--text-3)' }}>No recent activity.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 24 }}>
                    {activity.map(a => (
                      <div key={a.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                        <span style={{ color: 'var(--text-2)' }}>{a.action?.replace(/_/g, ' ')}</span>
                        {a.details?.title && <span style={{ fontWeight: 500 }}> — {a.details.title}</span>}
                        <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{fmt(a.created_at)}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Edit Profile */}
                <button className="btn btn-ghost w-full" style={{ justifyContent: 'center' }} onClick={() => setEditing(!editing)}>
                  {editing ? 'CLOSE EDITOR' : 'EDIT PROFILE'}
                </button>

                {editing && (
                  <div style={{ marginTop: 16, background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
                    <form onSubmit={save}>
                      <div className="form-group">
                        <label className="form-label">MOTTO / TAGLINE</label>
                        <input className="form-input" value={form.motto} onChange={e => setForm(f => ({ ...f, motto: e.target.value }))} placeholder="Your personal creed..." maxLength={100} />
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">DIVISION</label>
                          <select className="form-select" value={form.division} onChange={e => setForm(f => ({ ...f, division: e.target.value }))}>
                            <option value="">—</option>
                            {SC_DIVISIONS.map(d => <option key={d}>{d}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">SPECIALITY</label>
                          <select className="form-select" value={form.speciality} onChange={e => setForm(f => ({ ...f, speciality: e.target.value }))}>
                            <option value="">—</option>
                            {SC_SPECIALITIES.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">PREFERRED SHIP</label>
                          <input className="form-input" value={form.preferred_ship} onChange={e => setForm(f => ({ ...f, preferred_ship: e.target.value }))} placeholder="e.g. Cutlass Black" />
                        </div>
                        <div className="form-group">
                          <label className="form-label">TIMEZONE</label>
                          <input className="form-input" value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} placeholder="e.g. GMT, EST" />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">AVATAR COLOR</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {AVATAR_COLORS.map(c => (
                            <div key={c} onClick={() => setForm(f => ({ ...f, avatar_color: c }))}
                              style={{
                                width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                                border: form.avatar_color === c ? '2.5px solid #fff' : '2px solid transparent',
                                boxShadow: form.avatar_color === c ? `0 0 8px ${c}66` : 'none',
                                transition: 'all .15s',
                              }} />
                          ))}
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">BIO</label>
                        <textarea className="form-textarea" value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Operative background, skills, areas of operation..." style={{ minHeight: 80 }} />
                      </div>

                      {error && <div className="form-error mb-8">{error}</div>}
                      <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? 'SAVING...' : saved ? '✓ SAVED' : 'SAVE CHANGES'}
                      </button>
                    </form>
                  </div>
                )}

                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  Handle and rank can only be changed by senior Grayveil leadership.
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
