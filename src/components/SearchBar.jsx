import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { UEE_AMBER, CLIP_CHAMFER } from './uee'

// ─────────────────────────────────────────────────────────────
// Result type metadata. Each entity Tier-K can return gets a
// colour and glyph so they're visually distinct in the result
// list, and they'll always sort in the order defined here.
// ─────────────────────────────────────────────────────────────
const TYPE_META = {
  MEMBER:    { color: UEE_AMBER, glyph: '◆', label: 'OPERATIVE',   group: 'PERSONNEL' },
  CONTRACT:  { color: '#5a80d9', glyph: '◉', label: 'CONTRACT',    group: 'OPERATIONS' },
  EVENT:     { color: '#5a80d9', glyph: '⬢', label: 'OPERATION',   group: 'OPERATIONS' },
  TEMPLATE:  { color: '#5a80d9', glyph: '◇', label: 'TEMPLATE',    group: 'OPERATIONS' },
  AAR:       { color: '#5ce0a1', glyph: '✓', label: 'AAR',         group: 'OPERATIONS' },
  KILL:      { color: '#e05c5c', glyph: '⚔', label: 'ENGAGEMENT',  group: 'COMBAT' },
  BOUNTY:    { color: '#e05c5c', glyph: '✕', label: 'BOUNTY',      group: 'COMBAT' },
  INTEL:     { color: '#b566d9', glyph: '◍', label: 'INTEL',       group: 'INTELLIGENCE' },
  DIPLOMACY: { color: '#5a80d9', glyph: '◇', label: 'ORG',         group: 'INTELLIGENCE' },
  ARTICLE:   { color: UEE_AMBER, glyph: '◈', label: 'WIKI',        group: 'KNOWLEDGE' },
  FLEET:     { color: '#5a80d9', glyph: '◎', label: 'VESSEL',      group: 'ASSETS' },
  LOADOUT:   { color: UEE_AMBER, glyph: '◆', label: 'LOADOUT',     group: 'ASSETS' },
  LISTING:   { color: '#5ce0a1', glyph: '✦', label: 'MARKET',      group: 'ASSETS' },
  PAGE:      { color: '#9099a8', glyph: '›', label: 'PAGE',        group: 'NAVIGATION' },
}

const GROUP_ORDER = ['NAVIGATION', 'PERSONNEL', 'OPERATIONS', 'COMBAT', 'INTELLIGENCE', 'ASSETS', 'KNOWLEDGE']

// Fast nav targets surfaced when the query is short. Keeps Cmd-K
// useful even before any search hits — it's a router shortcut too.
const NAV_TARGETS = [
  { label: 'Dashboard',       sub: 'Live SITREP',                 link: '/' },
  { label: 'Roster',          sub: 'Member directory',            link: '/roster' },
  { label: 'Contracts',       sub: 'Operations registry',         link: '/contracts' },
  { label: 'Operations',      sub: 'Scheduled ops board',         link: '/events' },
  { label: 'Op Templates',    sub: 'Pre-baked briefings',         link: '/templates' },
  { label: 'KillBoard',       sub: 'Combat feed + leaderboard',   link: '/killboard' },
  { label: 'Bounties',        sub: 'Active bounty registry',      link: '/bounties' },
  { label: 'Intelligence',    sub: 'Classified archive',          link: '/intelligence' },
  { label: 'Diplomacy',       sub: 'Standing orders on orgs',     link: '/diplomacy' },
  { label: 'Fleet',           sub: 'Vessel registry',             link: '/fleet' },
  { label: 'Loadouts',        sub: 'Ship/weapon/armor kits',      link: '/loadouts' },
  { label: 'Marketplace',     sub: 'Member-to-member goods',      link: '/market' },
  { label: 'Bank',            sub: 'Wallet + treasury',           link: '/bank' },
  { label: 'Ledger',          sub: 'Earnings register',           link: '/ledger' },
  { label: 'AARs',            sub: 'Post-op debriefs',            link: '/aars' },
  { label: 'Medals',          sub: 'Commendations + certs',       link: '/medals' },
  { label: 'Wiki',            sub: 'Org knowledge base',          link: '/wiki' },
  { label: 'Profile',         sub: 'Your citizen dossier',        link: '/profile' },
  { label: 'Updates',         sub: 'Changelog + release notes',   link: '/updates' },
]

