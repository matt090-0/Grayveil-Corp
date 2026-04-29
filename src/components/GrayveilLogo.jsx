// Blacksteel Aerospace mark — hex frame + machined chevron + signal-orange
// status bar. Renders crisp at any size; no external assets.
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
      </defs>

      {/* Hex plate */}
      <polygon
        points="50,4 91,27 91,73 50,96 9,73 9,27"
        fill={`url(#${id}-plate)`}
        stroke={`url(#${id}-steel)`}
        strokeWidth="2"
        strokeLinejoin="miter"
      />

      {/* Inner cut-line (technical drawing feel) */}
      <polygon
        points="50,14 83,32 83,68 50,86 17,68 17,32"
        fill="none"
        stroke="#c8cfdb"
        strokeWidth="0.6"
        opacity="0.35"
      />

      {/* Stacked chevrons — wing/lift mark */}
      <path
        d="M 27 60 L 50 36 L 73 60 L 65 60 L 50 45 L 35 60 Z"
        fill={`url(#${id}-steel)`}
      />
      <path
        d="M 36 70 L 50 56 L 64 70 L 58 70 L 50 62 L 42 70 Z"
        fill={`url(#${id}-steel)`}
        opacity="0.7"
      />

      {/* Signal-orange status bar */}
      <rect x="38" y="78" width="24" height="2.4" fill="#ff6a1f" />
      <rect x="38" y="78" width="24" height="2.4" fill="#ff6a1f" opacity="0.4">
        <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2.6s" repeatCount="indefinite" />
      </rect>
    </svg>
  )
}
