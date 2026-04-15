// Military-style SVG patches for Grayveil commendations
// Each medal gets a unique geometric design on a hex/shield base

const RARITY_COLORS = {
  COMMON:    { border: '#555566', glow: '#44445a' },
  UNCOMMON:  { border: '#4a9060', glow: '#2a5038' },
  RARE:      { border: '#4a7ad9', glow: '#283f6a' },
  LEGENDARY: { border: '#d4af6e', glow: '#5a4520' },
}

function PatchBase({ rarity = 'COMMON', children, size = 80 }) {
  const c = RARITY_COLORS[rarity] || RARITY_COLORS.COMMON
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* Outer glow */}
      <polygon points="50,4 93,27 93,73 50,96 7,73 7,27" fill={c.glow} stroke={c.border} strokeWidth="2.5" />
      {/* Inner dark */}
      <polygon points="50,12 85,31 85,69 50,88 15,69 15,31" fill="#0e0e16" stroke={c.border} strokeWidth="0.5" opacity="0.6" />
      {/* Content */}
      {children}
    </svg>
  )
}

const PATCHES = {
  'First Blood': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <line x1="35" y1="35" x2="65" y2="65" stroke="#c83030" strokeWidth="5" strokeLinecap="round" />
      <line x1="65" y1="35" x2="35" y2="65" stroke="#c83030" strokeWidth="5" strokeLinecap="round" />
      <circle cx="50" cy="50" r="8" fill="none" stroke="#e04040" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="3" fill="#e04040" />
    </PatchBase>
  ),

  'Centurion': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <polygon points="50,22 58,40 78,40 62,52 68,70 50,60 32,70 38,52 22,40 42,40" fill="none" stroke="#4a7ad9" strokeWidth="2" />
      <text x="50" y="56" textAnchor="middle" fill="#4a7ad9" fontSize="14" fontWeight="700" fontFamily="monospace">100</text>
    </PatchBase>
  ),

  'Fleet Commander': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <path d="M50,28 L65,45 L50,40 L35,45 Z" fill="#4a9060" stroke="#5ab870" strokeWidth="1" />
      <line x1="50" y1="40" x2="50" y2="72" stroke="#5ab870" strokeWidth="2" />
      <line x1="35" y1="55" x2="65" y2="55" stroke="#5ab870" strokeWidth="1.5" />
      <line x1="38" y1="62" x2="62" y2="62" stroke="#5ab870" strokeWidth="1" />
      <circle cx="50" cy="72" r="3" fill="#5ab870" />
    </PatchBase>
  ),

  'Founding Member': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <polygon points="50,25 56,43 75,43 60,54 65,72 50,62 35,72 40,54 25,43 44,43" fill="#d4af6e" opacity="0.15" stroke="#d4af6e" strokeWidth="1.5" />
      <polygon points="50,33 54,43 63,43 56,49 58,59 50,54 42,59 44,49 37,43 46,43" fill="#d4af6e" />
      <text x="50" y="80" textAnchor="middle" fill="#d4af6e" fontSize="7" fontFamily="monospace" letterSpacing="2">FOUNDER</text>
    </PatchBase>
  ),

  'Iron Hauler': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <rect x="35" y="38" width="30" height="22" rx="2" fill="none" stroke="#8888a0" strokeWidth="2" />
      <line x1="35" y1="45" x2="65" y2="45" stroke="#8888a0" strokeWidth="1" />
      <rect x="42" y="30" width="16" height="10" rx="1" fill="none" stroke="#8888a0" strokeWidth="1.5" />
      <text x="50" y="55" textAnchor="middle" fill="#aaaabc" fontSize="8" fontFamily="monospace">SCU</text>
      <line x1="38" y1="65" x2="42" y2="65" stroke="#8888a0" strokeWidth="2" strokeLinecap="round" />
      <line x1="58" y1="65" x2="62" y2="65" stroke="#8888a0" strokeWidth="2" strokeLinecap="round" />
    </PatchBase>
  ),

  'Deep Scanner': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <circle cx="50" cy="48" r="18" fill="none" stroke="#4a9060" strokeWidth="1.5" />
      <circle cx="50" cy="48" r="12" fill="none" stroke="#4a9060" strokeWidth="1" opacity="0.6" />
      <circle cx="50" cy="48" r="6" fill="none" stroke="#4a9060" strokeWidth="0.8" opacity="0.4" />
      <line x1="50" y1="30" x2="50" y2="66" stroke="#4a9060" strokeWidth="0.5" opacity="0.4" />
      <line x1="32" y1="48" x2="68" y2="48" stroke="#4a9060" strokeWidth="0.5" opacity="0.4" />
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
      <line x1="28" y1="50" x2="72" y2="50" stroke="#666680" strokeWidth="0.5" opacity="0.3" />
    </PatchBase>
  ),

  'Moneybags': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <circle cx="50" cy="50" r="16" fill="none" stroke="#d4af6e" strokeWidth="2" />
      <text x="50" y="56" textAnchor="middle" fill="#d4af6e" fontSize="20" fontWeight="700" fontFamily="serif">¤</text>
      <line x1="40" y1="32" x2="60" y2="32" stroke="#d4af6e" strokeWidth="1" opacity="0.4" />
      <line x1="38" y1="68" x2="62" y2="68" stroke="#d4af6e" strokeWidth="1" opacity="0.4" />
    </PatchBase>
  ),

  'Pathfinder': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <circle cx="50" cy="50" r="14" fill="none" stroke="#8888a0" strokeWidth="1.5" />
      <line x1="50" y1="36" x2="50" y2="34" stroke="#aaaabc" strokeWidth="2" strokeLinecap="round" />
      <line x1="50" y1="64" x2="50" y2="66" stroke="#8888a0" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="36" y1="50" x2="34" y2="50" stroke="#8888a0" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="64" y1="50" x2="66" y2="50" stroke="#8888a0" strokeWidth="1.5" strokeLinecap="round" />
      <polygon points="50,38 54,48 50,46 46,48" fill="#c83030" />
      <circle cx="50" cy="50" r="2" fill="#aaaabc" />
    </PatchBase>
  ),

  'Combat Medic': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <rect x="46" y="34" width="8" height="28" rx="1" fill="#c83030" />
      <rect x="36" y="44" width="28" height="8" rx="1" fill="#c83030" />
      <circle cx="50" cy="48" r="18" fill="none" stroke="#c83030" strokeWidth="1" opacity="0.4" />
    </PatchBase>
  ),

  'Ace Pilot': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <path d="M50,30 L56,44 L72,44 L60,54 L64,68 L50,58 L36,68 L40,54 L28,44 L44,44 Z" fill="none" stroke="#4a7ad9" strokeWidth="2" />
      <path d="M38,56 L30,62" stroke="#4a7ad9" strokeWidth="2" strokeLinecap="round" />
      <path d="M62,56 L70,62" stroke="#4a7ad9" strokeWidth="2" strokeLinecap="round" />
      <circle cx="50" cy="48" r="4" fill="#4a7ad9" />
    </PatchBase>
  ),

  'Loan Shark': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <path d="M35,50 Q42,35 50,42 Q58,35 65,50 Q58,65 50,58 Q42,65 35,50" fill="none" stroke="#8888a0" strokeWidth="1.5" />
      <polygon points="46,46 50,38 54,46" fill="#aaaabc" />
      <polygon points="46,54 50,62 54,54" fill="#aaaabc" />
      <circle cx="44" cy="48" r="1.5" fill="#aaaabc" />
      <circle cx="56" cy="48" r="1.5" fill="#aaaabc" />
    </PatchBase>
  ),

  'Recruiter': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <circle cx="42" cy="42" r="7" fill="none" stroke="#4a9060" strokeWidth="1.5" />
      <circle cx="58" cy="42" r="7" fill="none" stroke="#4a9060" strokeWidth="1.5" />
      <circle cx="50" cy="56" r="7" fill="none" stroke="#5ab870" strokeWidth="2" />
      <line x1="50" y1="63" x2="50" y2="70" stroke="#5ab870" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="46" y1="67" x2="54" y2="67" stroke="#5ab870" strokeWidth="1.5" strokeLinecap="round" />
    </PatchBase>
  ),

  'Survivor': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <path d="M40,65 L45,40 L50,55 L55,35 L60,65" fill="none" stroke="#c87030" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="50" cy="30" r="4" fill="#c87030" opacity="0.6" />
      <line x1="35" y1="68" x2="65" y2="68" stroke="#c87030" strokeWidth="1" opacity="0.4" />
    </PatchBase>
  ),

  "Architect's Hand": ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      <polygon points="50,24 62,34 62,54 50,64 38,54 38,34" fill="#d4af6e" opacity="0.1" stroke="#d4af6e" strokeWidth="2" />
      <polygon points="50,32 56,38 56,50 50,56 44,50 44,38" fill="none" stroke="#d4af6e" strokeWidth="1" />
      <circle cx="50" cy="44" r="5" fill="#d4af6e" />
      <line x1="50" y1="64" x2="50" y2="76" stroke="#d4af6e" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="44" y1="72" x2="56" y2="72" stroke="#d4af6e" strokeWidth="1" />
      <text x="50" y="82" textAnchor="middle" fill="#d4af6e" fontSize="5" fontFamily="monospace" letterSpacing="1">ARCHITECT</text>
    </PatchBase>
  ),

  'Sovereign Backer': ({ size, rarity }) => (
    <PatchBase rarity={rarity} size={size}>
      {/* Bengal carrier silhouette */}
      <path d="M30,52 L38,48 L40,42 L46,40 L50,32 L54,40 L60,42 L62,48 L70,52" fill="#d4af6e" opacity="0.15" stroke="#d4af6e" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Hull body */}
      <rect x="36" y="52" width="28" height="8" rx="1" fill="#d4af6e" opacity="0.2" stroke="#d4af6e" strokeWidth="1" />
      {/* Flight deck lines */}
      <line x1="40" y1="54" x2="60" y2="54" stroke="#d4af6e" strokeWidth="0.5" opacity="0.6" />
      <line x1="42" y1="57" x2="58" y2="57" stroke="#d4af6e" strokeWidth="0.5" opacity="0.4" />
      {/* Crown above */}
      <polygon points="44,28 47,24 50,26 53,24 56,28" fill="#d4af6e" stroke="#d4af6e" strokeWidth="0.8" />
      {/* Hangar bays */}
      <rect x="42" y="60" width="4" height="3" rx="0.5" fill="#d4af6e" opacity="0.5" />
      <rect x="54" y="60" width="4" height="3" rx="0.5" fill="#d4af6e" opacity="0.5" />
      {/* Text */}
      <text x="50" y="76" textAnchor="middle" fill="#d4af6e" fontSize="4.5" fontFamily="monospace" letterSpacing="1">SOVEREIGN</text>
    </PatchBase>
  ),
}

// Fallback for medals not in the list
function DefaultPatch({ size, rarity }) {
  return (
    <PatchBase rarity={rarity} size={size}>
      <polygon points="50,32 58,44 58,56 50,68 42,56 42,44" fill="none" stroke="#8888a0" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="4" fill="#8888a0" />
    </PatchBase>
  )
}

export default function MedalPatch({ name, rarity = 'COMMON', size = 80 }) {
  const Patch = PATCHES[name]
  if (Patch) return <Patch size={size} rarity={rarity} />
  return <DefaultPatch size={size} rarity={rarity} />
}
