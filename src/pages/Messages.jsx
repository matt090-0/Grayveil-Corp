import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { fmtDate, timeAgo } from '../lib/dates'
import { useToast } from '../components/Toast'
import { ClassificationBar, StatusBadge, UEE_AMBER } from '../components/uee'

const REACTIONS = ['👍', '🫡', '✅', '⚡', '🎯', '🔥', '💀']
const CHANNELS = ['DIRECT', 'SQUAD', 'COMMAND', 'INTEL']
const PRIORITIES = ['ROUTINE', 'IMPORTANT', 'URGENT', 'CRITICAL']
const QUICK_TEMPLATES = [
  { label: 'FORM-UP', text: 'FORM-UP at designated rally point. Confirm ship status and role.' },
  { label: 'CONTACT', text: 'CONTACT reported. Marking hostile vector and awaiting command directives.' },
  { label: 'MEDEVAC', text: 'MEDEVAC required. Casualty location transmitted. Cover requested.' },
  { label: 'RTB', text: 'RTB ordered. Disengage and return to base in disciplined sequence.' },
]

function isOnline(ts) {
  if (!ts) return false
  return Date.now() - new Date(ts) < 300000
}
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
function dateSep(ts) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'TODAY'
  const y = new Date(now); y.setDate(y.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'YESTERDAY'
  return fmtDate(ts).toUpperCase()
}
function decodePriority(content) {
  const match = (content || '').match(/^\[(ROUTINE|IMPORTANT|URGENT|CRITICAL)\]\s+/)
  if (!match) return { priority: 'ROUTINE', body: content || '' }
  return { priority: match[1], body: (content || '').slice(match[0].length) }
}
function encodePriority(content, priority) {
  const plain = (content || '').trim()
  if (!plain) return plain
  return priority === 'ROUTINE' ? plain : `[${priority}] ${plain}`
}
function accentForPriority(priority) {
  if (priority === 'CRITICAL') return '#e05c5c'
  if (priority === 'URGENT') return '#e0a155'
  if (priority === 'IMPORTANT') return '#5a80d9'
  return UEE_AMBER
}

