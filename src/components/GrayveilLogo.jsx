export default function GrayveilLogo({ size = 32 }) {
  const id = 'gv-' + Math.random().toString(36).slice(2, 7)
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#e8ecf2" />
          <stop offset="65%" stopColor="#a8b0bc" />
          <stop offset="100%" stopColor="#6a7280" />
        </linearGradient>
      </defs>
      {/* Outer V/arrow */}
      <path
        d="M 18 28 L 50 82 L 82 28 L 72 28 L 50 64 L 28 28 Z"
        fill={`url(#${id})`}
        stroke="#d4d8e0"
        strokeWidth="0.5"
      />
      {/* Inner V */}
      <path
        d="M 38 28 L 50 48 L 62 28 L 55 28 L 50 38 L 45 28 Z"
        fill={`url(#${id})`}
        opacity="0.95"
      />
    </svg>
  )
}
