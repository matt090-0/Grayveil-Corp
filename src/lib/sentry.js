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

// Redact three classes of secret from anywhere in an event or breadcrumb:
//   1. Full JWTs (three base64url segments) — Supabase access/refresh tokens
//   2. Supabase/Discord webhook URLs (path contains the secret)
//   3. Bearer token headers and apikey fields
// Walks the object graph — strings, arrays, nested objects — so secrets that
// slip into event.extra, event.contexts, event.request, breadcrumbs, etc. are
// scrubbed. Returns a cloned object; never mutates the input.
const JWT_RX   = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g
const HOOK_RX  = /https:\/\/(?:discord(?:app)?\.com|ptb\.discord\.com)\/api\/webhooks\/[^\s"'<>]+/gi
const BEARER_RX= /Bearer\s+[A-Za-z0-9._\-+/=]+/gi
const REDACTED = '[REDACTED]'
const SENSITIVE_KEYS = /^(authorization|apikey|api_key|x-api-key|cookie|set-cookie|password|access_token|refresh_token|token)$/i

function redactString(s) {
  if (typeof s !== 'string') return s
  return s
    .replace(JWT_RX, REDACTED)
    .replace(HOOK_RX, REDACTED)
    .replace(BEARER_RX, 'Bearer ' + REDACTED)
}

function redactSecrets(input, depth = 0) {
  if (depth > 6) return input // bail on pathological cycles / deep trees
  if (input == null) return input
  if (typeof input === 'string') return redactString(input)
  if (typeof input !== 'object') return input
  if (Array.isArray(input)) return input.map(v => redactSecrets(v, depth + 1))
  const out = {}
  for (const [k, v] of Object.entries(input)) {
    out[k] = SENSITIVE_KEYS.test(k) ? REDACTED : redactSecrets(v, depth + 1)
  }
  return out
}

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
      return redactSecrets(event)
    },
    beforeBreadcrumb(breadcrumb) {
      return redactSecrets(breadcrumb)
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
