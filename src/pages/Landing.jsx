import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { supabase } from '../supabaseClient'
import GrayveilLogo from '../components/GrayveilLogo'
import { RANKS, CIVILIAN_RANKS } from '../lib/ranks'
import { SC_SHIPS } from '../lib/ships'
import { useSeo, useJsonLd } from '../lib/useSeo'

// ─────────────────────────────────────────────────────────────
// Hero boot sequence — orchestrated reveal:
//   t=0     scan-line sweeps top→bottom of the hero
//   t=200ms top hairline draws in (centered, scaleX 0→1)
//   t=400ms wordmark types in letter-by-letter (60ms stagger)
//   t=900ms subtitle + body fade up
//   t=1100ms bottom hairline draws in
//   t=1200ms stat counters roll from 0 to value (1.2s ease-out)
//   t=1500ms CTAs slide up
// All gated by useReducedMotion — skip-to-final-state when set.
// ─────────────────────────────────────────────────────────────

// Counts up from 0 to `value` over 1200ms, ease-out cubic, after `delay` ms.
// If `reduce` is true, snaps straight to value.
function RollupNumber({ value, delay = 0, reduce = false }) {
  const target = Number(value) || 0
  const [n, setN] = useState(reduce ? target : 0)
  useEffect(() => {
    if (reduce) { setN(target); return }
    const startAt = performance.now() + delay
    const dur = 1200
    let raf
    const tick = (t) => {
      const elapsed = t - startAt
      if (elapsed < 0) { raf = requestAnimationFrame(tick); return }
      if (elapsed >= dur) { setN(target); return }
      const p = elapsed / dur
      const eased = 1 - Math.pow(1 - p, 3) // ease-out cubic
      setN(Math.round(eased * target))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, delay, reduce])
  return n
}

// Letter-by-letter cascade. Each char fades + lifts + unblurs in sequence.
function AnimatedWordmark({ text = 'GRAYVEIL', baseDelay = 0.4, reduce = false }) {
  if (reduce) return text
  return text.split('').map((ch, i) => (
    <motion.span
      key={i}
      initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ delay: baseDelay + i * 0.06, duration: 0.5, ease: [0.2, 0.7, 0.3, 1] }}
      style={{ display: 'inline-block' }}
    >{ch}</motion.span>
  ))
}

