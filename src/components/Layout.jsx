import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getRankByTier } from '../lib/ranks'

const NAV = [
  { to: '/',            icon: '◈', label: 'SITREP'        },
  { to: '/roster',      icon: '◉', label: 'ROSTER'        },
  { to: '/fleet',       icon: '◎', label: 'FLEET'         },
  { to: '/contracts',   icon: '◆', label: 'CONTRACTS'     },
  { to: '/intelligence',icon: '◍', label: 'INTELLIGENCE'  },
  { to: '/ledger',      icon: '◇', label: 'LEDGER'        },
  { to: '/recruitment', icon: '◐', label: 'RECRUITMENT', minTier: 6 },
  { to: '/polls',       icon: '◑', label: 'POLLS'         },
  { to: '/admin',       icon: '⬡', label: 'ADMIN',        minTier: 1 },
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
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">GRAYVEIL</div>
          <div className="sidebar-logo-sub">CORPORATION</div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">COMMAND</div>
          {NAV.filter(canSee).map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-item-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-pill" onClick={() => navigate('/profile')}>
            <div className="avatar">{initials}</div>
            <div className="user-info">
              <div className="user-handle truncate">{profile?.handle || '—'}</div>
              <div className="user-rank">{rankInfo?.label || '—'}</div>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm w-full mt-8"
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
