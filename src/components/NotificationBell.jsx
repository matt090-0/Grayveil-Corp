import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { timeAgo } from '../lib/dates'
import { confirmAction } from '../lib/dialogs'
import { UEE_AMBER, CLIP_CHAMFER_SM } from './uee'

// Notification type metadata. Mirrors src/pages/Inbox.jsx so the bell
// dropdown reads the same colour/glyph as the full-page inbox.
// If you add a new type, update both places.
const TYPE_META = {
  promotion:       { color: UEE_AMBER, glyph: '★', label: 'PROMOTION' },
  medal:           { color: UEE_AMBER, glyph: '✦', label: 'MEDAL' },
  achievement:     { color: UEE_AMBER, glyph: '✦', label: 'UNLOCK' },
  announcement:    { color: '#e05c5c', glyph: '◈', label: 'TX' },
  contract:        { color: '#5a80d9', glyph: '◆', label: 'CONTRACT' },
  op_signup:       { color: '#5a80d9', glyph: '◉', label: 'OP' },
  op_reminder:     { color: '#5a80d9', glyph: '⬢', label: 'OP' },
  aar:             { color: '#5ce0a1', glyph: '✓', label: 'AAR' },
  bounty:          { color: '#e05c5c', glyph: '✕', label: 'BOUNTY' },
  payment_request: { color: UEE_AMBER, glyph: '◇', label: 'PAY REQ' },
  message:         { color: '#b566d9', glyph: '✉', label: 'MSG' },
  mention:         { color: '#b566d9', glyph: '@', label: 'MENTION' },
  system:          { color: '#9099a8', glyph: '●', label: 'SYS' },
}

