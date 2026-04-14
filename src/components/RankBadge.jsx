import { RANK_BADGES, getRankByTier } from '../lib/ranks'

export default function RankBadge({ tier }) {
  const info = getRankByTier(tier)
  const cls  = RANK_BADGES[tier] || 'badge-muted'
  return <span className={`badge ${cls}`}>{info.label}</span>
}