// Smooth-scroll to the Discord waitlist section. Used by every
// "Apply / Join the waitlist" CTA on the page since intake is closed
// pre-1.0 and we route prospects to Discord instead of /apply.
function scrollToWaitlist() {
  const el = typeof document !== 'undefined' && document.getElementById('discord-waitlist')
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Animated hero block. Pulled out so the boot sequence is self-contained
// and easy to reason about. `reduce` collapses everything to its final state.
function Hero({ stats, navigate, reduce }) {
  const fadeIn = (delay) => reduce ? { initial: false } : ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.6, ease: [0.2, 0.7, 0.3, 1] },
  })
  const drawLine = (delay) => reduce ? { initial: false } : ({
    initial: { scaleX: 0, opacity: 0 },
    animate: { scaleX: 1, opacity: 1 },
    transition: { delay, duration: 0.7, ease: [0.2, 0.7, 0.3, 1] },
  })

  return (
    <div style={{
      position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center',
      padding: '80px 20px 40px',
      minHeight: '85vh',
      overflow: 'hidden',
    }}>
      {/* Radial glow */}
      <div style={{
        position: 'absolute', top: '35%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(196,168,120,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Scan-line sweep — single pass top→bottom on mount */}
      {!reduce && (
        <motion.div
          initial={{ top: '-2%', opacity: 0 }}
          animate={{ top: '102%', opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.2, ease: 'easeInOut', times: [0, 0.1, 0.9, 1] }}
          style={{
            position: 'absolute', left: 0, right: 0,
            height: 1,
            background: 'linear-gradient(90deg, transparent 0%, var(--accent) 50%, transparent 100%)',
            boxShadow: '0 0 14px var(--accent-glow)',
            pointerEvents: 'none', zIndex: 1,
          }}
        />
      )}

      <div style={{ position: 'relative', maxWidth: 720, zIndex: 2 }}>
        {/* Logo */}
        <motion.div {...fadeIn(0.05)} style={{ marginBottom: 24, filter: 'drop-shadow(0 0 20px rgba(196,168,120,0.18))' }}>
          <GrayveilLogo size={110} />
        </motion.div>

        {/* Top hairline bracket */}
        <motion.div
          {...drawLine(0.2)}
          style={{
            height: 1, background: 'var(--accent)',
            width: 'min(60%, 320px)', margin: '0 auto 28px',
            transformOrigin: 'center', opacity: 0.65,
          }}
        />

        {/* Wordmark — letter cascade */}
        <h1 style={{
          fontFamily: 'Inter Tight, sans-serif', fontSize: 'clamp(44px, 7vw, 72px)',
          fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1,
          color: 'var(--text-1)', margin: '0 0 12px',
        }}>
          <AnimatedWordmark text="GRAYVEIL" baseDelay={0.4} reduce={reduce} />
        </h1>

        {/* Subtitle */}
        <motion.div
          {...fadeIn(0.9)}
          style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 'clamp(10px, 2vw, 12px)',
            letterSpacing: '.32em', color: 'var(--text-3)', marginBottom: 32,
          }}
        >CORPORATION · STANTON SYSTEM</motion.div>

        {/* Quote */}
        <motion.p
          {...fadeIn(1.0)}
          style={{
            fontFamily: 'Inter, sans-serif', fontSize: 'clamp(16px, 2.5vw, 20px)',
            color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 10,
            fontStyle: 'italic', fontWeight: 300, letterSpacing: '-0.005em',
          }}
        >"Profit is neutral. Everything else is negotiable."</motion.p>

        {/* Body */}
        <motion.p
          {...fadeIn(1.05)}
          style={{
            fontFamily: 'Inter, sans-serif', fontSize: 'clamp(13px, 2vw, 15px)',
            color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 40,
            maxWidth: 560, margin: '0 auto 40px',
          }}
        >
          A private military and commercial enterprise operating across the Stanton system.
          Contracts, intelligence, and discretion — backed by a shared fleet and a real internal economy.
        </motion.p>

        {/* Bottom hairline bracket */}
        <motion.div
          {...drawLine(1.1)}
          style={{
            height: 1, background: 'var(--accent)',
            width: 'min(60%, 320px)', margin: '0 auto 28px',
            transformOrigin: 'center', opacity: 0.65,
          }}
        />

        {/* Operational status panel — replaces raw counters with three
            indicator cells. Reads as a defense-contractor readiness
            board. Live-tunable: just edit STATUS_CELLS below. */}
        <motion.div
          {...fadeIn(1.15)}
          style={{
            display: 'flex', justifyContent: 'center', gap: 'clamp(24px, 5vw, 60px)',
            marginBottom: 48, flexWrap: 'wrap',
          }}
        >
          {[
            { status: 'OPERATIONAL', label: 'COMMAND',     color: 'var(--green)'  },
            { status: 'GREEN',       label: 'ALERT LEVEL', color: 'var(--green)'  },
            { status: 'OPEN',        label: 'RECRUITMENT', color: 'var(--accent)' },
          ].map(s => (
            <div key={s.label} style={{
              textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              minWidth: 110,
            }}>
              {/* Indicator dot — stacked above so each cell self-centers */}
              <span style={{
                display: 'block',
                width: 10, height: 10, borderRadius: '50%',
                background: s.color,
                boxShadow: `0 0 12px ${s.color}`,
                marginBottom: 14,
              }} />
              {/* Status value */}
              <div style={{
                fontFamily: 'Inter Tight, sans-serif',
                fontSize: 'clamp(20px, 3vw, 28px)',
                fontWeight: 700, letterSpacing: '-0.015em',
                color: 'var(--text-1)', lineHeight: 1,
              }}>{s.status}</div>
              {/* Category label */}
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 'clamp(8px, 1.5vw, 10px)',
                letterSpacing: '.24em', color: 'var(--text-3)', marginTop: 8,
              }}>{s.label}</div>
            </div>
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div
          {...fadeIn(1.5)}
          style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}
        >
          <button onClick={scrollToWaitlist} className="h-accent-bg" style={{
            background: 'var(--accent)', color: '#0a0a0c', border: 'none', borderRadius: 2,
            padding: '14px 32px', fontSize: 13, fontWeight: 600,
            fontFamily: 'Inter, sans-serif', letterSpacing: '-0.005em',
            cursor: 'pointer', transition: 'background .15s',
          }}>Join the waitlist →</button>
          <button onClick={() => navigate('/auth')} className="h-text-edge" style={{
            background: 'transparent', color: 'var(--text-2)',
            border: '1px solid var(--border-md)', borderRadius: 2,
            padding: '14px 32px', fontSize: 13, fontWeight: 500,
            fontFamily: 'Inter, sans-serif', letterSpacing: '-0.005em',
            cursor: 'pointer', transition: 'border-color .15s, color .15s',
          }}>Member login</button>
        </motion.div>
      </div>
    </div>
  )
}

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
  letterSpacing: '.32em',
  color: 'var(--text-3)',
  marginBottom: 14,
  textAlign: 'center',
}
const sectionHeading = {
  fontFamily: 'Inter Tight, sans-serif',
  fontSize: 'clamp(28px, 4.5vw, 44px)',
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: 'var(--text-1)',
  textAlign: 'center',
  marginBottom: 48,
}

