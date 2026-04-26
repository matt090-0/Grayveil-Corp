import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import GrayveilLogo from '../components/GrayveilLogo'
import { RANKS } from '../lib/ranks'
import { useSeo, useJsonLd } from '../lib/useSeo'

const LADDER_COLORS = {
  1: '#e8c98a',
  2: '#d4d8e0',
  3: '#a8afbd',
  4: '#4a90d9',
  5: '#6ba6d9',
  6: '#8b6fc7',
  7: '#a590c8',
  8: '#d4943a',
  9: '#6a7280',
}

const DIVISIONS = [
  {
    code: '01',
    name: 'COMBAT OPERATIONS',
    tagline: 'Bounties, escorts, and open warfare.',
    body: 'Strike teams run bounty contracts, defend convoys, and answer calls for hostile engagement. Kills are logged, medals are earned.',
  },
  {
    code: '02',
    name: 'INDUSTRIAL & TRADE',
    tagline: 'Mining, refining, and market work.',
    body: 'Haul cargo, run mining ops, and arbitrage the markets. The org tracks every credit and auto-pays out on contract completion.',
  },
  {
    code: '03',
    name: 'LOGISTICS & FLEET',
    tagline: 'Ships, fuel, and repair.',
    body: 'Manage the shared fleet, coordinate reservations, and keep combat teams in the air. Access to org-funded capital ships.',
  },
  {
    code: '04',
    name: 'INTELLIGENCE',
    tagline: 'Recon, diplomacy, and discretion.',
    body: 'Track hostile orgs, file intel reports across clearance tiers, and feed leadership the picture that wins the next op.',
  },
]

const FAQ = [
  {
    q: 'What is Grayveil?',
    a: 'A private military and commercial Star Citizen organization operating across the Stanton system. We run contracts, operations, and an internal economy with shared fleet, treasury, and aUEC wallets for every member.',
  },
  {
    q: 'Do I need to own expensive ships to join?',
    a: 'No. Grayveil operates a shared fleet and runs crowd-funded ship projects so members can crew vessels far bigger than they own. Bring whatever you fly — we build around it.',
  },
  {
    q: 'What is the activity requirement?',
    a: 'There is no hard weekly minimum, but members who go inactive can be moved to a suspended status. Let leadership know if you need a break; no strikes for honest absences.',
  },
  {
    q: 'Do I have to use voice comms?',
    a: 'Discord voice is standard for live operations. Ensigns can listen-only while they get comfortable, but combat and logistics ops expect voice presence. No mic shaming — we all started somewhere.',
  },
  {
    q: 'How does the org economy work?',
    a: 'Every member gets an in-app wallet. Contracts auto-payout when marked complete, a configurable tax feeds the org treasury, and members can request loans or contribute to ship-fund campaigns. Every aUEC transaction is logged.',
  },
  {
    q: 'How do I earn medals and move up in rank?',
    a: 'Medals are auto-awarded when you cross real thresholds — confirmed kills, contracts run, aUEC earned, funds contributed. Promotions come from activity, leadership trust, and completing certifications tied to roles.',
  },
  {
    q: 'Do you run organized ops or is it solo work?',
    a: 'Both. Contracts can be solo or squad, and scheduled events (with RSVP + ship assignments) run regularly. After-action reports are filed so every op improves the next one.',
  },
  {
    q: 'What are the rules?',
    a: 'No griefing fellow members, no internal theft, and respect the chain of command during ops. Banned conduct is enforced through a strike system with clear reasons and appeal paths — nothing is silent or arbitrary.',
  },
]

const sectionLabel = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  letterSpacing: '.35em',
  color: '#6a7280',
  marginBottom: 14,
  textAlign: 'center',
}
const sectionHeading = {
  fontFamily: 'Syne, sans-serif',
  fontSize: 'clamp(24px, 4vw, 36px)',
  fontWeight: 700,
  letterSpacing: '.08em',
  color: '#ededf2',
  textAlign: 'center',
  marginBottom: 40,
}

function Section({ eyebrow, title, children }) {
  return (
    <section style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto', position: 'relative' }}>
      <div style={sectionLabel}>{eyebrow}</div>
      <h2 style={sectionHeading}>{title}</h2>
      {children}
    </section>
  )
}