export default function Messages() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const endRef = useRef(null)
  const inputRef = useRef(null)

  const [channel, setChannel] = useState('DIRECT')
  const [members, setMembers] = useState([])
  const [conversations, setConversations] = useState([])
  const [activeConv, setActiveConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  const [text, setText] = useState('')
  const [priority, setPriority] = useState('ROUTINE')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [chatSearch, setChatSearch] = useState('')
  const [newConv, setNewConv] = useState(false)
  const [replyTo, setReplyTo] = useState(null)
  const [editing, setEditing] = useState(null)
  const [hoveredMsg, setHoveredMsg] = useState(null)
  const [reactingTo, setReactingTo] = useState(null)
  const [showPinned, setShowPinned] = useState(false)

  async function loadConvos() {
    const [{ data: mem }, { data: msgs, error }] = await Promise.all([
      supabase.from('profiles').select('id, handle, avatar_color, tier, last_seen_at, status').eq('status', 'ACTIVE').order('handle'),
      supabase.from('messages').select('id, sender_id, recipient_id, content, is_read, created_at, deleted_at')
        .is('deleted_at', null).order('created_at', { ascending: false }).limit(500),
    ])
    if (error) console.error('Convo load error:', error.message)
    const memList = (mem || []).filter(m => m.id !== me.id)
    setMembers(memList)
    const memMap = {}
    ;(mem || []).forEach(m => { memMap[m.id] = m })
    const convMap = {}
    ;(msgs || []).forEach(m => {
      const otherId = m.sender_id === me.id ? m.recipient_id : m.sender_id
      const other = memMap[otherId]
      if (!convMap[otherId]) {
        convMap[otherId] = {
          id: otherId,
          handle: other?.handle || 'Unknown',
          avatar_color: other?.avatar_color || '#d4d8e0',
          last_seen_at: other?.last_seen_at,
          lastMessage: decodePriority(m.content).body,
          lastTime: m.created_at,
          unread: 0,
        }
      }
      if (m.recipient_id === me.id && !m.is_read) convMap[otherId].unread++
    })
    setConversations(Object.values(convMap).sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime)))
    setLoading(false)
  }

  useEffect(() => {
    loadConvos()
    const ch = supabase
      .channel(`dm-convos-${me.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => { loadConvos() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [me.id])

  async function loadMsgs(convId) {
    if (!convId) return
    const { data, error } = await supabase.from('messages')
      .select('*')
      .or(`and(sender_id.eq.${me.id},recipient_id.eq.${convId}),and(sender_id.eq.${convId},recipient_id.eq.${me.id})`)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(300)
    if (error) { console.error('Messages load error:', error.message); return }
    const msgMap = {}
    ;(data || []).forEach(m => { msgMap[m.id] = m })
    const resolved = (data || []).map(m => ({
      ...m,
      reply: m.reply_to_id ? msgMap[m.reply_to_id] || null : null,
    }))
    setMessages(resolved)
    await supabase.from('messages').update({ is_read: true })
      .eq('sender_id', convId).eq('recipient_id', me.id).eq('is_read', false)
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  useEffect(() => {
    if (!activeConv || channel !== 'DIRECT') return
    loadMsgs(activeConv)
  }, [activeConv, me.id, channel])

  // Realtime for active uplink — replaces polling loop.
  useEffect(() => {
    if (!activeConv || channel !== 'DIRECT') return
    const ch = supabase
      .channel(`dm-active-${me.id}-${activeConv}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, payload => {
        const m = payload.new || payload.old || {}
        const inThread =
          (m.sender_id === me.id && m.recipient_id === activeConv)
          || (m.sender_id === activeConv && m.recipient_id === me.id)
        if (!inThread) return
        loadMsgs(activeConv)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [activeConv, me.id, channel])

  async function send() {
    if (!text.trim() || !activeConv || channel !== 'DIRECT') return
    setSending(true)
    const outgoing = encodePriority(text, priority)
    if (editing) {
      await supabase.from('messages')
        .update({ content: outgoing, edited_at: new Date().toISOString() })
        .eq('id', editing.id)
      setEditing(null)
    } else {
      await supabase.from('messages').insert({
        sender_id: me.id,
        recipient_id: activeConv,
        content: outgoing,
        reply_to_id: replyTo?.id || null,
      })
    }
    setText('')
    setReplyTo(null)
    setPriority('ROUTINE')
    setSending(false)
    loadMsgs(activeConv)
  }

  async function deleteMsg(id) {
    await supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    toast('Transmission purged', 'info')
    loadMsgs(activeConv)
  }
  async function toggleReaction(msg, emoji) {
    const next = { ...(msg.reactions || {}) }
    const users = next[emoji] || []
    if (users.includes(me.id)) {
      next[emoji] = users.filter(x => x !== me.id)
      if (!next[emoji].length) delete next[emoji]
    } else {
      next[emoji] = [...users, me.id]
    }
    await supabase.from('messages').update({ reactions: next }).eq('id', msg.id)
    setReactingTo(null)
    loadMsgs(activeConv)
  }
  async function togglePin(msg) {
    await supabase.from('messages').update({ is_pinned: !msg.is_pinned }).eq('id', msg.id)
    toast(msg.is_pinned ? 'Transmission unpinned' : 'Transmission pinned', 'info')
    loadMsgs(activeConv)
  }
  function startReply(msg) {
    setReplyTo(msg)
    setEditing(null)
    setPriority(decodePriority(msg.content).priority)
    inputRef.current?.focus()
  }
  function startEdit(msg) {
    setEditing(msg)
    const decoded = decodePriority(msg.content)
    setText(decoded.body)
    setPriority(decoded.priority)
    setReplyTo(null)
    inputRef.current?.focus()
  }

  const activeProfile = members.find(m => m.id === activeConv) || conversations.find(c => c.id === activeConv)
  const filteredConvs = search
    ? conversations.filter(c => c.handle?.toLowerCase().includes(search.toLowerCase()))
    : conversations
  const filteredMsgs = chatSearch
    ? messages.filter(m => decodePriority(m.content).body.toLowerCase().includes(chatSearch.toLowerCase()))
    : messages
  const pinnedMessages = messages.filter(m => m.is_pinned)
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0)

  const groupedMsgs = useMemo(() => {
    const groups = []
    let lastDate = ''
    filteredMsgs.forEach(m => {
      const d = dateSep(m.created_at)
      if (d !== lastDate) {
        groups.push({ type: 'date', id: `date-${d}`, label: d })
        lastDate = d
      }
      groups.push({ type: 'msg', ...m })
    })
    return groups
  }, [filteredMsgs])

  return (
    <>
      <ClassificationBar
        section="UEE COMMS GRID"
        label="SECURE TRANSMISSIONS"
        right={(
          <>
            <span>UPLINKS · {conversations.length}</span>
            <span>QUEUE · {totalUnread}</span>
            <span style={{ color: UEE_AMBER }}>ACTIVE · {channel}</span>
          </>
        )}
      />

      <div className="page-header" style={{ paddingBottom: 10 }}>
        <div className="page-title">COMMS</div>
        <div className="page-subtitle">
          Fleet uplink and command traffic relay.
          {totalUnread > 0 && <span style={{ color: UEE_AMBER, fontWeight: 600 }}> · {totalUnread} unread packets</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {CHANNELS.map(c => (
            <button
              key={c}
              className="btn btn-ghost btn-sm"
              style={channel === c ? { color: UEE_AMBER, borderColor: `${UEE_AMBER}66`, background: `${UEE_AMBER}10` } : undefined}
              onClick={() => setChannel(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', gap: 0, padding: 0, overflow: 'hidden' }}>
        {channel !== 'DIRECT' ? (
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 420 }}>
            <div className="empty-state" style={{ maxWidth: 560 }}>
              {channel} channel uplink is reserved for the next COMMS phase. DIRECT traffic remains live.
            </div>
          </div>
        ) : (
          <>
            <div style={{ width: 300, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--bg-raised)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 9, letterSpacing: '.2em', color: UEE_AMBER, fontFamily: 'var(--font-mono)', marginBottom: 8 }}>DIRECT UPLINKS</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="form-input" style={{ flex: 1, fontSize: 11 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Find operative..." />
                  <button className="btn btn-primary btn-sm" style={{ minWidth: 34 }} onClick={() => setNewConv(v => !v)}>+</button>
                </div>
              </div>
              {newConv && (
                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                  <select
                    className="form-select"
                    value=""
                    onChange={e => {
                      if (!e.target.value) return
                      setActiveConv(e.target.value)
                      setNewConv(false)
                    }}
                  >
                    <option value="">Open new uplink...</option>
                    {members.filter(m => !conversations.some(c => c.id === m.id)).map(m => (
                      <option key={m.id} value={m.id}>{m.handle}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading ? <div style={{ padding: 20, color: 'var(--text-3)', textAlign: 'center' }}>Linking channels...</div> : null}
                {!loading && filteredConvs.length === 0 ? (
                  <div style={{ padding: 20, color: 'var(--text-3)', textAlign: 'center' }}>
                    {search ? 'No matching operatives' : 'No active uplinks'}
                  </div>
                ) : null}
                {filteredConvs.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setActiveConv(c.id)}
                    style={{
                      width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                      borderBottom: '1px solid var(--border)', background: activeConv === c.id ? 'var(--bg-surface)' : 'transparent',
                      padding: '11px 12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ position: 'relative' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', border: `1.5px solid ${c.avatar_color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: c.avatar_color }}>
                          {c.handle?.slice(0, 2).toUpperCase()}
                        </div>
                        {isOnline(c.last_seen_at) && <div style={{ position: 'absolute', right: 0, bottom: 0, width: 9, height: 9, borderRadius: '50%', background: '#5ab870', border: '2px solid var(--bg-raised)' }} />}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: c.unread ? 600 : 500 }}>{c.handle}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>{timeAgo(c.lastTime)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
                          <span style={{ fontSize: 10.5, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastMessage}</span>
                          {c.unread > 0 && <span style={{ fontSize: 9, background: `${UEE_AMBER}33`, color: UEE_AMBER, borderRadius: 10, padding: '1px 6px' }}>{c.unread}</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {!activeConv ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="empty-state">Select active uplink to begin transmission.</div>
                </div>
              ) : (
                <>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', border: `1.5px solid ${activeProfile?.avatar_color || '#d4d8e0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: activeProfile?.avatar_color || '#d4d8e0' }}>
                        {activeProfile?.handle?.slice(0, 2).toUpperCase() || '??'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{activeProfile?.handle || 'Unknown'}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: isOnline(activeProfile?.last_seen_at) ? '#5ab870' : 'var(--text-3)', letterSpacing: '.12em' }}>
                          {isOnline(activeProfile?.last_seen_at) ? 'SIGNAL LIVE' : activeProfile?.last_seen_at ? `LAST LINK ${timeAgo(activeProfile.last_seen_at)}` : 'OFFLINE'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {pinnedMessages.length > 0 && (
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowPinned(v => !v)}>
                          📌 {pinnedMessages.length}
                        </button>
                      )}
                      <input className="form-input" style={{ width: 170, fontSize: 11 }} value={chatSearch} onChange={e => setChatSearch(e.target.value)} placeholder="Search traffic..." />
                    </div>
                  </div>

                  {showPinned && pinnedMessages.length > 0 && (
                    <div style={{ borderBottom: '1px solid var(--border)', background: 'rgba(212,216,224,0.04)', padding: '8px 14px', maxHeight: 120, overflowY: 'auto' }}>
                      <div style={{ fontSize: 9, letterSpacing: '.2em', color: UEE_AMBER, fontFamily: 'var(--font-mono)', marginBottom: 5 }}>PINNED TRANSMISSIONS</div>
                      {pinnedMessages.map(m => {
                        const decoded = decodePriority(m.content)
                        return <div key={m.id} style={{ fontSize: 11, color: 'var(--text-2)', padding: '2px 0' }}>{decoded.body.slice(0, 90)}</div>
                      })}
                    </div>
                  )}

                  <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {groupedMsgs.map((item, idx) => {
                      if (item.type === 'date') {
                        return (
                          <div key={item.id} style={{ textAlign: 'center', padding: '12px 0 6px' }}>
                            <span style={{ fontSize: 9, letterSpacing: '.2em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{item.label}</span>
                          </div>
                        )
                      }
                      const m = item
                      const decoded = decodePriority(m.content)
                      const isMine = m.sender_id === me.id
                      const prev = groupedMsgs[idx - 1]
                      const grouped = prev?.type === 'msg' && prev.sender_id === m.sender_id && (new Date(m.created_at) - new Date(prev.created_at)) < 120000
                      const rxns = m.reactions || {}

                      return (
                        <div
                          key={m.id}
                          onMouseEnter={() => setHoveredMsg(m.id)}
                          onMouseLeave={() => { setHoveredMsg(null); if (reactingTo === m.id) setReactingTo(null) }}
                          style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '74%', marginTop: grouped ? 0 : 8, position: 'relative' }}
                        >
                          {m.reply?.content && (
                            <div style={{ borderLeft: `2px solid ${UEE_AMBER}`, padding: '2px 10px', marginBottom: 3, fontSize: 10.5, color: 'var(--text-3)', maxWidth: '95%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {decodePriority(m.reply.content).body}
                            </div>
                          )}
                          <div style={{
                            background: isMine ? 'rgba(200,165,90,0.08)' : 'var(--bg-raised)',
                            border: `1px solid ${isMine ? 'rgba(200,165,90,0.35)' : 'var(--border)'}`,
                            borderLeft: `2px solid ${accentForPriority(decoded.priority)}`,
                            borderRadius: grouped ? (isMine ? '8px 5px 5px 8px' : '5px 8px 8px 5px') : (isMine ? '10px 10px 4px 10px' : '10px 10px 10px 4px'),
                            padding: '8px 11px',
                            lineHeight: 1.55,
                          }}>
                            {decoded.priority !== 'ROUTINE' && (
                              <div style={{ marginBottom: 5 }}>
                                <StatusBadge label={decoded.priority} color={accentForPriority(decoded.priority)} />
                              </div>
                            )}
                            <div style={{ fontSize: 13, color: 'var(--text-1)', wordBreak: 'break-word' }}>{decoded.body}</div>
                          </div>
                          {!grouped && (
                            <div style={{ marginTop: 2, display: 'flex', gap: 6, justifyContent: isMine ? 'flex-end' : 'flex-start', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>
                              <span>{fmtTime(m.created_at)}</span>
                              {m.edited_at && <span>AMENDED</span>}
                              {isMine && <span style={{ color: m.is_read ? UEE_AMBER : 'var(--text-3)' }}>{m.is_read ? '✓✓' : '✓'}</span>}
                            </div>
                          )}
                          {Object.keys(rxns).length > 0 && (
                            <div style={{ display: 'flex', gap: 3, marginTop: 2, justifyContent: isMine ? 'flex-end' : 'flex-start', flexWrap: 'wrap' }}>
                              {Object.entries(rxns).map(([emoji, users]) => (
                                <button key={emoji} onClick={() => toggleReaction(m, emoji)} style={{ border: '1px solid var(--border)', background: users.includes(me.id) ? `${UEE_AMBER}18` : 'var(--bg-surface)', borderRadius: 9, fontSize: 11, padding: '1px 6px', cursor: 'pointer' }}>
                                  {emoji} <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{users.length}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {hoveredMsg === m.id && (
                            <div style={{ position: 'absolute', top: -7, [isMine ? 'left' : 'right']: 0, display: 'flex', gap: 2, border: '1px solid var(--border)', background: 'var(--bg-raised)', borderRadius: 6, padding: '2px 4px', zIndex: 5 }}>
                              {[{ icon: '↩', title: 'Reply', fn: () => startReply(m) }, { icon: '😊', title: 'React', fn: () => setReactingTo(reactingTo === m.id ? null : m.id) }, { icon: m.is_pinned ? '📌' : '📍', title: 'Pin', fn: () => togglePin(m) }, ...(isMine ? [{ icon: '✏️', title: 'Edit', fn: () => startEdit(m) }, { icon: '🗑', title: 'Delete', fn: () => deleteMsg(m.id) }] : [])].map((a, i) => (
                                <button key={i} title={a.title} onClick={a.fn} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}>{a.icon}</button>
                              ))}
                            </div>
                          )}
                          {reactingTo === m.id && (
                            <div style={{ position: 'absolute', bottom: '100%', marginBottom: 4, [isMine ? 'right' : 'left']: 0, display: 'flex', gap: 2, border: '1px solid var(--border)', background: 'var(--bg-raised)', borderRadius: 8, padding: '4px 6px', zIndex: 8 }}>
                              {REACTIONS.map(emoji => (
                                <button key={emoji} onClick={() => toggleReaction(m, emoji)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18 }}>{emoji}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    <div ref={endRef} />
                  </div>

                  {(replyTo || editing) && (
                    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-raised)', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.15em', color: UEE_AMBER }}>
                        {editing ? 'AMEND TRANSMISSION' : 'REPLY CHAIN'}
                      </span>
                      <span style={{ flex: 1, fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {decodePriority((editing || replyTo)?.content || '').body.slice(0, 70)}
                      </span>
                      <button onClick={() => { setReplyTo(null); setEditing(null); setText(''); setPriority('ROUTINE') }} style={{ border: 'none', background: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>✕</button>
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-raised)', padding: '8px 14px' }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 7, flexWrap: 'wrap' }}>
                      {QUICK_TEMPLATES.map(t => (
                        <button key={t.label} className="btn btn-ghost btn-sm" onClick={() => setText(t.text)}>{t.label}</button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select className="form-select" value={priority} onChange={e => setPriority(e.target.value)} style={{ maxWidth: 145 }}>
                        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <input
                        ref={inputRef}
                        className="form-input"
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
                          if (e.key === 'Escape') { setReplyTo(null); setEditing(null); setText(''); setPriority('ROUTINE') }
                        }}
                        placeholder={editing ? 'Amend transmission...' : replyTo ? 'Transmit reply packet...' : 'Compose transmission...'}
                        style={{ flex: 1, fontSize: 13 }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={send} disabled={sending || !text.trim()} style={{ minWidth: 76 }}>
                        {editing ? 'SAVE' : 'TRANSMIT'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
