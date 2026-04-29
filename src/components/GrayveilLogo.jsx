// Blacksteel Aerospace mark — hex plate + stealth-wing delta with a
// signal-orange leading-edge vector. Registration ticks at opposing
// corners read as classification chrome. Renders crisp at any size.
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
        <linearGradient id={`${id}-plate`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"  stopColor="#1a1f2a" />
          <stop offset="100%" stopColor="#06080b" />
        </linearGradient>
        <linearGradient id={`${id}-wing`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"  stopColor="#e8ecf4" />
          <stop offset="55%" stopColor="#9aa3b3" />
          <stop offset="100%" stopColor="#4a5160" />
        </linearGradient>
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
        opacity="0.28"
      />

      {/* Stealth-wing delta — flying-wing silhouette */}
      <path
        d="M 50 28
           L 82 60
           L 68 64
           L 60 56
           L 60 70
           L 40 70
           L 40 56
           L 32 64
           L 18 60 Z"
        fill={`url(#${id}-wing)`}
        stroke="#3a4150"
        strokeWidth="0.4"
        strokeLinejoin="miter"
      />

      {/* Centerline facet — adds the swept-wing crease */}
      <line x1="50" y1="28" x2="50" y2="70" stroke="#3a4150" strokeWidth="0.5" opacity="0.6" />

      {/* Signal-orange leading-edge vector */}
      <polyline
        points="18,60 50,28 82,60"
        fill="none"
        stroke="#ff6a1f"
        strokeWidth="1.6"
        strokeLinejoin="miter"
        strokeLinecap="square"
      />

      {/* Pulse on the apex marker */}
      <circle cx="50" cy="28" r="1.6" fill="#ff6a1f">
        <animate attributeName="opacity" values="0.45;1;0.45" dur="2.4s" repeatCount="indefinite" />
      </circle>

      {/* Registration ticks (top-left, bottom-right) */}
      <path d="M 16 18 L 22 18 M 16 18 L 16 24" stroke="#c8cfdb" strokeWidth="0.6" opacity="0.45" fill="none" />
      <path d="M 84 82 L 78 82 M 84 82 L 84 76" stroke="#c8cfdb" strokeWidth="0.6" opacity="0.45" fill="none" />
    </svg>
  )
}
