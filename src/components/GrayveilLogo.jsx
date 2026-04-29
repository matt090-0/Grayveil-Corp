// Blacksteel Aerospace mark — military trident inscribed in a hex plate.
// Three-pronged blade with a signal-orange power core at the cross-guard,
// banded tactical haft, swept aerospace fins, and a pommel diamond.
// Renders crisp at any size; no external assets.
export default function GrayveilLogo({ size = 32 }) {
  const id = 'gv-' + Math.random().toString(36).slice(2, 7)
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${id}-steel`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"  stopColor="#f4f6fa" />
          <stop offset="35%" stopColor="#c8cfdb" />
          <stop offset="70%" stopColor="#7d8696" />
          <stop offset="100%" stopColor="#3a4150" />
        </linearGradient>
        <linearGradient id={`${id}-blade`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"  stopColor="#f4f6fa" />
          <stop offset="55%" stopColor="#9aa3b3" />
          <stop offset="100%" stopColor="#4a5160" />
        </linearGradient>
        <linearGradient id={`${id}-plate`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"  stopColor="#1a1f2a" />
          <stop offset="100%" stopColor="#06080b" />
        </linearGradient>
        <radialGradient id={`${id}-core`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#fff5e8" />
          <stop offset="35%"  stopColor="#ff8a4a" />
          <stop offset="100%" stopColor="#b8430f" />
        </radialGradient>
      </defs>

      {/* Hex plate */}
      <polygon
        points="50,4 91,27 91,73 50,96 9,73 9,27"
        fill={`url(#${id}-plate)`}
        stroke={`url(#${id}-steel)`}
        strokeWidth="2"
        strokeLinejoin="miter"
      />

      {/* Inner technical hairline */}
      <polygon
        points="50,12 84,30 84,70 50,88 16,70 16,30"
        fill="none"
        stroke="#c8cfdb"
        strokeWidth="0.5"
        opacity="0.25"
      />

      {/* ═══ TRIDENT ═══ */}

      {/* Center blade — tallest, double-edged spear */}
      <path
        d="M 50 11 L 54 22 L 54 44 L 50 47 L 46 44 L 46 22 Z"
        fill={`url(#${id}-blade)`}
        stroke="#1a1f2a"
        strokeWidth="0.4"
        strokeLinejoin="miter"
      />
      {/* Center blade fuller (groove) */}
      <line x1="50" y1="16" x2="50" y2="42" stroke="#1a1f2a" strokeWidth="0.4" opacity="0.6" />

      {/* Left blade — angled outward at tip, hooks back to crossbar */}
      <path
        d="M 26 17 L 33 22 L 41 44 L 38 47 L 34 45 L 28 32 Z"
        fill={`url(#${id}-blade)`}
        stroke="#1a1f2a"
        strokeWidth="0.4"
        strokeLinejoin="miter"
      />
      {/* Left blade fuller */}
      <line x1="30" y1="22" x2="38" y2="44" stroke="#1a1f2a" strokeWidth="0.35" opacity="0.55" />

      {/* Right blade — mirror */}
      <path
        d="M 74 17 L 67 22 L 59 44 L 62 47 L 66 45 L 72 32 Z"
        fill={`url(#${id}-blade)`}
        stroke="#1a1f2a"
        strokeWidth="0.4"
        strokeLinejoin="miter"
      />
      {/* Right blade fuller */}
      <line x1="70" y1="22" x2="62" y2="44" stroke="#1a1f2a" strokeWidth="0.35" opacity="0.55" />

      {/* Cross-guard — horizontal binding bar */}
      <rect x="22" y="46" width="56" height="6" fill={`url(#${id}-steel)`} stroke="#1a1f2a" strokeWidth="0.4" />
      {/* Cross-guard top bevel */}
      <rect x="22" y="46" width="56" height="1.4" fill="#f4f6fa" opacity="0.55" />
      {/* Cross-guard end caps */}
      <rect x="22" y="46" width="2.5" height="6" fill="#3a4150" />
      <rect x="75.5" y="46" width="2.5" height="6" fill="#3a4150" />

      {/* Power core — signal-orange gem, the brand accent */}
      <circle cx="50" cy="49" r="3.4" fill={`url(#${id}-core)`} stroke="#1a1f2a" strokeWidth="0.4" />
      <circle cx="50" cy="49" r="3.4" fill="none" stroke="#ff6a1f" strokeWidth="0.5" opacity="0.5">
        <animate attributeName="opacity" values="0.25;0.7;0.25" dur="2.4s" repeatCount="indefinite" />
      </circle>
      {/* Core specular highlight */}
      <circle cx="48.5" cy="47.6" r="0.9" fill="#fff5e8" opacity="0.85" />

      {/* Swept aerospace fins — flank the upper haft */}
      <path d="M 47 54 L 33 58 L 38 62 L 47 60 Z" fill={`url(#${id}-blade)`} stroke="#1a1f2a" strokeWidth="0.35" opacity="0.95" />
      <path d="M 53 54 L 67 58 L 62 62 L 53 60 Z" fill={`url(#${id}-blade)`} stroke="#1a1f2a" strokeWidth="0.35" opacity="0.95" />

      {/* Haft — banded tactical grip */}
      <rect x="47" y="52" width="6" height="30" fill={`url(#${id}-steel)`} stroke="#1a1f2a" strokeWidth="0.4" />
      {/* Grip bands */}
      <rect x="47" y="62" width="6" height="1.4" fill="#1a1f2a" opacity="0.7" />
      <rect x="47" y="68" width="6" height="1.4" fill="#1a1f2a" opacity="0.7" />
      <rect x="47" y="74" width="6" height="1.4" fill="#1a1f2a" opacity="0.7" />

      {/* Pommel — diamond cap */}
      <polygon
        points="50,82 56,86 50,90 44,86"
        fill={`url(#${id}-blade)`}
        stroke="#1a1f2a"
        strokeWidth="0.4"
        strokeLinejoin="miter"
      />
      <line x1="50" y1="82" x2="50" y2="90" stroke="#1a1f2a" strokeWidth="0.3" opacity="0.55" />

      {/* Blade-tip signal-orange heat marks (subtle) */}
      <line x1="50" y1="11" x2="50" y2="14" stroke="#ff6a1f" strokeWidth="0.9" />
      <line x1="26" y1="17" x2="28" y2="20" stroke="#ff6a1f" strokeWidth="0.7" opacity="0.85" />
      <line x1="74" y1="17" x2="72" y2="20" stroke="#ff6a1f" strokeWidth="0.7" opacity="0.85" />

      {/* Registration ticks */}
      <path d="M 16 18 L 22 18 M 16 18 L 16 24" stroke="#c8cfdb" strokeWidth="0.6" opacity="0.45" fill="none" />
      <path d="M 84 82 L 78 82 M 84 82 L 84 76" stroke="#c8cfdb" strokeWidth="0.6" opacity="0.45" fill="none" />
    </svg>
  )
}
