import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getRankByTier } from '../lib/ranks'
import NotificationBell from './NotificationBell'
import GrayveilLogo from './GrayveilLogo'
import SearchBar from './SearchBar'
import NavIcon from './NavIcon'
import PageTransition from './PageTransition'
import { NAV, MAINT_BYPASS_TIER } from '../lib/nav'
import { useMaintenanceMap } from '../hooks/useMaintenanceMap'

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const rankInfo = profile ? getRankByTier(profile.tier) : null
  const initials = profile?.handle?.slice(0, 2).toUpperCase() || 'GV'
  const accentColor = profile?.avatar_color || 'var(--accent)'
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const canSee = (item) => !item.minTier || (profile?.tier <= item.minTier)
  const maintenance = useMaintenanceMap()
  const canBypassMaint = profile?.tier <= MAINT_BYPASS_TIER

  // Global keyboard shortcut for search
  // - Cmd+K (mac) / Ctrl+K (win/linux): standard "command palette" everywhere
  // - "/": typing-friendly fallback (only when no input is focused)
  useEffect(() => {
    function handler(e) {
      // Cmd-K / Ctrl-K — works even when an input is focused, mirroring
      // Slack/Linear/GitHub/etc. so muscle memory transfers.
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen(true)
        return
      }
      // "/" — keep the existing behaviour, but only when nothing is focused.
      if (e.key === '/' && !e.ctrlKey && !e.metaKey
          && document.activeElement?.tagName !== 'INPUT'
          && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Close mobile nav on route change
  function navClick() { setMobileOpen(false) }

  return (
    <div className="app-shell">
      {/* Mobile hamburger */}
      <button className="mobile-hamburger" onClick={() => setMobileOpen(!mobileOpen)}>
        <span style={{ fontSize: 20 }}>{mobileOpen ? '✕' : '☰'}</span>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}

      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <GrayveilLogo size={36} />
          <div>
            <div className="sidebar-logo-mark">GRAYVEIL</div>
            <div className="sidebar-logo-sub">CORPORATION</div>
          </div>
        </div>

        {/* Search trigger */}
        <div style={{ padding: '0 10px 8px' }}>
          <button
            className="btn btn-ghost btn-sm w-full"
            onClick={() => { setSearchOpen(true); setMobileOpen(false) }}
            style={{ justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)' }}
          >
            <span>⌕ Search anything...</span>
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '.05em',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              padding: '1px 6px', borderRadius: 3,
            }}>
              {typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'CTRL K'}
            </span>
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item, i) => {
            if (item.section) return <div key={item.section} className="nav-section-label" style={i > 0 ? { marginTop: 12 } : {}}>{item.section}</div>
            if (!canSee(item)) return null
            const isMaint = !!maintenance?.[item.to]?.enabled
            if (isMaint && !canBypassMaint) return null
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={navClick}>
                <span className="nav-item-icon"><NavIcon name={item.icon} /></span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {isMaint && canBypassMaint && (
                  <span style={{ fontSize: 8, letterSpacing: '.15em', fontFamily: 'var(--font-mono)', color: 'var(--amber)', border: '1px solid var(--amber)', borderRadius: 3, padding: '1px 4px', marginLeft: 6 }}>MAINT</span>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div className="user-pill" onClick={() => { navigate('/profile'); setMobileOpen(false) }} style={{ flex: 1 }}>
              <div className="avatar" style={{ borderColor: accentColor, color: accentColor }}>{initials}</div>
              <div className="user-info">
                <div className="user-handle truncate">{profile?.handle || '—'}</div>
                <div className="user-rank">{rankInfo?.label || '—'}</div>
              </div>
            </div>
            <NotificationBell />
          </div>
          <button className="btn btn-ghost btn-sm w-full" style={{ justifyContent: 'center' }} onClick={signOut}>
            DISCONNECT
          </button>
        </div>
      </aside>

      <div className="main-content">
        <PageTransition key={location.pathname}>
          {children}
        </PageTransition>
      </div>

      {searchOpen && <SearchBar onClose={() => setSearchOpen(false)} />}
    </div>
  )
}
