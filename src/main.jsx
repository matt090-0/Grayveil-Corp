import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ToastProvider } from './components/Toast'
import PWAStatus from './components/PWAStatus'
import ErrorFallback from './components/ErrorFallback'
import { initSentry, Sentry } from './lib/sentry'
import './index.css'

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
