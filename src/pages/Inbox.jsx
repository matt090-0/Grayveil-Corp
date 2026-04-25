import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { confirmAction } from '../lib/dialogs'
import {
  UEE_AMBER, ClassificationBar, TabStrip, FilterRow, Card,
  StatusBadge, EmptyState,
  fmtDate, timeAgo,
} from '../components/uee'

// ─────────────────────────────────────────────────────────────
// Notification type metadata.
// Each type maps to a colour, glyph, group bucket, and human label.
// Adding a new type? Drop it here and the inbox + bell pick it up.
// ─────────────────────────────────────────────────────────────
const TYPE_META = {
  promotion:       { color: UEE_AMBER, glyph: '★', label: 'PROMOTION',     group: 'PERSONNEL' },
  medal:           { color: UEE_AMBER, glyph: '✦', label: 'MEDAL',         group: 'PERSONNEL' },
  announcement:    { color: '#e05c5c', glyph: '◈', label: 'TRANSMISSION',  group: 'COMMAND' },
  contract:        { color: '#5a80d9', glyph: '◆', label: 'CONTRACT',      group: 'OPERATIONS' },
  op_signup:       { color: '#5a80d9', glyph: '◉', label: 'OP SIGNUP',     group: 'OPERATIONS' },
  op_reminder:     { color: '#5a80d9', glyph: '⬢', label: 'OP REMINDER',   group: 'OPERATIONS' },
  aar:             { color: '#5ce0a1', glyph: '✓', label: 'AAR',           group: 'OPERATIONS' },
  bounty:          { color: '#e05c5c', glyph: '✕', label: 'BOUNTY',        group: 'COMBAT' },
  payment_request: { color: UEE_AMBER, glyph: '◇', label: 'PAYMENT REQ',   group: 'FINANCE' },
  message:         { color: '#b566d9', glyph: '✉', label: 'MESSAGE',       group: 'COMMS' },
  mention:         { color: '#b566d9', glyph: '@', label: 'MENTION',       group: 'COMMS' },
  system:          { color: '#9099a8', glyph: '●', label: 'SYSTEM',        group: 'COMMS' },
}

const PAGE_SIZE = 50

function dayBucket(ts) {
  if (!ts) return 'OLDER'
  const d = new Date(ts)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfToday.getDate() - 1)
  const startOfWeek = new Date(startOfToday)
  startOfWeek.setDate(startOfToday.getDate() - 7)
  if (d >= startOfToday) return 'TODAY'
  if (d >= startOfYesterday) return 'YESTERDAY'
  if (d >= startOfWeek) return 'THIS WEEK'
  return 'OLDER'
}

