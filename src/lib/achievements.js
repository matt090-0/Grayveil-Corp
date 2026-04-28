// ─────────────────────────────────────────────────────────────
// Helpers for the achievements feature.
//
// Achievement definitions live in the `achievements` table and
// are queried at page load. This module is purely presentational
// — colour palette per category, rarity ordering, progress text
// formatting. No database calls, no React.
// ─────────────────────────────────────────────────────────────

export const ACH_CATEGORY_META = {
  COMBAT:      { label: 'COMBAT',       color: '#e05c5c', glyph: '⚔' },
  CONTRACTS:   { label: 'CONTRACTS',    color: '#5ce0a1', glyph: '◆' },
  OPS:         { label: 'OPERATIONS',   color: '#5a80d9', glyph: '◉' },
  INTEL:       { label: 'INTEL & AAR',  color: '#b566d9', glyph: '◍' },
  BOUNTY:      { label: 'BOUNTY',       color: '#e05c5c', glyph: '✕' },
  WEALTH:      { label: 'WEALTH',       color: '#c8a55a', glyph: '✦' },
  LEADERSHIP:  { label: 'LEADERSHIP',   color: '#5a80d9', glyph: '◆' },
  SERVICE:     { label: 'SERVICE',      color: '#c8a55a', glyph: '✦' },
  MARKETPLACE: { label: 'MARKETPLACE',  color: '#5ce0a1', glyph: '◇' },
  SPECIAL:     { label: 'SPECIAL',      color: '#c8a55a', glyph: '✦' },
}

export const ACH_CATEGORY_ORDER = [
  'COMBAT', 'CONTRACTS', 'OPS', 'INTEL', 'BOUNTY',
  'WEALTH', 'LEADERSHIP', 'SERVICE', 'MARKETPLACE', 'SPECIAL',
]

export const ACH_RARITY_META = {
  LEGENDARY: { color: '#c8a55a', glyph: '✦', label: 'LEGENDARY' },
  RARE:      { color: '#5a80d9', glyph: '◆', label: 'RARE' },
  UNCOMMON:  { color: '#5ce0a1', glyph: '◇', label: 'UNCOMMON' },
  COMMON:    { color: '#9099a8', glyph: '◯', label: 'COMMON' },
}

export const ACH_RARITY_ORDER = ['LEGENDARY', 'RARE', 'UNCOMMON', 'COMMON']

// Friendly labels for the metric_key column (used in progress
// text like "85 / 100 KILLS").
export const METRIC_LABEL = {
  kills:             'kills',
  assists:           'assists',
  engagements:       'engagements',
  contracts_done:    'contracts',
  contracts_posted:  'contracts posted',
  ops_attended:      'ops',
  aars_filed:        'AARs',
  intel_filed:       'intel reports',
  bounties_claimed:  'bounties',
  bounties_posted:   'bounties posted',
  loot_earned:       'aUEC earned',
  listings_sold:     'listings sold',
  medals_earned:     'medals',
  certs_earned:      'certs',
  rep_score:         'rep',
  days_in_org:       'days',
  rank_attainment:   'tier',
  is_founder:        'founder',
}

// Format a metric value for display. aUEC values get comma
// separators; everything else is a count.
export function formatMetricValue(metricKey, value) {
  const v = Number(value || 0)
  if (metricKey === 'loot_earned') return v.toLocaleString()
  return v.toString()
}

// "85 / 100 KILLS" — used in progress bars on locked
// achievements. Hides the value for boolean-y secret metrics.
export function progressLabel(achievement, currentValue) {
  if (achievement.metric_key === 'is_founder') return 'FOUNDER STATUS'
  if (achievement.metric_key === 'rank_attainment') {
    return `T-${9 - Number(currentValue || 0)} CURRENT · T-${9 - achievement.threshold} REQUIRED`
  }
  const cur  = formatMetricValue(achievement.metric_key, currentValue)
  const need = formatMetricValue(achievement.metric_key, achievement.threshold)
  const lbl  = METRIC_LABEL[achievement.metric_key] || achievement.metric_key
  return `${cur} / ${need} ${lbl.toUpperCase()}`
}

// Clamp progress to [0,1] for the progress bar fill.
export function progressRatio(achievement, currentValue) {
  if (!achievement?.threshold) return 0
  const v = Number(currentValue || 0)
  return Math.max(0, Math.min(1, v / achievement.threshold))
}

// Total achievement points earned by a member from a list of
// member_achievements rows joined to the achievements table.
export function totalPoints(earned) {
  return (earned || []).reduce((s, e) => s + (e.achievement?.points || 0), 0)
}
