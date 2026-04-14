import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

const TOAST_COLORS = {
  success: { bg: '#1a2e1a', border: '#2d5a2d', color: '#5ab870' },
  error:   { bg: '#2e1a1a', border: '#5a2d2d', color: '#e05050' },
  info:    { bg: '#1a1a2e', border: '#2d2d5a', color: '#5a80d9' },
  warning: { bg: '#2e2a1a', border: '#5a4d2d', color: '#d4af6e' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 99999,
        display: 'flex', flexDirection: 'column-reverse', gap: 8,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const c = TOAST_COLORS[t.type] || TOAST_COLORS.info
          return (
            <div key={t.id} style={{
              background: c.bg, border: `1px solid ${c.border}`,
              borderRadius: 8, padding: '10px 16px', minWidth: 250, maxWidth: 380,
              fontSize: 13, color: c.color, fontFamily: 'var(--font-mono, monospace)',
              boxShadow: '0 8px 32px rgba(0,0,0,.4)',
              animation: 'toast-in .3s ease-out',
              pointerEvents: 'auto',
            }}>
              {t.message}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
