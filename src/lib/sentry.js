// Sentry integration.
//
// Enabled only when VITE_SENTRY_DSN is set. Safe to import from anywhere —
// all helpers no-op silently when the SDK isn't initialized.
//
// Environment variables (all optional):
//   VITE_SENTRY_DSN              — if unset, Sentry is entirely disabled
//   VITE_SENTRY_ENVIRONMENT      — e.g. "production" | "staging" | "dev"
//   VITE_SENTRY_RELEASE          — tag for the current build (commit sha, etc.)
//   VITE_SENTRY_TRACES_SAMPLE    — float 0..1, default 0.1
//   VITE_SENTRY_REPLAYS_ERRORS   — float 0..1, default 1.0 (on errors only)

import * as Sentry from '@sentry/react'

let initialized = false

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn || initialized) return

  const tracesSampleRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE) || 0.1
  const replaysOnErrorSampleRate = Number(import.meta.env.VITE_SENTRY_REPLAYS_ERRORS) || 1.0

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    tracesSampleRate,
    // Record replays for errored sessions only — 0% normal traffic.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: false,
      }),
    ],
    // Drop runtime noise we don't care about.
    ignoreErrors: [
      /ResizeObserver loop/i,
      /Non-Error promise rejection captured/i,
      /Load failed/,         // iOS Safari fetch errors
      /NetworkError/i,
      /AbortError/i,
    ],
    beforeSend(event) {
      // Never forward auth tokens or API keys if they somehow end up in a message.
      const msg = event.message || ''
      if (/eyJ[A-Za-z0-9_-]{20,}/.test(msg)) return null
      return event
    },
  })

  initialized = true
}

export function setSentryUser(profile) {
  if (!initialized) return
  if (!profile) {
    Sentry.setUser(null)
    return
  }
  Sentry.setUser({
    id: profile.id,
    username: profile.handle,
    tier: profile.tier,
    is_founder: !!profile.is_founder,
  })
}

export function captureException(err, context) {
  if (!initialized) { console.error(err); return }
  Sentry.captureException(err, context ? { extra: context } : undefined)
}

export { Sentry }
