import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { getRankByTier, formatCredits } from '../lib/ranks'
import { SC_DIVISIONS, SC_SPECIALITIES } from '../lib/scdata'
import RankBadge from '../components/RankBadge'
import MedalPatch from '../components/MedalPatch'
import { useToast } from '../components/Toast'
import { buildCitizenDossier, openDossier, downloadDossier } from '../lib/dossier'

const AVATAR_COLORS = [
  '#d4d8e0', '#4a90d9', '#d94a4a', '#4ad980', '#d94ad9',
  '#d9904a', '#4ad9d9', '#9060c8', '#60c860', '#c86060',
  '#8888a0', '#ffffff',
]

// UEE-aesthetic bureaucratic amber used for classification chrome.
const UEE_AMBER = '#c8a55a'

// Inline replica of the Banking credit tier helper — both pages reference
// the same 300-850 scale, but this one only needs a tiny read-only view.
const CREDIT_BANDS = [
  { min: 800, label: 'EXCELLENT', color: '#c8a55a' },
  { min: 740, label: 'VERY GOOD', color: '#5ce0a1' },
  { min: 670, label: 'GOOD',      color: '#5a80d9' },
  { min: 580, label: 'FAIR',      color: '#e0a155' },
  { min: 300, label: 'POOR',      color: '#e05c5c' },
]
function creditBand(score) {
  const s = Number(score) || 0
  return CREDIT_BANDS.find(b => s >= b.min) || CREDIT_BANDS[CREDIT_BANDS.length - 1]
}

function fmt(ts) {
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtMono(ts) {
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
}
function daysSince(ts) {
  return Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 86400000))
}
function citizenId(uuid) {
  // GV-XXXXXXXX from the first 8 hex chars of the profile UUID.
  return 'GV-' + (uuid || '').replace(/-/g, '').slice(0, 8).toUpperCase()
}

