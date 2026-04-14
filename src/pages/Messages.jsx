import { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export default function Messages() {
  const { profile: me } = useAuth()
  const [members, setMembers] = useState([])
  const [conversations, setConversations] = useState([])
  const [activeConv, setActiveConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    async function load() {
      const [{ data: mem }, { data: msgs }] = await Promise.all([
        supabase.from('profiles').select('id, handle, avatar_color, tier').eq('status', 'ACTIVE').order('handle'),
        supabase.from('messages').select('*, sender:profiles!messages_sender_id_fkey(handle, avatar_color), recipient:profiles!messages_recipient_id_fkey(handle, avatar_color)').order('created_at', { ascending: false }).limit(500),
      ])
      setMembers((mem || []).filter(m => m.id !== me.id))

      // Build conversation list
      const convMap = {}
      ;(msgs || []).forEach(m => {
        const otherId = m.sender_id === me.id ? m.recipient_id : m.sender_id
        const other = m.sender_id === me.id ? m.recipient : m.sender
        if (!convMap[otherId]) {
          convMap[otherId] = {
            id: otherId, handle: other?.handle, avatar_color: other?.avatar_color || '#c8a55a',
            lastMessage: m.content, lastTime: m.created_at,
            unread: 0,
          }
        }
        if (m.recipient_id === me.id && !m.is_read) convMap[otherId].unread++
      })
      setConversations(Object.values(convMap).sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime)))
      setLoading(false)
    }
    load()

    // Real-time subscription
    const channel = supabase.channel('dm-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async () => {
        load() // Refresh on new message
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [me.id])

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConv) return
    async function loadMsgs() {
      const { data } = await supabase.from('messages').select('*')
        .or(`and(sender_id.eq.${me.id},recipient_id.eq.${activeConv}),and(sender_id.eq.${activeConv},recipient_id.eq.${me.id})`)
        .order('created_at', { ascending: true })
        .limit(200)
      setMessages(data || [])
      // Mark as read
      await supabase.from('messages').update({ is_read: true })
        .eq('sender_id', activeConv).eq('recipient_id', me.id).eq('is_read', false)
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
    loadMsgs()
    const interval = setInterval(loadMsgs, 5000) // Poll for new messages
    return () => clearInterval(interval)
  }, [activeConv, me.id])

  async function send() {
    if (!text.trim() || !activeConv) return
    setSending(true)
    await supabase.from('messages').insert({ sender_id: me.id, recipient_id: activeConv, content: text.trim() })
    setText('')
    setSending(false)
    // Refresh
    const { data } = await supabase.from('messages').select('*')
      .or(`and(sender_id.eq.${me.id},recipient_id.eq.${activeConv}),and(sender_id.eq.${activeConv},recipient_id.eq.${me.id})`)
      .order('created_at', { ascending: true }).limit(200)
    setMessages(data || [])
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const activeProfile = members.find(m => m.id === activeConv)
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0)

  return (
    <>
      <div className="page-header">
        <div className="page-title">COMMS</div>
        <div className="page-subtitle">Internal messaging{totalUnread > 0 && ` — ${totalUnread} unread`}</div>
      </div>

      <div className="page-body" style={{ display: 'flex', gap: 0, height: 'calc(100vh - 160px)', overflow: 'hidden' }}>
        {/* Conversation list */}
        <div style={{
          width: 260, flexShrink: 0, borderRight: '1px solid var(--border)',
          overflowY: 'auto', display: 'flex', flexDirection: 'column',
        }}>
          {/* New conversation */}
          <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
            <select className="form-select" style={{ fontSize: 11 }} value=""
              onChange={e => { if (e.target.value) setActiveConv(e.target.value) }}>
              <option value="">+ NEW MESSAGE...</option>
              {members.filter(m => !conversations.find(c => c.id === m.id)).map(m => (
                <option key={m.id} value={m.id}>{m.handle}</option>
              ))}
            </select>
          </div>

          {loading ? <div style={{ padding: 20, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>Loading...</div> :
          conversations.length === 0 ? <div style={{ padding: 20, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>No conversations yet</div> :
          conversations.map(c => (
            <div key={c.id} onClick={() => setActiveConv(c.id)} style={{
              padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
              background: activeConv === c.id ? 'var(--bg-surface)' : 'transparent',
              transition: 'background .1s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  border: `1.5px solid ${c.avatar_color}`, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: c.avatar_color,
                }}>
                  {c.handle?.slice(0, 2).toUpperCase()}
                </div>
                <span style={{ fontSize: 13, fontWeight: c.unread > 0 ? 600 : 400, flex: 1 }}>{c.handle}</span>
                {c.unread > 0 && (
                  <span style={{
                    background: 'var(--accent)', color: '#0a0a10', fontSize: 9,
                    fontWeight: 700, borderRadius: 10, padding: '1px 6px', minWidth: 16,
                    textAlign: 'center',
                  }}>{c.unread}</span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{c.lastMessage}</span>
                <span style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{timeAgo(c.lastTime)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!activeConv ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              Select a conversation or start a new one
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: `1.5px solid ${activeProfile?.avatar_color || '#c8a55a'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: activeProfile?.avatar_color || '#c8a55a',
                }}>
                  {activeProfile?.handle?.slice(0, 2).toUpperCase() || '??'}
                </div>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{activeProfile?.handle || 'Unknown'}</span>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {messages.map(m => {
                  const isMine = m.sender_id === me.id
                  return (
                    <div key={m.id} style={{
                      alignSelf: isMine ? 'flex-end' : 'flex-start',
                      maxWidth: '70%',
                    }}>
                      <div style={{
                        background: isMine ? 'var(--accent-dim)' : 'var(--bg-surface)',
                        border: `1px solid ${isMine ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: isMine ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                        padding: '8px 12px', fontSize: 13, color: 'var(--text-1)',
                        lineHeight: 1.5,
                      }}>
                        {m.content}
                      </div>
                      <div style={{
                        fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
                        marginTop: 3, textAlign: isMine ? 'right' : 'left',
                      }}>
                        {timeAgo(m.created_at)}
                      </div>
                    </div>
                  )
                })}
                <div ref={endRef} />
              </div>

              {/* Input */}
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                <input className="form-input" value={text} onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && send()}
                  placeholder="Type a message..." style={{ flex: 1, fontSize: 13 }} />
                <button className="btn btn-primary btn-sm" onClick={send} disabled={sending || !text.trim()}>
                  SEND
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
