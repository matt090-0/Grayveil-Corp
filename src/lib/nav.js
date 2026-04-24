export const NAV = [
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
  { to: '/updates',     icon: 'updates',    label: 'UPDATES'       },
  { to: '/messages',    icon: 'comms',      label: 'COMMS'         },
  { to: '/polls',       icon: 'polls',      label: 'POLLS'         },
  { to: '/referrals',   icon: 'referrals',  label: 'REFERRALS'     },
  { to: '/admin',       icon: 'admin',      label: 'ADMIN', minTier: 1 },
]

export const NAV_ITEMS = NAV.filter(n => n.to)

export const MAINT_BYPASS_TIER = 3

export function findMaintenanceForPath(pathname, maintenance) {
  if (!maintenance) return null
  for (const item of NAV_ITEMS) {
    const cfg = maintenance[item.to]
    if (!cfg?.enabled) continue
    if (item.to === '/' && pathname === '/') return { ...cfg, route: item.to, label: item.label }
    if (item.to !== '/' && (pathname === item.to || pathname.startsWith(item.to + '/'))) {
      return { ...cfg, route: item.to, label: item.label }
    }
  }
  return null
}
