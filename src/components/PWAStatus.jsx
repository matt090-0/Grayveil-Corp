import { useEffect, useState } from 'react'

/**
 * Combined PWA surface:
 *   1. Register the service worker (replaces the inline <script> in index.html).
 *   2. Watch for an updated SW that is waiting — show a reload banner.
 *   3. Capture the beforeinstallprompt event — expose an install button.
 *
 * Both banners are fixed-position, auto-dismissible, and never block input.
 */
export default function PWAStatus() {
  const [waitingWorker, setWaitingWorker] = useState(null)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installDismissed, setInstallDismissed] = useState(false)

  // ── Register SW + listen for updates ──
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let registration
    const onLoad = async () => {
      try {
        registration = await navigator.serviceWorker.register('/sw.js')

        // If there's already a waiting worker at load time
        if (registration.waiting) setWaitingWorker(registration.waiting)

        // Watch for new installations
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(installing)
            }
          })
        })

        // Poll for updates hourly while the tab is open
        const poll = setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000)
        return () => clearInterval(poll)
      } catch {
        // SW registration failed — not fatal, app still works
      }
    }
    window.addEventListener('load', onLoad)

    // Reload once when the active SW changes (user accepted update)
    let refreshing = false
    const onControllerChange = () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    return () => {
      window.removeEventListener('load', onLoad)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  // ── Capture install prompt ──
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Clear after successful install
    const installedHandler = () => {
      setInstallPrompt(null)
      try { localStorage.setItem('pwa_installed', '1') } catch {}
    }
    window.addEventListener('appinstalled', installedHandler)

    // Respect previous dismissal for 7 days
    try {
      const dismissedAt = parseInt(localStorage.getItem('pwa_install_dismissed_at') || '0')
      if (dismissedAt && Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) {
        setInstallDismissed(true)
      }
    } catch {}

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  function applyUpdate() {
    if (!waitingWorker) return
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
    // controllerchange handler will reload
  }

  async function triggerInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    try { await installPrompt.userChoice } catch {}
    setInstallPrompt(null)
  }

  function dismissInstall() {
    setInstallPrompt(null)
    setInstallDismissed(true)
    try { localStorage.setItem('pwa_install_dismissed_at', String(Date.now())) } catch {}
  }

  return (
    <>
      {waitingWorker && (
        <Banner
          accent="#c8a55a"
          label="UPDATE READY"
          message="A new version of Grayveil is available."
          primary={{ label: 'RELOAD', onClick: applyUpdate }}
        />
      )}
      {installPrompt && !installDismissed && (
        <Banner
          accent="#5a80d9"
          label="INSTALL APP"
          message="Add Grayveil to your home screen for a native app feel."
          primary={{ label: 'INSTALL', onClick: triggerInstall }}
          secondary={{ label: 'LATER', onClick: dismissInstall }}
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
        background: 'rgba(15,16,21,0.96)',
        border: `1px solid ${accent}55`,
        borderRadius: 10,
        padding: '14px 16px',
        boxShadow: `0 12px 40px rgba(0,0,0,.5), 0 0 40px ${accent}22`,
        backdropFilter: 'blur(12px)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 10, letterSpacing: '.25em',
          color: accent, marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ color: '#d4d8e0', fontSize: 13, lineHeight: 1.45, marginBottom: 12 }}>
        {message}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {secondary && (
          <button
            onClick={secondary.onClick}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6,
              color: '#9aa0ac',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              fontSize: 10, letterSpacing: '.2em',
              padding: '7px 14px', cursor: 'pointer',
            }}
          >
            {secondary.label}
          </button>
        )}
        <button
          onClick={primary.onClick}
          style={{
            background: 'transparent',
            border: `1px solid ${accent}`,
            borderRadius: 6,
            color: accent,
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            fontSize: 10, letterSpacing: '.2em', fontWeight: 600,
            padding: '7px 14px', cursor: 'pointer',
          }}
        >
          {primary.label}
        </button>
      </div>
    </div>
  )
}
