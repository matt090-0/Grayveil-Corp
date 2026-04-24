import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { timeAgo } from '../lib/dates'
import { confirmAction } from '../lib/dialogs'

const TYPE_ICONS = {
  promotion: '★',
  announcement: '📢',
  contract: '◆',
  bounty: '🎯',
  medal: '🏅',
  message: '✉',
  mention: '@',
  system: '●',
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
      .limit(30)
    setNotifications(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const ch = supabase.channel('notif-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${me.id}` }, () => load())
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
    await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', me.id).eq('is_read', false)
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

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
        width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: 'var(--text-2)', position: 'relative',
        transition: 'all .15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M3 6a5 5 0 0 1 10 0v3l1.5 2.5H1.5L3 9V6z" />
          <path d="M6 13a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: 'var(--red)', color: '#fff', fontSize: 9, fontWeight: 700,
            borderRadius: 10, padding: '1px 5px', minWidth: 16, textAlign: 'center',
            border: '2px solid var(--bg-base)',
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
          border: '1px solid var(--border-md)', borderRadius: 10,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', zIndex: 1100,
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '.2em', fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>NOTIFICATIONS</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{unread} unread · {notifications.length} total</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {unread > 0 && <button className="btn btn-ghost btn-sm" style={{ fontSize: 9, padding: '2px 6px' }} onClick={markAllRead}>READ ALL</button>}
              {notifications.length > 0 && <button className="btn btn-ghost btn-sm" style={{ fontSize: 9, padding: '2px 6px' }} onClick={clearAll}>CLEAR</button>}
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: 'var(--text-3)' }}>Loading...</div> :
            notifications.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 32, opacity: 0.15, marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>All caught up</div>
              </div>
            ) : notifications.map(n => (
              <div key={n.id} onClick={() => clickNotif(n)} style={{
                padding: '10px 14px', borderBottom: '1px solid var(--border)',
                cursor: n.link ? 'pointer' : 'default',
                background: !n.is_read ? 'rgba(212,216,224,0.04)' : 'transparent',
                borderLeft: !n.is_read ? '3px solid var(--accent)' : '3px solid transparent',
                transition: 'background .1s',
              }}
                onMouseEnter={e => { if (n.link) e.currentTarget.style.background = 'var(--bg-surface)' }}
                onMouseLeave={e => e.currentTarget.style.background = !n.is_read ? 'rgba(212,216,224,0.04)' : 'transparent'}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 14, marginTop: 1, color: 'var(--accent)', flexShrink: 0 }}>{TYPE_ICONS[n.type] || '●'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: !n.is_read ? 600 : 500, color: 'var(--text-1)', marginBottom: 2 }}>{n.title}</div>
                    {n.message && <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 3 }}>{n.message}</div>}
                    <div style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{timeAgo(n.created_at)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
