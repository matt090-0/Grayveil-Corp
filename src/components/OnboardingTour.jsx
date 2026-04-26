import { useEffect, useState, useLayoutEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { UEE_AMBER, CLIP_CHAMFER_SM } from './uee'

// ─────────────────────────────────────────────────────────────
// First-login walkthrough.
// Spotlights key elements of the shell — search, nav, bell,
// profile pill — with a callout next to each. Set
// profiles.onboarded_at when complete or skipped, so it doesn't
// replay. Restartable from the Profile page.
//
// Each step targets an element via [data-tour="<name>"]; the
// Layout component already labels search / nav / bell / profile.
//
// On mobile, the sidebar collapses behind a hamburger so the
// spotlight steps don't make sense — we render the welcome and
// closing modals only and skip the targeted steps. Cleaner UX
// than trying to open the drawer programmatically.
// ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    key: 'welcome',
    target: null, // centred modal
    title: 'Welcome aboard, operative.',
    body: (
      <>
        <p>You're operational on the Grayveil corp comms.</p>
        <p style={{ marginTop: 10 }}>
          60-second tour to show you the chrome. Five steps. You can skip at any time
          and restart from your profile later.
        </p>
      </>
    ),
    cta: 'BEGIN TOUR',
  },
  {
    key: 'search',
    target: '[data-tour="search"]',
    side: 'right',
    title: 'Cmd-K · find anything',
    body: (
      <>
        Hit <kbd>⌘K</kbd> / <kbd>Ctrl-K</kbd> from anywhere in the app.
        It searches operatives, contracts, ops, intel, ships, marketplace,
        and 19 page shortcuts. Best single shortcut to learn.
      </>
    ),
  },
  {
    key: 'nav',
    target: '[data-tour="nav"]',
    side: 'right',
    title: 'Sidebar · every page, one click',
    body: (
      <>
        Grouped by intent — <strong>COMMAND</strong>,
        <strong> ORGANISATION</strong>, <strong>OPERATIONS</strong>,
        <strong> RESOURCES</strong>. The OPS BOARD has scheduled missions,
        CONTRACTS lists open assignments, KILL BOARD is your combat record.
      </>
    ),
  },
  {
    key: 'bell',
    target: '[data-tour="bell"]',
    side: 'top-right',
    title: 'Inbox · we ping you here',
    body: (
      <>
        Promotions, contract claims, op signups, AAR mentions, marketplace
        replies, T-1H op reminders — all land here. Click the bell for a
        recent dropdown, or visit <strong>/inbox</strong> for the full archive
        with filters and search.
      </>
    ),
  },
  {
    key: 'profile',
    target: '[data-tour="profile"]',
    side: 'top-right',
    title: 'Citizen Dossier · this is you',
    body: (
      <>
        Click your name to open your dossier — wallet, rep, kit, medals,
        service record. From there you can also export a printable PDF
        of your file (very official, very UEE). Your full <strong>analytics</strong> page
        rolls up everything you've done.
      </>
    ),
  },
  {
    key: 'finish',
    target: null,
    title: "You're cleared for ops.",
    body: (
      <>
        <p>That's the tour. A few extra hits worth knowing:</p>
        <ul style={{ margin: '8px 0 0 18px', padding: 0, fontSize: 12.5, lineHeight: 1.7 }}>
          <li><strong>SITREP</strong> (front page) is your live ops/comms feed</li>
          <li><strong>OPS BOARD</strong> &rarr; sign up for an op to lock your slot</li>
          <li><strong>CONTRACTS</strong> &rarr; claim something open to start earning</li>
          <li><strong>BANK</strong> &rarr; your wallet, credit score, treasury</li>
          <li>Cmd-K to fly anywhere</li>
        </ul>
      </>
    ),
    cta: 'TAKE ME TO MY DASHBOARD',
  },
]