export default function Inbox() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('UNREAD')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  async function load() {
    const { data } = await supabase.from('notifications')
      .select('*')
      .eq('recipient_id', me.id)
      .order('created_at', { ascending: false })
      .limit(500)
    setItems(data || [])
    setLoading(false)
  }
  useEffect(() => {
    load()
    const ch = supabase.channel('inbox-live')
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${me.id}` },
          () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [me.id])

  const counts = useMemo(() => {
    const c = { ALL: items.length, UNREAD: items.filter(i => !i.is_read).length, READ: items.filter(i => i.is_read).length }
    Object.keys(TYPE_META).forEach(t => {
      c[t] = items.filter(i => i.type === t).length
    })
    return c
  }, [items])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items
      .filter(n => {
        if (tab === 'UNREAD') return !n.is_read
        if (tab === 'READ')   return n.is_read
        if (tab === 'ALL')    return true
        return n.type === tab
      })
      .filter(n => !q
        || (n.title || '').toLowerCase().includes(q)
        || (n.message || '').toLowerCase().includes(q))
  }, [items, tab, search])

  const visible = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page])

  const grouped = useMemo(() => {
    const buckets = { TODAY: [], YESTERDAY: [], 'THIS WEEK': [], OLDER: [] }
    visible.forEach(n => {
      const b = dayBucket(n.created_at)
      buckets[b].push(n)
    })
    return ['TODAY', 'YESTERDAY', 'THIS WEEK', 'OLDER']
      .map(k => ({ key: k, items: buckets[k] }))
      .filter(g => g.items.length > 0)
  }, [visible])

  async function markRead(n) {
    if (n.is_read) return
    await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
    setItems(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
  }
  async function markUnread(n) {
    await supabase.from('notifications').update({ is_read: false }).eq('id', n.id)
    setItems(prev => prev.map(x => x.id === n.id ? { ...x, is_read: false } : x))
  }
  async function deleteOne(n) {
    await supabase.from('notifications').delete().eq('id', n.id)
    setItems(prev => prev.filter(x => x.id !== n.id))
  }
  async function markAllRead() {
    await supabase.from('notifications').update({ is_read: true })
      .eq('recipient_id', me.id).eq('is_read', false)
    toast('All marked read', 'success')
    load()
  }
  async function clearAll() {
    if (!(await confirmAction('Clear all notifications? Read and unread will be removed.'))) return
    await supabase.from('notifications').delete().eq('recipient_id', me.id)
    toast('Inbox cleared', 'success')
    load()
  }

  function open(n) {
    markRead(n)
    if (n.link) navigate(n.link)
  }

  return (
    <>
      <ClassificationBar
        section="GRAYVEIL COMMS · PERSONAL INBOX"
        label={tab === 'UNREAD' ? 'UNREAD' : tab === 'READ' ? 'READ' : tab === 'ALL' ? 'ALL' : (TYPE_META[tab]?.label || tab)}
        right={(
          <>
            <span style={{ color: UEE_AMBER }}>UNREAD · {counts.UNREAD}</span>
            <span>TOTAL · {counts.ALL}</span>
          </>
        )}
      />

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>INBOX</h1>
            <div style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 640 }}>
              Promotions, transmissions, contract activity, op reminders — anything the system needs to bring to your attention.
              Live updates while open.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {counts.UNREAD > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={markAllRead}>MARK ALL READ</button>
            )}
            {counts.ALL > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={clearAll}>CLEAR ALL</button>
            )}
          </div>
        </div>

        <TabStrip
          active={tab} onChange={k => { setTab(k); setPage(1) }}
          tabs={[
            { key: 'UNREAD', label: 'UNREAD', color: UEE_AMBER, glyph: '◆', count: counts.UNREAD, attention: counts.UNREAD > 0 ? counts.UNREAD : 0 },
            { key: 'ALL',    label: 'ALL',    color: '#d4d8e0',                count: counts.ALL },
            { key: 'READ',   label: 'READ',   color: '#9099a8', glyph: '✓',    count: counts.READ },
            ...Object.keys(TYPE_META)
              .filter(t => counts[t] > 0)
              .map(t => ({
                key:   t,
                label: TYPE_META[t].label,
                color: TYPE_META[t].color,
                glyph: TYPE_META[t].glyph,
                count: counts[t],
              })),
          ]}
        />
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING INBOX...</div> : (
          <>
            <FilterRow
              search={search} setSearch={setSearch}
              placeholder="Search title, message body..."
            />

            {filtered.length === 0 ? (
              <EmptyState>
                {counts.ALL === 0
                  ? 'Inbox is empty. The system will land notifications here when something needs your attention.'
                  : tab === 'UNREAD'
                    ? 'All caught up. No unread notifications.'
                    : 'No notifications match the current filter.'}
              </EmptyState>
            ) : (
              <>
                {grouped.map(group => (
                  <div key={group.key} style={{ marginBottom: 18 }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em',
                      color: 'var(--text-3)', marginBottom: 8,
                      paddingBottom: 5, borderBottom: '1px solid var(--border)',
                    }}>
                      ◆ {group.key} · {group.items.length}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {group.items.map(n => (
                        <NotifCard
                          key={n.id} notif={n}
                          onOpen={() => open(n)}
                          onMarkRead={e => { e.stopPropagation(); markRead(n) }}
                          onMarkUnread={e => { e.stopPropagation(); markUnread(n) }}
                          onDelete={e => { e.stopPropagation(); deleteOne(n) }}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {visible.length < filtered.length && (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => p + 1)}>
                      LOAD {Math.min(PAGE_SIZE, filtered.length - visible.length)} MORE
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
function NotifCard({ notif: n, onOpen, onMarkRead, onMarkUnread, onDelete }) {
  const meta = TYPE_META[n.type] || TYPE_META.system
  const unread = !n.is_read
  return (
    <Card
      accent={meta.color}
      onClick={n.link ? onOpen : undefined}
      style={{
        flexDirection: 'row', alignItems: 'flex-start', gap: 12,
        padding: '11px 14px',
        background: unread ? `${meta.color}0a` : 'var(--bg-raised)',
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 4,
        background: `${meta.color}1a`,
        border: `1px solid ${meta.color}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: meta.color, fontSize: 14, flexShrink: 0, marginTop: 2,
      }}>
        {meta.glyph}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em',
            color: meta.color,
          }}>{meta.label}</span>
          {unread && <StatusBadge color={UEE_AMBER} glyph="●" label="NEW" />}
          <span style={{
            marginLeft: 'auto', fontSize: 10, color: 'var(--text-3)',
            fontFamily: 'var(--font-mono)', letterSpacing: '.1em',
          }}>{timeAgo(n.created_at)}</span>
        </div>
        <div style={{
          fontSize: 13, fontWeight: unread ? 600 : 500,
          color: 'var(--text-1)', lineHeight: 1.35,
        }}>
          {n.title}
        </div>
        {n.message && (
          <div style={{
            fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, marginTop: 3,
          }}>
            {n.message}
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }} onClick={e => e.stopPropagation()}>
          {unread ? (
            <button onClick={onMarkRead} style={tinyBtn('var(--text-3)')}>MARK READ</button>
          ) : (
            <button onClick={onMarkUnread} style={tinyBtn('var(--text-3)')}>MARK UNREAD</button>
          )}
          {n.link && (
            <button onClick={onOpen} style={tinyBtn(meta.color)}>OPEN →</button>
          )}
          <button onClick={onDelete} style={tinyBtn('#9099a8')}>✕</button>
        </div>
      </div>
    </Card>
  )
}

function tinyBtn(color) {
  return {
    background: 'transparent',
    border: '1px solid var(--border)',
    color,
    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em', fontWeight: 600,
    padding: '3px 8px', borderRadius: 3, cursor: 'pointer',
  }
}