export default function SearchBar({ onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    function handler(e) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected(s => Math.min(s + 1, displayedItems.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected(s => Math.max(s - 1, 0))
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const target = displayedItems[selected]
        if (target) go(target.link)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  // Debounced search across every entity table that can be queried by name.
  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const timeout = setTimeout(async () => {
      setLoading(true)
      const q = `%${query}%`
      const [
        { data: members }, { data: contracts }, { data: intel }, { data: wiki },
        { data: kills }, { data: bounties }, { data: events }, { data: templates },
        { data: aars }, { data: fleet }, { data: orgs },
        { data: loadouts }, { data: listings },
      ] = await Promise.all([
        supabase.from('profiles').select('id, handle, rank, division, tier').ilike('handle', q).limit(6),
        supabase.from('contracts').select('id, title, status, contract_type').ilike('title', q).limit(6),
        supabase.from('intelligence').select('id, title, classification').ilike('title', q).limit(6),
        supabase.from('wiki_articles').select('id, title, category').ilike('title', q).limit(6),
        supabase.from('kill_log').select('id, target_name, target_org, outcome').ilike('target_name', q).limit(6),
        supabase.from('bounties').select('id, target_name, target_org, status, reward').ilike('target_name', q).limit(6),
        supabase.from('events').select('id, title, status, event_type, starts_at').ilike('title', q).limit(6),
        supabase.from('op_templates').select('id, name, category').ilike('name', q).limit(6),
        supabase.from('after_action_reports').select('id, title, outcome').ilike('title', q).limit(6),
        supabase.from('fleet').select('id, vessel_name, ship_class, status').ilike('vessel_name', q).limit(6),
        supabase.from('diplomacy').select('id, org_name, org_tag, status').or(`org_name.ilike.${q},org_tag.ilike.${q}`).limit(6),
        supabase.from('loadouts').select('id, name, kind').ilike('name', q).limit(6).then(r => r.error ? { data: [] } : r),
        supabase.from('marketplace_listings').select('id, title, status, price').ilike('title', q).limit(6).then(r => r.error ? { data: [] } : r),
      ])

      const r = []
      ;(members || []).forEach(m => r.push({
        type: 'MEMBER', label: m.handle, sub: `${m.rank || `T-${m.tier}`} · ${m.division || 'No division'}`,
        link: '/roster',
      }))
      ;(contracts || []).forEach(c => r.push({
        type: 'CONTRACT', label: c.title, sub: `${c.status} · ${c.contract_type}`,
        link: '/contracts',
      }))
      ;(events || []).forEach(e => r.push({
        type: 'EVENT', label: e.title, sub: `${e.status} · ${e.event_type}`,
        link: '/events',
      }))
      ;(templates || []).forEach(t => r.push({
        type: 'TEMPLATE', label: t.name, sub: t.category,
        link: '/templates',
      }))
      ;(aars || []).forEach(a => r.push({
        type: 'AAR', label: a.title, sub: a.outcome,
        link: '/aars',
      }))
      ;(kills || []).forEach(k => r.push({
        type: 'KILL', label: k.target_name, sub: `${k.outcome} · ${k.target_org || '—'}`,
        link: '/killboard',
      }))
      ;(bounties || []).forEach(b => r.push({
        type: 'BOUNTY', label: b.target_name,
        sub: `${b.status} · ${(b.reward || 0).toLocaleString()} aUEC`,
        link: '/bounties',
      }))
      ;(intel || []).forEach(i => r.push({
        type: 'INTEL', label: i.title, sub: i.classification,
        link: '/intelligence',
      }))
      ;(orgs || []).forEach(o => r.push({
        type: 'DIPLOMACY', label: o.org_name, sub: `${o.status}${o.org_tag ? ' · ' + o.org_tag : ''}`,
        link: '/diplomacy',
      }))
      ;(fleet || []).forEach(f => r.push({
        type: 'FLEET', label: f.vessel_name, sub: `${f.ship_class} · ${f.status}`,
        link: '/fleet',
      }))
      ;(loadouts || []).forEach(l => r.push({
        type: 'LOADOUT', label: l.name, sub: l.kind || 'KIT',
        link: '/loadouts',
      }))
      ;(listings || []).forEach(l => r.push({
        type: 'LISTING', label: l.title, sub: `${l.status} · ${(l.price || 0).toLocaleString()} aUEC`,
        link: '/market',
      }))
      ;(wiki || []).forEach(w => r.push({
        type: 'ARTICLE', label: w.title, sub: w.category,
        link: '/wiki',
      }))

      setResults(r)
      setLoading(false)
      setSelected(0)
    }, 250)
    return () => clearTimeout(timeout)
  }, [query])

  // What's actually visible in the list — when query is short we
  // surface NAV_TARGETS as a router shortcut.
  const navMatches = useMemo(() => {
    if (query.length >= 2) return []
    const q = query.trim().toLowerCase()
    return NAV_TARGETS
      .filter(n => !q || n.label.toLowerCase().includes(q) || n.sub.toLowerCase().includes(q))
      .slice(0, 12)
      .map(n => ({ type: 'PAGE', label: n.label, sub: n.sub, link: n.link }))
  }, [query])

  // Group results by group, keeping NAV_TARGETS first when shown.
  const grouped = useMemo(() => {
    const items = query.length < 2 ? navMatches : results
    const out = []
    GROUP_ORDER.forEach(g => {
      const inGroup = items.filter(r => TYPE_META[r.type]?.group === g)
      if (inGroup.length > 0) out.push({ group: g, items: inGroup })
    })
    return out
  }, [query, results, navMatches])

  // Flat displayed list — for keyboard nav we need a single index.
  const displayedItems = useMemo(() =>
    grouped.flatMap(g => g.items),
  [grouped])

  function go(link) { navigate(link); onClose() }

  // Keep selected item in view when arrow-keying down a long list.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`)
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [selected])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99998,
        background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        // Top padding adapts to viewport height so the palette
        // doesn't crowd the keyboard on short phones.
        padding: 'min(12vh, 80px) 12px 12px',
        animation: 'searchFade .12s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <style>{`
        @keyframes searchFade {
          from { opacity: 0 }
          to { opacity: 1 }
        }
        @keyframes searchSlide {
          from { opacity: 0; transform: translateY(-12px) }
          to { opacity: 1; transform: translateY(0) }
        }
      `}</style>
      <div style={{
        width: '100%', maxWidth: 640,
        background: 'var(--bg-raised)',
        border: `1px solid ${UEE_AMBER}55`,
        clipPath: CLIP_CHAMFER,
        boxShadow: `0 24px 70px rgba(0,0,0,.6), 0 0 0 1px ${UEE_AMBER}22`,
        overflow: 'hidden',
        animation: 'searchSlide .15s ease',
      }}>
        {/* Classification bar */}
        <div style={{
          background: `linear-gradient(180deg, #0e0f14 0%, #0a0b0f 100%)`,
          borderBottom: `1px solid ${UEE_AMBER}33`,
          padding: '6px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.22em',
          color: UEE_AMBER,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: UEE_AMBER,
              boxShadow: `0 0 8px ${UEE_AMBER}`, animation: 'pulse 2s ease-in-out infinite',
            }} />
            GRAYVEIL UNIFIED LOOKUP
          </div>
          <div style={{ display: 'flex', gap: 12, color: 'var(--text-3)' }}>
            <span>↑↓ NAV</span>
            <span>↵ OPEN</span>
            <span>ESC CLOSE</span>
          </div>
        </div>

        {/* Search input */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(0,0,0,0.2)',
        }}>
          <span style={{ color: UEE_AMBER, fontSize: 18, lineHeight: 1 }}>⌕</span>
          <input
            ref={inputRef} value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search anything — operatives, ops, contracts, intel, ships..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-1)', fontSize: 15,
              fontFamily: 'var(--font-display)', letterSpacing: '.02em',
            }}
          />
          {loading && (
            <span style={{
              fontSize: 9, letterSpacing: '.22em', color: UEE_AMBER,
              fontFamily: 'var(--font-mono)',
            }}>
              SEARCHING...
            </span>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {!loading && grouped.length === 0 && query.length >= 2 && (
            <div style={{
              padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--text-3)',
              fontFamily: 'var(--font-mono)', letterSpacing: '.05em',
            }}>
              NO RESULTS · Try a shorter or different query
            </div>
          )}

          {!loading && query.length === 0 && (
            <div style={{
              padding: '12px 18px 6px', fontSize: 9, letterSpacing: '.22em',
              color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
            }}>
              ◆ JUMP TO PAGE
            </div>
          )}

          {grouped.map((group, gi) => {
            // Calculate the absolute starting index for keyboard nav
            let startIdx = 0
            for (let i = 0; i < gi; i++) startIdx += grouped[i].items.length
            return (
              <div key={group.group}>
                {gi > 0 && (
                  <div style={{
                    padding: '10px 18px 4px',
                    fontSize: 9, letterSpacing: '.22em',
                    color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
                    borderTop: '1px solid var(--border)',
                    marginTop: 4,
                  }}>
                    ◆ {group.group}
                  </div>
                )}
                {group.items.map((r, i) => {
                  const m = TYPE_META[r.type] || TYPE_META.PAGE
                  const idx = startIdx + i
                  const isSelected = idx === selected
                  return (
                    <div
                      key={`${group.group}-${i}`}
                      data-idx={idx}
                      onClick={() => go(r.link)}
                      onMouseEnter={() => setSelected(idx)}
                      style={{
                        padding: '9px 18px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 12,
                        background: isSelected ? `${m.color}14` : 'transparent',
                        borderLeft: `3px solid ${isSelected ? m.color : 'transparent'}`,
                        transition: 'background .1s, border-color .1s',
                      }}
                    >
                      <span style={{
                        color: m.color, fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0,
                      }}>{m.glyph}</span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em',
                        color: m.color, width: 78, flexShrink: 0,
                      }}>{m.label}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 500, color: 'var(--text-1)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {r.label}
                        </div>
                        <div style={{
                          fontSize: 11, color: 'var(--text-3)',
                          fontFamily: 'var(--font-mono)', letterSpacing: '.04em',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1,
                        }}>
                          {r.sub}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 13, color: isSelected ? m.color : 'var(--text-3)',
                        opacity: isSelected ? 1 : 0.4, flexShrink: 0,
                      }}>↵</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Footer hint */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '8px 18px',
          background: 'rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em',
          color: 'var(--text-3)',
        }}>
          <span>{query.length >= 2 ? `${displayedItems.length} HIT${displayedItems.length === 1 ? '' : 'S'}` : 'TYPE TO SEARCH'}</span>
          <span>⌘K · CTRL+K · /</span>
        </div>
      </div>
    </div>
  )
}
