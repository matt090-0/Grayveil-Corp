export const RANKS = [
  { tier: 1, rank: 'HIGH ADMIRAL',  label: 'High Admiral',  color: '#d4af6e' },
  { tier: 2, rank: 'ADMIRAL',       label: 'Admiral',       color: '#9090a8' },
  { tier: 3, rank: 'VICE ADMIRAL',  label: 'Vice Admiral',  color: '#9090a8' },
  { tier: 4, rank: 'COMMODORE',     label: 'Commodore',     color: '#4a90d9' },
  { tier: 5, rank: 'CAPTAIN',       label: 'Captain',       color: '#4a90d9' },
  { tier: 6, rank: 'COMMANDER',     label: 'Commander',     color: '#8888a0' },
  { tier: 7, rank: 'LIEUTENANT',    label: 'Lieutenant',    color: '#8888a0' },
  { tier: 8, rank: 'ENSIGN',        label: 'Ensign',        color: '#44445a' },
  { tier: 9, rank: 'RECRUIT',       label: 'Recruit',       color: '#44445a' },
]

export const RANK_BADGES = {
  1: 'badge-accent',
  2: 'badge-muted',
  3: 'badge-muted',
  4: 'badge-blue',
  5: 'badge-blue',
  6: 'badge-muted',
  7: 'badge-muted',
  8: 'badge-muted',
  9: 'badge-muted',
}

export function getRankByTier(tier) {
  return RANKS.find(r => r.tier === tier) || RANKS[8]
}

export function getRankColor(tier) {
  return getRankByTier(tier).color
}

export function canPromote(myTier, targetTier) {
  if (targetTier >= 7) return myTier <= targetTier - 2
  if (targetTier >= 5) return myTier <= 3
  return myTier <= 2
}

export function formatCredits(n) {
  if (!n && n !== 0) return '—'
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M aUEC'
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + 'k aUEC'
  return n.toLocaleString() + ' aUEC'
}

export const CONTRACT_TYPES = ['COMBAT', 'TRADE', 'INTELLIGENCE', 'LOGISTICS', 'SALVAGE', 'ESCORT', 'BOUNTY', 'RECON']
export const SHIP_STATUSES  = ['AVAILABLE', 'DEPLOYED', 'MAINTENANCE', 'RESERVED']
export const INTEL_CLASSES  = [
  { label: 'OPEN',      min_tier: 9, badge: 'badge-muted'  },
  { label: 'RESTRICTED',min_tier: 6, badge: 'badge-amber'  },
  { label: 'CLASSIFIED',min_tier: 4, badge: 'badge-red'    },
  { label: 'BLACKLINE', min_tier: 2, badge: 'badge-purple' },
]
