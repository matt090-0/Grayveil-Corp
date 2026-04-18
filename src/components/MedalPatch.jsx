const RARITY_COLORS = {
  COMMON:    { border: '#555566', glow: '#44445a' },
  UNCOMMON:  { border: '#4a9060', glow: '#2a5038' },
  RARE:      { border: '#4a7ad9', glow: '#283f6a' },
  LEGENDARY: { border: '#d4d8e0', glow: '#3a3e48' },
}

function PatchBase({ rarity = 'COMMON', children, size = 80 }) {
  const c = RARITY_COLORS[rarity] || RARITY_COLORS.COMMON
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <polygon points="50,4 93,27 93,73 50,96 7,73 7,27" fill={c.glow} stroke={c.border} strokeWidth="2.5" />
      <polygon points="50,12 85,31 85,69 50,88 15,69 15,31" fill="#0a0b0f" stroke={c.border} strokeWidth="0.5" opacity="0.6" />
      {children}
    </svg>
  )
}

// Color shortcuts per rarity for inner designs — gld is now chrome-silver for Legendary medals
const C = { grey: '#8888a0', grn: '#5ab870', blu: '#4a7ad9', red: '#c83030', gld: '#d4d8e0', amb: '#c87030', teal: '#40b0a0', prp: '#9060c8', wht: '#ccccdd' }