// Sections enter when ~20% in view: brief fade + 32px lift, 600ms
// ease-out, plays once. Reads as each editorial block coming online
// as you scroll. useReducedMotion collapses to instant.
function sectionRevealProps(reduce) {
  if (reduce) return {}
  return {
    initial:     { opacity: 0, y: 32 },
    whileInView: { opacity: 1, y: 0 },
    viewport:    { once: true, amount: 0.2 },
    transition:  { duration: 0.6, ease: [0.2, 0.7, 0.3, 1] },
  }
}

function Section({ eyebrow, title, children }) {
  const reduce = useReducedMotion()
  return (
    <motion.section
      {...sectionRevealProps(reduce)}
      style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto', position: 'relative' }}
    >
      <div style={sectionLabel}>{eyebrow}</div>
      <h2 style={sectionHeading}>{title}</h2>
      {children}
    </motion.section>
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
            fontFamily: 'Inter Tight, sans-serif',
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

// Curated capital-class flagships shown as image cards. Drop matching
// JPG/WebP into public/brand/ships/<slug>.jpg to populate; missing
// images fall back to a tan/black gradient panel so cards stay clean.
// Only 6 hero ships — more than that and the section becomes a museum.
// `tag` drives the classification chip top-left on each card. Carrack
// and Hammerhead are Large class per CIG's matrix, not Capital — the
// chip respects that.
const HERO_SHIPS = [
  { name: 'Javelin',     manufacturer: 'Aegis Dynamics',       role: 'Destroyer',     tag: 'CAPITAL ASSET', image: '/brand/ships/javelin.webp'    },
  { name: 'Idris-M',     manufacturer: 'Aegis Dynamics',       role: 'Frigate',       tag: 'CAPITAL ASSET', image: '/brand/ships/idris.webp'      },
  { name: 'Polaris',     manufacturer: 'RSI',                  role: 'Corvette',      tag: 'CAPITAL ASSET', image: '/brand/ships/polaris.webp'    },
  { name: 'Kraken',      manufacturer: 'Drake Interplanetary', role: 'Carrier',       tag: 'CAPITAL ASSET', image: '/brand/ships/kraken.webp'     },
  { name: 'Carrack',     manufacturer: 'Anvil Aerospace',      role: 'Exploration',   tag: 'LARGE HULL',    image: '/brand/ships/carrack.webp'    },
  { name: 'Hammerhead',  manufacturer: 'Aegis Dynamics',       role: 'Heavy Gunship', tag: 'LARGE HULL',    image: '/brand/ships/hammerhead.webp' },
]

function FleetShowcase() {
  // Catalog-driven stats. Reads the static SC_SHIPS list, NOT the
  // database — the marketing page should reflect the org's full
  // Legatus collection, not just user-registered hulls.
  const total       = SC_SHIPS.length
  const mfgList     = [...new Set(SC_SHIPS.map(s => s.manufacturer).filter(Boolean))].sort()
  const mfgCount    = mfgList.length
  // Manufacturer short-codes (drop "Aerospace", "Dynamics", etc.) for the
  // roll-call line — fits the editorial cap-spaced look.
  const mfgShort = mfgList.map(m =>
    m.replace(/\s+(Aerospace|Dynamics|Interplanetary|Industrial|Manufacturing|Mfg|Industries|Corp|Corporation)$/i, '')
  )

  return (
    <div>
      {/* Editorial intro */}
      <div style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: 'clamp(17px, 2.2vw, 22px)',
        color: 'var(--text-2)', textAlign: 'center',
        lineHeight: 1.6, maxWidth: 640, margin: '0 auto 16px',
        letterSpacing: '-0.005em',
      }}>
        Every hull in active service across the Stanton system —
        snub fighters to capital frigates, concept ships included.
      </div>

      {/* Stat line */}
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 'clamp(11px, 1.8vw, 13px)',
        color: 'var(--text-3)', textAlign: 'center',
        letterSpacing: '.18em', marginBottom: 56, textTransform: 'uppercase',
      }}>
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{total}+ HULLS</span>
        <span style={{ margin: '0 12px', opacity: 0.5 }}>·</span>
        <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{mfgCount} MANUFACTURERS</span>
        <span style={{ margin: '0 12px', opacity: 0.5 }}>·</span>
        <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>EVERY ROLE COVERED</span>
      </div>

      {/* Featured hero cards — capital + large hulls */}
      <div style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
        letterSpacing: '.32em', color: 'var(--text-3)', textAlign: 'center',
        marginBottom: 24, textTransform: 'uppercase',
      }}>FEATURED HULLS</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16, marginBottom: 56,
      }}>
        {HERO_SHIPS.map(s => (
          <div key={s.name} style={{
            border: '1px solid var(--border-md)',
            borderRadius: 2,
            overflow: 'hidden',
            background: 'var(--bg-surface)',
          }}>
            {/* Image area with gradient fallback. The gradient sits underneath
                the <img>, so if the file is missing the gradient shows. */}
            <div style={{
              position: 'relative',
              aspectRatio: '16 / 9',
              background: 'linear-gradient(135deg, rgba(196,168,120,0.08) 0%, rgba(11,14,19,0.95) 70%)',
              overflow: 'hidden',
            }}>
              <img
                src={s.image}
                alt={s.name}
                loading="lazy"
                onError={e => { e.currentTarget.style.opacity = '0' }}
                style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                  display: 'block', transition: 'opacity .3s',
                }}
              />
              {/* Top-left classification chip (CAPITAL ASSET / LARGE HULL) */}
              <div style={{
                position: 'absolute', top: 10, left: 12,
                fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                letterSpacing: '.28em', color: 'var(--accent)',
                textTransform: 'uppercase',
                background: 'rgba(6,8,11,0.7)', padding: '3px 8px',
                border: '1px solid var(--border-md)',
              }}>{s.tag}</div>
            </div>
            {/* Caption */}
            <div style={{ padding: '16px 18px', borderTop: '1px solid var(--border)' }}>
              <div style={{
                fontFamily: 'Inter Tight, sans-serif', fontSize: 18, fontWeight: 700,
                color: 'var(--text-1)', letterSpacing: '-0.01em', marginBottom: 6,
              }}>{s.name}</div>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                letterSpacing: '.22em', color: 'var(--text-3)',
                textTransform: 'uppercase',
              }}>{s.manufacturer} · {s.role}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Manufacturer roll-call */}
      <div style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
        letterSpacing: '.32em', color: 'var(--text-3)', textAlign: 'center',
        marginBottom: 16, textTransform: 'uppercase',
      }}>CERTIFIED MANUFACTURERS</div>
      <div style={{
        textAlign: 'center', maxWidth: 720, margin: '0 auto',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 'clamp(10px, 1.6vw, 12px)',
        letterSpacing: '.24em', color: 'var(--text-2)',
        textTransform: 'uppercase', lineHeight: 2.2,
      }}>
        {mfgShort.map((m, i) => (
          <span key={m}>
            {m}
            {i < mfgShort.length - 1 && (
              <span style={{ color: 'var(--text-3)', margin: '0 10px', opacity: 0.5 }}>·</span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

// Two stacked rank ladders (military + civilian) with a CSS 3D Y-flip
// between them. Tier numbers map 1:1 across both tracks — switching
// path is a wardrobe change, not a re-rank. The toggle uses a
// segmented control above; the flipped face is rendered absolute
// over the front so the layout doesn't reflow during animation.
function TierLadder() {
  const [path, setPath] = useState('military')
  const flipped = path === 'civilian'
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Segmented toggle */}
      <div role="tablist" aria-label="Rank track" style={{
        display: 'inline-flex', gap: 0,
        margin: '0 auto 22px',
        border: '1px solid var(--border-md)',
        background: 'var(--bg-surface)',
        position: 'relative', left: '50%', transform: 'translateX(-50%)',
      }}>
        {[
          { key: 'military', label: 'MILITARY' },
          { key: 'civilian', label: 'CIVILIAN' },
        ].map((p, i) => {
          const active = path === p.key
          return (
            <button
              key={p.key}
              role="tab"
              aria-selected={active}
              onClick={() => setPath(p.key)}
              className={active ? 'h-accent-bg' : 'h-accent-edge'}
              style={{
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? '#0a0a0c' : 'var(--text-2)',
                border: 'none',
                borderLeft: i === 0 ? 'none' : '1px solid var(--border-md)',
                padding: '11px 22px',
                fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                letterSpacing: '.28em', fontWeight: 700,
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'background .15s, color .15s',
              }}
            >{p.label}</button>
          )
        })}
      </div>

      {/* 3D flip surface */}
      <div style={{ perspective: '1800px' }}>
        <div style={{
          position: 'relative',
          transformStyle: 'preserve-3d',
          transition: 'transform .85s cubic-bezier(.2,.7,.3,1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}>
          {/* Front face — military, in flow so it sets the parent height */}
          <div
            aria-hidden={flipped}
            style={{
              backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
            }}>
            <RankRows ranks={RANKS} />
          </div>
          {/* Back face — civilian, absolute over the front, pre-rotated */}
          <div
            aria-hidden={!flipped}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              transform: 'rotateY(180deg)',
              backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
            }}>
            <RankRows ranks={CIVILIAN_RANKS} />
          </div>
        </div>
      </div>

      {/* Footer line — switches with the path */}
      <div style={{
        textAlign: 'center', marginTop: 22,
        fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic',
      }}>
        {path === 'military'
          ? 'Every new operative enters at Recruit. Rank is earned, never granted.'
          : 'Every new contractor enters as Prospect. Standing is earned, never granted.'}
      </div>
    </div>
  )
}

function RankRows({ ranks }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {ranks.map(r => {
        const c = LADDER_COLORS[r.tier] || r.color
        return (
          <div key={r.tier} style={{
            display: 'grid',
            gridTemplateColumns: '48px 1fr auto',
            alignItems: 'center',
            gap: 16,
            background: `linear-gradient(90deg, ${c}14 0%, rgba(11,14,19,0.55) 40%)`,
            border: '1px solid var(--border)',
            borderLeft: `3px solid ${c}`,
            borderRadius: 2,
            padding: '12px 18px',
          }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11, color: c, opacity: 0.85, letterSpacing: '.15em',
            }}>T-{r.tier}</div>
            <div style={{
              fontFamily: 'Inter Tight, sans-serif',
              fontSize: 14, fontWeight: 700, letterSpacing: '.08em',
              color: 'var(--text-1)',
            }}>{r.rank}</div>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: c, boxShadow: `0 0 12px ${c}88`,
            }} />
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PathChoice — two membership profiles a prospect can sign up under.
// Independent axis from Divisions: divisions describe WHAT you do,
// paths describe HOW INTENSE. Frames the org as accessible to casual
// joiners while still serious about the milsim side.
// ─────────────────────────────────────────────────────────────

const PATHS = [
  {
    code: '01',
    title: 'MILITARY OPERATIONS',
    tagline: 'Combat-rated · structured chain of command',
    icon: 'shield',
    bullets: [
      'Higher-intensity MilSim posture',
      'Structured ops with formal chain of command',
      'Disciplined tactical gameplay',
      'Authentic coordination on strategic missions',
    ],
  },
  {
    code: '02',
    title: 'CIVILIAN CONTRACTORS',
    tagline: 'Casual · org-backed · no formal milsim requirement',
    icon: 'people',
    bullets: [
      'More casual roleplay experience',
      'Full benefits of the corporate structure',
      'Fleet support network and coordination',
      'No formal military requirement',
    ],
  },
]

function PathChoice() {
  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 16,
      }}>
        {PATHS.map(p => (
          <div key={p.code} style={{
            position: 'relative',
            background: 'rgba(11,14,19,0.6)',
            border: '1px solid var(--border-md)',
            borderLeft: '3px solid var(--accent)',
            padding: '28px 28px 24px',
          }}>
            {/* Corner ticks for classification chrome */}
            <CornerTick pos={{ top: 8, right: 8 }} flipX />
            <CornerTick pos={{ bottom: 8, left: 8 }}  flipY />

            {/* Icon + path number */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18,
            }}>
              <PathIcon name={p.icon} />
              <div>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                  letterSpacing: '.32em', color: 'var(--accent)',
                  textTransform: 'uppercase', marginBottom: 4,
                }}>PATH {p.code}</div>
                <div style={{
                  fontFamily: 'Inter Tight, sans-serif', fontSize: 20,
                  fontWeight: 800, letterSpacing: '-0.02em',
                  color: 'var(--text-1)', lineHeight: 1.05,
                }}>{p.title}</div>
              </div>
            </div>

            {/* Tagline */}
            <div style={{
              fontFamily: 'Inter, sans-serif', fontSize: 13,
              color: 'var(--text-2)', lineHeight: 1.55,
              marginBottom: 18, fontStyle: 'italic',
            }}>{p.tagline}</div>

            {/* Bullets */}
            <ul style={{
              listStyle: 'none', padding: 0, margin: 0,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              {p.bullets.map(b => (
                <li key={b} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  fontFamily: 'Inter, sans-serif', fontSize: 13,
                  color: 'var(--text-2)', lineHeight: 1.55,
                }}>
                  <CheckGlyph />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {/* Footer note — both paths welcome, transition supported */}
      <div style={{
        marginTop: 24, padding: '14px 18px',
        textAlign: 'center',
        border: '1px dashed var(--border-md)',
        fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
        letterSpacing: '.22em', color: 'var(--text-3)',
        textTransform: 'uppercase',
      }}>
        Members can transition between paths as preferences evolve.
      </div>
    </div>
  )
}

function PathIcon({ name }) {
  const common = {
    width: 36, height: 36, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'var(--accent)',
    strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': true,
  }
  if (name === 'shield') {
    return (
      <svg {...common}>
        <path d="M12 2 L21 5 L21 11 C21 16.5 17 20.5 12 22 C7 20.5 3 16.5 3 11 L3 5 Z" />
        <path d="M9 12 L11 14 L15 10" />
      </svg>
    )
  }
  // people glyph (two heads + shoulder bars)
  return (
    <svg {...common}>
      <circle cx="9"  cy="8" r="3.2" />
      <circle cx="17" cy="9.2" r="2.6" />
      <path d="M3.5 19 C4 15.5 6.2 14 9 14 C11.8 14 14 15.5 14.5 19" />
      <path d="M14.5 19 C15 16.8 16.6 15.6 17.5 15.6 C18.4 15.6 20 16.8 20.5 19" />
    </svg>
  )
}

function CheckGlyph() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 14 14"
      fill="none" aria-hidden="true"
      style={{ flexShrink: 0, marginTop: 3 }}
    >
      <circle cx="7" cy="7" r="6" stroke="var(--accent)" strokeWidth="1" opacity="0.6" />
      <path d="M4 7.4 L6 9.4 L10.2 5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CornerTick({ pos, flipX, flipY }) {
  const transform = `${flipX ? 'scaleX(-1)' : ''} ${flipY ? 'scaleY(-1)' : ''}`.trim()
  return (
    <svg
      width={8} height={8} viewBox="0 0 8 8"
      style={{ position: 'absolute', ...pos, transform, opacity: 0.5 }}
      aria-hidden="true"
    >
      <path d="M 0 0 L 8 0 M 0 0 L 0 8" stroke="var(--accent)" strokeWidth="1.4" fill="none" />
    </svg>
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
  const navigate = useNavigate()
  const reduceMotion = !!useReducedMotion()

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
      // Hit the SECURITY DEFINER RPC instead of querying tables directly.
      // /welcome is unauthenticated, so the anon role hits RLS that
      // blocks fleet/contracts SELECT. The RPC bypasses RLS and returns
      // only the public-safe fields the landing page actually needs.
      // Fleet showcase is now driven by the static SC_SHIPS catalog
      // (see FleetShowcase) — the landing page advertises the org's
      // full Legatus collection, not just user-registered hulls.
      const { data: stats } = await supabase.rpc('public_org_stats')
      setStats({
        members:   stats?.members   || 0,
        ships:     stats?.ships     || 0,
        contracts: stats?.contracts || 0,
      })
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
      <Hero stats={stats} navigate={navigate} reduce={reduceMotion} />

      {/* ── DIVISIONS ── */}
      <Section eyebrow="WHAT WE DO" title="Four Divisions, One Corporation">
        <Divisions />
      </Section>

      {/* ── FLEET SHOWCASE ── */}
      <Section eyebrow="OPERATIONAL FLEET" title="Built for Every Mission">
        <FleetShowcase />
      </Section>

      {/* ── TIER PATH ── */}
      <Section eyebrow="SERVICE & CITIZENSHIP" title="Earned, Never Granted">
        <TierLadder />
      </Section>

      {/* ── PATH CHOICE ── */}
      <Section eyebrow="MEMBERSHIP" title="Choose Your Path">
        <PathChoice />
      </Section>

      {/* ── FAQ ── */}
      <Section eyebrow="QUESTIONS" title="Before You Apply">
        <FaqList />
      </Section>

      {/* ── BOTTOM CTA ── */}
      <motion.section
        {...sectionRevealProps(reduceMotion)}
        style={{
          padding: '60px 24px 40px',
          maxWidth: 760, margin: '0 auto', position: 'relative', textAlign: 'center',
        }}
      >
        <div style={{
          fontFamily: 'Inter Tight, sans-serif',
          fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 700,
          color: 'var(--text-1)', marginBottom: 14, letterSpacing: '-0.02em',
        }}>Ready to fly under the grey flag?</div>
        <p style={{
          color: 'var(--text-2)', fontSize: 15, lineHeight: 1.7, marginBottom: 28,
        }}>
          Intake is paused until closer to Star Citizen 1.0. Drop into the
          Discord waitlist — we'll ping the channel the moment doors reopen.
        </p>
        <button onClick={scrollToWaitlist} className="h-accent-bg" style={{
          background: 'var(--accent)', color: '#0a0a0c', border: 'none', borderRadius: 2,
          padding: '14px 32px', fontSize: 13, fontWeight: 600,
          fontFamily: 'Inter, sans-serif', letterSpacing: '-0.005em',
          cursor: 'pointer', transition: 'background .15s',
        }}>Join the waitlist →</button>
      </motion.section>

      {/* ── DISCORD WAITLIST ── */}
      <motion.section
        id="discord-waitlist"
        {...sectionRevealProps(reduceMotion)}
        style={{
          padding: '40px 24px 60px',
          textAlign: 'center', position: 'relative',
          scrollMarginTop: 24,
        }}
      >
        <div style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
          letterSpacing: '.3em', color: 'var(--amber)', marginBottom: 12,
        }}>● RECRUITMENT CLOSED · WAITLIST OPEN</div>
        <div style={{
          fontFamily: 'Inter Tight, sans-serif',
          fontSize: 'clamp(20px, 2.6vw, 26px)', fontWeight: 700,
          color: 'var(--text-1)', marginBottom: 8, letterSpacing: '-0.02em',
        }}>Get on the list.</div>
        <p style={{
          color: 'var(--text-2)', fontSize: 13, lineHeight: 1.65,
          maxWidth: 460, margin: '0 auto 22px',
        }}>
          Hop into the Discord and you'll be first in line when intake reopens
          for Star Citizen 1.0. No form, no waiting on a reply — just join.
        </p>
        <div style={{
          display: 'inline-block', borderRadius: 12, overflow: 'hidden',
          border: '1px solid #222233', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <iframe
            src="https://discord.com/widget?id=1493915754997878856&theme=dark"
            width="350"
            height="400"
            sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
            style={{ display: 'block', border: 'none', background: 'transparent' }}
            title="Grayveil Corporation Discord"
          />
        </div>
      </motion.section>

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