export default function OnboardingTour({ onClose }) {
  const { profile, refreshProfile } = useAuth()
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  // Filter the steps array on mobile — drop the targeted steps
  // since the sidebar is hidden behind a hamburger menu.
  const steps = isMobile ? STEPS.filter(s => !s.target) : STEPS
  const current = steps[step]
  const last = step === steps.length - 1

  // Recompute the spotlight cutout whenever the step (or
  // viewport) changes. layoutEffect so we paint the rect on
  // the same frame as the overlay rather than flashing once.
  useLayoutEffect(() => {
    function updateRect() {
      if (!current?.target) { setRect(null); return }
      const el = document.querySelector(current.target)
      if (!el) { setRect(null); return }
      const r = el.getBoundingClientRect()
      setRect({
        top: r.top - 6, left: r.left - 6,
        width: r.width + 12, height: r.height + 12,
      })
    }
    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [step, current?.target])

  // Keep tab key from escaping the modal; allow Esc to skip.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); finish(true) }
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next() }
      if (e.key === 'ArrowLeft' && step > 0) { e.preventDefault(); setStep(s => s - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function finish(skipped) {
    await supabase.from('profiles')
      .update({ onboarded_at: new Date().toISOString() })
      .eq('id', profile.id)
    if (refreshProfile) await refreshProfile()
    onClose?.(skipped)
  }
  function next() {
    if (last) { finish(false); return }
    setStep(s => s + 1)
  }
  function back() { if (step > 0) setStep(s => s - 1) }

  // Position the callout relative to the spotlight rect (or
  // centre it if there's no target).
  const callout = computeCalloutPosition(rect, current?.side)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        animation: 'tourFade .15s ease',
      }}
    >
      <style>{`
        @keyframes tourFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes tourPulse {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.78), 0 0 0 2px ${UEE_AMBER}, 0 0 24px ${UEE_AMBER}88; }
          50%      { box-shadow: 0 0 0 9999px rgba(0,0,0,0.78), 0 0 0 2px ${UEE_AMBER}, 0 0 32px ${UEE_AMBER}cc; }
        }
        .tour-kbd {
          display: inline-block;
          font-family: var(--font-mono); font-size: 10px;
          background: rgba(200,165,90,0.15);
          border: 1px solid rgba(200,165,90,0.5);
          padding: 1px 6px; border-radius: 3px;
          color: ${UEE_AMBER};
          margin: 0 2px;
        }
      `}</style>

      {/* Backdrop — solid when no spotlight, cut around the
          target when there is one. We render the dark layer as
          a giant inset-shadow on the spotlight box itself; that
          way the cutout is precise without canvas/SVG masks. */}
      {rect ? (
        <div style={{
          position: 'fixed', top: rect.top, left: rect.left,
          width: rect.width, height: rect.height,
          borderRadius: 6, pointerEvents: 'none',
          animation: 'tourPulse 2s ease-in-out infinite',
        }} />
      ) : (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(2px)',
        }} />
      )}

      {/* Callout */}
      <div
        style={{
          position: 'fixed',
          ...callout,
          width: 'min(420px, calc(100vw - 32px))',
          background: 'var(--bg-raised)',
          border: `1px solid ${UEE_AMBER}66`,
          clipPath: CLIP_CHAMFER_SM,
          boxShadow: `0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px ${UEE_AMBER}22`,
          padding: 0, overflow: 'hidden',
        }}
      >
        {/* Classification bar */}
        <div style={{
          background: 'linear-gradient(180deg, #0e0f14 0%, #0a0b0f 100%)',
          borderBottom: `1px solid ${UEE_AMBER}33`,
          padding: '6px 16px',
          fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.22em',
          color: UEE_AMBER,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%', background: UEE_AMBER,
              boxShadow: `0 0 6px ${UEE_AMBER}`,
              animation: 'pulse 2s ease-in-out infinite',
            }} />
            ORIENTATION · STEP {step + 1} OF {steps.length}
          </div>
          <button
            onClick={() => finish(true)}
            style={{
              background: 'transparent', border: 'none',
              color: 'var(--text-3)', fontSize: 9, letterSpacing: '.2em',
              fontFamily: 'var(--font-mono)', cursor: 'pointer',
            }}
          >SKIP TOUR ✕</button>
        </div>

        <div style={{ padding: '18px 20px 16px' }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
            color: 'var(--text-1)', marginBottom: 10, lineHeight: 1.25,
          }}>
            {current.title}
          </div>
          <div style={{
            fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65,
          }}>
            {current.body}
          </div>
        </div>

        <div style={{
          borderTop: '1px solid var(--border)',
          background: 'rgba(0,0,0,0.2)',
          padding: '10px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}>
          <div style={{
            display: 'flex', gap: 4,
          }}>
            {steps.map((_, i) => (
              <span key={i} style={{
                width: i === step ? 18 : 6,
                height: 6, borderRadius: 3,
                background: i === step ? UEE_AMBER : i < step ? `${UEE_AMBER}66` : 'var(--border)',
                transition: 'all .2s ease',
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {step > 0 && !last && (
              <button
                onClick={back}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-3)', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', fontWeight: 600,
                  padding: '5px 10px', borderRadius: 3,
                }}
              >← BACK</button>
            )}
            <button
              onClick={next}
              style={{
                background: UEE_AMBER,
                border: `1px solid ${UEE_AMBER}`,
                color: '#0a0b0f', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', fontWeight: 700,
                padding: '5px 12px', borderRadius: 3,
              }}
            >{current.cta || (last ? 'FINISH ✓' : 'NEXT →')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Position the callout box relative to the spotlight rect.
// `side` hints which way to lay it out — tries that first,
// falls back to whichever side has space. If no rect, centre
// the callout on screen.
function computeCalloutPosition(rect, side = 'right') {
  if (!rect) {
    // Centred — used by the welcome and finish steps.
    return {
      top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
    }
  }
  const margin = 16
  const calloutWidth = 420
  const calloutHeight = 240 // estimate; box auto-sizes
  const vpW = window.innerWidth
  const vpH = window.innerHeight

  // Try the requested side, fall back if it would overflow.
  const tryRight = () => ({
    top: Math.min(Math.max(margin, rect.top - 6), vpH - calloutHeight - margin),
    left: Math.min(rect.left + rect.width + margin, vpW - calloutWidth - margin),
  })
  const tryTopRight = () => ({
    bottom: Math.min(vpH - rect.top + margin, vpH - margin),
    left: Math.min(rect.left, vpW - calloutWidth - margin),
  })
  const tryBottom = () => ({
    top: Math.min(rect.top + rect.height + margin, vpH - calloutHeight - margin),
    left: Math.min(Math.max(margin, rect.left), vpW - calloutWidth - margin),
  })

  if (side === 'top-right') {
    const pos = tryTopRight()
    // If the callout would overlap the spotlight, fall to plain right.
    if ((vpH - pos.bottom) < rect.top - 8) return pos
    return tryRight()
  }
  if (side === 'bottom') return tryBottom()
  return tryRight()
}
