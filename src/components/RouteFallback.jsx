import { UEE_AMBER } from './uee'

// ─────────────────────────────────────────────────────────────
// Suspense fallback used while a route's lazy-loaded chunk is
// still downloading. Matches the UEE archive aesthetic so the
// transition reads as "incoming transmission" rather than a
// blank-screen failure.
//
// `fullscreen` covers the entire viewport (used outside Layout
// for pre-auth routes); the default mode renders inside the
// page content area so the sidebar stays put.
// ─────────────────────────────────────────────────────────────
export default function RouteFallback({ fullscreen = false }) {
  const wrapStyle = fullscreen
    ? { position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }
    : { padding: '60px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }

  return (
    <div style={wrapStyle}>
      <div style={{
        textAlign: 'center',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-3)',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '8px 18px',
          border: `1px solid ${UEE_AMBER}55`,
          background: `${UEE_AMBER}0a`,
          borderRadius: 3,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: UEE_AMBER,
            boxShadow: `0 0 10px ${UEE_AMBER}`,
            animation: 'pulse 1.4s ease-in-out infinite',
          }} />
          <span style={{
            fontSize: 11, letterSpacing: '.25em', color: UEE_AMBER, fontWeight: 600,
          }}>
            INCOMING TRANSMISSION
          </span>
        </div>
        <div style={{
          fontSize: 9, letterSpacing: '.22em', marginTop: 10,
          color: 'var(--text-3)',
        }}>
          ◆ DECRYPTING PAGE CHUNK
        </div>
      </div>
    </div>
  )
}
