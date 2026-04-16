import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getRankByTier } from '../lib/ranks'
import NotificationBell from './NotificationBell'
import GrayveilLogo from './GrayveilLogo'
import SearchBar from './SearchBar'
import NavIcon from './NavIcon'
import PageTransition from './PageTransition'

const NAV = [
  { section: 'COMMAND' },
  { to: '/',            icon: 'sitrep',     label: 'SITREP'        },
  { to: '/events',      icon: 'ops',        label: 'OPS BOARD'     },
  { to: '/templates',   icon: 'templates',  label: 'OP TEMPLATES'  },
  { to: '/contracts',   icon: 'contracts',  label: 'CONTRACTS'     },
  { to: '/killboard',   icon: 'killboard',  label: 'KILL BOARD'    },
  { to: '/bounties',    icon: 'bounties',   label: 'BOUNTIES'      },

  { section: 'ORGANISATION' },
  { to: '/roster',      icon: 'roster',     label: 'ROSTER'        },
  { to: '/fleet',       icon: 'fleet',      label: 'FLEET'         },
  { to: '/ships',       icon: 'fleet',      label: 'SHIP CALENDAR' },
  { to: '/loadouts',    icon: 'loadouts',   label: 'LOADOUTS'      },
  { to: '/medals',      icon: 'medals',     label: 'COMMENDATIONS' },
  { to: '/reputation',  icon: 'reputation', label: 'REPUTATION'    },
  { to: '/diplomacy',   icon: 'diplomacy',  label: 'DIPLOMACY', minTier: 6 },

  { section: 'OPERATIONS' },
  { to: '/intelligence',icon: 'intel',      label: 'INTELLIGENCE'  },
  { to: '/blacklist',   icon: 'bounties',   label: 'WANTED LIST'   },
  { to: '/bank',        icon: 'bank',       label: 'BANK'          },
  { to: '/ledger',      icon: 'ledger',     label: 'LEDGER'        },
  { to: '/aars',        icon: 'aar',        label: 'AFTER ACTION'  },
  { to: '/recruitment', icon: 'recruitment',label: 'RECRUITMENT', minTier: 6 },

  { section: 'RESOURCES' },
  { to: '/wiki',        icon: 'wiki',       label: 'KNOWLEDGE BASE'},
  { to: '/messages',    icon: 'comms',      label: 'COMMS'         },
  { to: '/polls',       icon: 'polls',      label: 'POLLS'         },
  { to: '/referrals',   icon: 'referrals',  label: 'REFERRALS'     },
  { to: '/admin',       icon: 'admin',      label: 'ADMIN', minTier: 1 },
]

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

  // Global keyboard shortcut for search
  useEffect(() => {
    function handler(e) {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault(); setSearchOpen(true)
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
          <button className="btn btn-ghost btn-sm w-full" onClick={() => { setSearchOpen(true); setMobileOpen(false) }}
            style={{ justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)' }}>
            <span>⌕ Search...</span>
            <span style={{ fontSize: 9, background: 'var(--bg-surface)', padding: '1px 5px', borderRadius: 3 }}>/</span>
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item, i) => {
            if (item.section) return <div key={item.section} className="nav-section-label" style={i > 0 ? { marginTop: 12 } : {}}>{item.section}</div>
            if (!canSee(item)) return null
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={navClick}>
                <span className="nav-item-icon"><NavIcon name={item.icon} /></span>
                {item.label}
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
