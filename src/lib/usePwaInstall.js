import { useEffect, useState } from 'react'

// ─────────────────────────────────────────────────────────────
// usePwaInstall — single source of truth for install state.
//
// Returns:
//   isInstalled  : true when the app is running standalone (already installed)
//   isIOS        : true on iPhone/iPad Safari (no beforeinstallprompt support)
//   canInstall   : true when the browser has fired beforeinstallprompt
//                  OR the user is on iOS and not already standalone
//   install()    : triggers the captured prompt; resolves to user choice.
//                  On iOS this is a no-op (caller should show instructions).
//   dismissed    : true if the user clicked "Later" within the past 7 days
//   dismiss()    : marks the install nudge as dismissed for 7 days
//
// Banner state (PWAStatus) and the persistent button (Profile / Layout)
// share this hook so they stay in sync — accept on one, the other goes away.
// ─────────────────────────────────────────────────────────────
const DISMISS_KEY  = 'pwa_install_dismissed_at'
const DISMISS_DAYS = 7

function detectStandalone() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true
  if (window.navigator?.standalone) return true // iOS Safari home-screen
  return false
}

function detectIOS() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  // Plain iPhone/iPad/iPod, plus iPad-on-Mac (UA reports "Macintosh" but exposes touch).
  return /iPhone|iPad|iPod/.test(ua)
    || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

export function usePwaInstall() {
  const [isInstalled, setInstalled] = useState(detectStandalone)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  // Capture beforeinstallprompt + appinstalled at the window level.
  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    const onInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
      try { localStorage.setItem('pwa_installed', '1') } catch {}
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)

    // Honor a recent dismissal — only suppresses the banner, not the
    // persistent button.
    try {
      const at = parseInt(localStorage.getItem(DISMISS_KEY) || '0')
      if (at && Date.now() - at < DISMISS_DAYS * 86400000) setDismissed(true)
    } catch {}

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const isIOS = detectIOS() && !isInstalled

  // canInstall is true on Android/desktop when the browser has fired the
  // prompt OR on iOS Safari where we'll show manual instructions.
  const canInstall = !isInstalled && (!!installPrompt || isIOS)

  async function install() {
    if (!installPrompt) return null
    installPrompt.prompt()
    try {
      const choice = await installPrompt.userChoice
      setInstallPrompt(null)
      return choice
    } catch {
      setInstallPrompt(null)
      return null
    }
  }

  function dismiss() {
    setDismissed(true)
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
  }

  return { isInstalled, isIOS, canInstall, install, dismissed, dismiss }
}
