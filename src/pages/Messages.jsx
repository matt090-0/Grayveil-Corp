import { useEffect, useState, useRef, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { timeAgo, fmtDate } from '../lib/dates'
import { useToast } from '../components/Toast'

const REACTIONS = ['👍', '❤️', '😂', '🎯', '🔥', '⚡', '💀', '🫡']

function isOnline(ts) {
  if (!ts) return false
  return (Date.now() - new Date(ts)) < 300000
}

function dateSep(ts) {
  const d = new Date(ts), now = new Date()
  if (d.toDateString() === now.toDateString()) return 'TODAY'
  const y = new Date(now); y.setDate(y.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'YESTERDAY'
  return fmtDate(ts).toUpperCase()
}

function fmtTime(ts) { return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }

export default function Messages() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const [members, setMembers] = useState([])
  const [conversations, setConversations] = useState([])
  const [activeConv, setActiveConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [chatSearch, setChatSearch] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [editing, setEditing] = useState(null)
  const [hoveredMsg, setHoveredMsg] = useState(null)
  const [reactingTo, setReactingTo] = useState(null)
  const [showPinned, setShowPinned] = useState(false)
  const [newConv, setNewConv] = useState(false)
  const endRef = useRef(null)
  const inputRef = useRef(null)

  async function loadConvos() {
    const [{ data: mem }, { data: msgs }] = await Promise.all([
      supabase.from('profiles').select('id, handle, avatar_color, tier, last_seen_at, status').eq('status', 'ACTIVE').order('handle'),
      supabase.from('messages').select('*, sender:profiles!messages_sender_id_fkey(handle, avatar_color, last_seen_at), recipient:profiles!messages_recipient_id_fkey(handle, avatar_color, last_seen_at)')
        .is('deleted_at', null).order('created_at', { ascending: false }).limit(500),
    ])
    setMembers((mem || []).filter(m => m.id !== me.id))
    const convMap = {}
    ;(msgs || []).forEach(m => {
      const otherId = m.sender_id === me.id ? m.recipient_id : m.sender_id
      const other = m.sender_id === me.id ? m.recipient : m.sender
      if (!convMap[otherId]) {
        convMap[otherId] = { id: otherId, handle: other?.handle, avatar_color: other?.avatar_color || '#c8a55a', last_seen_at: other?.last_seen_at, lastMessage: m.content, lastTime: m.created_at, unread: 0 }
      }
      if (m.recipient_id === me.id && !m.is_read) convMap[otherId].unread++
    })
    setConversations(Object.values(convMap).sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime)))
    setLoading(false)
  }

  useEffect(() => {
    loadConvos()
    const ch = supabase.channel('dm-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => { loadConvos(); if (activeConv) loadMsgs(activeConv) })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [me.id])

  async function loadMsgs(convId) {
    const { data } = await supabase.from('messages')
      .select('*, reply:messages!messages_reply_to_id_fkey(id, content, sender_id)')
      .or(`and(sender_id.eq.${me.id},recipient_id.eq.${convId}),and(sender_id.eq.${convId},recipient_id.eq.${me.id})`)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }).limit(300)
    setMessages(data || [])
    await supabase.from('messages').update({ is_read: true }).eq('sender_id', convId).eq('recipient_id', me.id).eq('is_read', false)
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  useEffect(() => { if (activeConv) loadMsgs(activeConv) }, [activeConv, me.id])

  async function send() {
    if (!text.trim() || !activeConv) return
    setSending(true)
    if (editing) {
      await supabase.from('messages').update({ content: text.trim(), edited_at: new Date().toISOString() }).eq('id', editing.id)
      setEditing(null)
    } else {
      await supabase.from('messages').insert({ sender_id: me.id, recipient_id: activeConv, content: text.trim(), reply_to_id: replyTo?.id || null })
    }
    setText(''); setReplyTo(null); setSending(false); loadMsgs(activeConv)
  }

  async function deleteMsg(id) {
    await supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    toast('Message deleted', 'info'); loadMsgs(activeConv)
  }

  async function toggleReaction(msg, emoji) {
    const r = { ...(msg.reactions || {}) }
    const u = r[emoji] || []
    if (u.includes(me.id)) { r[emoji] = u.filter(x => x !== me.id); if (!r[emoji].length) delete r[emoji] }
    else r[emoji] = [...u, me.id]
    await supabase.from('messages').update({ reactions: r }).eq('id', msg.id)
    setReactingTo(null); loadMsgs(activeConv)
  }

  async function togglePin(msg) {
    await supabase.from('messages').update({ is_pinned: !msg.is_pinned }).eq('id', msg.id)
    toast(msg.is_pinned ? 'Unpinned' : 'Pinned', 'info'); loadMsgs(activeConv)
  }

  function startEdit(msg) { setEditing(msg); setText(msg.content); setReplyTo(null); inputRef.current?.focus() }
  function startReply(msg) { setReplyTo(msg); setEditing(null); inputRef.current?.focus() }

  const activeProfile = members.find(m => m.id === activeConv) || conversations.find(c => c.id === activeConv)
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0)
  const pinnedMessages = messages.filter(m => m.is_pinned)
  const filteredConvs = search ? conversations.filter(c => c.handle?.toLowerCase().includes(search.toLowerCase())) : conversations
  const filteredMsgs = chatSearch ? messages.filter(m => m.content?.toLowerCase().includes(chatSearch.toLowerCase())) : messages

  const groupedMsgs = useMemo(() => {
    const groups = []; let lastDate = ''
    filteredMsgs.forEach(m => {
      const d = dateSep(m.created_at)
      if (d !== lastDate) { groups.push({ type: 'date', label: d, id: 'date-' + d }); lastDate = d }
      groups.push({ type: 'msg', ...m })
    })
    return groups
  }, [filteredMsgs])

  return (
    <>
      <div className="page-header" style={{ paddingBottom: 12 }}>
        <div className="page-title">COMMS</div>
        <div className="page-subtitle">Encrypted channel{totalUnread > 0 && <span style={{ color: 'var(--accent)', fontWeight: 600 }}> — {totalUnread} unread</span>}</div>
      </div>

      <div className="page-body" style={{ display: 'flex', gap: 0, padding: 0, overflow: 'hidden' }}>

        {/* ═══ SIDEBAR ═══ */}
        <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-raised)' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6 }}>
            <input className="form-input" style={{ flex: 1, fontSize: 11, padding: '6px 10px' }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people..." />
            <button className="btn btn-primary btn-sm" style={{ padding: '4px 10px', fontSize: 14, lineHeight: 1 }} onClick={() => setNewConv(!newConv)}>+</button>
          </div>

          {newConv && (
            <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
              <select className="form-select" style={{ fontSize: 11 }} value="" onChange={e => { if (e.target.value) { setActiveConv(e.target.value); setNewConv(false) } }}>
                <option value="">Select member...</option>
                {members.filter(m => !conversations.find(c => c.id === m.id)).map(m => <option key={m.id} value={m.id}>{m.handle}</option>)}
              </select>
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>Loading...</div> :
            filteredConvs.length === 0 ? <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>{search ? 'No matches' : 'No conversations'}</div> :
            filteredConvs.map(c => (
              <div key={c.id} onClick={() => setActiveConv(c.id)} style={{
                padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                background: activeConv === c.id ? 'var(--bg-surface)' : 'transparent',
                borderLeft: activeConv === c.id ? '2px solid var(--accent)' : '2px solid transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', border: `1.5px solid ${c.avatar_color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: c.avatar_color }}>{c.handle?.slice(0, 2).toUpperCase()}</div>
                    {isOnline(c.last_seen_at) && <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: '#5ab870', border: '2px solid var(--bg-raised)' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: c.unread ? 600 : 400 }}>{c.handle}</span>
                      <span style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{timeAgo(c.lastTime)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: c.unread ? 'var(--text-1)' : 'var(--text-3)', fontWeight: c.unread ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>{c.lastMessage}</span>
                      {c.unread > 0 && <span style={{ background: 'var(--accent)', color: '#0a0a10', fontSize: 9, fontWeight: 700, borderRadius: 10, padding: '1px 6px', minWidth: 16, textAlign: 'center' }}>{c.unread}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ CHAT ═══ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!activeConv ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 32, opacity: 0.12 }}>💬</div>
              <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Select a conversation</div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-raised)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', border: `1.5px solid ${activeProfile?.avatar_color || '#c8a55a'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: activeProfile?.avatar_color || '#c8a55a' }}>{activeProfile?.handle?.slice(0, 2).toUpperCase() || '??'}</div>
                    {isOnline(activeProfile?.last_seen_at) && <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: '#5ab870', border: '2px solid var(--bg-raised)' }} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{activeProfile?.handle || 'Unknown'}</div>
                    <div style={{ fontSize: 10, color: isOnline(activeProfile?.last_seen_at) ? '#5ab870' : 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                      {isOnline(activeProfile?.last_seen_at) ? 'ONLINE' : activeProfile?.last_seen_at ? `Last seen ${timeAgo(activeProfile.last_seen_at)}` : 'Offline'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {pinnedMessages.length > 0 && <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => setShowPinned(!showPinned)}>📌 {pinnedMessages.length}</button>}
                  <input className="form-input" style={{ width: 140, fontSize: 10, padding: '4px 8px' }} value={chatSearch} onChange={e => setChatSearch(e.target.value)} placeholder="Search..." />
                </div>
              </div>

              {showPinned && pinnedMessages.length > 0 && (
                <div style={{ padding: '8px 16px', background: 'rgba(200,165,90,0.05)', borderBottom: '1px solid rgba(200,165,90,0.15)', maxHeight: 100, overflowY: 'auto', flexShrink: 0 }}>
                  <div style={{ fontSize: 9, letterSpacing: '.15em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>📌 PINNED</div>
                  {pinnedMessages.map(m => (
                    <div key={m.id} style={{ fontSize: 11, color: 'var(--text-2)', padding: '2px 0' }}>
                      <span style={{ fontWeight: 500 }}>{m.sender_id === me.id ? 'You' : activeProfile?.handle}</span>: {m.content?.slice(0, 80)}
                    </div>
                  ))}
                </div>
              )}

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {chatSearch && <div style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>{filteredMsgs.length} result{filteredMsgs.length !== 1 ? 's' : ''} for "{chatSearch}"</div>}

                {groupedMsgs.map((item, idx) => {
                  if (item.type === 'date') return (
                    <div key={item.id} style={{ textAlign: 'center', padding: '14px 0 6px' }}>
                      <span style={{ fontSize: 9, letterSpacing: '.2em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', background: 'var(--bg-base)', padding: '0 12px' }}>{item.label}</span>
                    </div>
                  )
                  const m = item, isMine = m.sender_id === me.id
                  const prev = groupedMsgs[idx - 1]
                  const isGrouped = prev?.type === 'msg' && prev.sender_id === m.sender_id && (new Date(m.created_at) - new Date(prev.created_at)) < 120000
                  const rxns = m.reactions || {}

                  return (
                    <div key={m.id} onMouseEnter={() => setHoveredMsg(m.id)} onMouseLeave={() => { setHoveredMsg(null); if (reactingTo === m.id) setReactingTo(null) }}
                      style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', maxWidth: '72%', position: 'relative', marginTop: isGrouped ? 0 : 8 }}>

                      {m.reply?.content && (
                        <div style={{ fontSize: 11, color: 'var(--text-3)', padding: '3px 10px', borderLeft: '2px solid var(--accent)', marginBottom: 2, maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: isMine ? 'auto' : 0 }}>
                          {m.reply.sender_id === me.id ? 'You' : activeProfile?.handle}: {m.reply.content.slice(0, 50)}
                        </div>
                      )}

                      <div style={{
                        background: isMine ? 'rgba(200,165,90,0.08)' : 'var(--bg-raised)',
                        border: `1px solid ${isMine ? 'rgba(200,165,90,0.2)' : 'var(--border)'}`,
                        borderRadius: isGrouped ? (isMine ? '8px 4px 4px 8px' : '4px 8px 8px 4px') : (isMine ? '12px 12px 4px 12px' : '12px 12px 12px 4px'),
                        padding: '8px 12px', fontSize: 13, color: 'var(--text-1)', lineHeight: 1.6, wordBreak: 'break-word',
                      }}>{m.content}</div>

                      {!isGrouped && (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                          <span>{fmtTime(m.created_at)}</span>
                          {m.edited_at && <span>edited</span>}
                          {isMine && <span style={{ color: m.is_read ? 'var(--accent)' : 'var(--text-3)' }}>{m.is_read ? '✓✓' : '✓'}</span>}
                        </div>
                      )}

                      {Object.keys(rxns).length > 0 && (
                        <div style={{ display: 'flex', gap: 3, marginTop: 2, flexWrap: 'wrap', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                          {Object.entries(rxns).map(([emoji, users]) => (
                            <button key={emoji} onClick={() => toggleReaction(m, emoji)} style={{
                              background: users.includes(me.id) ? 'rgba(200,165,90,0.12)' : 'var(--bg-surface)',
                              border: `1px solid ${users.includes(me.id) ? 'rgba(200,165,90,0.3)' : 'var(--border)'}`,
                              borderRadius: 10, padding: '1px 6px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                            }}>{emoji} <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{users.length}</span></button>
                          ))}
                        </div>
                      )}

                      {hoveredMsg === m.id && (
                        <div style={{
                          position: 'absolute', top: -6, [isMine ? 'left' : 'right']: 0,
                          display: 'flex', gap: 1, background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 3px', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', zIndex: 5,
                        }}>
                          {[
                            { icon: '↩', fn: () => startReply(m), title: 'Reply' },
                            { icon: '😊', fn: () => setReactingTo(reactingTo === m.id ? null : m.id), title: 'React' },
                            { icon: m.is_pinned ? '📌' : '📍', fn: () => togglePin(m), title: m.is_pinned ? 'Unpin' : 'Pin' },
                            ...(isMine ? [
                              { icon: '✏️', fn: () => startEdit(m), title: 'Edit' },
                              { icon: '🗑', fn: () => deleteMsg(m.id), title: 'Delete' },
                            ] : []),
                          ].map((a, i) => (
                            <button key={i} onClick={a.fn} title={a.title} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '2px 4px', borderRadius: 4 }}>{a.icon}</button>
                          ))}
                        </div>
                      )}

                      {reactingTo === m.id && (
                        <div style={{
                          position: 'absolute', bottom: '100%', marginBottom: 4, [isMine ? 'right' : 'left']: 0,
                          display: 'flex', gap: 2, background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 6px', boxShadow: '0 4px 16px rgba(0,0,0,0.5)', zIndex: 10,
                        }}>
                          {REACTIONS.map(emoji => (
                            <button key={emoji} onClick={() => toggleReaction(m, emoji)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: '2px 3px', borderRadius: 4, transition: 'transform .1s' }}
                              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'} onMouseLeave={e => e.currentTarget.style.transform = ''}>{emoji}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                <div ref={endRef} />
              </div>

              {(replyTo || editing) && (
                <div style={{ padding: '6px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-raised)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, flexShrink: 0 }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{editing ? '✏️ Editing' : '↩ Reply'}</span>
                  <span style={{ color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(editing || replyTo)?.content?.slice(0, 60)}</span>
                  <button onClick={() => { setReplyTo(null); setEditing(null); setText('') }} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14 }}>✕</button>
                </div>
              )}

              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, background: 'var(--bg-raised)', flexShrink: 0 }}>
                <input ref={inputRef} className="form-input" value={text} onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } if (e.key === 'Escape') { setReplyTo(null); setEditing(null); setText('') } }}
                  placeholder={editing ? 'Edit message...' : replyTo ? 'Type reply...' : 'Type a message...'} style={{ flex: 1, fontSize: 13 }} />
                <button className="btn btn-primary btn-sm" onClick={send} disabled={sending || !text.trim()} style={{ minWidth: 60 }}>{editing ? 'SAVE' : 'SEND'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