function Divisions() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: 18,
    }}>
      {DIVISIONS.map(d => (
        <div key={d.code} style={{
          background: 'rgba(21,23,28,0.7)',
          border: '1px solid rgba(212,216,224,0.08)',
          borderRadius: 12,
          padding: '24px 22px',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10, letterSpacing: '.3em', color: '#6a7280',
            marginBottom: 12,
          }}>DIVISION {d.code}</div>
          <div style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 17, fontWeight: 700, letterSpacing: '.08em',
            color: '#ededf2', marginBottom: 6,
          }}>{d.name}</div>
          <div style={{
            fontSize: 13, color: '#b8bcc8',
            fontStyle: 'italic', marginBottom: 14,
          }}>{d.tagline}</div>
          <div style={{ fontSize: 13, color: '#8a8f9c', lineHeight: 1.65 }}>
            {d.body}
          </div>
        </div>
      ))}
    </div>
  )
}

function FleetShowcase({ ships }) {
  if (!ships.length) return null
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: 12,
    }}>
      {ships.map(s => (
        <div key={s.id} style={{
          background: 'rgba(15,16,21,0.75)',
          border: '1px solid rgba(212,216,224,0.07)',
          borderRadius: 10,
          padding: '16px 18px',
        }}>
          <div style={{
            fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 600,
            color: '#ededf2', letterSpacing: '.04em', marginBottom: 4,
          }}>{s.vessel_name}</div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
            letterSpacing: '.18em', color: '#6a7280',
          }}>
            {s.manufacturer || '—'} · {s.ship_class}
            {s.role ? ` · ${s.role}` : ''}
          </div>
        </div>
      ))}
    </div>
  )
}

function TierLadder() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      maxWidth: 720, margin: '0 auto',
    }}>
      {RANKS.map(r => {
        const c = LADDER_COLORS[r.tier] || r.color
        return (
          <div key={r.tier} style={{
            display: 'grid',
            gridTemplateColumns: '48px 1fr auto',
            alignItems: 'center',
            gap: 16,
            background: `linear-gradient(90deg, ${c}0f 0%, rgba(15,16,21,0.55) 40%)`,
            border: '1px solid rgba(212,216,224,0.06)',
            borderLeft: `3px solid ${c}`,
            borderRadius: 8,
            padding: '12px 18px',
          }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11, color: c, opacity: 0.85, letterSpacing: '.15em',
            }}>T-{r.tier}</div>
            <div style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 14, fontWeight: 600, letterSpacing: '.1em',
              color: '#ededf2',
            }}>{r.rank}</div>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: c, boxShadow: `0 0 12px ${c}88`,
            }} />
          </div>
        )
      })}
      <div style={{
        textAlign: 'center', marginTop: 18,
        fontSize: 12, color: '#6a7280', fontStyle: 'italic',
      }}>
        Every new operative enters at Recruit. Rank is earned, never granted.
      </div>
    </div>
  )
}

