import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// ─────────────────────────────────────────────────────────────
// PromotionChecklist — Recruit (tier 9) → Ensign (tier 8) progress.
// Four objective criteria, all self-serve. Renders a hairline-divided
// list with status dots; the completion ratio is shown in the header.
//
// Defensive queries: if a table is missing or a query errors out we
// just treat that criterion as "0", no crash. Officers see the same
// component on member detail views, so the truth lives here.
//
// Props:
//   - profileId: UUID of the recruit
//   - joinedAt:  ISO timestamp from profile.joined_at
//   - division:  current value
//   - speciality: current value
//   - bio:       current value
//   - compact:   reduces padding for embedded use (officer table cell)
//
// Exports `usePromotionStatus(profile)` for places that just need the
// boolean ready-state (e.g. Recruits tab promote button).
// ─────────────────────────────────────────────────────────────

const REQUIRED_DAYS = 7

function daysSince(iso) {
  if (!iso) return 0
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / 86400000))
}

// Hook: returns { criteria, ready, loading } where criteria is an
// array of { key, label, met, detail } and ready is true iff all met.
export function usePromotionStatus(profile) {
  const [intelCount,    setIntelCount]    = useState(0)
  const [contractCount, setContractCount] = useState(0)
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    if (!profile?.id) { setLoading(false); return }
    let cancelled = false
    async function load() {
      const [intelRes, claimsRes] = await Promise.all([
        supabase
          .from('intelligence')
          .select('id', { count: 'exact', head: true })
          .eq('posted_by', profile.id),
        supabase
          .from('contract_claims')
          .select('id', { count: 'exact', head: true })
          .eq('claimed_by', profile.id),
      ])
      if (cancelled) return
      setIntelCount(intelRes.count ?? 0)
      setContractCount(claimsRes.count ?? 0)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [profile?.id])

  const tenure = daysSince(profile?.joined_at)
  const profileComplete = !!(profile?.division && profile?.speciality && profile?.bio)

  const criteria = [
    {
      key:    'profile',
      label:  'Profile complete',
      met:    profileComplete,
      detail: profileComplete ? 'Division + speciality + bio set' : 'Set division, speciality, and bio',
    },
    {
      key:    'tenure',
      label:  'Tenure ≥ 7 days',
      met:    tenure >= REQUIRED_DAYS,
      detail: `${Math.min(tenure, REQUIRED_DAYS)} / ${REQUIRED_DAYS} days`,
    },
    {
      key:    'intel',
      label:  'File 1 intelligence report',
      met:    intelCount >= 1,
      detail: `${Math.min(intelCount, 1)} / 1 filed`,
    },
    {
      key:    'contract',
      label:  'Claim 1 contract',
      met:    contractCount >= 1,
      detail: `${Math.min(contractCount, 1)} / 1 claimed`,
    },
  ]
  const ready = criteria.every(c => c.met)
  return { criteria, ready, loading }
}

export default function PromotionChecklist({ profile, compact = false }) {
  const { criteria, ready, loading } = usePromotionStatus(profile)
  const metCount = criteria.filter(c => c.met).length

  return (
    <div style={{
      border: '1px solid var(--border-md)',
      background: 'var(--bg-surface)',
      padding: compact ? '14px 16px' : '20px 22px',
    }}>
      {/* Header — eyebrow + progress ratio */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: compact ? 12 : 18, gap: 12,
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
          letterSpacing: '.28em', color: 'var(--text-3)',
          textTransform: 'uppercase',
        }}>PATH TO ENSIGN</div>
        <div style={{
          fontFamily: 'Inter Tight, sans-serif',
          fontSize: compact ? 13 : 15, fontWeight: 700,
          color: ready ? 'var(--green)' : 'var(--text-1)',
          letterSpacing: '-0.01em',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {loading ? '— / 4' : `${metCount} / 4`}
          {ready && (
            <span style={{
              marginLeft: 10,
              fontSize: 9, letterSpacing: '.28em',
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--green)',
            }}>READY</span>
          )}
        </div>
      </div>

      {/* Criteria rows */}
      <div>
        {criteria.map((c, i) => (
          <div
            key={c.key}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              gap: 12,
              padding: compact ? '8px 0' : '10px 0',
              borderTop: i === 0 ? 'none' : '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
              {/* Status dot */}
              <span style={{
                marginTop: 6, width: 8, height: 8, borderRadius: '50%',
                background: c.met ? 'var(--green)' : 'var(--text-3)',
                boxShadow: c.met ? '0 0 8px var(--green-dim)' : 'none',
                flexShrink: 0, opacity: c.met ? 1 : 0.5,
              }} />
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontFamily: 'Inter, sans-serif', fontSize: compact ? 12 : 13,
                  fontWeight: 500,
                  color: c.met ? 'var(--text-1)' : 'var(--text-2)',
                  letterSpacing: '-0.005em', marginBottom: 2,
                }}>{c.label}</div>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: compact ? 9 : 10,
                  letterSpacing: '.18em',
                  color: 'var(--text-3)',
                  textTransform: 'uppercase',
                }}>{c.detail}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
