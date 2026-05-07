import { useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────
// CipherTerminal — full-screen authentication takeover for the
// 501st black channel. Replaces the plain Modal with a cinematic
// terminal: typed intro → passcode input → verifying scan →
// granted/rejected flash. Pure presentational; the host owns the
// verification logic and passes onSubmit + state in.
//
// Props:
//   open        boolean — mount/unmount toggle
//   busy        boolean — verification in flight (caller-controlled)
//   error       string  — verification error message; triggers reject anim
//   onSubmit    (code: string) => void — fires when user clicks VERIFY
//   onCancel    () => void — fires on Esc / ABORT button
//   onSuccessAck() => void — called once after success animation finishes
//                           so the host can navigate
// ─────────────────────────────────────────────────────────────

const PURPLE = '#9d83e8'   // 501st cell color
const RED    = '#c45a4a'
const GREEN  = '#7ba673'

const INTRO_LINES = [
  '> establishing secure channel...',
  '> routing through null relay...',
  '> wiping forward trace...',
  '> ready.',
]

export default function CipherTerminal({ open, busy, error, onSubmit, onCancel, onSuccessAck }) {
  const [code, setCode] = useState('')
  const [stage, setStage] = useState('intro') // 'intro' | 'input' | 'verifying' | 'rejected' | 'granted'
  const [shownLines, setShownLines] = useState([])
  const [partialLine, setPartialLine] = useState('')
  const inputRef = useRef(null)
  const successTimer = useRef(null)

  // Reset on open
  useEffect(() => {
    if (!open) return
    setCode('')
    setStage('intro')
    setShownLines([])
    setPartialLine('')
  }, [open])

  // Type out the intro lines one char at a time, then advance to input.
  useEffect(() => {
    if (!open || stage !== 'intro') return
    const idx = shownLines.length
    if (idx >= INTRO_LINES.length) {
      const t = setTimeout(() => {
        setStage('input')
        setTimeout(() => inputRef.current?.focus?.(), 30)
      }, 350)
      return () => clearTimeout(t)
    }
    const target = INTRO_LINES[idx]
    if (partialLine.length < target.length) {
      const t = setTimeout(() => {
        setPartialLine(target.slice(0, partialLine.length + 1))
      }, 18 + Math.random() * 22)
      return () => clearTimeout(t)
    }
    // Line complete — commit + start next
    const t = setTimeout(() => {
      setShownLines(s => [...s, target])
      setPartialLine('')
    }, 220)
    return () => clearTimeout(t)
  }, [open, stage, shownLines, partialLine])

  // Drive stage transitions from busy / error props.
  useEffect(() => {
    if (busy && stage === 'input') setStage('verifying')
  }, [busy, stage])
  useEffect(() => {
    if (error && stage === 'verifying') {
      setStage('rejected')
      const t = setTimeout(() => setStage('input'), 1400)
      return () => clearTimeout(t)
    }
  }, [error, stage])
  // Caller signals success by setting busy=false, error=null, and we
  // detect the transition from verifying -> none of those:
  useEffect(() => {
    if (stage === 'verifying' && !busy && !error) {
      setStage('granted')
      successTimer.current = setTimeout(() => {
        onSuccessAck?.()
      }, 1100)
      return () => clearTimeout(successTimer.current)
    }
  }, [stage, busy, error, onSuccessAck])

  // Keyboard: Esc cancels, Enter submits when in input
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); onCancel?.() }
      if (e.key === 'Enter' && stage === 'input' && code.trim()) {
        e.preventDefault()
        onSubmit?.(code)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, stage, code, onSubmit, onCancel])

  if (!open) return null

  const flash = stage === 'rejected' ? RED : stage === 'granted' ? GREEN : null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="501st secure channel authentication"
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: '#040608',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        overflow: 'hidden',
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      }}
    >
      {/* Hex grid backdrop */}
      <HexBackdrop />

      {/* Radial vignette in 501st purple */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse at center, ${PURPLE}26 0%, transparent 60%)`,
      }} />

      {/* Top + bottom classification stripes */}
      <ClassificationStripe pos="top" />
      <ClassificationStripe pos="bottom" />

      {/* Animated scan line */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent 0%, ${PURPLE} 50%, transparent 100%)`,
        boxShadow: `0 0 14px ${PURPLE}`,
        animation: 'cipher-scan 5s linear infinite',
        pointerEvents: 'none',
      }} />

      {/* Main terminal panel */}
      <div style={{
        position: 'relative',
        width: '100%', maxWidth: 560,
        background: 'rgba(11,14,19,0.92)',
        border: `1px solid ${PURPLE}55`,
        borderLeft: `3px solid ${PURPLE}`,
        padding: 'clamp(22px, 5vw, 36px) clamp(22px, 5vw, 36px) clamp(20px, 4vw, 28px)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: `0 0 60px ${PURPLE}1f, inset 0 0 0 1px rgba(255,255,255,0.02)`,
        animation: stage === 'rejected' ? 'cipher-shake .35s' : undefined,
      }}>
        {/* Corner registration ticks */}
        <CornerTick color={PURPLE} pos={{ top: 8, left: 8 }} />
        <CornerTick color={PURPLE} pos={{ top: 8, right: 8 }} flipX />
        <CornerTick color={PURPLE} pos={{ bottom: 8, left: 8 }} flipY />
        <CornerTick color={PURPLE} pos={{ bottom: 8, right: 8 }} flipX flipY />

        {/* Top row: classification chip + abort */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, marginBottom: 22,
        }}>
          <span style={{
            fontSize: 9, letterSpacing: '.32em', color: PURPLE, fontWeight: 700,
            textTransform: 'uppercase',
          }}>● BLACK CHANNEL · 501ST</span>
          <button
            onClick={onCancel}
            aria-label="Abort"
            className="h-text-edge"
            style={{
              background: 'transparent', color: 'var(--text-3)',
              border: '1px solid var(--border-md)', borderRadius: 2,
              padding: '4px 10px', fontSize: 9, letterSpacing: '.22em',
              fontFamily: 'inherit', textTransform: 'uppercase',
              cursor: 'pointer', transition: 'border-color .15s, color .15s',
            }}
          >ABORT · ESC</button>
        </div>

        {/* Title */}
        <div style={{
          fontFamily: 'Inter Tight, sans-serif',
          fontSize: 'clamp(22px, 4vw, 28px)',
          fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.05,
          color: 'var(--text-1)', marginBottom: 4,
        }}>SECURE TERMINAL</div>
        <div style={{
          fontSize: 10, letterSpacing: '.28em',
          color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 26,
        }}>Cipher gate · 501ST authentication</div>

        {/* Terminal log */}
        <div style={{
          minHeight: 110,
          background: 'rgba(0,0,0,0.45)',
          border: '1px solid var(--border)',
          padding: '14px 16px',
          marginBottom: 18,
          fontSize: 12, lineHeight: 1.7,
          color: 'var(--text-2)',
        }}>
          {shownLines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
          {stage === 'intro' && (
            <div>{partialLine}<Caret color={PURPLE} /></div>
          )}
          {stage === 'verifying' && (
            <div style={{ color: PURPLE }}>&gt; verifying passcode<Dots /></div>
          )}
          {stage === 'rejected' && (
            <div style={{ color: RED }}>
              &gt; rejected. attempt logged. <span style={{ opacity: 0.6 }}>[{Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')}]</span>
            </div>
          )}
          {stage === 'granted' && (
            <div style={{ color: GREEN }}>&gt; access granted. routing to compartment...</div>
          )}
        </div>

        {/* Input row — only shown during input/verifying/rejected */}
        {stage !== 'intro' && stage !== 'granted' && (
          <div style={{ marginBottom: 18 }}>
            <label style={{
              display: 'block',
              fontSize: 9, letterSpacing: '.28em', color: 'var(--text-3)',
              textTransform: 'uppercase', marginBottom: 8,
            }}>Passcode</label>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 0,
              border: `1px solid ${stage === 'rejected' ? RED : PURPLE}88`,
              background: 'rgba(0,0,0,0.3)',
              transition: 'border-color .25s',
            }}>
              <span style={{
                padding: '0 10px', color: PURPLE,
                fontSize: 14, fontWeight: 700,
              }}>&gt;</span>
              <input
                ref={inputRef}
                type="password"
                value={code}
                onChange={e => setCode(e.target.value)}
                disabled={busy || stage === 'verifying'}
                placeholder="••••••••"
                autoComplete="off"
                spellCheck={false}
                style={{
                  flex: 1,
                  background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text-1)',
                  fontFamily: 'inherit', fontSize: 14,
                  letterSpacing: '.32em',
                  padding: '12px 8px',
                }}
              />
              <button
                onClick={() => onSubmit?.(code)}
                disabled={!code.trim() || busy || stage === 'verifying'}
                className="h-accent-bg"
                style={{
                  background: PURPLE, color: '#0a0a0c', border: 'none',
                  padding: '10px 14px', fontSize: 10, fontWeight: 700,
                  letterSpacing: '.28em', textTransform: 'uppercase',
                  fontFamily: 'inherit',
                  cursor: code.trim() && !busy ? 'pointer' : 'not-allowed',
                  opacity: code.trim() && !busy ? 1 : 0.5,
                  whiteSpace: 'nowrap', transition: 'opacity .15s',
                }}
              >Verify ⏎</button>
            </div>
            {error && (
              <div style={{
                marginTop: 10, fontSize: 10, letterSpacing: '.18em',
                color: RED, textTransform: 'uppercase',
              }}>● {error}</div>
            )}
          </div>
        )}

        {/* Footer telemetry */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
          fontSize: 8, letterSpacing: '.28em', color: 'var(--text-3)',
          textTransform: 'uppercase',
          paddingTop: 14, borderTop: '1px solid var(--border)',
        }}>
          <span>Compartmentalized · Eyes only</span>
          <span>{nowStamp()}</span>
        </div>

        {/* Full-screen flash overlay on grant/reject */}
        {flash && (
          <div style={{
            position: 'absolute', inset: 0,
            background: flash, opacity: 0.18,
            pointerEvents: 'none',
            animation: 'cipher-flash .55s ease-out',
          }} />
        )}
      </div>

      <style>{`
        @keyframes cipher-scan {
          0%   { top: 0;    opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes cipher-flash {
          0%   { opacity: 0.55; }
          100% { opacity: 0; }
        }
        @keyframes cipher-shake {
          0%, 100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          40%      { transform: translateX(6px); }
          60%      { transform: translateX(-3px); }
          80%      { transform: translateX(3px); }
        }
        @keyframes cipher-blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ── Internal bits ──────────────────────────────────────────────

function HexBackdrop() {
  return (
    <svg
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        opacity: 0.06,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      <defs>
        <pattern id="hex" width="36" height="32" patternUnits="userSpaceOnUse" patternTransform="scale(1.4)">
          <polygon
            points="9,1 27,1 36,16 27,31 9,31 0,16"
            fill="none" stroke="#e8e3d8" strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hex)" />
    </svg>
  )
}

function ClassificationStripe({ pos }) {
  const yProps = pos === 'top' ? { top: 0 } : { bottom: 0 }
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, ...yProps,
      height: 22,
      borderTop: pos === 'bottom' ? '1px solid #1a1f2a' : 'none',
      borderBottom: pos === 'top' ? '1px solid #1a1f2a' : 'none',
      background: 'repeating-linear-gradient(90deg, transparent 0 18px, #1a1f2a 18px 36px)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 18px',
      fontSize: 8, letterSpacing: '.32em', color: 'var(--text-3)',
      textTransform: 'uppercase',
    }}>
      <span>● COMPARTMENTALIZED</span>
      <span>GRAYVEIL CORP · BLACK CHANNEL</span>
      <span>NOFORN · NOFWD ●</span>
    </div>
  )
}

function CornerTick({ color, pos, flipX, flipY }) {
  const transform = `${flipX ? 'scaleX(-1)' : ''} ${flipY ? 'scaleY(-1)' : ''}`.trim()
  return (
    <svg
      width={10} height={10} viewBox="0 0 10 10"
      style={{ position: 'absolute', ...pos, transform, opacity: 0.7 }}
      aria-hidden="true"
    >
      <path d="M 0 0 L 10 0 M 0 0 L 0 10" stroke={color} strokeWidth="1.4" fill="none" />
    </svg>
  )
}

function Caret({ color }) {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 12,
      background: color, marginLeft: 2,
      verticalAlign: '-2px',
      animation: 'cipher-blink 1s steps(1) infinite',
    }} />
  )
}

function Dots() {
  const [n, setN] = useState(1)
  useEffect(() => {
    const id = setInterval(() => setN(v => (v % 3) + 1), 320)
    return () => clearInterval(id)
  }, [])
  return <span>{'.'.repeat(n)}</span>
}

function nowStamp() {
  const d = new Date()
  return `T-${d.toLocaleTimeString('en-GB', { hour12: false }).replace(/:/g, '·')} · REL ${d.getFullYear()}`
}
