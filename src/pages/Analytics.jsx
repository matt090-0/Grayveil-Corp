import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatCredits, getRankByTier } from '../lib/ranks'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import RankBadge from '../components/RankBadge'
import {
  UEE_AMBER, ClassificationBar, StatCell, Card,
  StatusBadge, EmptyState, SectionHeader,
  fmtDate, timeAgo,
} from '../components/uee'

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#0e0f14', border: `1px solid ${UEE_AMBER}55`, borderRadius: 3,
      padding: '6px 10px', fontSize: 11,
      fontFamily: 'var(--font-mono)', letterSpacing: '.05em',
    }}>
      <div style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: '.18em' }}>{label}</div>
      <div style={{ color: UEE_AMBER, fontWeight: 600 }}>{payload[0].value}</div>
    </div>
  )
}

// Round timestamps down to the start of their week (ISO Monday).
function weekKey(ts) {
  const d = new Date(ts)
  const day = d.getDay() || 7
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (day - 1))
  return d.toISOString().slice(0, 10)
}

function weekLabel(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

const ACTION_LABELS = {
  contract_claimed:    { glyph: '◆', verb: 'claimed contract',   color: '#5a80d9' },
  contract_posted:     { glyph: '◆', verb: 'posted contract',    color: UEE_AMBER },
  contract_completed:  { glyph: '✓', verb: 'completed contract',  color: '#5ce0a1' },
  intel_filed:         { glyph: '◍', verb: 'filed intel',         color: '#b566d9' },
  member_promoted:     { glyph: '⬆', verb: 'was promoted',        color: '#5ce0a1' },
  fleet_added:         { glyph: '◎', verb: 'registered vessel',   color: '#5a80d9' },
  announcement_posted: { glyph: '◈', verb: 'posted transmission', color: UEE_AMBER },
  poll_created:        { glyph: '◑', verb: 'created poll',        color: '#5a80d9' },
  event_created:       { glyph: '◉', verb: 'scheduled op',        color: '#5a80d9' },
  bounty_posted:       { glyph: '✕', verb: 'posted bounty',       color: '#e05c5c' },
  kill_logged:         { glyph: '⚔', verb: 'logged engagement',   color: '#e05c5c' },
  aar_filed:           { glyph: '✓', verb: 'filed AAR',           color: '#5ce0a1' },
}

export default function Analytics() {
  const { profile: me } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [members, setMembers] = useState([])
  const [activeId, setActiveId] = useState(searchParams.get('m') || me.id)
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  const isMine = activeId === me.id
  const canPickOther = me.tier <= 4

  useEffect(() => {
    if (!canPickOther) return
    supabase.from('profiles')
      .select('id, handle, tier')
      .eq('status', 'ACTIVE')
      .order('tier').order('handle')
      .then(({ data }) => setMembers(data || []))
  }, [canPickOther])

  useEffect(() => {
    if (activeId !== me.id) setSearchParams({ m: activeId })
    else setSearchParams({})
  }, [activeId])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    ;(async () => {
      // Profile + denormalised counts in one shot
      const { data: p } = await supabase
        .from('profiles').select('*').eq('id', activeId).maybeSingle()
      if (!mounted) return
      setProfile(p)

      const [
        { data: claims },
        { data: postedContracts },
        { data: completedContracts },
        { data: kills },
        { data: postedBounties },
        { data: claimedBounties },
        { data: signups },
        { data: filedAARs },
        { data: filedIntel },
        { data: lootSplits },
        { data: medals },
        { data: certs },
        { data: achievements },
        { data: ledger },
        { data: act },
      ] = await Promise.all([
        supabase.from('contract_claims').select('id, contract:contracts(status, reward)').eq('member_id', activeId),
        supabase.from('contracts').select('id, status').eq('posted_by', activeId),
        supabase.from('contracts').select('id, reward').eq('posted_by', activeId).eq('status', 'COMPLETE'),
        supabase.from('kill_log').select('id, outcome, engagement_type, created_at').eq('reporter_id', activeId),
        supabase.from('bounties').select('id, status, reward').eq('posted_by', activeId),
        supabase.from('bounties').select('id, reward, target_name').eq('claimed_by', activeId),
        supabase.from('event_signups').select('id, status, event:events(status)').eq('member_id', activeId),
        supabase.from('after_action_reports').select('id, outcome, loot_total').eq('filed_by', activeId),
        supabase.from('intelligence').select('id, classification').eq('posted_by', activeId),
        supabase.from('loot_splits').select('amount').eq('member_id', activeId),
        supabase.from('member_medals').select('id, medal:medals(rarity, name)').eq('member_id', activeId),
        supabase.from('member_certifications').select('id, cert:certifications(name)').eq('member_id', activeId),
        supabase.from('member_achievements').select('id, achievement:achievements(rarity, points)').eq('member_id', activeId),
        supabase.from('ledger').select('amount, created_at').eq('member_id', activeId),
        supabase.from('activity_log').select('*, actor:profiles(handle)').eq('actor_id', activeId).order('created_at', { ascending: false }).limit(30),
      ])
      if (!mounted) return

      const kdr = (() => {
        const k = (kills || []).filter(x => x.outcome === 'KILL').length
        const a = (kills || []).filter(x => x.outcome === 'ASSIST').length
        const d = (kills || []).filter(x => x.outcome === 'DEATH').length
        return { kills: k, assists: a, deaths: d, ratio: d === 0 ? k : (k / d) }
      })()

      const ledgerIn  = (ledger || []).filter(x => x.amount > 0).reduce((s, x) => s + x.amount, 0)
      const ledgerOut = (ledger || []).filter(x => x.amount < 0).reduce((s, x) => s + Math.abs(x.amount), 0)

      setStats({
        contractsClaimed:  claims?.length || 0,
        contractsCompleted: (claims || []).filter(c => c.contract?.status === 'COMPLETE').length,
        contractsPosted:   postedContracts?.length || 0,
        contractsClosed:   completedContracts?.length || 0,
        contractsPostedRevenue: (completedContracts || []).reduce((s, c) => s + (c.reward || 0), 0),
        ...kdr,
        bountiesPosted:    postedBounties?.length || 0,
        bountiesClaimed:   claimedBounties?.length || 0,
        bountiesEarned:    (claimedBounties || []).reduce((s, b) => s + (b.reward || 0), 0),
        opsConfirmed:      (signups || []).filter(s => s.status === 'CONFIRMED').length,
        opsTentative:      (signups || []).filter(s => s.status === 'TENTATIVE').length,
        aarsFiled:         filedAARs?.length || 0,
        intelFiled:        filedIntel?.length || 0,
        lootEarned:        (lootSplits || []).reduce((s, l) => s + (l.amount || 0), 0),
        medalsCount:       medals?.length || 0,
        legendaryMedals:   (medals || []).filter(m => m.medal?.rarity === 'LEGENDARY').length,
        certsCount:        certs?.length || 0,
        achievementsCount: achievements?.length || 0,
        achievementPoints: (achievements || []).reduce((s, a) => s + (a.achievement?.points || 0), 0),
        legendaryAch:      (achievements || []).filter(a => a.achievement?.rarity === 'LEGENDARY').length,
        ledgerIn,
        ledgerOut,
        ledgerNet:         ledgerIn - ledgerOut,
        kills: kills || [],
      })
      setActivity(act || [])
      setLoading(false)
    })()
    return () => { mounted = false }
  }, [activeId])

  const weeks = useMemo(() => {
    if (!stats) return []
    // Roll activity_log + kills into the same weekly bucket so we can
    // chart "engagement" combined with "actions" over the last 12 weeks.
    const buckets = {}
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i * 7)
      buckets[weekKey(d)] = { week: weekLabel(weekKey(d)), actions: 0, kills: 0 }
    }
    activity.forEach(a => {
      const k = weekKey(a.created_at)
      if (buckets[k]) buckets[k].actions += 1
    })
    stats.kills.forEach(k => {
      const wk = weekKey(k.created_at)
      if (buckets[wk] && k.outcome === 'KILL') buckets[wk].kills += 1
    })
    return Object.values(buckets)
  }, [activity, stats])

  if (loading || !profile || !stats) {
    return (
      <>
        <ClassificationBar section="GRAYVEIL OPERATIVE ANALYTICS" label="LOADING" />
        <div className="page-body"><div className="loading">COMPILING ANALYTICS...</div></div>
      </>
    )
  }

  const rank = getRankByTier(profile.tier)
  const initials = profile.handle.slice(0, 2).toUpperCase()
  const daysInOrg = profile.joined_at
    ? Math.floor((Date.now() - new Date(profile.joined_at)) / 86400000)
    : 0

  return (
    <>
      <ClassificationBar
        section="GRAYVEIL OPERATIVE ANALYTICS"
        label={profile.handle.toUpperCase()}
        right={(
          <>
            <span style={{ color: rank.color }}>{rank.label.toUpperCase()}</span>
            <span>{daysInOrg}D IN ORG</span>
            <span style={{ color: UEE_AMBER }}>REP {profile.rep_score || 0}</span>
          </>
        )}
      />

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>ANALYTICS</h1>
            <div style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 640 }}>
              {isMine
                ? 'Year-to-date roll-up of your service record — combat, contracts, ops, intel, earnings.'
                : `Service record for ${profile.handle}. Visible to officers (T-4 and above).`}
            </div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '8px 12px',
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            borderLeft: `3px solid ${rank.color}`,
            borderRadius: 3,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              border: `1.5px solid ${profile.avatar_color || rank.color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: profile.avatar_color || rank.color,
            }}>{initials}</div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600 }}>{profile.handle}</div>
              <RankBadge tier={profile.tier} />
            </div>
          </div>
        </div>

        {canPickOther && (
          <div style={{ marginTop: 14 }}>
            <label style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em',
              color: UEE_AMBER, marginRight: 10,
            }}>◆ ANALYZING:</label>
            <select
              className="form-select"
              value={activeId}
              onChange={e => setActiveId(e.target.value)}
              style={{ maxWidth: 280, display: 'inline-block' }}
            >
              <option value={me.id}>{me.handle} (you)</option>
              {members.filter(m => m.id !== me.id).map(m => (
                <option key={m.id} value={m.id}>{m.handle}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="page-body">
        {/* HEADLINE STATS */}
        <SectionHeader label="SERVICE METRICS" color={UEE_AMBER} />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 10, marginBottom: 22,
        }}>
          <StatCell label="REP SCORE"   value={profile.rep_score || 0} color={UEE_AMBER} glyph="✦" desc="standing" />
          <StatCell label="KILLS"       value={stats.kills}            color="#e05c5c"   glyph="⚔" desc={`K/D ${stats.ratio.toFixed(2)}`} />
          <StatCell label="ASSISTS"     value={stats.assists}          color="#5a80d9"   glyph="◆" desc="combat support" />
          <StatCell label="DEATHS"      value={stats.deaths}           color="#9099a8"   glyph="○" desc="lost engagements" />
          <StatCell label="CONTRACTS"   value={stats.contractsCompleted} color="#5ce0a1" glyph="✓" desc={`${stats.contractsClaimed} claimed`} />
          <StatCell label="OPS ATTENDED" value={stats.opsConfirmed}    color="#5a80d9"   glyph="◉" desc={`${stats.aarsFiled} AARs filed`} />
          <StatCell label="INTEL FILED" value={stats.intelFiled}       color="#b566d9"   glyph="◍" desc="reports filed" />
          <StatCell label="MEDALS"      value={stats.medalsCount}      color={UEE_AMBER} glyph="✦" desc={stats.legendaryMedals > 0 ? `${stats.legendaryMedals} legendary` : 'commendations'} />
          <StatCell label="ACHIEVEMENTS" value={stats.achievementsCount} color={UEE_AMBER} glyph="◆" desc={`${stats.achievementPoints} pts${stats.legendaryAch > 0 ? ` · ${stats.legendaryAch} legendary` : ''}`} />
        </div>

        {/* COMBAT */}
        {(stats.kills.length > 0 || weeks.some(w => w.actions > 0)) && (
          <>
            <SectionHeader label="ACTIVITY OVER TIME · 12 WEEKS" color="#5a80d9" />
            <div style={{
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              borderLeft: `3px solid ${UEE_AMBER}`,
              borderRadius: 3, padding: '20px 16px 12px', marginBottom: 22,
            }}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeks} margin={{ top: 10, right: 16, left: 0, bottom: 0 }} barCategoryGap="20%">
                  <XAxis dataKey="week" tick={{ fill: '#8a8f9c', fontSize: 9, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}
                    axisLine={{ stroke: '#333344' }} tickLine={false} tickMargin={8} />
                  <YAxis tick={{ fill: '#555566', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
                    axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(200,165,90,0.06)' }} />
                  <Bar dataKey="actions" fill={UEE_AMBER} radius={[2, 2, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em',
                color: 'var(--text-3)', marginTop: 6, textAlign: 'center',
              }}>
                LOGGED ACTIONS PER WEEK
              </div>
            </div>
          </>
        )}

        {/* EARNINGS */}
        <SectionHeader label="EARNINGS · ALL TIME" color="#5ce0a1" />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 10, marginBottom: 22,
        }}>
          <StatCell label="LOOT EARNED"      value={formatCredits(stats.lootEarned)}     color="#5ce0a1" glyph="◆" desc="from AAR splits" />
          <StatCell label="BOUNTIES BANKED"  value={formatCredits(stats.bountiesEarned)} color="#e05c5c" glyph="✕" desc={`${stats.bountiesClaimed} collected`} />
          <StatCell label="POSTED PAYOUTS"   value={formatCredits(stats.contractsPostedRevenue)} color={UEE_AMBER} glyph="◆" desc={`${stats.contractsClosed} contracts paid`} />
          <StatCell label="LEDGER NET"       value={formatCredits(stats.ledgerNet)}      color={stats.ledgerNet >= 0 ? '#5ce0a1' : '#e05c5c'} glyph={stats.ledgerNet >= 0 ? '↑' : '↓'} desc={`${formatCredits(stats.ledgerIn)} in / ${formatCredits(stats.ledgerOut)} out`} />
          <StatCell label="WALLET"           value={formatCredits(profile.wallet_balance || 0)} color={UEE_AMBER} glyph="✦" desc="current balance" />
          <StatCell label="CREDIT SCORE"     value={profile.credit_score || 0}           color={UEE_AMBER} glyph="◇" desc="standing" />
        </div>

        {/* CONTRIBUTION */}
        <SectionHeader label="CONTRIBUTION" color={UEE_AMBER} />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 10, marginBottom: 22,
        }}>
          <StatCell label="CONTRACTS POSTED" value={stats.contractsPosted}  color={UEE_AMBER} glyph="◆" desc="opportunities created" />
          <StatCell label="BOUNTIES POSTED"  value={stats.bountiesPosted}   color="#e05c5c"   glyph="✕" desc="targets marked" />
          <StatCell label="AARs FILED"       value={stats.aarsFiled}        color="#5ce0a1"   glyph="✓" desc="ops debriefed" />
          <StatCell label="INTEL FILED"      value={stats.intelFiled}       color="#b566d9"   glyph="◍" desc="reports submitted" />
          <StatCell label="CERTIFICATIONS"   value={stats.certsCount}       color="#5a80d9"   glyph="◆" desc="qualifications held" />
          <StatCell label="DAYS IN ORG"      value={daysInOrg}              color={UEE_AMBER} glyph="◆" desc={fmtDate(profile.joined_at)} />
        </div>

        {/* RECENT ACTIVITY */}
        <SectionHeader label="RECENT ACTIVITY" color={UEE_AMBER} />
        {activity.length === 0 ? (
          <EmptyState>NO RECORDED ACTIVITY YET</EmptyState>
        ) : (
          <div style={{
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            borderRadius: 3, padding: '4px 12px',
          }}>
            {activity.slice(0, 20).map(a => {
              const info = ACTION_LABELS[a.action] || { glyph: '●', verb: a.action.replace(/_/g, ' '), color: 'var(--text-3)' }
              const det = a.details || {}
              return (
                <div key={a.id} style={{
                  padding: '8px 0', borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <span style={{
                    fontSize: 13, color: info.color, flexShrink: 0, marginTop: 1,
                    width: 16, textAlign: 'center',
                  }}>{info.glyph}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--text-2)' }}>{info.verb}</span>
                      {det.title && <span style={{ fontWeight: 500, color: info.color }}> — {det.title}</span>}
                      {det.new_rank && <span style={{ color: UEE_AMBER }}> → {det.new_rank}</span>}
                    </div>
                    <div style={{
                      fontSize: 9, color: 'var(--text-3)',
                      fontFamily: 'var(--font-mono)', letterSpacing: '.15em', marginTop: 2,
                    }}>{timeAgo(a.created_at)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
