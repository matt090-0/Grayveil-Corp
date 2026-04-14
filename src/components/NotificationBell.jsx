import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

const TYPE_ICON = {
  promotion: '⬆',
  contract_posted: '◆',
  poll_created: '◑',
  intel_filed: '◍',
  fleet_request: '◎',
  application: '◐',
  announcement: '◈',
  general: '●',
}

export default function NotificationBell() {
  const { profile } = useAuth()
  const [notifs, setNotifs] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  async function load() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifs(data || [])
  }

  useEffect(() => {
    load()
    // Subscribe to new notifications
    const channel = supabase
      .channel('notifs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${profile.id}`,
      }, (payload) => {
        setNotifs(prev => [payload.new, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile.id])

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unread = notifs.filter(n => !n.is_read).length

  async function markAllRead() {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', profile.id)
      .eq('is_read', false)
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  async function handleClick(n) {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
    }
    if (n.link) { navigate(n.link); setOpen(false) }
  }

  async function clearAll() {
    await supabase.from('notifications').delete().eq('recipient_id', profile.id)
    setNotifs([])
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn btn-ghost btn-sm btn-icon"
        onClick={() => setOpen(!open)}
        style={{ position: 'relative', fontSize: 16, padding: '4px 8px' }}
      >
        ◆
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            background: 'var(--red, #e55)', color: '#fff',
            fontSize: 9, fontWeight: 700, borderRadius: '50%',
            width: 16, height: 16, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0,
          width: 300, maxHeight: 400, overflowY: 'auto',
          background: 'var(--bg-raised)', border: '1px solid var(--border-md)',
          borderRadius: 'var(--radius-lg)', marginBottom: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,.5)', zIndex: 100,
        }}>
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              NOTIFICATIONS {unread > 0 && `(${unread})`}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {unread > 0 && (
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 6px' }}
                  onClick={markAllRead}>MARK READ</button>
              )}
              {notifs.length > 0 && (
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 6px' }}
                  onClick={clearAll}>CLEAR</button>
              )}
            </div>
          </div>

          {notifs.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>
              NO NOTIFICATIONS
            </div>
          ) : notifs.map(n => (
            <div
              key={n.id}
              onClick={() => handleClick(n)}
              style={{
                padding: '10px 14px', borderBottom: '1px solid var(--border)',
                cursor: n.link ? 'pointer' : 'default',
                background: n.is_read ? 'transparent' : 'var(--accent-glow)',
                transition: 'background .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
              onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'transparent' : 'var(--accent-glow)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 12 }}>{TYPE_ICON[n.type] || TYPE_ICON.general}</span>
                <span style={{ fontSize: 12, fontWeight: n.is_read ? 400 : 500 }}>{n.title}</span>
                <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
                  {timeAgo(n.created_at)}
                </span>
              </div>
              {n.message && (
                <div style={{ fontSize: 11, color: 'var(--text-2)', paddingLeft: 20 }}>{n.message}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
