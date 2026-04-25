import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from './Toast'
import { buildAnnualReport, openDossier, downloadDossier } from '../lib/dossier'
import { UEE_AMBER } from './uee'

// ─────────────────────────────────────────────────────────────
// Annual report generator. Officer-only (caller is responsible
// for gating). Click → query the org for the chosen year →
// hand to buildAnnualReport → open the printable HTML in a
// new tab. No state outside the modal.
//
// Pulls aggregates from a dozen tables in parallel. The query
// boundaries are `[Jan 1 of year, Jan 1 of year+1)` so partial
// years (current year before Dec 31) work too.
// ─────────────────────────────────────────────────────────────
export default function AnnualReportButton() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())
  const [busy, setBusy] = useState(false)

  async function generate(action /* 'open' | 'download' */) {
    setBusy(true)
    try {
      const start = new Date(`${year}-01-01T00:00:00Z`).toISOString()
      const end   = new Date(`${year + 1}-01-01T00:00:00Z`).toISOString()

      // ─── Headline totals ─────────────────────────────────────
      const [
        membersActive,
        membersJoined,
        opsAll,
        contractsCompleted,
        contractsAll,
        kills,
        bountiesCollected,
        bountiesAll,
        intel,
        aars,
        lootSplits,
        treasury,
        medalsAwarded,
        divisionsRows,
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('joined_at', start).lt('joined_at', end),
        supabase.from('events').select('id, status, starts_at').gte('starts_at', start).lt('starts_at', end),
        supabase.from('contracts').select('id, reward').eq('status', 'COMPLETE').gte('created_at', start).lt('created_at', end),
        supabase.from('contracts').select('id, reward, status').gte('created_at', start).lt('created_at', end),
        supabase.from('kill_log').select('outcome').gte('created_at', start).lt('created_at', end),
        supabase.from('bounties').select('reward').eq('status', 'CLAIMED').gte('claimed_at', start).lt('claimed_at', end),
        supabase.from('bounties').select('reward, status').gte('created_at', start).lt('created_at', end),
        supabase.from('intelligence').select('id', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end),
        supabase.from('after_action_reports').select('id, title, outcome, attendees, loot_total').gte('created_at', start).lt('created_at', end),
        supabase.from('loot_splits').select('amount').gte('created_at', start).lt('created_at', end),
        supabase.from('treasury').select('balance').eq('id', 1).maybeSingle(),
        supabase.from('member_medals').select('id', { count: 'exact', head: true }).gte('awarded_at', start).lt('awarded_at', end),
        supabase.from('profiles').select('division').eq('status', 'ACTIVE'),
      ])

      const opsList = opsAll.data || []
      const opsRun = opsList.filter(o => o.status !== 'CANCELLED').length
      const opsCancelled = opsList.filter(o => o.status === 'CANCELLED').length

      const killStats = (kills.data || []).reduce((a, k) => {
        if (k.outcome === 'KILL')   a.k++
        if (k.outcome === 'ASSIST') a.a++
        if (k.outcome === 'DEATH')  a.d++
        return a
      }, { k: 0, a: 0, d: 0 })

      const lootDistributed = (lootSplits.data || []).reduce((s, x) => s + (x.amount || 0), 0)
      const contractPool    = (contractsCompleted.data || []).reduce((s, c) => s + (c.reward || 0), 0)
      const bountyPool      = (bountiesCollected.data || []).reduce((s, b) => s + (b.reward || 0), 0)

      // Division roll-up
      const divCounts = {}
      ;(divisionsRows.data || []).forEach(r => {
        const d = r.division || 'Unassigned'
        divCounts[d] = (divCounts[d] || 0) + 1
      })
      const divisions = Object.entries(divCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, members]) => ({ name, members }))

      // Headline ops — most-attended successful AARs
      const aarList = aars.data || []
      const headlineOps = [...aarList]
        .filter(a => a.outcome === 'SUCCESS' || a.outcome === 'PARTIAL')
        .sort((a, b) => (b.attendees?.length || 0) - (a.attendees?.length || 0))
        .slice(0, 6)
        .map(a => ({
          title: a.title,
          outcome: a.outcome,
          attendees: a.attendees?.length || 0,
          loot: a.loot_total || 0,
        }))

      // ─── Top operatives ──────────────────────────────────────
      // We compute these in JS rather than firing 4 grouped queries —
      // the data sets are small enough that one fetch + reduce is faster
      // than 4 round-trips, and we already have most of it via foreign
      // joins.
      const [
        { data: killAgg },
        { data: contractAgg },
        { data: lootAgg },
        { data: repAll },
      ] = await Promise.all([
        supabase.from('kill_log')
          .select('reporter_id, outcome, reporter:profiles!kill_log_reporter_id_fkey(handle)')
          .gte('created_at', start).lt('created_at', end),
        supabase.from('contract_claims')
          .select('member_id, contract:contracts!contract_claims_contract_id_fkey(status, created_at), member:profiles!contract_claims_member_id_fkey(handle)'),
        supabase.from('loot_splits')
          .select('member_id, amount, member:profiles!loot_splits_member_id_fkey(handle)')
          .gte('created_at', start).lt('created_at', end),
        supabase.from('profiles')
          .select('handle, rep_score').eq('status', 'ACTIVE')
          .order('rep_score', { ascending: false }).limit(5),
      ])

      const killByOp = {}
      ;(killAgg || []).filter(k => k.outcome === 'KILL').forEach(k => {
        const h = k.reporter?.handle
        if (!h) return
        killByOp[h] = (killByOp[h] || 0) + 1
      })
      const topKills = Object.entries(killByOp)
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([handle, value]) => ({ handle, value }))

      const contractByOp = {}
      ;(contractAgg || [])
        .filter(c => c.contract?.status === 'COMPLETE'
                  && c.contract?.created_at >= start
                  && c.contract?.created_at < end)
        .forEach(c => {
          const h = c.member?.handle
          if (!h) return
          contractByOp[h] = (contractByOp[h] || 0) + 1
        })
      const topContracts = Object.entries(contractByOp)
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([handle, value]) => ({ handle, value }))

      const lootByOp = {}
      ;(lootAgg || []).forEach(l => {
        const h = l.member?.handle
        if (!h) return
        lootByOp[h] = (lootByOp[h] || 0) + (l.amount || 0)
      })
      const topLoot = Object.entries(lootByOp)
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([handle, value]) => ({ handle, value }))

      const topRep = (repAll || []).map(r => ({ handle: r.handle, value: r.rep_score || 0 }))

      // ─── Compose ─────────────────────────────────────────────
      const data = {
        year,
        generated_by: me.handle,
        totals: {
          members_active:      membersActive.count || 0,
          members_joined:      membersJoined.count || 0,
          ops_run:             opsRun,
          ops_cancelled:       opsCancelled,
          contracts_completed: (contractsCompleted.data || []).length,
          contracts_pool:      contractPool,
          kills:               killStats.k,
          assists:             killStats.a,
          deaths:              killStats.d,
          bounties_collected:  (bountiesCollected.data || []).length,
          bounty_pool:         bountyPool,
          intel_filed:         intel.count || 0,
          aars_filed:          (aars.data || []).length,
          loot_distributed:    lootDistributed,
          treasury_balance:    treasury.data?.balance || 0,
          medals_awarded:      medalsAwarded.count || 0,
        },
        top: {
          kills:     topKills,
          contracts: topContracts,
          loot:      topLoot,
          rep:       topRep,
        },
        divisions,
        headlineOps,
      }

      const { html, filename } = buildAnnualReport(data)
      if (action === 'download') downloadDossier(html, filename)
      else openDossier(html)
      toast(`Annual report ${year} generated`, 'success')
      setOpen(false)
    } catch (err) {
      toast(err.message || 'Failed to generate report', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: `${UEE_AMBER}10`,
          border: `1px solid ${UEE_AMBER}55`,
          color: UEE_AMBER,
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', fontWeight: 600,
          padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
        }}
      >
        ⎙ ANNUAL REPORT
      </button>

      {open && (
        <div className="modal-backdrop" onClick={() => !busy && setOpen(false)}>
          <div
            className="modal"
            style={{ maxWidth: 460, padding: 0, overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              background: `linear-gradient(135deg, ${UEE_AMBER}22, ${UEE_AMBER}08)`,
              borderBottom: `1px solid ${UEE_AMBER}44`,
              padding: '14px 22px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.25em',
                  color: UEE_AMBER, marginBottom: 3,
                }}>◆ ORG REPORTING</div>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600,
                }}>Generate Annual Report</div>
              </div>
              <button
                onClick={() => !busy && setOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', fontSize: 18, cursor: 'pointer' }}
              >✕</button>
            </div>
            <div style={{ padding: 18 }}>
              <div style={{
                fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 16,
              }}>
                Pulls totals, top operatives, division roll-up, and headline ops from the chosen fiscal year.
                Output is a printable UEE-styled HTML brief — same family as the citizen dossier and op briefing.
              </div>
              <div className="form-group">
                <label className="form-label">FISCAL YEAR</label>
                <select
                  className="form-select"
                  value={year}
                  onChange={e => setYear(parseInt(e.target.value))}
                  disabled={busy}
                >
                  {[0, 1, 2, 3].map(offset => {
                    const y = new Date().getFullYear() - offset
                    return <option key={y} value={y}>{y}{offset === 0 ? ' (current)' : ''}</option>
                  })}
                </select>
              </div>
            </div>
            <div style={{
              borderTop: '1px solid var(--border)',
              background: 'rgba(0,0,0,0.15)',
              padding: '12px 22px',
              display: 'flex', justifyContent: 'flex-end', gap: 8,
            }}>
              <button className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>CANCEL</button>
              <button className="btn btn-ghost" onClick={() => generate('download')} disabled={busy}>
                {busy ? 'GENERATING...' : '↓ SAVE .HTML'}
              </button>
              <button className="btn btn-primary" onClick={() => generate('open')} disabled={busy}>
                {busy ? 'GENERATING...' : '⎙ PRINT REPORT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
