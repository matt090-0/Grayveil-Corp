export default function GrayveilLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gv-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e0c070"/>
          <stop offset="50%" stopColor="#c8a55a"/>
          <stop offset="100%" stopColor="#a08040"/>
        </linearGradient>
        <linearGradient id="gv-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1a22"/>
          <stop offset="100%" stopColor="#0e0e14"/>
        </linearGradient>
      </defs>
      <polygon points="256,20 476,140 476,372 256,492 36,372 36,140" fill="url(#gv-dark)" stroke="url(#gv-gold)" strokeWidth="12"/>
      <polygon points="256,52 452,158 452,354 256,460 60,354 60,158" fill="none" stroke="#c8a55a" strokeWidth="2" opacity="0.3"/>
      <path d="M 300,150 L 180,150 C 130,150 100,190 100,240 L 100,280 C 100,330 130,362 180,362 L 300,362 L 300,280 L 210,280 C 195,280 185,270 185,256 L 185,256 C 185,242 195,232 210,232 L 260,232 L 260,280"
        fill="none" stroke="url(#gv-gold)" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="310" y1="120" x2="370" y2="400" stroke="url(#gv-gold)" strokeWidth="16" strokeLinecap="round" opacity="0.9"/>
      <circle cx="395" cy="150" r="8" fill="#c8a55a" opacity="0.6"/>
    </svg>
  )
}
