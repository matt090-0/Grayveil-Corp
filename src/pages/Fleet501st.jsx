import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import { fmtDateTime, timeUntil } from '../components/uee'
import { get501stCellMembers, is501stChosen, is501stUnlocked } from '../lib/fleet501st'

// ─────────────────────────────────────────────────────────────
// HighCouncil — the org's privy chamber. Was the 501st strike
// wing originally, repurposed as the strategic leadership cabal.
// (Underlying lib + DB key names stay `fleet_501st_*` for now —
// renaming the schema is a separate migration.)
//
// Visual: classified governance document. Hex backdrop, hatched
// classification stripes, corner brackets, sectioned chrome.
// Purple is the council seat color; blends with the warm cream/tan
// palette without breaking it. Renders only when the operator is
// BOTH on the council roster (server-checked) AND has unlocked
// this session via the CipherTerminal.
// ─────────────────────────────────────────────────────────────

const PURPLE = '#9d83e8'
const RED = '#c45a4a'
const GREEN = '#7ba673'

// Governing principles. Replaces the previous strike-tactic doctrine —
// the council deliberates and directs, it doesn't kick doors.
const PRINCIPLES = [
  {
    code: 'SOVEREIGN VOICE',
    brief: 'The council speaks first, last, and quietly. Decisions surface as standing orders, not announcements.',
  },
  {
    code: 'QUIET HAND',
    brief: 'Directives filter through other ranks without attribution. Outcomes are visible; authorship is not.',
  },
  {
    code: 'SHARED SILENCE',
    brief: 'No external references. No open-board chatter. This room does not exist outside this room.',
  },
]

// Council powers — what this body can authorize that lower ranks cannot.
const POWERS = [
  { name: 'TIER ELEVATION',          scope: 'Promote · demote · suspend' },
  { name: 'TREASURY UNLOCK',         scope: 'Disburse from corp reserves' },
  { name: 'CONTRACT SANCTION',       scope: 'Issue standing-order operations' },
  { name: 'DIPLOMATIC RECOGNITION',  scope: 'Bind alliances · KOS declarations' },
  { name: 'DOCTRINE AMENDMENT',      scope: 'Rewrite SOP · revise charter' },
]

// Theaters of strategic interest — areas the council actively monitors.
const THEATERS = ['STANTON · CRUSADER', 'PYRO RELAY', 'NYX REACH', 'TERRA EMBASSIES']

