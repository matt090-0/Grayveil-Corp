import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function SearchBar({ onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => { inputRef.current?.focus() }, [])

  // Keyboard shortcut to close
  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const timeout = setTimeout(async () => {
      setLoading(true)
      const q = `%${query}%`
      const [{ data: members }, { data: contracts }, { data: intel }, { data: wiki }, { data: kills }] = await Promise.all([
        supabase.from('profiles').select('id, handle, rank, division').ilike('handle', q).limit(5),
        supabase.from('contracts').select('id, title, status, contract_type').ilike('title', q).limit(5),
        supabase.from('intelligence').select('id, title, classification').ilike('title', q).limit(5),
        supabase.from('wiki_articles').select('id, title, category').ilike('title', q).limit(5),
        supabase.from('kill_log').select('id, target_name, target_org, outcome').ilike('target_name', q).limit(5),
      ])

      const r = []
      ;(members || []).forEach(m => r.push({ type: 'MEMBER', label: m.handle, sub: `${m.rank} · ${m.division || '—'}`, link: '/roster' }))
      ;(contracts || []).forEach(c => r.push({ type: 'CONTRACT', label: c.title, sub: `${c.status} · ${c.contract_type}`, link: '/contracts' }))
      ;(intel || []).forEach(i => r.push({ type: 'INTEL', label: i.title, sub: i.classification, link: '/intelligence' }))
      ;(wiki || []).forEach(w => r.push({ type: 'ARTICLE', label: w.title, sub: w.category, link: '/wiki' }))
      ;(kills || []).forEach(k => r.push({ type: 'KILL', label: k.target_name, sub: `${k.outcome} · ${k.target_org || '—'}`, link: '/killboard' }))

      setResults(r)
      setLoading(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  function go(link) { navigate(link); onClose() }

  const TYPE_COLOR = { MEMBER: 'var(--accent)', CONTRACT: 'var(--green)', INTEL: 'var(--red)', ARTICLE: 'var(--blue)', KILL: 'var(--amber)' }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99998,
      background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: '15vh',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        width: '100%', maxWidth: 520, background: 'var(--bg-raised)',
        border: '1px solid var(--border-md)', borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,.5)', overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--text-3)', fontSize: 16 }}>⌕</span>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search members, contracts, intel, wiki..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-1)', fontSize: 15, fontFamily: 'var(--font-mono)',
            }} />
          <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', padding: '2px 6px', background: 'var(--bg-surface)', borderRadius: 4 }}>ESC</span>
        </div>

        {loading && <div style={{ padding: 16, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>Searching...</div>}

        {!loading && results.length > 0 && (
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {results.map((r, i) => (
              <div key={i} onClick={() => go(r.link)}
                style={{
                  padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 12, transition: 'background .1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: TYPE_COLOR[r.type], letterSpacing: '.1em', width: 70 }}>{r.type}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.sub}</div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>→</span>
              </div>
            ))}
          </div>
        )}

        {!loading && query.length >= 2 && results.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>No results found</div>
        )}

        {!loading && query.length < 2 && (
          <div style={{ padding: 16, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>Type at least 2 characters to search</div>
        )}
      </div>
    </div>
  )
}
