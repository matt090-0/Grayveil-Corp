import GrayveilLogo from './GrayveilLogo'

/**
 * Branded fallback shown when a render error crashes the React tree.
 * Wired through Sentry.ErrorBoundary in main.jsx — Sentry captures the
 * exception; this component is what the user sees.
 */
export default function ErrorFallback({ error, resetError, eventId }) {
  const message = error?.message || 'An unexpected error interrupted the uplink.'
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0b0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(214,69,69,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'relative',
        maxWidth: 520, width: '100%',
        background: 'rgba(15,16,21,0.88)',
        border: '1px solid rgba(214,69,69,0.25)',
        borderRadius: 12,
        padding: '40px 36px',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 0 60px rgba(214,69,69,0.15)',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'center',
          marginBottom: 24,
          filter: 'drop-shadow(0 0 16px rgba(214,69,69,0.35))',
        }}>
          <GrayveilLogo size={56} />
        </div>

        <div style={{
          textAlign: 'center',
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 10, letterSpacing: '.3em',
          color: '#d64545', marginBottom: 10,
        }}>
          SYSTEM FAULT
        </div>

        <div style={{
          textAlign: 'center', color: '#d4d8e0',
          fontSize: 15, lineHeight: 1.5, marginBottom: 20,
        }}>
          {message}
        </div>

        {eventId && (
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '12px 14px', marginBottom: 24,
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            fontSize: 10, color: '#6a7280',
            textAlign: 'center', letterSpacing: '.15em',
          }}>
            REF: {eventId}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => { try { resetError?.() } catch {} ; window.location.reload() }}
            style={{
              flex: 1, padding: '12px 16px',
              background: 'transparent',
              border: '1px solid #d64545',
              borderRadius: 8,
              color: '#d64545',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              fontSize: 11, letterSpacing: '.2em', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            RELOAD
          </button>
          <button
            onClick={() => { window.location.href = '/' }}
            style={{
              flex: 1, padding: '12px 16px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              color: '#d4d8e0',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              fontSize: 11, letterSpacing: '.2em',
              cursor: 'pointer',
            }}
          >
            RETURN HOME
          </button>
        </div>

        <div style={{
          marginTop: 24, textAlign: 'center',
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 9, letterSpacing: '.25em', color: '#4a5060',
        }}>
          GRAYVEIL CORPORATION
        </div>
      </div>
    </div>
  )
}