function FaqList() {
  const [openIdx, setOpenIdx] = useState(0)
  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      {FAQ.map((item, i) => {
        const open = openIdx === i
        return (
          <div key={item.q} style={{
            borderBottom: '1px solid rgba(212,216,224,0.08)',
          }}>
            <button
              onClick={() => setOpenIdx(open ? -1 : i)}
              style={{
                width: '100%', textAlign: 'left',
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '20px 4px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                gap: 16,
                color: open ? '#ededf2' : '#b8bcc8',
                fontFamily: 'Inter, sans-serif',
                fontSize: 15, fontWeight: 500,
                transition: 'color .15s',
              }}
            >
              <span>{item.q}</span>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 14, color: '#6a7280',
                transform: open ? 'rotate(45deg)' : 'none',
                transition: 'transform .2s',
                flexShrink: 0,
              }}>+</span>
            </button>
            {open && (
              <div style={{
                padding: '0 4px 22px',
                color: '#8a8f9c', fontSize: 14, lineHeight: 1.75,
              }}>{item.a}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Landing() {
  const [stats, setStats] = useState({ members: 0, ships: 0, contracts: 0 })
  const [ships, setShips] = useState([])
  const navigate = useNavigate()

  useSeo({
    title: 'Grayveil Corporation — Private Military & Commercial Enterprise',
    description: 'A Star Citizen organization operating across the Stanton system. Shared fleet, internal economy, auto-tracked medals, and real ops. Apply for membership.',
    path: '/welcome',
  })

  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Grayveil Corporation',
    url: 'https://grayveil.net',
    logo: 'https://grayveil.net/brand/icon.png',
    image: 'https://grayveil.net/brand/banner.png',
    slogan: 'Profit is neutral. Everything else is negotiable.',
    description: 'Private military and commercial Star Citizen organization operating in the Stanton system.',
  })

  useEffect(() => {
    async function load() {
      // Hit the SECURITY DEFINER RPCs instead of querying the
      // tables directly. /welcome is unauthenticated, so the
      // anon role hits RLS that blocks fleet/contracts SELECT.
      // The RPCs bypass RLS and return only the public-safe
      // fields the landing page actually needs.
      const [{ data: stats }, { data: fleetRows }] = await Promise.all([
        supabase.rpc('public_org_stats'),
        supabase.rpc('public_fleet_showcase'),
      ])
      setStats({
        members:   stats?.members   || 0,
        ships:     stats?.ships     || 0,
        contracts: stats?.contracts || 0,
      })
      setShips(fleetRows || [])
    }
    load()
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0b0f',
      position: 'relative', overflow: 'hidden', color: '#ededf2',
    }}>
      {/* Background overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url(/brand/background.png)',
        backgroundSize: 'cover', backgroundPosition: 'center',
        opacity: 0.35, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, transparent 0%, rgba(10,11,15,0.85) 55%, rgba(10,11,15,1) 100%)',
        pointerEvents: 'none',
      }} />

      {/* ── HERO ── */}
      <div style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center',
        padding: '80px 20px 40px',
        minHeight: '85vh',
      }}>
        {/* Radial glow */}
        <div style={{
          position: 'absolute', top: '35%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,216,224,0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', maxWidth: 720 }}>
          <div style={{ marginBottom: 24, filter: 'drop-shadow(0 0 20px rgba(212,216,224,0.2))' }}>
            <GrayveilLogo size={110} />
          </div>
          <h1 style={{
            fontFamily: 'Syne, sans-serif', fontSize: 'clamp(36px, 6vw, 56px)',
            fontWeight: 700, letterSpacing: '.15em',
            background: 'linear-gradient(180deg, #ffffff 0%, #b8bcc8 60%, #6a7280 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text', margin: '0 0 8px',
          }}>GRAYVEIL</h1>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 'clamp(10px, 2vw, 13px)',
            letterSpacing: '.3em', color: '#6a7280', marginBottom: 32,
          }}>CORPORATION · STANTON SYSTEM</div>
          <p style={{
            fontFamily: 'Inter, sans-serif', fontSize: 'clamp(15px, 2.5vw, 19px)',
            color: '#b8bcc8', lineHeight: 1.7, marginBottom: 10,
            fontStyle: 'italic', fontWeight: 300, letterSpacing: '.02em',
          }}>"Profit is neutral. Everything else is negotiable."</p>
          <p style={{
            fontFamily: 'Inter, sans-serif', fontSize: 'clamp(13px, 2vw, 15px)',
            color: '#8a8f9c', lineHeight: 1.8, marginBottom: 40,
            maxWidth: 560, margin: '0 auto 40px',
          }}>
            A private military and commercial enterprise operating across the Stanton system.
            Contracts, intelligence, and discretion — backed by a shared fleet and a real internal economy.
          </p>

          {/* Stats */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 'clamp(24px, 5vw, 60px)',
            marginBottom: 48, flexWrap: 'wrap',
          }}>
            {[
              { label: 'OPERATIVES', value: stats.members },
              { label: 'VESSELS', value: stats.ships },
              { label: 'CONTRACTS', value: stats.contracts },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: 'Syne, sans-serif', fontSize: 'clamp(24px, 4vw, 36px)',
                  fontWeight: 700,
                  background: 'linear-gradient(180deg, #ffffff 0%, #b8bcc8 80%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>{s.value}</div>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 'clamp(8px, 1.5vw, 10px)',
                  letterSpacing: '.2em', color: '#4a4f5c', marginTop: 4,
                }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/apply')} style={{
              background: 'linear-gradient(180deg, #e8ecf2 0%, #b8bcc8 60%, #6a7280 100%)',
              color: '#0a0b0f', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
              padding: '14px 36px', fontSize: 13, fontWeight: 700,
              fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.1em',
              cursor: 'pointer', transition: 'transform .15s, box-shadow .15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(212,216,224,0.25)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
            >APPLY FOR MEMBERSHIP</button>
            <button onClick={() => navigate('/auth')} style={{
              background: 'transparent', color: '#8a8f9c',
              border: '1px solid #333344', borderRadius: 8,
              padding: '14px 36px', fontSize: 13, fontWeight: 500,
              fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.08em',
              cursor: 'pointer', transition: 'border-color .15s, color .15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#d4d8e0'; e.currentTarget.style.color = '#d4d8e0' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#333344'; e.currentTarget.style.color = '#8a8f9c' }}
            >MEMBER LOGIN</button>
          </div>
        </div>
      </div>

      {/* ── DIVISIONS ── */}
      <Section eyebrow="WHAT WE DO" title="Four Divisions, One Corporation">
        <Divisions />
      </Section>

      {/* ── FLEET SHOWCASE ── */}
      {ships.length > 0 && (
        <Section eyebrow="OPERATIONAL FLEET" title="Vessels in Active Service">
          <FleetShowcase ships={ships} />
          <div style={{
            textAlign: 'center', marginTop: 24, fontSize: 12,
            color: '#6a7280', fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '.12em',
          }}>{stats.ships} TOTAL VESSELS REGISTERED</div>
        </Section>
      )}

      {/* ── TIER PATH ── */}
      <Section eyebrow="CHAIN OF COMMAND" title="The Nine-Tier Path">
        <TierLadder />
      </Section>

      {/* ── FAQ ── */}
      <Section eyebrow="QUESTIONS" title="Before You Apply">
        <FaqList />
      </Section>

      {/* ── BOTTOM CTA ── */}
      <section style={{
        padding: '60px 24px 40px',
        maxWidth: 760, margin: '0 auto', position: 'relative', textAlign: 'center',
      }}>
        <div style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: 'clamp(20px, 3.5vw, 28px)', fontWeight: 600,
          color: '#ededf2', marginBottom: 12, letterSpacing: '.04em',
        }}>Ready to fly under the grey flag?</div>
        <p style={{
          color: '#8a8f9c', fontSize: 14, lineHeight: 1.7, marginBottom: 28,
        }}>
          Applications take two minutes. We review every one — no form letters, no silent rejections.
        </p>
        <button onClick={() => navigate('/apply')} style={{
          background: 'linear-gradient(180deg, #e8ecf2 0%, #b8bcc8 60%, #6a7280 100%)',
          color: '#0a0b0f', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
          padding: '14px 36px', fontSize: 13, fontWeight: 700,
          fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.1em',
          cursor: 'pointer',
        }}>APPLY FOR MEMBERSHIP</button>
      </section>

      {/* ── DISCORD ── */}
      <section style={{
        padding: '40px 24px 60px',
        textAlign: 'center', position: 'relative',
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
          letterSpacing: '.3em', color: '#44445a', marginBottom: 16,
        }}>JOIN OUR DISCORD</div>
        <div style={{
          display: 'inline-block', borderRadius: 12, overflow: 'hidden',
          border: '1px solid #222233', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <iframe
            src="https://discord.com/widget?id=1493915754997878856&theme=dark"
            width="350"
            height="400"
            allowTransparency="true"
            frameBorder="0"
            sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
            style={{ display: 'block' }}
          />
        </div>
      </section>

      {/* ── FOOTER ── */}
      <div style={{
        position: 'relative',
        padding: '30px 24px 50px', textAlign: 'center',
        fontSize: 10, color: '#333344',
        fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.15em',
      }}>
        GRAYVEIL CORPORATION · STANTON SYSTEM · EST. 2026
      </div>
    </div>
  )
}
