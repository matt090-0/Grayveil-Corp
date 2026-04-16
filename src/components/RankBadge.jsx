import { getRankByTier } from '../lib/ranks'

const TIER_STYLES = {
  1: { bg: 'linear-gradient(180deg, #ffffff 0%, #d4d8e0 60%, #8a8f9c 100%)', fg: '#0a0b0f', border: '#d4d8e0' },
  2: { bg: 'linear-gradient(180deg, #e8ecf2 0%, #b8bcc8 100%)', fg: '#0a0b0f', border: '#b8bcc8' },
  3: { bg: 'rgba(139,111,199,0.15)', fg: '#b090e0', border: 'rgba(139,111,199,0.35)' },
  4: { bg: 'rgba(74,144,217,0.15)', fg: '#6aa8e8', border: 'rgba(74,144,217,0.35)' },
  5: { bg: 'rgba(77,184,112,0.15)', fg: '#6ac880', border: 'rgba(77,184,112,0.35)' },
  6: { bg: 'rgba(212,148,58,0.15)', fg: '#d8a850', border: 'rgba(212,148,58,0.35)' },
  7: { bg: 'rgba(138,143,156,0.15)', fg: '#a8afbc', border: 'rgba(138,143,156,0.35)' },
  8: { bg: 'rgba(138,143,156,0.08)', fg: '#8a8f9c', border: 'rgba(138,143,156,0.2)' },
  9: { bg: 'rgba(74,79,92,0.15)', fg: '#6a7280', border: 'rgba(74,79,92,0.3)' },
}

export default function RankBadge({ tier }) {
  const rank = getRankByTier(tier)
  if (!rank) return null
  const s = TIER_STYLES[tier] || TIER_STYLES[9]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 600, letterSpacing: '.08em',
      background: s.bg, color: s.fg,
      border: `1px solid ${s.border}`, borderRadius: 4,
      padding: '2px 8px', fontFamily: 'JetBrains Mono, monospace',
      whiteSpace: 'nowrap',
    }}>
      T{tier} · {rank.label}
    </span>
  )
}
