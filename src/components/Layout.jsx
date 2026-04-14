import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getRankByTier } from '../lib/ranks'
import NotificationBell from './NotificationBell'
import GrayveilLogo from './GrayveilLogo'

const NAV = [
  { section: 'COMMAND' },
  { to: '/',            icon: '◈', label: 'SITREP'        },
  { to: '/events',      icon: '📅', label: 'OPS BOARD'    },
  { to: '/contracts',   icon: '◆', label: 'CONTRACTS'     },
  { to: '/killboard',   icon: '⚔', label: 'KILL BOARD'   },

  { section: 'ORGANISATION' },
  { to: '/roster',      icon: '◉', label: 'ROSTER'        },
  { to: '/fleet',       icon: '◎', label: 'FLEET'         },
  { to: '/loadouts',    icon: '⚙', label: 'LOADOUTS'     },
  { to: '/medals',      icon: '🏅', label: 'COMMENDATIONS'},
  { to: '/diplomacy',   icon: '🤝', label: 'DIPLOMACY', minTier: 6 },

  { section: 'OPERATIONS' },
  { to: '/intelligence',icon: '◍', label: 'INTELLIGENCE'  },
  { to: '/bank',        icon: '⬡', label: 'BANK'          },
  { to: '/ledger',      icon: '◇', label: 'LEDGER'        },
  { to: '/recruitment', icon: '◐', label: 'RECRUITMENT', minTier: 6 },

  { section: 'RESOURCES' },
  { to: '/wiki',        icon: '📖', label: 'KNOWLEDGE BASE'},
  { to: '/polls',       icon: '◑', label: 'POLLS'         },
  { to: '/admin',       icon: '☠', label: 'ADMIN', minTier: 1 },
]

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const rankInfo = profile ? getRankByTier(profile.tier) : null
  const initials = profile?.handle?.slice(0, 2).toUpperCase() || 'GV'

  const canSee = (item) => !item.minTier || (profile?.tier <= item.minTier)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <GrayveilLogo size={36} />
          <div>
            <div className="sidebar-logo-mark">GRAYVEIL</div>
            <div className="sidebar-logo-sub">CORPORATION</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item, i) => {
            if (item.section) return <div key={item.section} className="nav-section-label" style={i > 0 ? { marginTop: 12 } : {}}>{item.section}</div>
            if (!canSee(item)) return null
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="nav-item-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div className="user-pill" onClick={() => navigate('/profile')} style={{ flex: 1 }}>
              <div className="avatar">{initials}</div>
              <div className="user-info">
                <div className="user-handle truncate">{profile?.handle || '—'}</div>
                <div className="user-rank">{rankInfo?.label || '—'}</div>
              </div>
            </div>
            <NotificationBell />
          </div>
          <button
            className="btn btn-ghost btn-sm w-full"
            style={{ justifyContent: 'center' }}
            onClick={signOut}
          >
            DISCONNECT
          </button>
        </div>
      </aside>

      <div className="main-content">
        {children}
      </div>
    </div>
  )
}
