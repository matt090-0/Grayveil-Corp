// Blacksteel Aerospace mark — a gray veil draped over a space helmet,
// inscribed in a hex plate. The veil is a U-shaped cloth that wraps
// behind/around the helmet; the helmet sits in front with a signal-
// orange visor band as the engagement accent. Renders crisp at any size.
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
        <radialGradient id={`${id}-dome`} cx="40%" cy="35%" r="65%">
          <stop offset="0%"  stopColor="#f4f6fa" />
          <stop offset="55%" stopColor="#9aa3b3" />
          <stop offset="100%" stopColor="#3a4150" />
        </radialGradient>
        <linearGradient id={`${id}-veil`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"  stopColor="#a8b1c0" />
          <stop offset="55%" stopColor="#5a6272" />
          <stop offset="100%" stopColor="#2a2f3a" />
        </linearGradient>
        <linearGradient id={`${id}-visor`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#ff8a4a" />
          <stop offset="50%"  stopColor="#ff6a1f" />
          <stop offset="100%" stopColor="#b8430f" />
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
        opacity="0.25"
      />

      {/* VEIL — U-shaped cloth, behind the helmet, two falling flaps */}
      <path
        d="M 50 18
           C 32 18, 22 28, 20 44
           C 18 60, 18 70, 22 78
           L 34 78
           C 36 70, 38 60, 40 50
           C 40 40, 44 32, 50 30
           C 56 32, 60 40, 60 50
           C 62 60, 64 70, 66 78
           L 78 78
           C 82 70, 82 60, 80 44
           C 78 28, 68 18, 50 18 Z"
        fill={`url(#${id}-veil)`}
        stroke="#1a1f2a"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />

      {/* Cloth fold lines — subtle vertical creases for cloth texture */}
      <path d="M 28 32 Q 25 56, 30 74" fill="none" stroke="#1a1f2a" strokeWidth="0.4" opacity="0.55" />
      <path d="M 72 32 Q 75 56, 70 74" fill="none" stroke="#1a1f2a" strokeWidth="0.4" opacity="0.55" />
      <path d="M 50 18 L 50 30" stroke="#1a1f2a" strokeWidth="0.4" opacity="0.45" />

      {/* HELMET — sits in front of the veil */}
      {/* Neck collar / torso suggestion peeking below dome */}
      <rect x="42" y="72" width="16" height="4" fill="#5a6272" stroke="#1a1f2a" strokeWidth="0.3" />
      <line x1="42" y1="73.5" x2="58" y2="73.5" stroke="#1a1f2a" strokeWidth="0.3" opacity="0.7" />

      {/* Dome */}
      <circle cx="50" cy="54" r="18" fill={`url(#${id}-dome)`} stroke="#1a1f2a" strokeWidth="0.6" />

      {/* Dome polish highlight (top-left specular) */}
      <ellipse cx="44" cy="47" rx="5.5" ry="3.2" fill="#f4f6fa" opacity="0.45" />

      {/* Visor band — signal orange */}
      <path
        d="M 34 53 Q 50 47, 66 53 L 66 60 Q 50 66, 34 60 Z"
        fill={`url(#${id}-visor)`}
        stroke="#1a1f2a"
        strokeWidth="0.3"
      />
      {/* Visor inner highlight */}
      <path d="M 36 54.6 Q 50 50.4, 64 54.6" fill="none" stroke="#ffd0a8" strokeWidth="0.5" opacity="0.75" />

      {/* Visor pulse — quiet life signal */}
      <rect x="34" y="53" width="32" height="13" fill="#ff6a1f" opacity="0.18" rx="1">
        <animate attributeName="opacity" values="0.05;0.28;0.05" dur="2.8s" repeatCount="indefinite" />
      </rect>

      {/* Registration ticks (top-left, bottom-right) */}
      <path d="M 16 18 L 22 18 M 16 18 L 16 24" stroke="#c8cfdb" strokeWidth="0.6" opacity="0.45" fill="none" />
      <path d="M 84 82 L 78 82 M 84 82 L 84 76" stroke="#c8cfdb" strokeWidth="0.6" opacity="0.45" fill="none" />
    </svg>
  )
}