// Corner-clipped rectangle — the top-right and bottom-left corners get a
// 45° chamfer. Classic UEE panel silhouette.
const CLIP_CHAMFER = 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))'
// Hex silhouette for the avatar.
const CLIP_HEX = 'polygon(25% 2%, 75% 2%, 98% 50%, 75% 98%, 25% 98%, 2% 50%)'

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
  const [certs, setCerts]   = useState([])
  const [ships, setShips]   = useState([])
  const [stats, setStats]   = useState({ kills: 0, deaths: 0, assists: 0, contracts: 0, intel: 0 })
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
        kills:     (kills || []).filter(k => k.outcome === 'KILL').length,
        deaths:    (kills || []).filter(k => k.outcome === 'DEATH').length,
        assists:   (kills || []).filter(k => k.outcome === 'ASSIST').length,
        contracts: (claims || []).length,
        intel:     (intel || []).length,
      })
      setActivity(act || [])
      setLoading(false)
    }
    load()
  }, [profile.id])

  const accent   = profile.avatar_color || '#d4d8e0'
  const initials = profile.handle.slice(0, 2).toUpperCase()
  const kd       = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(1) : stats.kills > 0 ? '∞' : '—'
  const isFounder = !!profile.is_founder
  const rank     = getRankByTier(profile.tier)
  const tenure   = daysSince(profile.joined_at)
  const band     = creditBand(profile.credit_score ?? 600)
  const cid      = citizenId(profile.id)
  const todayMono = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()

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
    toast('Ident record updated', 'success')
    setSaving(false); setEditing(false)
  }

  return (
    <>
      {/* ═══ CLASSIFICATION HEADER ═══ */}
      <div style={{
        flexShrink: 0,
        background: 'linear-gradient(180deg, #0e0f14 0%, #0a0b0f 100%)',
        borderBottom: `1px solid ${UEE_AMBER}33`,
        padding: '6px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em',
        color: UEE_AMBER,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: UEE_AMBER,
            boxShadow: `0 0 8px ${UEE_AMBER}`, animation: 'pulse 2s ease-in-out infinite',
          }} />
          CITIZEN DOSSIER · UEE-REG
        </div>
        <div style={{ display: 'flex', gap: 20, color: 'var(--text-3)' }}>
          <span>FILE {cid}</span>
          <span>CERT. {todayMono}</span>
          <span style={{ color: UEE_AMBER }}>
            {isFounder ? 'CLEARANCE · FOUNDER' : `CLEARANCE · T${profile.tier}`}
          </span>
        </div>
      </div>

      {/* ═══ IDENT HERO ═══ */}
      <div style={{
        position: 'relative', overflow: 'hidden', flexShrink: 0,
        padding: '32px 28px 28px',
        background: `
          radial-gradient(ellipse 80% 100% at 15% 0%, ${accent}12 0%, transparent 55%),
          radial-gradient(ellipse 60% 100% at 85% 100%, ${UEE_AMBER}08 0%, transparent 60%),
          linear-gradient(180deg, #0d0e14 0%, #0a0b0f 100%)
        `,
        borderBottom: '1px solid var(--border)',
      }}>
        {/* faint scanline grid */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(212,216,224,1) 1px, transparent 1px), linear-gradient(90deg, rgba(212,216,224,1) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 28, alignItems: 'stretch' }}>
          {/* ── HEX AVATAR ── */}
          <div style={{ position: 'relative', width: 132, height: 132, flexShrink: 0 }}>
            {/* outer ring */}
            <div style={{
              position: 'absolute', inset: 0, clipPath: CLIP_HEX,
              background: `conic-gradient(from 210deg, ${accent}55, ${accent}ee, ${accent}55, ${accent}22, ${accent}ee)`,
              filter: `drop-shadow(0 0 18px ${accent}44)`,
            }} />
            {/* inner fill */}
            <div style={{
              position: 'absolute', inset: 3, clipPath: CLIP_HEX,
              background: `radial-gradient(circle at 30% 25%, ${accent}26, #0a0b0f 80%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700,
              color: accent, letterSpacing: '.05em',
            }}>
              {initials}
            </div>
            {/* tier ribbon */}
            <div style={{
              position: 'absolute', left: '50%', bottom: -8, transform: 'translateX(-50%)',
              background: '#0a0b0f', border: `1px solid ${accent}88`,
              padding: '3px 12px', borderRadius: 3,
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.2em',
              color: accent, whiteSpace: 'nowrap',
            }}>
              T{profile.tier}
            </div>
          </div>

          {/* ── IDENTITY ── */}
          <div style={{ minWidth: 0, paddingTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 14, marginBottom: 10 }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700,
                letterSpacing: '.04em', lineHeight: 1,
              }}>{profile.handle}</span>
              {isFounder && (
                <span style={{
                  fontSize: 10, letterSpacing: '.25em', fontFamily: 'var(--font-mono)',
                  background: `linear-gradient(135deg, ${UEE_AMBER}26, ${UEE_AMBER}10)`,
                  border: `1px solid ${UEE_AMBER}88`, borderRadius: 3,
                  padding: '5px 12px', color: UEE_AMBER, fontWeight: 600,
                  boxShadow: `0 0 16px ${UEE_AMBER}22`,
                }}>◆ FOUNDER</span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: profile.motto ? 12 : 16 }}>
              <RankBadge tier={profile.tier} />
              {profile.division && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em',
                  color: 'var(--text-2)', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3,
                  padding: '4px 11px',
                }}>{profile.division.toUpperCase()}</span>
              )}
              {profile.speciality && (
                <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.15em' }}>
                  · {profile.speciality.toUpperCase()}
                </span>
              )}
            </div>

            {profile.motto && (
              <div style={{
                fontSize: 14, color: 'var(--text-2)', fontStyle: 'italic',
                borderLeft: `2px solid ${accent}66`, paddingLeft: 12, marginBottom: 16,
                maxWidth: 560, lineHeight: 1.5,
              }}>
                "{profile.motto}"
              </div>
            )}

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10,
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.15em',
            }}>
              <DataLine label="ENLISTED"    value={fmtMono(profile.joined_at)} />
              <DataLine label="IN SERVICE"  value={`${tenure.toLocaleString()} DAY${tenure === 1 ? '' : 'S'}`} />
              {profile.timezone      && <DataLine label="TIME ZONE" value={profile.timezone.toUpperCase()} />}
              {profile.preferred_ship && <DataLine label="MAIN"      value={profile.preferred_ship.toUpperCase()} />}
            </div>
          </div>

          {/* ── WALLET / STATUS PANEL ── */}
          <div style={{
            flexShrink: 0, minWidth: 220, padding: '16px 20px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border)', clipPath: CLIP_CHAMFER,
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.25em', color: 'var(--text-3)', marginBottom: 4 }}>
                UEC BALANCE
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--green)', lineHeight: 1 }}>
                {formatCredits(profile.wallet_balance || 0)}
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border)' }} />

            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.25em', color: 'var(--text-3)', marginBottom: 4 }}>
                CREDIT RATING
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: band.color, lineHeight: 1 }}>
                  {profile.credit_score ?? 600}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.2em', color: band.color }}>
                  {band.label}
                </span>
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border)' }} />

            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.25em', color: 'var(--text-3)', marginBottom: 4 }}>
                RANK
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: rank.color }}>
                {rank.label.toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING DOSSIER...</div> : (
          <>
            {/* ═══ SERVICE METRICS STRIP ═══ */}
            <SectionLabel color={accent}>SERVICE METRICS</SectionLabel>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
              gap: 0, marginBottom: 28,
              background: 'var(--bg-raised)',
              border: '1px solid var(--border)', clipPath: CLIP_CHAMFER,
              overflow: 'hidden',
            }}>
              {[
                { label: 'KILLS',        value: stats.kills,        color: 'var(--green)' },
                { label: 'DEATHS',       value: stats.deaths,       color: 'var(--red)'   },
                { label: 'K/D',          value: kd,                 color: accent         },
                { label: 'CONTRACTS',    value: stats.contracts                            },
                { label: 'COMMENDATIONS',value: medals.length,      color: accent         },
                { label: 'CERTS',        value: certs.length                               },
                { label: 'INTEL',        value: stats.intel                                },
                { label: 'FLEET',        value: ships.length                               },
              ].map((s, i, arr) => (
                <div key={s.label} style={{
                  padding: '18px 8px', textAlign: 'center',
                  borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  position: 'relative',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700,
                    color: s.color || 'var(--text-1)', lineHeight: 1,
                  }}>{s.value}</div>
                  <div style={{
                    fontSize: 9, letterSpacing: '.18em', color: 'var(--text-3)',
                    fontFamily: 'var(--font-mono)', marginTop: 6,
                  }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid-2" style={{ gap: 24 }}>
              {/* ═══ LEFT COLUMN — SERVICE RECORD ═══ */}
              <div>
                <SectionLabel color={accent}>SERVICE HISTORY</SectionLabel>
                {activity.length === 0 ? (
                  <EmptyLine>No entries on record.</EmptyLine>
                ) : (
                  <div style={{ marginBottom: 28, position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: 6, top: 4, bottom: 4, width: 1,
                      background: `linear-gradient(180deg, ${accent}55, ${accent}11 95%)`,
                    }} />
                    {activity.map(a => (
                      <div key={a.id} style={{
                        position: 'relative', paddingLeft: 22, paddingBottom: 12,
                      }}>
                        <div style={{
                          position: 'absolute', left: 2, top: 7, width: 9, height: 9,
                          borderRadius: '50%', background: '#0a0b0f',
                          border: `1.5px solid ${accent}`, boxShadow: `0 0 6px ${accent}55`,
                        }} />
                        <div style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.4 }}>
                          <span style={{ color: 'var(--text-2)' }}>{(a.action || '').replace(/_/g, ' ').toUpperCase()}</span>
                          {a.details?.title && <span style={{ fontWeight: 500 }}> — {a.details.title}</span>}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em', marginTop: 2 }}>
                          {fmtMono(a.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {profile.bio && (
                  <>
                    <SectionLabel color={accent}>PERSONAL NOTE</SectionLabel>
                    <div style={{
                      background: 'var(--bg-raised)', border: '1px solid var(--border)',
                      clipPath: CLIP_CHAMFER, padding: 18, fontSize: 13,
                      color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap',
                      marginBottom: 28,
                    }}>{profile.bio}</div>
                  </>
                )}
              </div>

              {/* ═══ RIGHT COLUMN — AWARDS / QUALS / FLEET ═══ */}
              <div>
                <SectionLabel color={accent}>COMMENDATIONS ({medals.length})</SectionLabel>
                {medals.length === 0 ? (
                  <EmptyLine>No commendations awarded.</EmptyLine>
                ) : (
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))',
                    gap: 10, marginBottom: 28,
                  }}>
                    {medals.map(mm => (
                      <div key={mm.id} style={{
                        background: 'var(--bg-raised)', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '10px 6px', textAlign: 'center',
                        transition: 'border-color .15s ease, transform .15s ease',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${accent}88`; e.currentTarget.style.transform = 'translateY(-2px)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)';  e.currentTarget.style.transform = 'none' }}
                      >
                        <MedalPatch name={mm.medal?.name} rarity={mm.medal?.rarity} size={56} />
                        <div style={{ fontSize: 10, fontWeight: 600, marginTop: 6, lineHeight: 1.3 }}>{mm.medal?.name}</div>
                        <div style={{ fontSize: 8, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em', marginTop: 2 }}>
                          {fmtMono(mm.awarded_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <SectionLabel color={accent}>QUALIFICATIONS ({certs.length})</SectionLabel>
                {certs.length === 0 ? (
                  <EmptyLine>No qualifications on record.</EmptyLine>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 28 }}>
                    {certs.map(mc => (
                      <span key={mc.id} style={{
                        background: 'var(--bg-raised)', border: `1px solid ${accent}44`,
                        borderRadius: 3, padding: '6px 12px', fontSize: 11, fontWeight: 500,
                        display: 'inline-flex', alignItems: 'center', gap: 7,
                        fontFamily: 'var(--font-mono)', letterSpacing: '.1em',
                        color: 'var(--text-2)',
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: accent, boxShadow: `0 0 5px ${accent}` }} />
                        {mc.cert?.name?.toUpperCase()}
                      </span>
                    ))}
                  </div>
                )}

                <SectionLabel color={accent}>ASSIGNED VESSELS ({ships.length})</SectionLabel>
                {ships.length === 0 ? (
                  <EmptyLine>No vessels assigned.</EmptyLine>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 28 }}>
                    {ships.map(s => (
                      <div key={s.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'var(--bg-raised)', border: '1px solid var(--border)',
                        borderRadius: 4, padding: '10px 14px',
                        transition: 'border-color .15s ease',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${accent}55` }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{s.vessel_name}</div>
                          <div style={{
                            color: 'var(--text-3)', fontSize: 10, marginTop: 2,
                            fontFamily: 'var(--font-mono)', letterSpacing: '.12em',
                          }}>
                            {(s.ship_class || '').toUpperCase()}{s.manufacturer ? ` · ${s.manufacturer.toUpperCase()}` : ''}
                          </div>
                        </div>
                        <span className={`badge ${s.status === 'AVAILABLE' ? 'badge-green' : s.status === 'DEPLOYED' ? 'badge-amber' : 'badge-muted'}`} style={{ fontSize: 9 }}>
                          {s.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ═══ EDIT IDENT ═══ */}
            <div style={{
              marginTop: 8, paddingTop: 20,
              borderTop: `1px dashed ${UEE_AMBER}33`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: editing ? 16 : 0 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em', color: UEE_AMBER, marginBottom: 4 }}>
                    IDENT RECORD · SELF-SERVICE
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    Handle and rank are leadership-managed. You may amend division, tagline, ship, and personal note.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                  <button
                    onClick={async () => {
                      // Clear onboarded_at so the next render mounts the tour
                      // (Layout watches this column on the auth profile).
                      const { error } = await supabase.from('profiles')
                        .update({ onboarded_at: null }).eq('id', profile.id)
                      if (error) { toast(error.message, 'error'); return }
                      if (refreshProfile) await refreshProfile()
                      toast('Replaying orientation tour...', 'info')
                    }}
                    title="Replay the first-login tour."
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
                      fontSize: 10, letterSpacing: '.2em', fontWeight: 600,
                      padding: '9px 14px', borderRadius: 3, cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ↻ REPLAY TOUR
                  </button>
                  <button
                    onClick={() => {
                      const { html, filename } = buildCitizenDossier(profile, { medals, certs, ships, stats })
                      const w = openDossier(html)
                      if (!w) {
                        // Popup blocked — fall back to direct download.
                        downloadDossier(html, filename)
                        toast('Popup blocked — dossier downloaded', 'info')
                      } else {
                        toast('Dossier opened in new tab', 'success')
                      }
                    }}
                    title="Opens a printable UEE-styled HTML dossier in a new tab. Use the browser print dialog to save as PDF."
                    style={{
                      background: 'transparent',
                      border: `1px solid ${UEE_AMBER}`,
                      color: UEE_AMBER, fontFamily: 'var(--font-mono)',
                      fontSize: 10, letterSpacing: '.2em', fontWeight: 600,
                      padding: '9px 14px', borderRadius: 3, cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ⎙ EXPORT DOSSIER
                  </button>
                  <button
                    onClick={() => setEditing(!editing)}
                    style={{
                      background: editing ? `${accent}22` : 'transparent',
                      border: `1px solid ${accent}`,
                      color: accent, fontFamily: 'var(--font-mono)',
                      fontSize: 10, letterSpacing: '.2em', fontWeight: 600,
                      padding: '9px 18px', borderRadius: 3, cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {editing ? '◂ CLOSE' : 'AMEND ▸'}
                  </button>
                </div>
              </div>

              {editing && (
                <form onSubmit={save} style={{
                  background: 'var(--bg-raised)', border: '1px solid var(--border)',
                  clipPath: CLIP_CHAMFER, padding: 20, marginTop: 8,
                }}>
                  <div className="form-group">
                    <label className="form-label">MOTTO / TAGLINE</label>
                    <input className="form-input" value={form.motto}
                      onChange={e => setForm(f => ({ ...f, motto: e.target.value }))}
                      placeholder="Your personal creed..." maxLength={100} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">DIVISION</label>
                      <select className="form-select" value={form.division}
                        onChange={e => setForm(f => ({ ...f, division: e.target.value }))}>
                        <option value="">—</option>
                        {SC_DIVISIONS.map(d => (
                          <option key={d} value={d} disabled={d === 'High Command' && !profile.is_head_founder}>
                            {d}{d === 'High Command' && !profile.is_head_founder ? ' · head-only' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">SPECIALITY</label>
                      <select className="form-select" value={form.speciality}
                        onChange={e => setForm(f => ({ ...f, speciality: e.target.value }))}>
                        <option value="">—</option>
                        {SC_SPECIALITIES.map(s => (
                          <option key={s} value={s} disabled={s === 'Strategic Command' && !profile.is_head_founder}>
                            {s}{s === 'Strategic Command' && !profile.is_head_founder ? ' · head-only' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">PREFERRED SHIP</label>
                      <input className="form-input" value={form.preferred_ship}
                        onChange={e => setForm(f => ({ ...f, preferred_ship: e.target.value }))}
                        placeholder="e.g. Cutlass Black" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">TIMEZONE</label>
                      <input className="form-input" value={form.timezone}
                        onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                        placeholder="e.g. GMT, EST" />
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
                    <label className="form-label">PERSONAL NOTE</label>
                    <textarea className="form-textarea" value={form.bio}
                      onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                      placeholder="Operative background, skills, areas of operation..."
                      style={{ minHeight: 90 }} />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'FILING...' : 'FILE AMENDMENT'}
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

function SectionLabel({ color, children }) {
  return (
    <div style={{
      fontSize: 10, letterSpacing: '.2em', fontFamily: 'var(--font-mono)',
      color, marginBottom: 12, paddingBottom: 5,
      display: 'flex', alignItems: 'center', gap: 10,
      borderBottom: `1px solid ${color}22`,
    }}>
      <span style={{ width: 4, height: 4, background: color, boxShadow: `0 0 6px ${color}` }} />
      {children}
    </div>
  )
}

function DataLine({ label, value }) {
  return (
    <div>
      <div style={{ color: 'var(--text-3)', marginBottom: 3 }}>{label}</div>
      <div style={{ color: 'var(--text-1)', letterSpacing: '.1em' }}>{value}</div>
    </div>
  )
}

function EmptyLine({ children }) {
  return (
    <div style={{
      padding: '12px 14px', marginBottom: 28,
      fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic',
      background: 'rgba(255,255,255,0.02)',
      border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 4,
    }}>
      {children}
    </div>
  )
}
