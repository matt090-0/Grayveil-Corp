import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { UEE_AMBER, CLIP_CHAMFER_SM } from './uee'

// ─────────────────────────────────────────────────────────────
// InquiryThread
// Renders a buyer ↔ seller conversation for a marketplace
// listing. Lazy-resolves the thread (creating it on first
// message via the open_inquiry RPC), then keeps the thread in
// sync with realtime + a manual reload after sending.
//
// Mounts inside DetailModal, so we keep our chrome lightweight
// and don't wrap our own modal shell.
//
// Props:
//   listing        — the row from market_listings being inquired about
//   me             — current profile
//   onClose?       — optional close handler if used standalone
//   embedded?:bool — true when nested inside another modal (default true)
// ─────────────────────────────────────────────────────────────
export default function InquiryThread({ listing, me, embedded = true }) {
  const toast = useToast()
  const [inquiry, setInquiry] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef(null)

  const isSeller = listing.seller_id === me.id

  // Find the existing thread for THIS buyer ↔ THIS listing.
  // For sellers, we list every inquiry on their listing in a
  // sibling component (InquiryList). This component focuses
  // on the buyer view — opening a single thread.
  useEffect(() => {
    if (isSeller) { setLoading(false); return }
    let mounted = true
    ;(async () => {
      const { data } = await supabase
        .from('market_inquiries')
        .select('*')
        .eq('listing_id', listing.id)
        .eq('buyer_id', me.id)
        .maybeSingle()
      if (!mounted) return
      setInquiry(data || null)
      if (data) {
        await loadMessages(data.id)
      }
      setLoading(false)
    })()
    return () => { mounted = false }
  }, [listing.id, me.id, isSeller])

  async function loadMessages(inqId) {
    const { data } = await supabase
      .from('market_inquiry_messages')
      .select('*, sender:profiles(handle)')
      .eq('inquiry_id', inqId)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    queueMicrotask(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    })
  }

  // Subscribe to realtime so the seller sees buyer replies live
  // (and vice versa) without a manual refresh.
  useEffect(() => {
    if (!inquiry) return
    const ch = supabase.channel(`inq-${inquiry.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'market_inquiry_messages',
        filter: `inquiry_id=eq.${inquiry.id}`,
      }, () => loadMessages(inquiry.id))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [inquiry?.id])

  async function send() {
    const body = draft.trim()
    if (!body) return
    setSending(true)
    if (!inquiry) {
      // First message — opens the thread atomically via RPC.
      const { data, error } = await supabase.rpc('open_inquiry', {
        p_listing_id: listing.id,
        p_first_message: body,
      })
      if (error) { toast(error.message, 'error'); setSending(false); return }
      // Re-fetch the freshly-created row + messages
      const { data: inq } = await supabase
        .from('market_inquiries')
        .select('*').eq('id', data).maybeSingle()
      setInquiry(inq)
      await loadMessages(data)
    } else {
      const { error } = await supabase.rpc('post_inquiry_message', {
        p_inquiry_id: inquiry.id,
        p_body: body,
      })
      if (error) { toast(error.message, 'error'); setSending(false); return }
      await loadMessages(inquiry.id)
    }
    setDraft('')
    setSending(false)
  }

  if (isSeller) {
    return (
      <div style={{
        background: `${UEE_AMBER}0a`,
        border: `1px solid ${UEE_AMBER}33`,
        borderLeft: `3px solid ${UEE_AMBER}`,
        borderRadius: 3, padding: '10px 14px',
        fontSize: 12, color: 'var(--text-2)',
        fontFamily: 'var(--font-mono)', letterSpacing: '.05em',
      }}>
        ◆ This is your listing. Buyer inquiries appear in your INBOX as messages, and on the MY LISTINGS tab as threads.
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--bg-raised)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${UEE_AMBER}`,
      borderRadius: 3, clipPath: CLIP_CHAMFER_SM,
      display: 'flex', flexDirection: 'column',
      maxHeight: 360, minHeight: 200,
    }}>
      <div style={{
        padding: '8px 14px', borderBottom: '1px solid var(--border)',
        fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.22em',
        color: UEE_AMBER, display: 'flex', justifyContent: 'space-between',
      }}>
        <span>◆ DIRECT MESSAGE · SELLER</span>
        <span style={{ color: 'var(--text-3)' }}>
          {messages.length} {messages.length === 1 ? 'MSG' : 'MSGS'}
        </span>
      </div>

      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '10px 14px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {loading ? (
          <div style={{
            padding: '20px 0', textAlign: 'center',
            fontSize: 11, color: 'var(--text-3)',
            fontFamily: 'var(--font-mono)', letterSpacing: '.2em',
          }}>LOADING THREAD...</div>
        ) : messages.length === 0 ? (
          <div style={{
            padding: '14px 0', textAlign: 'center',
            fontSize: 11.5, color: 'var(--text-3)', fontStyle: 'italic',
          }}>
            No messages yet. Send the seller a question — they'll get a notification.
          </div>
        ) : messages.map(m => {
          const mine = m.sender_id === me.id
          return (
            <div key={m.id} style={{
              alignSelf: mine ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              background: mine ? `${UEE_AMBER}14` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${mine ? UEE_AMBER + '44' : 'var(--border)'}`,
              borderRadius: 4, padding: '7px 10px',
            }}>
              <div style={{
                display: 'flex', gap: 6, alignItems: 'baseline',
                marginBottom: 2,
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em',
                  color: mine ? UEE_AMBER : 'var(--text-3)', fontWeight: 600,
                }}>
                  {mine ? 'YOU' : (m.sender?.handle || '—').toUpperCase()}
                </span>
                <span style={{
                  fontSize: 9, color: 'var(--text-3)',
                  fontFamily: 'var(--font-mono)', letterSpacing: '.1em',
                }}>
                  {new Date(m.created_at).toLocaleString('en-GB', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
              <div style={{
                fontSize: 12.5, color: 'var(--text-1)', lineHeight: 1.45,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {m.body}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{
        borderTop: '1px solid var(--border)',
        padding: '8px 10px', display: 'flex', gap: 6,
      }}>
        <input
          className="form-input" value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={messages.length === 0 ? 'Hi! Is this still available?' : 'Reply...'}
          style={{ flex: 1, fontSize: 12 }}
          disabled={sending}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={send}
          disabled={sending || !draft.trim()}
          style={{ flexShrink: 0 }}
        >
          {sending ? '...' : 'SEND'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// InquiryList — seller-side view of all open conversations on
// their listings. Drops into DetailModal when isMine === true.
// ─────────────────────────────────────────────────────────────
export function InquiryList({ listingId, me }) {
  const toast = useToast()
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)

  async function loadThreads() {
    const { data } = await supabase
      .from('market_inquiries')
      .select('*, buyer:profiles!market_inquiries_buyer_id_fkey(handle)')
      .eq('listing_id', listingId)
      .order('updated_at', { ascending: false })
    setThreads(data || [])
    setLoading(false)
    if (data?.length && !activeId) setActiveId(data[0].id)
  }

  useEffect(() => {
    loadThreads()
    const ch = supabase.channel(`listing-inq-${listingId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'market_inquiries',
        filter: `listing_id=eq.${listingId}`,
      }, () => loadThreads())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [listingId])

  async function loadMessages(inqId) {
    const { data } = await supabase
      .from('market_inquiry_messages')
      .select('*, sender:profiles(handle)')
      .eq('inquiry_id', inqId)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    queueMicrotask(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    })
  }

  useEffect(() => {
    if (!activeId) { setMessages([]); return }
    loadMessages(activeId)
    const ch = supabase.channel(`inq-msgs-${activeId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'market_inquiry_messages',
        filter: `inquiry_id=eq.${activeId}`,
      }, () => loadMessages(activeId))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [activeId])

  async function send() {
    const body = draft.trim()
    if (!body || !activeId) return
    setSending(true)
    const { error } = await supabase.rpc('post_inquiry_message', {
      p_inquiry_id: activeId,
      p_body: body,
    })
    if (error) { toast(error.message, 'error'); setSending(false); return }
    setDraft('')
    setSending(false)
    await loadMessages(activeId)
  }

  if (loading) {
    return (
      <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.18em', padding: '12px 0' }}>
        LOADING INQUIRIES...
      </div>
    )
  }

  if (threads.length === 0) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px dashed var(--border)',
        borderRadius: 4, padding: '14px 16px',
        fontSize: 12, color: 'var(--text-3)', textAlign: 'center',
      }}>
        No inquiries yet on this listing.
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '170px 1fr', gap: 10,
      minHeight: 240, maxHeight: 360,
    }}>
      {/* Thread sidebar */}
      <div style={{
        border: '1px solid var(--border)', borderRadius: 3,
        background: 'var(--bg-raised)',
        overflowY: 'auto',
      }}>
        <div style={{
          padding: '6px 10px', borderBottom: '1px solid var(--border)',
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em',
          color: UEE_AMBER, background: 'rgba(0,0,0,0.2)',
        }}>
          ◆ {threads.length} BUYER{threads.length === 1 ? '' : 'S'}
        </div>
        {threads.map(t => {
          const isActive = t.id === activeId
          return (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              style={{
                width: '100%', textAlign: 'left',
                padding: '8px 10px',
                background: isActive ? `${UEE_AMBER}14` : 'transparent',
                borderLeft: `3px solid ${isActive ? UEE_AMBER : 'transparent'}`,
                borderTop: 'none', borderRight: 'none',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              <div style={{
                fontSize: 12, fontWeight: 600,
                color: isActive ? UEE_AMBER : 'var(--text-1)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {t.buyer?.handle || '—'}
              </div>
              <div style={{
                fontSize: 9, color: 'var(--text-3)',
                fontFamily: 'var(--font-mono)', letterSpacing: '.1em', marginTop: 2,
              }}>
                {new Date(t.updated_at).toLocaleDateString('en-GB', {
                  day: '2-digit', month: 'short',
                })}
              </div>
            </button>
          )
        })}
      </div>

      {/* Thread pane */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        border: '1px solid var(--border)', borderRadius: 3,
        background: 'var(--bg-raised)',
        minHeight: 0,
      }}>
        <div ref={scrollRef} style={{
          flex: 1, overflowY: 'auto', padding: '10px 12px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {messages.length === 0 ? (
            <div style={{
              padding: '14px 0', textAlign: 'center',
              fontSize: 11.5, color: 'var(--text-3)', fontStyle: 'italic',
            }}>Empty thread.</div>
          ) : messages.map(m => {
            const mine = m.sender_id === me.id
            return (
              <div key={m.id} style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: mine ? `${UEE_AMBER}14` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${mine ? UEE_AMBER + '44' : 'var(--border)'}`,
                borderRadius: 4, padding: '6px 10px',
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em',
                  color: mine ? UEE_AMBER : 'var(--text-3)', fontWeight: 600,
                  marginBottom: 2,
                }}>
                  {mine ? 'YOU' : (m.sender?.handle || '—').toUpperCase()} · {new Date(m.created_at).toLocaleString('en-GB', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
                <div style={{
                  fontSize: 12.5, color: 'var(--text-1)', lineHeight: 1.45,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.body}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '6px 8px', display: 'flex', gap: 6,
        }}>
          <input
            className="form-input" value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Reply to buyer..."
            style={{ flex: 1, fontSize: 12 }}
            disabled={sending}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={send}
            disabled={sending || !draft.trim()}
            style={{ flexShrink: 0 }}
          >{sending ? '...' : 'SEND'}</button>
        </div>
      </div>
    </div>
  )
}
