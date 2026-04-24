// Clean geometric SVG icons for sidebar navigation
// Each renders at 16x16, uses currentColor for theming

function I({ children }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      {children}
    </svg>
  )
}

const icons = {
  // COMMAND
  sitrep: () => <I>
    <rect x="2" y="2" width="5" height="5" rx="0.5" fill="currentColor" opacity="0.3" />
    <rect x="9" y="2" width="5" height="5" rx="0.5" />
    <rect x="2" y="9" width="5" height="5" rx="0.5" />
    <rect x="9" y="9" width="5" height="5" rx="0.5" fill="currentColor" opacity="0.3" />
  </I>,

  ops: () => <I>
    <rect x="2" y="3" width="12" height="10" rx="1" />
    <line x1="2" y1="6" x2="14" y2="6" />
    <line x1="5" y1="3" x2="5" y2="6" />
    <line x1="11" y1="3" x2="11" y2="6" />
    <circle cx="8" cy="10" r="1.5" fill="currentColor" />
  </I>,

  contracts: () => <I>
    <path d="M4 2h8l-1 12H5L4 2z" />
    <line x1="6" y1="5" x2="10" y2="5" />
    <line x1="6" y1="7.5" x2="10" y2="7.5" />
    <line x1="6" y1="10" x2="9" y2="10" />
  </I>,

  killboard: () => <I>
    <line x1="3" y1="3" x2="13" y2="13" />
    <line x1="13" y1="3" x2="3" y2="13" />
    <circle cx="8" cy="8" r="5" />
    <circle cx="8" cy="8" r="1" fill="currentColor" />
  </I>,

  // ORGANISATION
  roster: () => <I>
    <circle cx="6" cy="5" r="2.5" />
    <path d="M1.5 14c0-3 2-4.5 4.5-4.5s4.5 1.5 4.5 4.5" />
    <circle cx="11.5" cy="5.5" r="1.8" />
    <path d="M10 14c0-2 1.2-3 2.5-3" />
  </I>,

  fleet: () => <I>
    <path d="M8 2L14 8L8 11L2 8L8 2z" fill="currentColor" opacity="0.15" />
    <path d="M8 2L14 8L8 11L2 8L8 2z" />
    <line x1="8" y1="11" x2="8" y2="14" />
    <line x1="5" y1="12.5" x2="11" y2="12.5" />
  </I>,

  loadouts: () => <I>
    <circle cx="8" cy="8" r="5.5" />
    <circle cx="8" cy="8" r="2" />
    <line x1="8" y1="2" x2="8" y2="4" />
    <line x1="8" y1="12" x2="8" y2="14" />
    <line x1="2" y1="8" x2="4" y2="8" />
    <line x1="12" y1="8" x2="14" y2="8" />
  </I>,

  medals: () => <I>
    <polygon points="8,1 9.5,5.5 14,5.5 10.5,8.5 11.5,13 8,10.5 4.5,13 5.5,8.5 2,5.5 6.5,5.5" />
  </I>,

  diplomacy: () => <I>
    <path d="M3 10V6c0-1.5 1-2.5 2.5-2.5h5C12 3.5 13 4.5 13 6v4" />
    <line x1="8" y1="3.5" x2="8" y2="12" />
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="11" cy="12" r="1.5" />
  </I>,

  // OPERATIONS
  intel: () => <I>
    <circle cx="7" cy="7" r="5" />
    <line x1="11" y1="11" x2="14" y2="14" />
    <circle cx="7" cy="7" r="1.5" fill="currentColor" opacity="0.4" />
  </I>,

  bank: () => <I>
    <path d="M2 6L8 2L14 6" />
    <rect x="2" y="6" width="12" height="1" fill="currentColor" opacity="0.3" />
    <line x1="4" y1="7" x2="4" y2="12" />
    <line x1="8" y1="7" x2="8" y2="12" />
    <line x1="12" y1="7" x2="12" y2="12" />
    <rect x="2" y="12" width="12" height="1.5" rx="0.3" />
  </I>,

  ledger: () => <I>
    <rect x="3" y="1.5" width="10" height="13" rx="1" />
    <line x1="5.5" y1="4.5" x2="10.5" y2="4.5" />
    <line x1="5.5" y1="7" x2="10.5" y2="7" />
    <line x1="5.5" y1="9.5" x2="8.5" y2="9.5" />
    <line x1="5.5" y1="12" x2="10.5" y2="12" />
  </I>,

  recruitment: () => <I>
    <circle cx="8" cy="5.5" r="3" />
    <line x1="8" y1="9" x2="8" y2="14" />
    <line x1="5.5" y1="11.5" x2="10.5" y2="11.5" />
  </I>,

  // RESOURCES
  wiki: () => <I>
    <path d="M3 2.5h4v11H4.5c-.8 0-1.5-.7-1.5-1.5V2.5z" />
    <path d="M7 2.5h6v10c0 .8-.7 1.5-1.5 1.5H7V2.5z" fill="currentColor" opacity="0.15" />
    <path d="M7 2.5h6v10c0 .8-.7 1.5-1.5 1.5H7V2.5z" />
  </I>,

  comms: () => <I>
    <path d="M2 3h12v8.5H6L3 14V11.5H2V3z" />
    <line x1="5" y1="6" x2="11" y2="6" />
    <line x1="5" y1="8.5" x2="9" y2="8.5" />
  </I>,

  polls: () => <I>
    <rect x="2" y="3" width="4" height="10" rx="0.5" fill="currentColor" opacity="0.2" />
    <rect x="2" y="3" width="4" height="10" rx="0.5" />
    <rect x="8" y="6" width="4" height="7" rx="0.5" fill="currentColor" opacity="0.2" />
    <rect x="8" y="6" width="4" height="7" rx="0.5" />
    <line x1="14" y1="13" x2="14" y2="8" strokeWidth="2" />
  </I>,

  admin: () => <I>
    <polygon points="8,1 10,6 15,6 11,9.5 12.5,14.5 8,11.5 3.5,14.5 5,9.5 1,6 6,6" fill="currentColor" opacity="0.15" />
    <polygon points="8,1 10,6 15,6 11,9.5 12.5,14.5 8,11.5 3.5,14.5 5,9.5 1,6 6,6" />
  </I>,

  bounties: () => <I>
    <circle cx="8" cy="6" r="4" />
    <line x1="8" y1="2" x2="8" y2="10" strokeWidth="0.8" />
    <line x1="4" y1="6" x2="12" y2="6" strokeWidth="0.8" />
    <path d="M6 10L8 14L10 10" fill="currentColor" opacity="0.3" />
    <path d="M6 10L8 14L10 10" />
  </I>,

  reputation: () => <I>
    <path d="M2 14L8 2L14 14" fill="currentColor" opacity="0.1" />
    <path d="M2 14L8 2L14 14" />
    <line x1="4.5" y1="10" x2="11.5" y2="10" />
    <line x1="6" y1="7" x2="10" y2="7" strokeWidth="0.8" />
  </I>,

  aar: () => <I>
    <rect x="3" y="1.5" width="10" height="13" rx="1" />
    <line x1="5.5" y1="4.5" x2="10.5" y2="4.5" />
    <line x1="5.5" y1="7" x2="10.5" y2="7" />
    <polyline points="5.5,10 7,11.5 10.5,9" strokeWidth="1.5" />
  </I>,

  referrals: () => <I>
    <circle cx="8" cy="4" r="2.5" />
    <path d="M3.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
    <line x1="12" y1="5" x2="15" y2="5" strokeWidth="1.5" />
    <line x1="13.5" y1="3.5" x2="13.5" y2="6.5" strokeWidth="1.5" />
  </I>,

  templates: () => <I>
    <rect x="2" y="2" width="12" height="12" rx="1.5" />
    <rect x="4" y="4" width="8" height="2" rx="0.5" fill="currentColor" opacity="0.3" />
    <line x1="4" y1="8.5" x2="12" y2="8.5" strokeWidth="0.8" />
    <line x1="4" y1="11" x2="9" y2="11" strokeWidth="0.8" />
  </I>,

  // Circular refresh / changelog glyph — rotating arrow with a version pulse
  updates: () => <I>
    <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
    <polyline points="13.5,2.5 13.5,5 11,5" />
    <circle cx="8" cy="8" r="1.4" fill="currentColor" />
  </I>,
}

export default function NavIcon({ name }) {
  const Icon = icons[name]
  return Icon ? <Icon /> : <span>●</span>
}
