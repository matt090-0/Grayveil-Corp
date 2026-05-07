import { useEffect, useState } from 'react'
import { usePwaInstall } from '../lib/usePwaInstall'

/**
 * Combined PWA surface:
 *   1. Register the service worker (replaces the inline <script> in index.html).
 *   2. Watch for an updated SW that is waiting — show a reload banner.
 *   3. Show install nudge — Android/desktop via beforeinstallprompt, iOS
 *      via a manual "Tap Share → Add to Home Screen" instruction card.
 *
 * Install state is owned by usePwaInstall so the persistent Install
 * button (Profile page / Layout chip) shares the same source of truth.
 * Banners are fixed-position, dismissible, and never block input.
 */
export default function PWAStatus() {
  const [waitingWorker, setWaitingWorker] = useState(null)
  const { isIOS, canInstall, install, dismissed, dismiss } = usePwaInstall()

  // ── Register SW + listen for updates ──
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let registration
    let pollId
    let cancelled = false

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register('/sw.js')
        if (cancelled) return

        // Force an immediate update check — covers the case where Chrome
        // cached the registration from a prior session and skipped refetch.
        registration.update().catch(() => {})

        if (registration.waiting) setWaitingWorker(registration.waiting)

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(installing)
            }
          })
        })

        pollId = setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000)
      } catch {
        // SW registration failed — not fatal, app still works
      }
    }

    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && registration) {
        registration.update().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    let refreshing = false
    const onControllerChange = () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    return () => {
      cancelled = true
      if (pollId) clearInterval(pollId)
      window.removeEventListener('load', register)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  function applyUpdate() {
    if (!waitingWorker) return
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
  }

  return (
    <>
      {waitingWorker && (
        <Banner
          accent="var(--amber)"
          label="UPDATE READY"
          message="A new version of Grayveil is available."
          primary={{ label: 'RELOAD', onClick: applyUpdate }}
        />
      )}
      {canInstall && !dismissed && !isIOS && (
        <Banner
          accent="var(--accent)"
          label="INSTALL APP"
          message="Add Grayveil to your home screen for a native-app feel — works offline, opens from your launcher."
          primary={{ label: 'INSTALL', onClick: install }}
          secondary={{ label: 'LATER', onClick: dismiss }}
        />
      )}
      {canInstall && !dismissed && isIOS && (
        <Banner
          accent="var(--accent)"
          label="ADD TO HOME SCREEN"
          message={
            <>
              Tap <strong style={{ color: 'var(--text-1)' }}>Share</strong> → <strong style={{ color: 'var(--text-1)' }}>Add to Home Screen</strong> to install Grayveil. Opens like a native app, works offline.
            </>
          }
          secondary={{ label: 'DISMISS', onClick: dismiss }}
        />
      )}
    </>
  )
}

function Banner({ accent, label, message, primary, secondary }) {
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 16, right: 16, bottom: 16,
        maxWidth: 420,
        marginLeft: 'auto',
        zIndex: 99998,
        background: 'rgba(11, 14, 19, 0.96)',
        border: '1px solid var(--border-md)',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 2,
        padding: '14px 16px',
        boxShadow: '0 12px 40px rgba(0,0,0,.55)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div
        style={{
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 10, letterSpacing: '.28em',
          color: accent, marginBottom: 6, textTransform: 'uppercase',
        }}
      >
        ● {label}
      </div>
      <div style={{
        color: 'var(--text-2)', fontSize: 13, lineHeight: 1.5, marginBottom: 12,
      }}>
        {message}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {secondary && (
          <button
            onClick={secondary.onClick}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-md)',
              borderRadius: 2,
              color: 'var(--text-2)',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              fontSize: 10, letterSpacing: '.22em',
              padding: '7px 14px', cursor: 'pointer',
            }}
          >
            {secondary.label}
          </button>
        )}
        {primary && (
          <button
            onClick={primary.onClick}
            style={{
              background: accent,
              border: 'none',
              borderRadius: 2,
              color: '#0a0a0c',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              fontSize: 10, letterSpacing: '.22em', fontWeight: 700,
              padding: '7px 14px', cursor: 'pointer',
            }}
          >
            {primary.label}
          </button>
        )}
      </div>
    </div>
  )
}
