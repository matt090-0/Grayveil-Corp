import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { getRankByTier, formatCredits } from '../lib/ranks'
import { SC_DIVISIONS, SC_SPECIALITIES } from '../lib/scdata'
import RankBadge from '../components/RankBadge'
import MedalPatch from '../components/MedalPatch'
import { useToast } from '../components/Toast'

const AVATAR_COLORS = [
  '#d4d8e0', '#4a90d9', '#d94a4a', '#4ad980', '#d94ad9',
  '#d9904a', '#4ad9d9', '#9060c8', '#60c860', '#c86060',
  '#8888a0', '#ffffff',
]

function fmt(ts) { return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }

export default function Profile() {
  const { profile, refreshProfile } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({
    division: profile.division || '', speciality: profile.speciality || '',
    bio: profile.bio || '', motto: profile.motto || '',
    avatar_color: profile.avatar_color || '#d4d8e0',
    preferred_ship: profile.preferred_ship || '', timezone: profile.timezone || '',
  })
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

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
      setMedals(mm || []); setCerts(mc || []); setShips(fl || [])
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

  const accentColor = profile.avatar_color || '#d4d8e0'
  const initials = profile.handle.slice(0, 2).toUpperCase()
  const kd = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(1) : stats.kills > 0 ? '∞' : '—'
  const isFounder = profile.is_founder

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      division: form.division || null, speciality: form.speciality || null,
      bio: form.bio || null, motto: form.motto || null,
      avatar_color: form.avatar_color || '#d4d8e0',
      preferred_ship: form.preferred_ship || null, timezone: form.timezone || null,
    }).eq('id', profile.id)
    if (error) { toast(error.message, 'error'); setSaving(false); return }
    await refreshProfile()
    toast('Profile updated', 'success')
    setSaving(false); setEditing(false)
  }

  return (
    <>
      {/* ═══ FOUNDER HERO BANNER ═══ */}
      {isFounder ? (
        <div style={{
          position: 'relative', overflow: 'hidden', flexShrink: 0,
          background: 'linear-gradient(160deg, #0e0e16 0%, #1a1520 40%, #0e0e16 100%)',
          borderBottom: '2px solid rgba(212,216,224,0.3)',
          padding: '40px 32px 32px',
        }}>
          {/* Background effects */}
          <div style={{
            position: 'absolute', top: '-30%', left: '-10%', width: '60%', height: '160%',
            background: `radial-gradient(ellipse, ${accentColor}08 0%, transparent 70%)`,
          }} />
          <div style={{
            position: 'absolute', top: 0, right: 0, width: '40%', height: '100%',
            background: 'linear-gradient(180deg, rgba(212,216,224,0.02) 0%, transparent 50%)',
          }} />
          {/* Grid overlay */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.015,
            backgroundImage: 'linear-gradient(rgba(212,216,224,1) 1px, transparent 1px), linear-gradient(90deg, rgba(212,216,224,1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />

          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 28 }}>
            {/* Large founder avatar */}
            <div style={{
              width: 110, height: 110, borderRadius: 16, flexShrink: 0,
              background: `linear-gradient(135deg, ${accentColor}20, ${accentColor}40)`,
              border: `3px solid ${accentColor}`,
              boxShadow: `0 0 40px ${accentColor}20, inset 0 0 20px ${accentColor}10`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700,
              color: accentColor,
            }}>
              {initials}
            </div>

            {/* Identity */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, letterSpacing: '.04em' }}>{profile.handle}</span>
                <span style={{
                  fontSize: 10, letterSpacing: '.2em', fontFamily: 'var(--font-mono)',
                  background: `linear-gradient(135deg, ${accentColor}30, ${accentColor}15)`,
                  border: `1px solid ${accentColor}60`, borderRadius: 6,
                  padding: '4px 12px', color: accentColor,
                }}>FOUNDER</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <RankBadge tier={profile.tier} />
                {profile.division && <span style={{ fontSize: 13, color: 'var(--text-2)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '3px 12px' }}>{profile.division}</span>}
                {profile.speciality && <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{profile.speciality}</span>}
              </div>
              {profile.motto && (
                <div style={{ fontSize: 15, color: 'var(--text-3)', fontStyle: 'italic', marginBottom: 8, maxWidth: 500 }}>"{profile.motto}"</div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', display: 'flex', gap: 16 }}>
                <span>JOINED {fmt(profile.joined_at).toUpperCase()}</span>
                {profile.timezone && <span>TZ: {profile.timezone}</span>}
                {profile.preferred_ship && <span>MAIN: {profile.preferred_ship}</span>}
              </div>
            </div>

            {/* Wallet */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>
                {formatCredits(profile.wallet_balance || 0)}
              </div>
              <div style={{ fontSize: 9, letterSpacing: '.15em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>WALLET BALANCE</div>
              <div style={{
                marginTop: 10, fontSize: 10, letterSpacing: '.15em', fontFamily: 'var(--font-mono)',
                color: accentColor, background: `${accentColor}10`, border: `1px solid ${accentColor}30`,
                borderRadius: 4, padding: '3px 10px', display: 'inline-block',
              }}>TIER {profile.tier} · {getRankByTier(profile.tier)?.label}</div>
            </div>
          </div>
        </div>
      ) : (
        /* ═══ STANDARD HERO (non-founder) ═══ */
        <div className="page-header" style={{ paddingBottom: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 24, padding: '24px 0',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}44)`,
              border: `2.5px solid ${accentColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700,
              color: accentColor, flexShrink: 0,
            }}>{initials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>{profile.handle}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <RankBadge tier={profile.tier} />
                {profile.division && <span className="badge badge-muted">{profile.division}</span>}
                {profile.speciality && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{profile.speciality}</span>}
              </div>
              {profile.motto && <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>"{profile.motto}"</div>}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600, color: 'var(--green)' }}>{formatCredits(profile.wallet_balance || 0)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em' }}>WALLET BALANCE</div>
            </div>
          </div>
        </div>
      )}

      <div className="page-body">
        {loading ? <div className="loading">LOADING DOSSIER...</div> : (
          <>
            {/* ═══ STAT CARDS ═══ */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isFounder ? 'repeat(4, 1fr)' : 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: isFounder ? 0 : 10,
              marginBottom: 24,
              ...(isFounder ? {
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                borderRadius: 10, overflow: 'hidden',
              } : {}),
            }}>
              {[
                { label: 'KILLS', value: stats.kills, color: 'var(--green)' },
                { label: 'DEATHS', value: stats.deaths, color: 'var(--red)' },
                { label: 'K/D', value: kd, color: accentColor },
                { label: 'CONTRACTS', value: stats.contracts },
              ].map((s, i) => (
                <div key={s.label} style={{
                  padding: isFounder ? '18px 0' : '12px 14px',
                  textAlign: 'center',
                  ...(isFounder ? { borderRight: i < 3 ? '1px solid var(--border)' : 'none' } : {
                    background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8,
                  }),
                }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: isFounder ? 32 : 22, fontWeight: 700, color: s.color || 'var(--text-1)', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: isFounder ? 10 : 9, letterSpacing: '.15em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Secondary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginBottom: 24 }}>
              {[
                { label: 'INTEL', value: stats.intel },
                { label: 'MEDALS', value: medals.length, color: accentColor },
                { label: 'REP', value: profile.rep_score || 0, color: accentColor },
                { label: 'CERTS', value: certs.length },
                { label: 'SHIPS', value: ships.length },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 0', textAlign: 'center',
                }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: s.color || 'var(--text-1)' }}>{s.value}</div>
                  <div style={{ fontSize: 8, letterSpacing: '.15em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid-2" style={{ gap: 24 }}>
              {/* ═══ LEFT COLUMN ═══ */}
              <div>
                {/* Medals */}
                <div style={{ fontSize: 10, letterSpacing: '.15em', color: accentColor, fontFamily: 'var(--font-mono)', marginBottom: 12, paddingBottom: 4, borderBottom: `1px solid ${accentColor}22` }}>
                  COMMENDATIONS ({medals.length})
                </div>
                {medals.length === 0 ? (
                  <div style={{ padding: '16px 0', fontSize: 12, color: 'var(--text-3)' }}>No commendations earned yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: isFounder ? 10 : 12, marginBottom: 24 }}>
                    {medals.map(mm => (
                      <div key={mm.id} style={{
                        textAlign: 'center', width: isFounder ? 80 : 90,
                        ...(isFounder ? {
                          background: 'var(--bg-raised)', borderRadius: 8,
                          border: '1px solid var(--border)', padding: '8px 4px',
                        } : {}),
                      }}>
                        <MedalPatch name={mm.medal?.name} rarity={mm.medal?.rarity} size={isFounder ? 60 : 72} />
                        <div style={{ fontSize: 9, fontWeight: 600, marginTop: 4, lineHeight: 1.3 }}>{mm.medal?.name}</div>
                        <div style={{ fontSize: 8, color: 'var(--text-3)' }}>{fmt(mm.awarded_at)}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Certs */}
                <div style={{ fontSize: 10, letterSpacing: '.15em', color: accentColor, fontFamily: 'var(--font-mono)', marginBottom: 12, paddingBottom: 4, borderBottom: `1px solid ${accentColor}22` }}>
                  CERTIFICATIONS ({certs.length})
                </div>
                {certs.length === 0 ? (
                  <div style={{ padding: '16px 0', fontSize: 12, color: 'var(--text-3)' }}>No certifications yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
                    {certs.map(mc => (
                      <span key={mc.id} style={{
                        background: 'var(--bg-raised)', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 500,
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor }} />
                        {mc.cert?.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Ships */}
                <div style={{ fontSize: 10, letterSpacing: '.15em', color: accentColor, fontFamily: 'var(--font-mono)', marginBottom: 12, paddingBottom: 4, borderBottom: `1px solid ${accentColor}22` }}>
                  SHIP HANGAR ({ships.length})
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

              {/* ═══ RIGHT COLUMN ═══ */}
              <div>
                {profile.bio && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 10, letterSpacing: '.15em', color: accentColor, fontFamily: 'var(--font-mono)', marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${accentColor}22` }}>BIO</div>
                    <div style={{
                      background: 'var(--bg-raised)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: 16, fontSize: 13, color: 'var(--text-2)',
                      lineHeight: 1.8, whiteSpace: 'pre-wrap',
                    }}>{profile.bio}</div>
                  </div>
                )}

                {/* Activity */}
                <div style={{ fontSize: 10, letterSpacing: '.15em', color: accentColor, fontFamily: 'var(--font-mono)', marginBottom: 12, paddingBottom: 4, borderBottom: `1px solid ${accentColor}22` }}>
                  RECENT ACTIVITY
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

                {/* Edit toggle */}
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
                              }} />
                          ))}
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">BIO</label>
                        <textarea className="form-textarea" value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Operative background, skills, areas of operation..." style={{ minHeight: 80 }} />
                      </div>
                      <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? 'SAVING...' : 'SAVE CHANGES'}
                      </button>
                    </form>
                  </div>
                )}

                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  Handle and rank can only be changed by Grayveil leadership.
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
