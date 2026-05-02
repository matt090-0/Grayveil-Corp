import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ToastProvider } from './components/Toast'
import PWAStatus from './components/PWAStatus'
import ErrorFallback from './components/ErrorFallback'
import { initSentry, Sentry } from './lib/sentry'
import './index.css'

const CHUNK_RELOAD_KEY = 'gv_chunk_reload_once'
function isChunkLoadFailure(err) {
  const text = String(err?.message || err || '').toLowerCase()
  return (
    text.includes('failed to fetch dynamically imported module') ||
    text.includes('importing a module script failed') ||
    text.includes('loading chunk') ||
    text.includes('chunkloaderror')
  )
}
function recoverFromChunkError(err) {
  if (!isChunkLoadFailure(err)) return
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1') return
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
  } catch {}
  window.location.reload()
}

window.addEventListener('error', (event) => recoverFromChunkError(event?.error || event?.message))
window.addEventListener('unhandledrejection', (event) => recoverFromChunkError(event?.reason))

// Initialize Sentry before React mounts so the ErrorBoundary can report
// errors that happen during the very first render. Safe no-op if DSN unset.
initSentry()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ error, resetError, eventId }) => (
        <ErrorFallback error={error} resetError={resetError} eventId={eventId} />
      )}
    >
      <ToastProvider>
        <App />
        <PWAStatus />
      </ToastProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
)
