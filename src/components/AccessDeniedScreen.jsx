// ─────────────────────────────────────────────────────────────
// AccessDeniedScreen — shown when a member's tier or permission
// set isn't enough for a route or action they tried to reach.
//
// Visual: defense-contractor classified-document card. Red accent
// stripe, corner registration ticks, animated scan-line, [CLASSIFIED]
// stamp, and a REF code derived from the missing permission so two
// users hitting the same denial see consistent telemetry.
//
// Props (all optional):
//   permission   string — required permission key (rendered in mono)
//   reason       string — short human reason; defaults to "Insufficient clearance."
//   minTier      number — required tier if known
//   currentTier  number — user's tier
//   onReturn     () => void — back-button handler; defaults to navigate(-1)
// ─────────────────────────────────────────────────────────────
import { useNavigate } from 'react-router-dom'
import GrayveilLogo from './GrayveilLogo'

const RED = '#c45a4a'

// Stable hash → REF code so the same denial gets the same id.
function refFor(permission, minTier) {
  const seed = `${permission || 'access'}|${minTier ?? '?'}`
  let h = 5381
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h) ^ seed.charCodeAt(i)
  return ('00000000' + (h >>> 0).toString(16)).slice(-8) +
         '-' + (Math.abs(h * 31) >>> 0).toString(16).slice(0, 4)
}

export default function AccessDeniedScreen({
  permission = 'admin_console',
  reason     = 'Insufficient clearance for this section.',
  minTier,
  currentTier,
  onReturn,
}) {
  const navigate = useNavigate()
  const handleReturn = onReturn || (() => navigate('/'))
  const ref = refFor(permission, minTier)

  return (
    <div style={{
      minHeight: 'calc(100vh - 60px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, position: 'relative', overflow: 'hidden',
    }}>
      {/* Faint red ambient glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse at center, ${RED}1a 0%, transparent 65%)`,
      }} />

      {/* Single-pass scan line */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0, height: 1,
        background: `linear-gradient(90deg, transparent 0%, ${RED} 50%, transparent 100%)`,
        boxShadow: `0 0 14px ${RED}`,
        animation: 'gv-scanline 4s linear infinite',
      }} />

      <div style={{
        position: 'relative',
        width: '100%', maxWidth: 520,
        background: 'rgba(11,14,19,0.92)',
        border: `1px solid ${RED}55`,
        borderLeft: `3px solid ${RED}`,
        padding: 'clamp(24px, 5vw, 40px) clamp(22px, 5vw, 36px)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: `0 0 60px ${RED}22`,
      }}>
        {/* Corner registration ticks */}
        <CornerTick color={RED} pos={{ top: 8, left: 8 }} />
        <CornerTick color={RED} pos={{ top: 8, right: 8 }} flipX />
        <CornerTick color={RED} pos={{ bottom: 8, left: 8 }} flipY />
        <CornerTick color={RED} pos={{ bottom: 8, right: 8 }} flipX flipY />

        {/* CLASSIFICATION header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 28, gap: 12,
        }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
            letterSpacing: '.32em', color: RED, fontWeight: 700,
            textTransform: 'uppercase',
          }}>● RESTRICTED · CLEARANCE GATE</span>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
            letterSpacing: '.24em', color: 'var(--text-3)',
            textTransform: 'uppercase',
          }}>GRAYVEIL CORP</span>
        </div>

        {/* Logo + classification stamp */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ filter: `drop-shadow(0 0 14px ${RED}55)`, opacity: 0.85 }}>
            <GrayveilLogo size={48} />
          </div>
          <div style={{
            border: `1px dashed ${RED}88`,
            padding: '6px 12px',
            transform: 'rotate(-2deg)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11, fontWeight: 700, letterSpacing: '.28em',
            color: RED, textTransform: 'uppercase',
          }}>[CLASSIFIED]</div>
        </div>

        {/* Big heading */}
        <h1 style={{
          fontFamily: 'Inter Tight, sans-serif',
          fontSize: 'clamp(28px, 5vw, 40px)',
          fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1,
          color: 'var(--text-1)', marginBottom: 10,
        }}>ACCESS DENIED</h1>

        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 14,
          color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 22,
        }}>{reason}</p>

        {/* Detail rows */}
        <div style={{
          marginBottom: 24,
          borderTop: `1px solid ${RED}33`,
        }}>
          <DetailRow label="Required permission" mono value={permission} />
          {typeof minTier === 'number' && (
            <DetailRow
              label="Required clearance"
              value={`TIER ${minTier} OR HIGHER`}
            />
          )}
          {typeof currentTier === 'number' && (
            <DetailRow
              label="Your clearance"
              value={`TIER ${currentTier}`}
              valueColor={RED}
            />
          )}
          <DetailRow label="Reference" mono value={ref} valueColor="var(--text-3)" />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={handleReturn}
            className="h-accent-bg"
            style={{
              flex: 1, minWidth: 140,
              background: 'var(--accent)', color: '#0a0a0c', border: 'none',
              borderRadius: 2, padding: '12px 20px',
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
              fontWeight: 700, letterSpacing: '.22em', textTransform: 'uppercase',
              cursor: 'pointer', transition: 'background .15s',
            }}
          >RETURN TO SITREP</button>
          <button
            onClick={() => navigate('/messages')}
            className="h-accent-edge"
            style={{
              flex: 1, minWidth: 140,
              background: 'transparent', color: 'var(--text-2)',
              border: '1px solid var(--border-md)', borderRadius: 2,
              padding: '12px 20px',
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
              fontWeight: 600, letterSpacing: '.22em', textTransform: 'uppercase',
              cursor: 'pointer', transition: 'border-color .15s, color .15s',
            }}
          >REQUEST ELEVATION</button>
        </div>

        {/* Footer chrome */}
        <div style={{
          marginTop: 26, paddingTop: 14,
          borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
          letterSpacing: '.28em', color: 'var(--text-3)',
          textTransform: 'uppercase', flexWrap: 'wrap', gap: 8,
        }}>
          <span>This event has been logged</span>
          <span>{new Date().toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          }).toUpperCase()}</span>
        </div>
      </div>

      <style>{`
        @keyframes gv-scanline {
          0%   { top: 0;    opacity: 0; }
          5%   { opacity: 1; }
          50%  { opacity: 1; }
          95%  { opacity: 0; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  )
}

function DetailRow({ label, value, mono, valueColor }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      gap: 12, padding: '10px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
        letterSpacing: '.24em', color: 'var(--text-3)',
        textTransform: 'uppercase', flexShrink: 0,
      }}>{label}</span>
      <span style={{
        fontFamily: mono ? 'JetBrains Mono, monospace' : 'Inter, sans-serif',
        fontSize: mono ? 11 : 13,
        color: valueColor || 'var(--text-1)',
        textAlign: 'right',
        overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{value}</span>
    </div>
  )
}

function CornerTick({ color, pos, flipX, flipY }) {
  const size = 10
  const transform = `${flipX ? 'scaleX(-1)' : ''} ${flipY ? 'scaleY(-1)' : ''}`.trim()
  return (
    <svg
      width={size} height={size} viewBox="0 0 10 10"
      style={{ position: 'absolute', ...pos, transform, opacity: 0.7 }}
      aria-hidden="true"
    >
      <path d="M 0 0 L 10 0 M 0 0 L 0 10" stroke={color} strokeWidth="1.4" fill="none" />
    </svg>
  )
}