export default function NotificationBell() {
  const { profile: me } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const panelRef = useRef(null)

  async function load() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', me.id)
      .order('created_at', { ascending: false })
      .limit(15)
    setNotifications(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const ch = supabase.channel('notif-live')
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${me.id}` },
          () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [me.id])

  useEffect(() => {
    function handleClick(e) {
      if (open && panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const unread = notifications.filter(n => !n.is_read).length

  async function markAllRead() {
    await supabase.from('notifications').update({ is_read: true })
      .eq('recipient_id', me.id).eq('is_read', false)
    load()
  }
  async function clickNotif(n) {
    if (!n.is_read) await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
    if (n.link) navigate(n.link)
    setOpen(false)
    load()
  }
  async function clearAll() {
    if (!(await confirmAction('Clear all notifications?'))) return
    await supabase.from('notifications').delete().eq('recipient_id', me.id)
    load()
  }
  function openInbox() {
    navigate('/inbox')
    setOpen(false)
  }

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        background: 'transparent',
        border: `1px solid ${unread > 0 ? UEE_AMBER + '88' : 'var(--border)'}`,
        borderRadius: 4,
        width: 36, height: 36,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        color: unread > 0 ? UEE_AMBER : 'var(--text-2)',
        position: 'relative',
        transition: 'all .15s',
      }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = UEE_AMBER
          e.currentTarget.style.color = UEE_AMBER
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = unread > 0 ? UEE_AMBER + '88' : 'var(--border)'
          e.currentTarget.style.color = unread > 0 ? UEE_AMBER : 'var(--text-2)'
        }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M3 6a5 5 0 0 1 10 0v3l1.5 2.5H1.5L3 9V6z" />
          <path d="M6 13a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5,
            background: UEE_AMBER, color: '#0a0b0f',
            fontSize: 9, fontWeight: 700,
            fontFamily: 'var(--font-mono)', letterSpacing: '.05em',
            borderRadius: 10, padding: '1px 5px', minWidth: 16, textAlign: 'center',
            border: '2px solid var(--bg-base)',
            boxShadow: `0 0 6px ${UEE_AMBER}66`,
            animation: 'pulse 2s ease-in-out infinite',
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        // Bell lives in the sidebar footer (bottom-left of viewport). Panel
        // is `position: fixed` so it breaks out of the 220px-wide sidebar
        // regardless of screen size: clamped to viewport width on mobile,
        // seated to the right of the sidebar on desktop.
        <div style={{
          position: 'fixed',
          bottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
          left: 'min(calc(var(--sidebar-w, 220px) + 12px), calc(100vw - 12px - min(380px, calc(100vw - 24px))))',
          width: 'min(380px, calc(100vw - 24px))',
          maxHeight: 'min(560px, calc(100vh - 24px))',
          background: 'var(--bg-raised)',
          border: `1px solid ${UEE_AMBER}55`,
          clipPath: CLIP_CHAMFER_SM,
          boxShadow: `0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px ${UEE_AMBER}22`,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column', zIndex: 1100,
        }}>
          {/* Classification bar */}
          <div style={{
            background: 'linear-gradient(180deg, #0e0f14 0%, #0a0b0f 100%)',
            borderBottom: `1px solid ${UEE_AMBER}33`,
            padding: '5px 14px',
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em',
            color: UEE_AMBER,
            display: 'flex', alignItems: 'center', gap: 8,
            flexShrink: 0,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%', background: UEE_AMBER,
              boxShadow: `0 0 6px ${UEE_AMBER}`,
              animation: 'pulse 2s ease-in-out infinite',
            }} />
            INBOX · {unread} UNREAD
          </div>

          {/* Header */}
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600,
              color: 'var(--text-1)',
            }}>
              Recent Notifications
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    background: 'transparent', border: '1px solid var(--border)',
                    color: 'var(--text-3)', cursor: 'pointer',
                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em', fontWeight: 600,
                    padding: '3px 7px', borderRadius: 3,
                  }}
                >READ ALL</button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  style={{
                    background: 'transparent', border: '1px solid var(--border)',
                    color: 'var(--text-3)', cursor: 'pointer',
                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em', fontWeight: 600,
                    padding: '3px 7px', borderRadius: 3,
                  }}
                >CLEAR</button>
              )}
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{
                padding: 20, textAlign: 'center',
                fontSize: 11, color: 'var(--text-3)',
                fontFamily: 'var(--font-mono)', letterSpacing: '.15em',
              }}>LOADING...</div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, opacity: 0.18, marginBottom: 8, color: UEE_AMBER }}>✓</div>
                <div style={{
                  fontSize: 11, color: 'var(--text-3)',
                  fontFamily: 'var(--font-mono)', letterSpacing: '.18em',
                }}>ALL CAUGHT UP</div>
              </div>
            ) : notifications.map(n => {
              const meta = TYPE_META[n.type] || TYPE_META.system
              return (
                <div
                  key={n.id}
                  onClick={() => clickNotif(n)}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border)',
                    cursor: n.link ? 'pointer' : 'default',
                    background: !n.is_read ? `${meta.color}0a` : 'transparent',
                    borderLeft: `3px solid ${!n.is_read ? meta.color : 'transparent'}`,
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if (n.link) e.currentTarget.style.background = `${meta.color}14` }}
                  onMouseLeave={e => e.currentTarget.style.background = !n.is_read ? `${meta.color}0a` : 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{
                      fontSize: 13, marginTop: 1,
                      color: meta.color, flexShrink: 0,
                      width: 16, textAlign: 'center',
                    }}>
                      {meta.glyph}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2,
                      }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '.18em',
                          color: meta.color, fontWeight: 600,
                        }}>{meta.label}</span>
                        <span style={{
                          marginLeft: 'auto', fontSize: 9, color: 'var(--text-3)',
                          fontFamily: 'var(--font-mono)', letterSpacing: '.1em',
                        }}>{timeAgo(n.created_at)}</span>
                      </div>
                      <div style={{
                        fontSize: 12, fontWeight: !n.is_read ? 600 : 500,
                        color: 'var(--text-1)', marginBottom: n.message ? 2 : 0,
                        lineHeight: 1.35,
                      }}>{n.title}</div>
                      {n.message && (
                        <div style={{
                          fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          {n.message}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer — full inbox link */}
          <button
            onClick={openInbox}
            style={{
              flexShrink: 0,
              borderTop: `1px solid ${UEE_AMBER}33`,
              padding: '10px 14px',
              background: 'rgba(0,0,0,0.25)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.22em', fontWeight: 600,
              color: UEE_AMBER,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              transition: 'background .12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = `${UEE_AMBER}14`}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.25)'}
          >
            <span>◆ OPEN FULL INBOX</span>
            <span>→</span>
          </button>
        </div>
      )}
    </div>
  )
}