export default function Fleet501st() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [intelLoading, setIntelLoading] = useState(true)
  const [seats, setSeats] = useState([])
  const [ops, setOps] = useState([])

  useEffect(() => {
    async function run() {
      const { chosen } = await is501stChosen()
      const open = is501stUnlocked(profile)
      setAllowed(chosen)
      setUnlocked(open)
      setLoading(false)

      if (!chosen || !open) return
      setIntelLoading(true)
      const { members } = await get501stCellMembers()
      setSeats(members || [])

      const { data: upcomingOps } = await supabase
        .from('events')
        .select('id, title, event_type, location, starts_at, status')
        .in('status', ['SCHEDULED', 'LIVE'])
        .order('starts_at', { ascending: true })
        .limit(5)
      setOps(upcomingOps || [])
      setIntelLoading(false)
    }
    run()
  }, [profile?.id, profile])

  if (loading) {
    return (
      <div className="page-body">
        <div className="loading">CONVENING THE COUNCIL...</div>
      </div>
    )
  }
  if (!allowed) return <DenialScreen reason="not-cleared" />
  if (!unlocked) return <DenialScreen reason="not-unlocked" />

  const activeCount = seats.filter(m => m.status === 'ACTIVE').length
  const onlineCount = seats.filter(m =>
    m.last_seen_at && (Date.now() - new Date(m.last_seen_at).getTime()) < 5 * 60 * 1000
  ).length
  const nextSession = ops.find(o => o.status !== 'LIVE')?.starts_at || null
  const liveOps = ops.filter(o => o.status === 'LIVE').length
  const callsign = (profile?.handle || 'OPERATIVE').toUpperCase()

  return (
    <div style={{
      position: 'relative',
      height: '100%',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      background: '#040608',
    }}>
      {/* Hex backdrop */}
      <HexBackdrop />
      {/* Purple radial glow */}
      <div style={{
        position: 'absolute', top: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: '90%', height: 480,
        background: `radial-gradient(ellipse at top, ${PURPLE}1f 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* TOP CLASSIFICATION STRIP */}
      <ClassificationStrip>
        <span>● COMPARTMENTALIZED</span>
        <span>HIGH COUNCIL · PRIVY CHAMBER</span>
        <span>SEAT {callsign} · NOFORN</span>
      </ClassificationStrip>

      <div style={{
        position: 'relative',
        padding: 'clamp(28px, 4vw, 48px) clamp(20px, 4vw, 40px)',
        maxWidth: 1200, margin: '0 auto',
      }}>
        {/* HERO */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 24, marginBottom: 36,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
              letterSpacing: '.32em', color: PURPLE,
              textTransform: 'uppercase', marginBottom: 12,
            }}>● PRIVY DIRECTIVE · GRAYVEIL CORP</div>
            <h1 style={{
              fontFamily: 'Inter Tight, sans-serif',
              fontSize: 'clamp(42px, 7vw, 72px)',
              fontWeight: 800, letterSpacing: '-0.025em',
              lineHeight: 1, color: 'var(--text-1)',
              marginBottom: 16,
            }}>THE <span style={{ color: PURPLE }}>HIGH COUNCIL</span></h1>
            <p style={{
              fontFamily: 'Inter, sans-serif', fontSize: 16,
              color: 'var(--text-2)', lineHeight: 1.6,
              maxWidth: 580, fontStyle: 'italic',
            }}>
              "Profit is neutral. Discipline is not."
            </p>
            <p style={{
              fontFamily: 'Inter, sans-serif', fontSize: 13,
              color: 'var(--text-3)', lineHeight: 1.6,
              maxWidth: 580, marginTop: 6,
            }}>
              Strategic leadership and standing-order authority for the corporation.
              Decisions surface here first — they do not surface at all anywhere else.
            </p>
          </div>
          {/* Council seal stamp */}
          <div style={{
            border: `1px dashed ${PURPLE}88`,
            padding: '14px 18px',
            transform: 'rotate(-1.5deg)',
            fontFamily: 'JetBrains Mono, monospace',
            color: PURPLE, textTransform: 'uppercase',
            background: 'rgba(0,0,0,0.4)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 9, letterSpacing: '.32em', opacity: 0.7, marginBottom: 4 }}>SEAL OF THE</div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '.18em', fontFamily: 'Inter Tight, sans-serif' }}>COUNCIL</div>
            <div style={{ fontSize: 8, letterSpacing: '.3em', opacity: 0.7, marginTop: 4 }}>EX SILENTIO IMPERIUM</div>
          </div>
        </div>

        {/* TELEMETRY ROW */}
        <Section number="01" label="COUNCIL TELEMETRY">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 0,
            borderTop: `1px solid ${PURPLE}44`,
          }}>
            <Telemetry label="CHAMBER"      value={intelLoading ? 'SYNCING' : 'IN SESSION'} dot={GREEN} />
            <Telemetry label="POSTURE"      value="PRIVY"      dot={PURPLE} />
            <Telemetry label="LIVE ORDERS"  value={liveOps}    dot={liveOps > 0 ? GREEN : 'var(--text-3)'} />
            <Telemetry label="SEATS PRESENT" value={intelLoading ? '—' : `${onlineCount} / ${seats.length || 0}`} dot={GREEN} />
            <Telemetry label="NEXT CONVENE" value={nextSession ? timeUntil(nextSession) : 'STANDBY'} dot={nextSession ? PURPLE : 'var(--text-3)'} />
          </div>
        </Section>

        {/* GOVERNING PRINCIPLES */}
        <Section number="02" label="GOVERNING PRINCIPLES">
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 14,
          }}>
            {PRINCIPLES.map((d, i) => (
              <div key={d.code} style={{
                position: 'relative',
                background: 'rgba(11,14,19,0.7)',
                border: `1px solid ${PURPLE}33`,
                borderLeft: `3px solid ${PURPLE}`,
                padding: '20px 20px 18px',
              }}>
                <CornerTick color={PURPLE} pos={{ top: 6, right: 6 }} flipX />
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                  letterSpacing: '.24em', color: PURPLE,
                  marginBottom: 8,
                }}>CANON {String(i + 1).padStart(2, '0')}</div>
                <div style={{
                  fontFamily: 'Inter Tight, sans-serif', fontSize: 18,
                  fontWeight: 700, letterSpacing: '-0.01em',
                  color: 'var(--text-1)', marginBottom: 8,
                }}>{d.code}</div>
                <div style={{
                  fontFamily: 'Inter, sans-serif', fontSize: 13,
                  color: 'var(--text-2)', lineHeight: 1.55,
                }}>{d.brief}</div>
              </div>
            ))}
          </div>
          {/* Theater list */}
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
              letterSpacing: '.32em', color: 'var(--text-3)',
              textTransform: 'uppercase',
            }}>ZONES OF INTEREST:</span>
            {THEATERS.map((t, i) => (
              <span key={t} style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                letterSpacing: '.22em', color: 'var(--text-2)',
                position: 'relative',
              }}>{t}{i < THEATERS.length - 1 && <span style={{ color: 'var(--text-3)', margin: '0 8px' }}>·</span>}</span>
            ))}
          </div>
        </Section>

        {/* STANDING ORDERS (mission slate) */}
        <Section number="03" label="STANDING ORDERS">
          {ops.length === 0 ? (
            <EmptyBlock label="No directives in force. Council is in standby." />
          ) : (
            <div style={{ borderTop: '1px solid var(--border-md)' }}>
              {ops.map(op => {
                const isLive = op.status === 'LIVE'
                return (
                  <div key={op.id} style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto',
                    alignItems: 'center', gap: 16,
                    padding: '16px 4px',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: isLive ? GREEN : PURPLE,
                      boxShadow: `0 0 8px ${isLive ? GREEN : PURPLE}`,
                      animation: isLive ? 'pulse 2s ease-in-out infinite' : undefined,
                    }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'Inter Tight, sans-serif', fontSize: 16,
                        fontWeight: 700, color: 'var(--text-1)',
                        letterSpacing: '-0.01em',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{op.title}</div>
                      <div style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                        letterSpacing: '.22em', color: 'var(--text-3)',
                        textTransform: 'uppercase', marginTop: 4,
                      }}>
                        {op.event_type || 'DIRECTIVE'} · {op.location || 'TBD'} · {fmtDateTime(op.starts_at)}
                      </div>
                    </div>
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                      letterSpacing: '.22em',
                      color: isLive ? GREEN : PURPLE,
                      border: `1px solid ${isLive ? GREEN : PURPLE}66`,
                      padding: '3px 10px',
                      textTransform: 'uppercase',
                    }}>{op.status}</span>
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <button
              onClick={() => navigate('/events')}
              className="h-accent-bg"
              style={{
                background: PURPLE, color: '#0a0a0c', border: 'none', borderRadius: 2,
                padding: '10px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '.22em',
                fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase',
                cursor: 'pointer', transition: 'background .15s', marginRight: 8,
              }}
            >Open Ops Board →</button>
            <button
              onClick={() => navigate('/admin')}
              className="h-accent-edge"
              style={{
                background: 'transparent', color: 'var(--text-2)',
                border: '1px solid var(--border-md)', borderRadius: 2,
                padding: '10px 18px', fontSize: 11, fontWeight: 600, letterSpacing: '.22em',
                fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase',
                cursor: 'pointer', transition: 'border-color .15s, color .15s',
              }}
            >Command Console →</button>
          </div>
        </Section>

        {/* SEATED COUNCIL */}
        <Section number="04" label="SEATED COUNCIL">
          {intelLoading ? (
            <EmptyBlock label="Calling the rolls..." />
          ) : seats.length === 0 ? (
            <EmptyBlock label="No seats assigned. Configure member_ids or handles in org_settings.fleet_501st_members." />
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 12,
            }}>
              {seats.map(m => {
                const online = m.last_seen_at && (Date.now() - new Date(m.last_seen_at).getTime()) < 5 * 60 * 1000
                const inactive = m.status !== 'ACTIVE'
                return (
                  <div key={m.id} style={{
                    background: 'rgba(11,14,19,0.6)',
                    border: `1px solid ${PURPLE}33`,
                    padding: '14px 16px',
                    position: 'relative',
                  }}>
                    {inactive && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
                        letterSpacing: '.28em', color: RED,
                        textTransform: 'uppercase',
                      }}>RECUSED</div>
                    )}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: online ? GREEN : 'var(--text-3)',
                        boxShadow: online ? `0 0 8px ${GREEN}` : undefined,
                      }} />
                      <span style={{
                        fontFamily: 'Inter Tight, sans-serif', fontSize: 16,
                        fontWeight: 700, color: 'var(--text-1)',
                        letterSpacing: '-0.01em',
                      }}>{m.handle}</span>
                    </div>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                      letterSpacing: '.22em', color: 'var(--text-3)',
                      textTransform: 'uppercase', lineHeight: 1.7,
                    }}>
                      {m.rank || 'COUNCILLOR'} · T{m.tier ?? '?'}<br/>
                      {m.speciality || '— UNSPECIFIED —'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Section>

        {/* COUNCIL POWERS — replaces the strike wing's "authorized hardware" */}
        <Section number="05" label="COUNCIL POWERS">
          <div style={{ borderTop: '1px solid var(--border-md)' }}>
            {POWERS.map(p => (
              <div key={p.name} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 4px',
                borderBottom: '1px solid var(--border)',
                gap: 16,
              }}>
                <span style={{
                  fontFamily: 'Inter Tight, sans-serif', fontSize: 15,
                  fontWeight: 700, color: 'var(--text-1)',
                  letterSpacing: '-0.005em',
                }}>{p.name}</span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                  letterSpacing: '.24em', color: 'var(--text-3)',
                  textTransform: 'uppercase',
                }}>{p.scope}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* FOOTER */}
        <div style={{
          marginTop: 56, paddingTop: 24,
          borderTop: '1px dashed var(--border-md)',
          display: 'flex', flexDirection: 'column', gap: 6,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
          letterSpacing: '.28em', color: 'var(--text-3)',
          textTransform: 'uppercase', textAlign: 'center',
        }}>
          <div style={{ color: PURPLE, opacity: 0.85 }}>● Recorded in the privy alone ●</div>
          <div>Do not redistribute · Do not reference externally · No open-board chatter</div>
          <div style={{ marginTop: 6 }}>SEAT HASH {hashFor(profile?.id)} · {new Date().toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          }).toUpperCase()}</div>
        </div>
      </div>

      {/* BOTTOM CLASSIFICATION STRIP */}
      <ClassificationStrip>
        <span>● COMPARTMENTALIZED</span>
        <span>EYES ONLY · HIGH COUNCIL</span>
        <span>NOFORN · NOFWD ●</span>
      </ClassificationStrip>
    </div>
  )
}

// ── BUILDING BLOCKS ───────────────────────────────────────────

function Section({ number, label, children }) {
  return (
    <section style={{ marginBottom: 44 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16,
      }}>
        <span style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 32,
          fontWeight: 700, color: PURPLE, opacity: 0.4,
          lineHeight: 1, letterSpacing: '-0.03em',
        }}>{number}</span>
        <span style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
          letterSpacing: '.32em', color: 'var(--text-2)',
          textTransform: 'uppercase',
          flex: 1,
        }}>{label}</span>
        <span style={{
          flex: 1, height: 1, background: 'var(--border-md)',
          maxWidth: 160,
        }} />
      </div>
      {children}
    </section>
  )
}

function Telemetry({ label, value, dot }) {
  return (
    <div style={{
      padding: '18px 16px',
      borderRight: '1px solid var(--border)',
      borderBottom: `1px solid ${PURPLE}44`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: dot, boxShadow: `0 0 6px ${dot}`,
        }} />
        <span style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
          letterSpacing: '.24em', color: 'var(--text-3)',
          textTransform: 'uppercase',
        }}>{label}</span>
      </div>
      <div style={{
        fontFamily: 'Inter Tight, sans-serif', fontSize: 22,
        fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1,
        color: 'var(--text-1)',
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  )
}

function EmptyBlock({ label }) {
  return (
    <div style={{
      padding: 28, textAlign: 'center',
      border: '1px dashed var(--border-md)',
      fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
      letterSpacing: '.18em', color: 'var(--text-3)',
      textTransform: 'uppercase',
    }}>{label}</div>
  )
}

function HexBackdrop() {
  return (
    <svg
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        opacity: 0.045, pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      <defs>
        <pattern id="hex-council" width="42" height="36" patternUnits="userSpaceOnUse">
          <polygon points="11,1 31,1 42,18 31,35 11,35 0,18" fill="none" stroke="#e8e3d8" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hex-council)" />
    </svg>
  )
}

function ClassificationStrip({ children }) {
  return (
    <div style={{
      position: 'relative',
      height: 22,
      background: 'repeating-linear-gradient(90deg, transparent 0 18px, #1a1f2a 18px 36px)',
      borderTop: '1px solid #1a1f2a',
      borderBottom: '1px solid #1a1f2a',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 18px',
      fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
      letterSpacing: '.32em', color: 'var(--text-3)',
      textTransform: 'uppercase',
      flexWrap: 'wrap', gap: 6,
    }}>
      {children}
    </div>
  )
}

function CornerTick({ color, pos, flipX, flipY }) {
  const transform = `${flipX ? 'scaleX(-1)' : ''} ${flipY ? 'scaleY(-1)' : ''}`.trim()
  return (
    <svg
      width={8} height={8} viewBox="0 0 8 8"
      style={{ position: 'absolute', ...pos, transform, opacity: 0.6 }}
      aria-hidden="true"
    >
      <path d="M 0 0 L 8 0 M 0 0 L 0 8" stroke={color} strokeWidth="1.4" fill="none" />
    </svg>
  )
}

function hashFor(uuid) {
  if (!uuid) return '0000-0000'
  const clean = uuid.replace(/-/g, '')
  return `${clean.slice(0, 4).toUpperCase()}-${clean.slice(-4).toUpperCase()}`
}

// ── DENIAL SCREENS ────────────────────────────────────────────
// Operator hits the route without clearance / without unlocking.
// Non-cleared copy is intentionally minimal-info — does not confirm
// the chamber exists.

function DenialScreen({ reason }) {
  const navigate = useNavigate()
  const isCleared = reason === 'not-unlocked'
  const accent = isCleared ? PURPLE : RED
  return (
    <div style={{
      position: 'relative',
      height: '100%',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      background: '#040608',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <HexBackdrop />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse at center, ${accent}1a 0%, transparent 60%)`,
      }} />
      <div style={{
        position: 'relative',
        width: '100%', maxWidth: 460,
        background: 'rgba(11,14,19,0.92)',
        border: `1px solid ${accent}55`,
        borderLeft: `3px solid ${accent}`,
        padding: '32px 28px',
        textAlign: 'center',
      }}>
        <CornerTick color={accent} pos={{ top: 8, left: 8 }} />
        <CornerTick color={accent} pos={{ top: 8, right: 8 }} flipX />
        <CornerTick color={accent} pos={{ bottom: 8, left: 8 }} flipY />
        <CornerTick color={accent} pos={{ bottom: 8, right: 8 }} flipX flipY />
        <div style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
          letterSpacing: '.32em', color: accent,
          textTransform: 'uppercase', marginBottom: 16,
        }}>
          {isCleared ? '● SEAT NOT CONVENED' : '● ACCESS DENIED'}
        </div>
        <div style={{
          fontFamily: 'Inter Tight, sans-serif', fontSize: 26,
          fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1,
          color: 'var(--text-1)', marginBottom: 14,
        }}>{isCleared ? 'Re-authenticate to take your seat.' : 'No record of this chamber.'}</div>
        <div style={{
          fontFamily: 'Inter, sans-serif', fontSize: 13,
          color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 22,
        }}>
          {isCleared
            ? 'Your session expired. Click the Grayveil mark to re-establish the cipher gate.'
            : 'You do not have authorization for this chamber. This event has been logged.'}
        </div>
        <button
          onClick={() => navigate('/')}
          className="h-accent-bg"
          style={{
            background: 'var(--accent)', color: '#0a0a0c', border: 'none', borderRadius: 2,
            padding: '11px 22px', fontSize: 11, fontWeight: 700, letterSpacing: '.22em',
            fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase',
            cursor: 'pointer', transition: 'background .15s',
          }}
        >Return to SITREP</button>
      </div>
    </div>
  )
}