const PATCHES = {
  // ═══════════════════════════════════════
  // ORIGINAL MEDALS
  // ═══════════════════════════════════════
  'First Blood': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <line x1="35" y1="35" x2="65" y2="65" stroke={C.red} strokeWidth="5" strokeLinecap="round" />
      <line x1="65" y1="35" x2="35" y2="65" stroke={C.red} strokeWidth="5" strokeLinecap="round" />
      <circle cx="50" cy="50" r="8" fill="none" stroke="#e04040" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="3" fill="#e04040" />
    </PatchBase>
  ),
  'Centurion': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <polygon points="50,22 58,40 78,40 62,52 68,70 50,60 32,70 38,52 22,40 42,40" fill="none" stroke={C.blu} strokeWidth="2" />
      <text x="50" y="56" textAnchor="middle" fill={C.blu} fontSize="14" fontWeight="700" fontFamily="monospace">100</text>
    </PatchBase>
  ),
  'Fleet Commander': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <path d="M50,28 L65,45 L50,40 L35,45 Z" fill={C.grn} stroke="#5ab870" strokeWidth="1" />
      <line x1="50" y1="40" x2="50" y2="72" stroke="#5ab870" strokeWidth="2" />
      <line x1="35" y1="55" x2="65" y2="55" stroke="#5ab870" strokeWidth="1.5" />
      <line x1="38" y1="62" x2="62" y2="62" stroke="#5ab870" strokeWidth="1" />
      <circle cx="50" cy="72" r="3" fill="#5ab870" />
    </PatchBase>
  ),
  'Founding Member': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <polygon points="50,25 56,43 75,43 60,54 65,72 50,62 35,72 40,54 25,43 44,43" fill={C.gld} opacity="0.15" stroke={C.gld} strokeWidth="1.5" />
      <polygon points="50,33 54,43 63,43 56,49 58,59 50,54 42,59 44,49 37,43 46,43" fill={C.gld} />
      <text x="50" y="80" textAnchor="middle" fill={C.gld} fontSize="7" fontFamily="monospace" letterSpacing="2">FOUNDER</text>
    </PatchBase>
  ),
  'Iron Hauler': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <rect x="35" y="38" width="30" height="22" rx="2" fill="none" stroke={C.grey} strokeWidth="2" />
      <line x1="35" y1="45" x2="65" y2="45" stroke={C.grey} strokeWidth="1" />
      <rect x="42" y="30" width="16" height="10" rx="1" fill="none" stroke={C.grey} strokeWidth="1.5" />
      <text x="50" y="55" textAnchor="middle" fill="#aaaabc" fontSize="8" fontFamily="monospace">SCU</text>
    </PatchBase>
  ),
  'Deep Scanner': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <circle cx="50" cy="48" r="18" fill="none" stroke={C.grn} strokeWidth="1.5" />
      <circle cx="50" cy="48" r="12" fill="none" stroke={C.grn} strokeWidth="1" opacity="0.6" />
      <circle cx="50" cy="48" r="6" fill="none" stroke={C.grn} strokeWidth="0.8" opacity="0.4" />
      <line x1="50" y1="30" x2="50" y2="66" stroke={C.grn} strokeWidth="0.5" opacity="0.4" />
      <line x1="32" y1="48" x2="68" y2="48" stroke={C.grn} strokeWidth="0.5" opacity="0.4" />
      <line x1="50" y1="48" x2="62" y2="38" stroke="#5ab870" strokeWidth="2" strokeLinecap="round" />
      <circle cx="50" cy="48" r="2" fill="#5ab870" />
    </PatchBase>
  ),
  'Ghost Operative': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <path d="M50,30 C60,30 68,38 68,48 C68,62 58,72 50,72 C42,72 32,62 32,48 C32,38 40,30 50,30" fill="none" stroke="#666680" strokeWidth="1.5" strokeDasharray="3,3" />
      <circle cx="43" cy="44" r="3" fill="#8888aa" />
      <circle cx="57" cy="44" r="3" fill="#8888aa" />
      <path d="M40,56 Q50,64 60,56" fill="none" stroke="#8888aa" strokeWidth="1" />
    </PatchBase>
  ),
  'Moneybags': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <circle cx="50" cy="50" r="16" fill="none" stroke={C.gld} strokeWidth="2" />
      <text x="50" y="56" textAnchor="middle" fill={C.gld} fontSize="20" fontWeight="700" fontFamily="serif">¤</text>
    </PatchBase>
  ),
  'Pathfinder': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <circle cx="50" cy="50" r="14" fill="none" stroke={C.grey} strokeWidth="1.5" />
      <line x1="50" y1="36" x2="50" y2="34" stroke="#aaaabc" strokeWidth="2" strokeLinecap="round" />
      <line x1="50" y1="64" x2="50" y2="66" stroke={C.grey} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="36" y1="50" x2="34" y2="50" stroke={C.grey} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="64" y1="50" x2="66" y2="50" stroke={C.grey} strokeWidth="1.5" strokeLinecap="round" />
      <polygon points="50,38 54,48 50,46 46,48" fill={C.red} />
      <circle cx="50" cy="50" r="2" fill="#aaaabc" />
    </PatchBase>
  ),
  'Combat Medic': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <rect x="46" y="34" width="8" height="28" rx="1" fill={C.red} />
      <rect x="36" y="44" width="28" height="8" rx="1" fill={C.red} />
      <circle cx="50" cy="48" r="18" fill="none" stroke={C.red} strokeWidth="1" opacity="0.4" />
    </PatchBase>
  ),
  'Ace Pilot': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <path d="M50,30 L56,44 L72,44 L60,54 L64,68 L50,58 L36,68 L40,54 L28,44 L44,44 Z" fill="none" stroke={C.blu} strokeWidth="2" />
      <path d="M38,56 L30,62" stroke={C.blu} strokeWidth="2" strokeLinecap="round" />
      <path d="M62,56 L70,62" stroke={C.blu} strokeWidth="2" strokeLinecap="round" />
      <circle cx="50" cy="48" r="4" fill={C.blu} />
    </PatchBase>
  ),
  'Loan Shark': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <path d="M35,50 Q42,35 50,42 Q58,35 65,50 Q58,65 50,58 Q42,65 35,50" fill="none" stroke={C.grey} strokeWidth="1.5" />
      <polygon points="46,46 50,38 54,46" fill="#aaaabc" />
      <polygon points="46,54 50,62 54,54" fill="#aaaabc" />
    </PatchBase>
  ),
  'Recruiter': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <circle cx="42" cy="42" r="7" fill="none" stroke={C.grn} strokeWidth="1.5" />
      <circle cx="58" cy="42" r="7" fill="none" stroke={C.grn} strokeWidth="1.5" />
      <circle cx="50" cy="56" r="7" fill="none" stroke="#5ab870" strokeWidth="2" />
      <line x1="50" y1="63" x2="50" y2="70" stroke="#5ab870" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="46" y1="67" x2="54" y2="67" stroke="#5ab870" strokeWidth="1.5" strokeLinecap="round" />
    </PatchBase>
  ),
  'Survivor': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <path d="M40,65 L45,40 L50,55 L55,35 L60,65" fill="none" stroke={C.amb} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="50" cy="30" r="4" fill={C.amb} opacity="0.6" />
    </PatchBase>
  ),
  "High Admiral's Commendation": ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <polygon points="50,24 62,34 62,54 50,64 38,54 38,34" fill={C.gld} opacity="0.1" stroke={C.gld} strokeWidth="2" />
      <polygon points="50,32 56,38 56,50 50,56 44,50 44,38" fill="none" stroke={C.gld} strokeWidth="1" />
      <circle cx="50" cy="44" r="5" fill={C.gld} />
      <text x="50" y="78" textAnchor="middle" fill={C.gld} fontSize="5" fontFamily="monospace" letterSpacing="1">ADMIRAL</text>
    </PatchBase>
  ),
  'Sovereign Backer': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <path d="M30,52 L38,48 L40,42 L46,40 L50,32 L54,40 L60,42 L62,48 L70,52" fill={C.gld} opacity="0.15" stroke={C.gld} strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="36" y="52" width="28" height="8" rx="1" fill={C.gld} opacity="0.2" stroke={C.gld} strokeWidth="1" />
      <polygon points="44,28 47,24 50,26 53,24 56,28" fill={C.gld} stroke={C.gld} strokeWidth="0.8" />
      <text x="50" y="76" textAnchor="middle" fill={C.gld} fontSize="4.5" fontFamily="monospace" letterSpacing="1">SOVEREIGN</text>
    </PatchBase>
  ),
  'Citadel Builder': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <rect x="40" y="38" width="20" height="20" rx="2" fill={C.blu} opacity="0.15" stroke={C.blu} strokeWidth="1.5" />
      <rect x="32" y="43" width="8" height="10" rx="1" fill="none" stroke={C.blu} strokeWidth="1" />
      <rect x="60" y="43" width="8" height="10" rx="1" fill="none" stroke={C.blu} strokeWidth="1" />
      <line x1="28" y1="48" x2="32" y2="48" stroke={C.blu} strokeWidth="2" />
      <line x1="68" y1="48" x2="72" y2="48" stroke={C.blu} strokeWidth="2" />
      <line x1="50" y1="38" x2="50" y2="28" stroke={C.blu} strokeWidth="1" />
      <circle cx="50" cy="27" r="2" fill={C.blu} opacity="0.5" />
      <line x1="62" y1="32" x2="70" y2="24" stroke={C.grn} strokeWidth="1.5" strokeLinecap="round" />
      <text x="50" y="74" textAnchor="middle" fill={C.blu} fontSize="4.5" fontFamily="monospace" letterSpacing="1">CITADEL</text>
    </PatchBase>
  ),

  // ═══════════════════════════════════════
  // NEW COMMON MEDALS (10)
  // ═══════════════════════════════════════
  'First Sortie': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <path d="M50,28 L58,42 L50,38 L42,42 Z" fill={C.grey} opacity="0.4" stroke={C.grey} strokeWidth="1.5" />
      <line x1="50" y1="42" x2="50" y2="68" stroke={C.grey} strokeWidth="1.5" />
      <circle cx="50" cy="68" r="3" fill={C.grey} />
      <line x1="40" y1="52" x2="60" y2="52" stroke={C.grey} strokeWidth="1" />
      <text x="50" y="80" textAnchor="middle" fill={C.grey} fontSize="5" fontFamily="monospace">SORTIE I</text>
    </PatchBase>
  ),
  'Void Walker': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <circle cx="50" cy="46" r="10" fill="none" stroke={C.grey} strokeWidth="2" />
      <circle cx="50" cy="46" r="4" fill={C.grey} opacity="0.3" />
      <path d="M40,60 Q45,68 50,60 Q55,68 60,60" fill="none" stroke={C.grey} strokeWidth="1.5" />
      <line x1="50" y1="32" x2="50" y2="24" stroke={C.grey} strokeWidth="1" strokeDasharray="2,2" />
    </PatchBase>
  ),
  'Cargo Runner': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <rect x="34" y="40" width="32" height="20" rx="3" fill={C.grey} opacity="0.15" stroke={C.grey} strokeWidth="1.5" />
      <line x1="34" y1="48" x2="66" y2="48" stroke={C.grey} strokeWidth="0.8" />
      <path d="M42,40 L42,34 L58,34 L58,40" fill="none" stroke={C.grey} strokeWidth="1.2" />
      <circle cx="40" cy="64" r="3" fill="none" stroke={C.grey} strokeWidth="1.2" />
      <circle cx="60" cy="64" r="3" fill="none" stroke={C.grey} strokeWidth="1.2" />
    </PatchBase>
  ),
  'Trigger Happy': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <rect x="46" y="30" width="8" height="36" rx="2" fill={C.grey} opacity="0.2" stroke={C.grey} strokeWidth="1.5" />
      <rect x="42" y="58" width="16" height="10" rx="2" fill="none" stroke={C.grey} strokeWidth="1.2" />
      <line x1="50" y1="22" x2="50" y2="28" stroke={C.grey} strokeWidth="2" strokeLinecap="round" />
      <line x1="38" y1="44" x2="46" y2="44" stroke={C.grey} strokeWidth="1" />
      <line x1="54" y1="44" x2="62" y2="44" stroke={C.grey} strokeWidth="1" />
    </PatchBase>
  ),
  'Wrench Monkey': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <path d="M38,62 L54,34" stroke={C.grey} strokeWidth="3" strokeLinecap="round" />
      <circle cx="56" cy="32" r="6" fill="none" stroke={C.grey} strokeWidth="1.5" />
      <path d="M52,28 L48,24" stroke={C.grey} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M60,36 L64,40" stroke={C.grey} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="36" cy="64" r="4" fill={C.grey} opacity="0.3" stroke={C.grey} strokeWidth="1" />
    </PatchBase>
  ),
  'Dust Devil': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <path d="M35,65 L42,55 L48,58 L55,42 L62,48 L68,35" fill="none" stroke={C.grey} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="50" cy="30" r="5" fill="none" stroke={C.grey} strokeWidth="1.5" />
      <line x1="50" y1="35" x2="50" y2="42" stroke={C.grey} strokeWidth="1" strokeDasharray="2,2" />
      <line x1="30" y1="70" x2="70" y2="70" stroke={C.grey} strokeWidth="1" opacity="0.4" />
    </PatchBase>
  ),
  'Beacon Keeper': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <polygon points="50,28 54,36 50,34 46,36" fill={C.grey} />
      <circle cx="50" cy="50" r="12" fill="none" stroke={C.grey} strokeWidth="1" strokeDasharray="3,3" />
      <circle cx="50" cy="50" r="6" fill="none" stroke={C.grey} strokeWidth="1.5" />
      <circle cx="50" cy="50" r="2" fill={C.grey} />
      <line x1="50" y1="36" x2="50" y2="38" stroke={C.grey} strokeWidth="1.5" />
    </PatchBase>
  ),
  'Credit Chaser': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <circle cx="42" cy="44" r="8" fill="none" stroke={C.grey} strokeWidth="1.5" />
      <circle cx="50" cy="50" r="8" fill="none" stroke={C.grey} strokeWidth="1.5" />
      <circle cx="58" cy="44" r="8" fill="none" stroke={C.grey} strokeWidth="1.5" />
      <text x="50" y="54" textAnchor="middle" fill={C.grey} fontSize="8" fontWeight="600" fontFamily="monospace">¤</text>
    </PatchBase>
  ),
  'Wingman': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <path d="M50,30 L62,50 L50,45 L38,50 Z" fill={C.grey} opacity="0.2" stroke={C.grey} strokeWidth="1.5" />
      <path d="M38,55 L28,65" stroke={C.grey} strokeWidth="2" strokeLinecap="round" />
      <path d="M62,55 L72,65" stroke={C.grey} strokeWidth="2" strokeLinecap="round" />
      <circle cx="50" cy="42" r="3" fill={C.grey} />
    </PatchBase>
  ),
  'Hangar Rat': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <rect x="30" y="42" width="40" height="22" rx="2" fill={C.grey} opacity="0.1" stroke={C.grey} strokeWidth="1.5" />
      <line x1="30" y1="52" x2="70" y2="52" stroke={C.grey} strokeWidth="0.8" />
      <path d="M36,42 L36,36 L64,36 L64,42" fill="none" stroke={C.grey} strokeWidth="1" />
      <rect x="38" y="44" width="6" height="6" rx="1" fill={C.grey} opacity="0.3" />
      <rect x="47" y="44" width="6" height="6" rx="1" fill={C.grey} opacity="0.3" />
      <rect x="56" y="44" width="6" height="6" rx="1" fill={C.grey} opacity="0.3" />
    </PatchBase>
  ),

  // ═══════════════════════════════════════
  // NEW UNCOMMON MEDALS (10)
  // ═══════════════════════════════════════
  'Void Reaper': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <path d="M50,24 L54,40 L68,34 L58,46 L72,50 L58,54 L68,66 L54,60 L50,76 L46,60 L32,66 L42,54 L28,50 L42,46 L32,34 L46,40 Z" fill={C.grn} opacity="0.1" stroke={C.grn} strokeWidth="1.5" />
      <circle cx="50" cy="50" r="8" fill="none" stroke={C.grn} strokeWidth="2" />
      <text x="50" y="54" textAnchor="middle" fill={C.grn} fontSize="10" fontWeight="700" fontFamily="monospace">100</text>
    </PatchBase>
  ),
  'Iron Convoy': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <rect x="28" y="40" width="14" height="10" rx="2" fill={C.grn} opacity="0.2" stroke={C.grn} strokeWidth="1.2" />
      <rect x="43" y="40" width="14" height="10" rx="2" fill={C.grn} opacity="0.2" stroke={C.grn} strokeWidth="1.2" />
      <rect x="58" y="40" width="14" height="10" rx="2" fill={C.grn} opacity="0.2" stroke={C.grn} strokeWidth="1.2" />
      <line x1="28" y1="56" x2="72" y2="56" stroke={C.grn} strokeWidth="1.5" />
      <polygon points="72,56 68,52 68,60" fill={C.grn} />
      <path d="M36,36 L50,28 L64,36" fill="none" stroke={C.grn} strokeWidth="1" strokeDasharray="2,2" />
    </PatchBase>
  ),
  'Quantum Ace': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <circle cx="50" cy="50" r="16" fill="none" stroke={C.grn} strokeWidth="1" />
      <ellipse cx="50" cy="50" rx="16" ry="8" fill="none" stroke={C.grn} strokeWidth="1.5" transform="rotate(30,50,50)" />
      <ellipse cx="50" cy="50" rx="16" ry="8" fill="none" stroke={C.grn} strokeWidth="1.5" transform="rotate(-30,50,50)" />
      <circle cx="50" cy="50" r="4" fill={C.grn} />
    </PatchBase>
  ),
  'Shield Wall': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <path d="M50,26 L68,36 L68,56 Q68,70 50,76 Q32,70 32,56 L32,36 Z" fill={C.grn} opacity="0.1" stroke={C.grn} strokeWidth="2" />
      <path d="M50,36 L60,42 L60,54 Q60,62 50,66 Q40,62 40,54 L40,42 Z" fill="none" stroke={C.grn} strokeWidth="1" />
      <line x1="50" y1="36" x2="50" y2="66" stroke={C.grn} strokeWidth="1" opacity="0.5" />
    </PatchBase>
  ),
  'Signal Ghost': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <circle cx="50" cy="50" r="6" fill={C.grn} opacity="0.3" />
      <circle cx="50" cy="50" r="12" fill="none" stroke={C.grn} strokeWidth="1" opacity="0.7" strokeDasharray="4,3" />
      <circle cx="50" cy="50" r="18" fill="none" stroke={C.grn} strokeWidth="0.8" opacity="0.4" strokeDasharray="4,3" />
      <line x1="50" y1="28" x2="50" y2="22" stroke={C.grn} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="46" y1="24" x2="50" y2="20" stroke={C.grn} strokeWidth="1" strokeLinecap="round" />
      <line x1="54" y1="24" x2="50" y2="20" stroke={C.grn} strokeWidth="1" strokeLinecap="round" />
    </PatchBase>
  ),
  'Ore Hound': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <polygon points="40,36 50,28 60,36 65,50 58,66 42,66 35,50" fill={C.grn} opacity="0.1" stroke={C.grn} strokeWidth="1.5" />
      <polygon points="44,42 50,38 56,42 58,50 54,58 46,58 42,50" fill="none" stroke={C.grn} strokeWidth="1" />
      <circle cx="48" cy="48" r="2" fill={C.grn} opacity="0.6" />
      <circle cx="54" cy="52" r="1.5" fill={C.grn} opacity="0.4" />
      <circle cx="50" cy="55" r="1" fill={C.grn} opacity="0.5" />
    </PatchBase>
  ),
  'Boarding Party': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <rect x="34" y="36" width="32" height="24" rx="3" fill="none" stroke={C.grn} strokeWidth="1.5" />
      <line x1="34" y1="44" x2="66" y2="44" stroke={C.grn} strokeWidth="0.8" />
      <path d="M26,50 L34,50" stroke={C.grn} strokeWidth="3" strokeLinecap="round" />
      <polygon points="26,50 30,46 30,54" fill={C.grn} />
      <circle cx="50" cy="52" r="3" fill="none" stroke={C.grn} strokeWidth="1.5" />
      <line x1="50" y1="49" x2="50" y2="55" stroke={C.grn} strokeWidth="1" />
    </PatchBase>
  ),
  'Night Stalker': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <circle cx="50" cy="40" r="12" fill="none" stroke={C.grn} strokeWidth="1" />
      <circle cx="46" cy="38" r="4" fill={C.grn} opacity="0.2" stroke={C.grn} strokeWidth="1.5" />
      <circle cx="54" cy="38" r="4" fill={C.grn} opacity="0.2" stroke={C.grn} strokeWidth="1.5" />
      <circle cx="46" cy="38" r="1.5" fill={C.grn} />
      <circle cx="54" cy="38" r="1.5" fill={C.grn} />
      <path d="M38,56 L50,64 L62,56" fill="none" stroke={C.grn} strokeWidth="1.5" />
    </PatchBase>
  ),
  'Fleet Anchor': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <line x1="50" y1="26" x2="50" y2="66" stroke={C.grn} strokeWidth="2" />
      <circle cx="50" cy="26" r="4" fill="none" stroke={C.grn} strokeWidth="1.5" />
      <line x1="38" y1="40" x2="62" y2="40" stroke={C.grn} strokeWidth="2" strokeLinecap="round" />
      <path d="M36,60 Q42,68 50,66 Q58,68 64,60" fill="none" stroke={C.grn} strokeWidth="2" strokeLinecap="round" />
    </PatchBase>
  ),
  'Treasury Guard': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <path d="M50,28 L64,36 L64,54 Q64,66 50,70 Q36,66 36,54 L36,36 Z" fill={C.grn} opacity="0.1" stroke={C.grn} strokeWidth="1.5" />
      <text x="50" y="56" textAnchor="middle" fill={C.grn} fontSize="16" fontWeight="700" fontFamily="serif">¤</text>
    </PatchBase>
  ),

  // ═══════════════════════════════════════
  // NEW RARE MEDALS (10)
  // ═══════════════════════════════════════
  'Vanguard': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <polygon points="50,24 66,38 66,58 50,72 34,58 34,38" fill={C.blu} opacity="0.1" stroke={C.blu} strokeWidth="2" />
      <polygon points="50,32 58,40 58,54 50,62 42,54 42,40" fill="none" stroke={C.blu} strokeWidth="1" />
      <polygon points="50,40 54,44 54,50 50,54 46,50 46,44" fill={C.blu} opacity="0.4" />
      <text x="50" y="80" textAnchor="middle" fill={C.blu} fontSize="5" fontFamily="monospace" letterSpacing="1">VANGUARD</text>
    </PatchBase>
  ),
  'Vanduul Slayer': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <path d="M40,30 L50,50 L60,30" fill="none" stroke={C.blu} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="44" y1="38" x2="56" y2="38" stroke={C.blu} strokeWidth="1.5" />
      <circle cx="50" cy="62" r="6" fill="none" stroke={C.blu} strokeWidth="1.5" />
      <line x1="44" y1="62" x2="56" y2="62" stroke={C.blu} strokeWidth="1" />
      <line x1="50" y1="56" x2="50" y2="68" stroke={C.blu} strokeWidth="1" />
    </PatchBase>
  ),
  'Pirate Hunter': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <circle cx="50" cy="44" r="14" fill="none" stroke={C.blu} strokeWidth="1.5" />
      <line x1="36" y1="44" x2="64" y2="44" stroke={C.blu} strokeWidth="1" />
      <line x1="50" y1="30" x2="50" y2="58" stroke={C.blu} strokeWidth="1" />
      <circle cx="50" cy="44" r="4" fill={C.blu} opacity="0.3" />
      <line x1="42" y1="64" x2="58" y2="64" stroke={C.blu} strokeWidth="3" strokeLinecap="round" />
      <line x1="44" y1="70" x2="56" y2="70" stroke={C.blu} strokeWidth="2" strokeLinecap="round" />
    </PatchBase>
  ),
  'Jump Master': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <circle cx="36" cy="50" r="5" fill={C.blu} opacity="0.2" stroke={C.blu} strokeWidth="1.5" />
      <circle cx="50" cy="40" r="5" fill={C.blu} opacity="0.3" stroke={C.blu} strokeWidth="1.5" />
      <circle cx="64" cy="50" r="5" fill={C.blu} opacity="0.2" stroke={C.blu} strokeWidth="1.5" />
      <line x1="41" y1="48" x2="45" y2="43" stroke={C.blu} strokeWidth="1.5" strokeDasharray="2,2" />
      <line x1="55" y1="43" x2="59" y2="48" stroke={C.blu} strokeWidth="1.5" strokeDasharray="2,2" />
      <text x="50" y="68" textAnchor="middle" fill={C.blu} fontSize="6" fontFamily="monospace">QT</text>
    </PatchBase>
  ),
  'War Profiteer': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <polygon points="50,26 58,42 72,42 62,52 66,68 50,58 34,68 38,52 28,42 42,42" fill={C.blu} opacity="0.1" stroke={C.blu} strokeWidth="1.5" />
      <text x="50" y="54" textAnchor="middle" fill={C.blu} fontSize="14" fontWeight="700" fontFamily="monospace">1M</text>
    </PatchBase>
  ),
  'Capital Crew': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <path d="M30,54 L40,46 L44,38 L50,34 L56,38 L60,46 L70,54" fill={C.blu} opacity="0.1" stroke={C.blu} strokeWidth="2" strokeLinejoin="round" />
      <rect x="38" y="54" width="24" height="10" rx="1" fill="none" stroke={C.blu} strokeWidth="1.5" />
      <line x1="44" y1="56" x2="56" y2="56" stroke={C.blu} strokeWidth="0.8" />
      <line x1="44" y1="60" x2="56" y2="60" stroke={C.blu} strokeWidth="0.8" />
      <circle cx="50" cy="42" r="3" fill={C.blu} opacity="0.5" />
    </PatchBase>
  ),
  'Siege Breaker': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <rect x="36" y="34" width="28" height="28" rx="3" fill="none" stroke={C.blu} strokeWidth="1.5" />
      <line x1="50" y1="34" x2="50" y2="62" stroke={C.blu} strokeWidth="1" opacity="0.4" />
      <line x1="36" y1="48" x2="64" y2="48" stroke={C.blu} strokeWidth="1" opacity="0.4" />
      <path d="M28,48 L36,48" stroke={C.blu} strokeWidth="3" strokeLinecap="round" />
      <polygon points="24,48 28,44 28,52" fill={C.blu} />
      <path d="M44,44 L56,56" stroke={C.red} strokeWidth="2" strokeLinecap="round" />
      <path d="M56,44 L44,56" stroke={C.red} strokeWidth="2" strokeLinecap="round" />
    </PatchBase>
  ),
  'Silent Running': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <path d="M50,30 L60,44 L50,40 L40,44 Z" fill="none" stroke={C.blu} strokeWidth="1" strokeDasharray="3,3" />
      <line x1="50" y1="40" x2="50" y2="62" stroke={C.blu} strokeWidth="1" strokeDasharray="3,3" />
      <circle cx="50" cy="50" r="14" fill="none" stroke={C.blu} strokeWidth="0.8" opacity="0.3" />
      <path d="M36,68 Q50,58 64,68" fill="none" stroke={C.blu} strokeWidth="1.5" opacity="0.5" />
      <text x="50" y="78" textAnchor="middle" fill={C.blu} fontSize="5" fontFamily="monospace" opacity="0.6">SILENT</text>
    </PatchBase>
  ),
  'Stanton Cartographer': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <circle cx="50" cy="48" r="16" fill="none" stroke={C.blu} strokeWidth="1.5" />
      <ellipse cx="50" cy="48" rx="16" ry="6" fill="none" stroke={C.blu} strokeWidth="0.8" />
      <ellipse cx="50" cy="48" rx="6" ry="16" fill="none" stroke={C.blu} strokeWidth="0.8" />
      <circle cx="50" cy="48" r="2" fill={C.blu} />
      <circle cx="40" cy="42" r="1.5" fill={C.blu} opacity="0.5" />
      <circle cx="58" cy="52" r="1.5" fill={C.blu} opacity="0.5" />
      <circle cx="52" cy="36" r="1" fill={C.blu} opacity="0.4" />
    </PatchBase>
  ),
  'Blood Diamond': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <polygon points="50,28 66,48 50,68 34,48" fill={C.blu} opacity="0.1" stroke={C.blu} strokeWidth="2" />
      <polygon points="50,36 58,48 50,60 42,48" fill="none" stroke={C.blu} strokeWidth="1" />
      <line x1="34" y1="48" x2="66" y2="48" stroke={C.blu} strokeWidth="0.8" />
      <circle cx="50" cy="48" r="3" fill={C.red} opacity="0.6" />
    </PatchBase>
  ),

  // ═══════════════════════════════════════
  // NEW LEGENDARY MEDALS (5)
  // ═══════════════════════════════════════
  'Ace of Aces': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <polygon points="50,20 56,38 74,38 60,50 65,68 50,56 35,68 40,50 26,38 44,38" fill={C.gld} opacity="0.15" stroke={C.gld} strokeWidth="2" />
      <polygon points="50,30 54,40 62,40 56,46 58,54 50,50 42,54 44,46 38,40 46,40" fill={C.gld} opacity="0.3" />
      <circle cx="50" cy="44" r="4" fill={C.gld} />
      <text x="50" y="80" textAnchor="middle" fill={C.gld} fontSize="5" fontFamily="monospace" letterSpacing="1">ACE</text>
    </PatchBase>
  ),
  'Fleet Admiral': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <polygon points="50,22 58,34 58,50 50,58 42,50 42,34" fill={C.gld} opacity="0.1" stroke={C.gld} strokeWidth="2" />
      <line x1="42" y1="40" x2="58" y2="40" stroke={C.gld} strokeWidth="1.5" />
      <line x1="42" y1="46" x2="58" y2="46" stroke={C.gld} strokeWidth="1.5" />
      <polygon points="44,30 50,24 56,30" fill={C.gld} />
      <line x1="32" y1="60" x2="68" y2="60" stroke={C.gld} strokeWidth="1" />
      <line x1="36" y1="64" x2="64" y2="64" stroke={C.gld} strokeWidth="0.8" />
      <line x1="40" y1="68" x2="60" y2="68" stroke={C.gld} strokeWidth="0.6" />
      <text x="50" y="80" textAnchor="middle" fill={C.gld} fontSize="4.5" fontFamily="monospace" letterSpacing="1">ADMIRAL</text>
    </PatchBase>
  ),
  'Bengal Ready': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <path d="M30,52 L38,48 L42,40 L50,32 L58,40 L62,48 L70,52" fill={C.gld} opacity="0.15" stroke={C.gld} strokeWidth="2" strokeLinejoin="round" />
      <rect x="36" y="52" width="28" height="8" rx="1" fill={C.gld} opacity="0.1" stroke={C.gld} strokeWidth="1.5" />
      <line x1="40" y1="54" x2="60" y2="54" stroke={C.gld} strokeWidth="0.8" />
      <line x1="42" y1="57" x2="58" y2="57" stroke={C.gld} strokeWidth="0.5" />
      <path d="M44,64 L50,68 L56,64" fill="none" stroke={C.gld} strokeWidth="1.5" />
      <polyline points="42,42 50,38 58,42" fill="none" stroke={C.gld} strokeWidth="1.5" />
      <circle cx="50" cy="44" r="2" fill={C.gld} />
      <text x="50" y="80" textAnchor="middle" fill={C.gld} fontSize="4.5" fontFamily="monospace" letterSpacing="1">BENGAL</text>
    </PatchBase>
  ),
  "Stanton's Shadow": ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <circle cx="50" cy="46" r="16" fill="none" stroke={C.gld} strokeWidth="1" />
      <circle cx="50" cy="46" r="10" fill="none" stroke={C.gld} strokeWidth="1.5" strokeDasharray="4,3" />
      <circle cx="50" cy="46" r="4" fill={C.gld} />
      <line x1="50" y1="28" x2="50" y2="22" stroke={C.gld} strokeWidth="1.5" />
      <line x1="46" y1="24" x2="50" y2="18" stroke={C.gld} strokeWidth="1" />
      <line x1="54" y1="24" x2="50" y2="18" stroke={C.gld} strokeWidth="1" />
      <path d="M34,66 Q50,74 66,66" fill="none" stroke={C.gld} strokeWidth="1" />
      <text x="50" y="80" textAnchor="middle" fill={C.gld} fontSize="4.5" fontFamily="monospace" letterSpacing="1">SHADOW</text>
    </PatchBase>
  ),
  'Kingmaker': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <polygon points="42,34 50,24 58,34" fill={C.gld} />
      <polygon points="38,40 50,28 62,40" fill="none" stroke={C.gld} strokeWidth="1.5" />
      <circle cx="42" cy="54" r="5" fill="none" stroke={C.gld} strokeWidth="1.2" />
      <circle cx="50" cy="50" r="5" fill="none" stroke={C.gld} strokeWidth="1.2" />
      <circle cx="58" cy="54" r="5" fill="none" stroke={C.gld} strokeWidth="1.2" />
      <line x1="42" y1="62" x2="42" y2="68" stroke={C.gld} strokeWidth="1" />
      <line x1="50" y1="58" x2="50" y2="68" stroke={C.gld} strokeWidth="1" />
      <line x1="58" y1="62" x2="58" y2="68" stroke={C.gld} strokeWidth="1" />
      <text x="50" y="80" textAnchor="middle" fill={C.gld} fontSize="4" fontFamily="monospace" letterSpacing="1">KINGMAKER</text>
    </PatchBase>
  ),
}

function DefaultPatch({ size, rarity }) {
  return (
    <PatchBase rarity={rarity} size={size}>
      <polygon points="50,32 58,44 58,56 50,68 42,56 42,44" fill="none" stroke={C.grey} strokeWidth="1.5" />
      <circle cx="50" cy="50" r="4" fill={C.grey} />
    </PatchBase>
  )
}

export default function MedalPatch({ name, rarity = 'COMMON', size = 80 }) {
  const Patch = PATCHES[name]
  if (Patch) return <Patch size={size} rarity={rarity} />
  return <DefaultPatch size={size} rarity={rarity} />
}
