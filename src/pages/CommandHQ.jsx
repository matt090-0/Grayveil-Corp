import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import {
  ClassificationBar, StatCell, Card, SectionHeader, StatusBadge, EmptyState, timeUntil, fmtDateTime,
} from '../components/uee'
import { formatCredits } from '../lib/ranks'

const TRACKS = [
  { key: 'pilot', label: 'PILOT', certs: ['Fleet Navigation', 'Turret Gunnery'] },
  { key: 'recon', label: 'RECON', certs: ['Electronic Warfare', 'Fleet Navigation'] },
  { key: 'medic', label: 'MEDIC', certs: ['Combat Medic'] },
  { key: 'logistics', label: 'LOGISTICS', certs: ['Mining Foreman', 'Fleet Navigation'] },
]

const INTEL_TAGS = {
  flank: ['flank', 'pincer', 'angle'],
  interdiction: ['interdict', 'snare', 'qed'],
  missile: ['missile', 'torpedo'],
  boarding: ['board', 'breach'],
  convoy: ['convoy', 'escort', 'hauler'],
  stealth: ['stealth', 'silent', 'low-signature'],
}

function decodePriority(content) {
  const match = String(content || '').match(/^\[(CRITICAL|URGENT|IMPORTANT|ROUTINE)\]\s*/i)
  if (!match) return 'ROUTINE'
  return match[1].toUpperCase()
}

function safe(data) {
  return Array.isArray(data) ? data : []
}

export default function CommandHQ() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState([])
  const [signups, setSignups] = useState([])
  const [members, setMembers] = useState([])
  const [certs, setCerts] = useState([])
  const [aars, setAars] = useState([])
  const [loans, setLoans] = useState([])
  const [funds, setFunds] = useState([])
  const [applications, setApplications] = useState([])
  const [recruitment, setRecruitment] = useState([])
  const [messages, setMessages] = useState([])
  const [pendingActions, setPendingActions] = useState([])
  const [treasury, setTreasury] = useState(0)

  useEffect(() => {
    async function load() {
      const queries = await Promise.allSettled([
        supabase.from('events').select('id, title, event_type, starts_at, status, location, max_slots, min_tier, created_by').order('starts_at', { ascending: true }),
        supabase.from('event_signups').select('event_id, member_id, role, status'),
        supabase.from('profiles').select('id, handle, tier, status, speciality, division, rep_score, strike_count, last_seen_at, joined_at').eq('status', 'ACTIVE'),
        supabase.from('member_certifications').select('member_id, cert:certifications(name)'),
        supabase.from('after_action_reports').select('id, title, summary, lessons, outcome, attendees, created_at').order('created_at', { ascending: false }).limit(120),
        supabase.from('loans').select('id, amount, repaid, status, created_at'),
        supabase.from('ship_funds').select('id, name, status, target_amount, current_amount, created_at'),
        supabase.from('applications').select('id, status, source, referral_code, created_at'),
        supabase.from('recruitment').select('id, handle, status, created_at, updated_at'),
        supabase.from('messages').select('id, content, created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(50),
        supabase.from('pending_admin_actions').select('id, action_type, status, initiated_at, approved_at').order('initiated_at', { ascending: false }).limit(100),
        supabase.from('treasury').select('balance').eq('id', 1).maybeSingle(),
      ])

      const pick = (idx) => (queries[idx].status === 'fulfilled' ? queries[idx].value.data : [])
      setEvents(safe(pick(0)))
      setSignups(safe(pick(1)))
      setMembers(safe(pick(2)))
      setCerts(safe(pick(3)))
      setAars(safe(pick(4)))
      setLoans(safe(pick(5)))
      setFunds(safe(pick(6)))
      setApplications(safe(pick(7)))
      setRecruitment(safe(pick(8)))
      setMessages(safe(pick(9)))
      setPendingActions(safe(pick(10)))
      const t = queries[11].status === 'fulfilled' ? queries[11].value.data : null
      setTreasury(t?.balance || 0)
      setLoading(false)
    }
    load()
  }, [])

  const certCountByMember = useMemo(() => {
    const map = {}
    certs.forEach(c => { map[c.member_id] = (map[c.member_id] || 0) + 1 })
    return map
  }, [certs])

  const upcomingOps = useMemo(
    () => events.filter(e => ['SCHEDULED', 'LIVE'].includes(e.status)).slice(0, 10),
    [events],
  )

  const readinessRows = useMemo(() => upcomingOps.map(op => {
    const roster = signups.filter(s => s.event_id === op.id && (s.status || 'CONFIRMED') !== 'DECLINED')
    const missingMedic = !roster.some(r => String(r.role || '').toLowerCase().includes('medic'))
    const missingLogistics = !roster.some(r => /(hauler|support|engineer|logistics)/i.test(String(r.role || '')))
    const lowCert = roster.filter(r => (certCountByMember[r.member_id] || 0) < 2).length
    const availableMedic = members.find(m =>
      !roster.some(r => r.member_id === m.id) && /(medic|medical)/i.test(String(m.speciality || '')),
    )?.handle
    const availableLogi = members.find(m =>
      !roster.some(r => r.member_id === m.id) && /(logistics|support|hauler|engineer)/i.test(String(m.speciality || '')),
    )?.handle
    return { op, rosterCount: roster.length, missingMedic, missingLogistics, lowCert, availableMedic, availableLogi }
  }), [upcomingOps, signups, certCountByMember, members])

  const trainingByTrack = useMemo(() => TRACKS.map(track => {
    const required = new Set(track.certs.map(c => c.toLowerCase()))
    const complete = members.filter(m => {
      const names = certs.filter(c => c.member_id === m.id).map(c => String(c.cert?.name || '').toLowerCase())
      return [...required].every(r => names.includes(r))
    }).length
    const pct = members.length ? Math.round((complete / members.length) * 100) : 0
    return { ...track, complete, pct }
  }), [members, certs])

  const promotionCandidates = useMemo(() => {
    const attendanceByMember = {}
    aars.forEach(a => (a.attendees || []).forEach(id => { attendanceByMember[id] = (attendanceByMember[id] || 0) + 1 }))
    return members
      .filter(m => m.tier > 1)
      .map(m => {
        const score = (m.rep_score || 0) + ((attendanceByMember[m.id] || 0) * 8) + ((certCountByMember[m.id] || 0) * 10) - ((m.strike_count || 0) * 25)
        return { ...m, score, attendance: attendanceByMember[m.id] || 0, certs: certCountByMember[m.id] || 0, recommendedTier: Math.max(1, m.tier - 1) }
      })
      .filter(m => m.score >= 120)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
  }, [members, aars, certCountByMember])

  const intel = useMemo(() => {
    const rows = []
    const strategy = {}
    aars.forEach(a => {
      const text = `${a.summary || ''} ${a.lessons || ''}`.toLowerCase()
      const tags = Object.entries(INTEL_TAGS).filter(([, keys]) => keys.some(k => text.includes(k))).map(([t]) => t)
      tags.forEach(tag => {
        if (!strategy[tag]) strategy[tag] = { total: 0, success: 0 }
        strategy[tag].total += 1
        if (a.outcome === 'SUCCESS') strategy[tag].success += 1
      })
      rows.push({ ...a, tags })
    })
    const strategyRows = Object.entries(strategy).map(([tag, v]) => ({
      tag, successRate: v.total ? Math.round((v.success / v.total) * 100) : 0, total: v.total,
    })).sort((a, b) => b.total - a.total)
    return { rows, strategyRows }
  }, [aars])

  const overlay = useMemo(() => {
    const online = members.filter(m => m.last_seen_at && (Date.now() - new Date(m.last_seen_at).getTime()) < 5 * 60 * 1000)
    const liveOps = upcomingOps.filter(op => op.status === 'LIVE')
    const prioCounts = messages.reduce((acc, m) => {
      const p = decodePriority(m.content)
      acc[p] = (acc[p] || 0) + 1
      return acc
    }, {})
    return { online, liveOps, prioCounts }
  }, [members, upcomingOps, messages])

  const treasuryForecast = useMemo(() => {
    const activeLoanExposure = loans.filter(l => l.status === 'ACTIVE').reduce((s, l) => s + Math.max(0, (l.amount || 0) - (l.repaid || 0)), 0)
    const activeFundGap = funds.filter(f => f.status === 'ACTIVE').reduce((s, f) => s + Math.max(0, (f.target_amount || 0) - (f.current_amount || 0)), 0)
    const dailyDrag = Math.round((activeLoanExposure * 0.01) + (activeFundGap * 0.015))
    const d7 = treasury - (dailyDrag * 7)
    const d30 = treasury - (dailyDrag * 30)
    const risk = d30 < 0 ? 'CRITICAL' : d30 < treasury * 0.35 ? 'HIGH' : d30 < treasury * 0.65 ? 'MEDIUM' : 'LOW'
    return { activeLoanExposure, activeFundGap, dailyDrag, d7, d30, risk }
  }, [loans, funds, treasury])

  const funnel = useMemo(() => {
    const appCounts = applications.reduce((acc, a) => {
      const k = a.status || 'PENDING'
      acc[k] = (acc[k] || 0) + 1
      return acc
    }, {})
    const approvedHandles = new Set(recruitment.filter(r => r.status === 'APPROVED').map(r => String(r.handle || '').toLowerCase()))
    const active30 = members.filter(m => approvedHandles.has(String(m.handle || '').toLowerCase()) && (Date.now() - new Date(m.joined_at || Date.now()).getTime()) > 30 * 86400000).length
    const sourceCounts = applications.reduce((acc, a) => {
      const k = a.source || (a.referral_code ? 'REFERRAL_CODE' : 'DIRECT')
      acc[k] = (acc[k] || 0) + 1
      return acc
    }, {})
    return { appCounts, active30, sourceCounts }
  }, [applications, recruitment, members])

  const pendingPromotions = pendingActions.filter(p => p.action_type === 'member_update' && p.status === 'PENDING').length

  return (
    <>
      <ClassificationBar
        section="GRAYVEIL COMMAND SYSTEM"
        label="HQ 2026"
        accent="#7ca8ff"
        right={<><span>OPS · {upcomingOps.length}</span><span>ONLINE · {overlay.online.length}</span><span>PENDING PROMO · {pendingPromotions}</span></>}
      />
      <div className="page-header">
        <h1 className="page-title">COMMAND HQ // MODERN 2026</h1>
        <div className="page-subtitle">All-command intelligence surface: readiness, training, promotions, AAR parsing, live overlay, treasury forecasts, funnel analytics, Discord ops, incident playbooks, and mobile quick deck.</div>
      </div>
      <div className="page-body" style={{ paddingBottom: 82 }}>
        {loading ? <div className="loading">SYNCHRONIZING COMMAND SYSTEM...</div> : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 14 }}>
              <StatCell label="OPS SCAN" value={readinessRows.length} color="#7ca8ff" glyph="◉" desc="scheduled/live ops scanned" />
              <StatCell label="TRACK COVERAGE" value={`${trainingByTrack.reduce((s, t) => s + t.pct, 0) / Math.max(trainingByTrack.length, 1) | 0}%`} color="#5ce0a1" glyph="◆" desc="campaign completion" />
              <StatCell label="PROMOTION PIPE" value={promotionCandidates.length} color="#c8a55a" glyph="⬆" desc="eligible candidates" />
              <StatCell label="TREASURY 30D" value={formatCredits(treasuryForecast.d30)} color={treasuryForecast.risk === 'LOW' ? '#5ce0a1' : '#e0a155'} glyph="◒" desc={`risk ${treasuryForecast.risk}`} />
            </div>

            <SectionHeader label="OPS READINESS SCANNER" color="#7ca8ff" />
            {readinessRows.length === 0 ? <EmptyState>No scheduled operations to scan.</EmptyState> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 10 }}>
                {readinessRows.map(r => (
                  <Card key={r.op.id} accent={r.missingMedic || r.missingLogistics || r.lowCert > 0 ? '#e0a155' : '#5ce0a1'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontWeight: 600 }}>{r.op.title}</div>
                      <StatusBadge label={r.op.status} color={r.op.status === 'LIVE' ? '#5ce0a1' : '#7ca8ff'} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{fmtDateTime(r.op.starts_at)} · {r.op.location || 'TBD'}</div>
                    <div style={{ marginTop: 7, fontSize: 12 }}>Roster {r.rosterCount}{r.op.max_slots ? `/${r.op.max_slots}` : ''} · Low-cert {r.lowCert}</div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {r.missingMedic && <StatusBadge label={`NO MEDIC${r.availableMedic ? ` · swap ${r.availableMedic}` : ''}`} color="#e05c5c" />}
                      {r.missingLogistics && <StatusBadge label={`NO LOGI${r.availableLogi ? ` · swap ${r.availableLogi}` : ''}`} color="#e0a155" />}
                      {!r.missingMedic && !r.missingLogistics && r.lowCert === 0 && <StatusBadge label="READY" color="#5ce0a1" />}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <SectionHeader label="DOCTRINE + TRAINING CAMPAIGNS" color="#5ce0a1" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
              {trainingByTrack.map(t => (
                <Card key={t.key} accent="#5ce0a1">
                  <div style={{ fontSize: 11, letterSpacing: '.14em', color: '#5ce0a1', fontFamily: 'var(--font-mono)' }}>{t.label}</div>
                  <div style={{ marginTop: 6, fontSize: 22, fontFamily: 'var(--font-display)' }}>{t.pct}%</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t.complete}/{members.length} complete</div>
                  <div style={{ marginTop: 8, fontSize: 11 }}>{t.certs.join(' · ')}</div>
                </Card>
              ))}
            </div>

            <SectionHeader label="PROMOTION BOARD 2.0" color="#c8a55a" />
            {promotionCandidates.length === 0 ? <EmptyState>No candidates over threshold right now.</EmptyState> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 }}>
                {promotionCandidates.map(c => (
                  <Card key={c.id} accent="#c8a55a">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{c.handle}</strong>
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#c8a55a' }}>SCORE {c.score}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>T{c.tier} → T{c.recommendedTier} · REP {c.rep_score || 0} · AAR {c.attendance} · CERT {c.certs} · STRIKE {c.strike_count || 0}</div>
                  </Card>
                ))}
              </div>
            )}
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)' }}>Chain-of-command queue: <b>{pendingPromotions}</b> pending promotion-related approvals.</div>

            <SectionHeader label="AFTER ACTION INTELLIGENCE ENGINE" color="#b566d9" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Card accent="#b566d9">
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Top doctrine tags</div>
                {(intel.strategyRows.slice(0, 6)).map(s => (
                  <div key={s.tag} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 0' }}>
                    <span>{s.tag.toUpperCase()}</span>
                    <span>{s.successRate}% success · {s.total} ops</span>
                  </div>
                ))}
              </Card>
              <Card accent="#b566d9">
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>Recent parsed AAR</div>
                {(intel.rows.slice(0, 4)).map(r => (
                  <div key={r.id} style={{ padding: '5px 0', borderBottom: '1px dashed var(--border)' }}>
                    <div style={{ fontSize: 12 }}>{r.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{r.tags.length ? r.tags.join(' · ') : 'No tags'} · {r.outcome}</div>
                  </div>
                ))}
              </Card>
            </div>

            <SectionHeader label="LIVE COMMAND OVERLAY" color="#7ca8ff" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
              <Card accent="#7ca8ff"><div>Online now: <b>{overlay.online.length}</b></div></Card>
              <Card accent="#5ce0a1"><div>Live ops: <b>{overlay.liveOps.length}</b></div></Card>
              <Card accent="#e0a155"><div>COMMS priority: CRITICAL {overlay.prioCounts.CRITICAL || 0} · URGENT {overlay.prioCounts.URGENT || 0}</div></Card>
              <Card accent="#9099a8"><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/events')}>OPS</button>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/roster')}>ROSTER</button>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/messages')}>COMMS</button>
              </div></Card>
            </div>

            <SectionHeader label="TREASURY FORECASTING" color="#c8a55a" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
              <Card accent="#c8a55a"><div>Current treasury: <b>{formatCredits(treasury)}</b></div></Card>
              <Card accent="#e0a155"><div>Loan exposure: <b>{formatCredits(treasuryForecast.activeLoanExposure)}</b></div></Card>
              <Card accent="#e05c5c"><div>Fund gap: <b>{formatCredits(treasuryForecast.activeFundGap)}</b></div></Card>
              <Card accent={treasuryForecast.risk === 'LOW' ? '#5ce0a1' : '#e05c5c'}><div>7D {formatCredits(treasuryForecast.d7)} · 30D {formatCredits(treasuryForecast.d30)} · risk <b>{treasuryForecast.risk}</b></div></Card>
            </div>

            <SectionHeader label="RECRUITMENT FUNNEL DASHBOARD" color="#5a80d9" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
              <Card accent="#5a80d9"><div>Apply: {applications.length} · Reviewing: {funnel.appCounts.REVIEWING || 0} · Approved: {funnel.appCounts.APPROVED || 0}</div></Card>
              <Card accent="#5ce0a1"><div>Approved → Active 30d retention: <b>{funnel.active30}</b></div></Card>
              <Card accent="#9099a8"><div style={{ fontSize: 11 }}>Top sources: {Object.entries(funnel.sourceCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}</div></Card>
            </div>

            <SectionHeader label="DISCORD OPS AUTOMATION PACK" color="#7289da" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
              <Card accent="#7289da"><div><b>/op</b> next-up preview · {upcomingOps[0] ? `${upcomingOps[0].title} in ${timeUntil(upcomingOps[0].starts_at)}` : 'none'}</div></Card>
              <Card accent="#7289da"><div><b>/roster</b> online summary · {overlay.online.length} online</div></Card>
              <Card accent="#7289da"><div><b>/501st-status</b> rolling code enabled in admin control</div></Card>
            </div>

            <SectionHeader label="INCIDENT PLAYBOOKS" color="#e05c5c" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 }}>
              {[
                { k: 'Account Compromise', s: 'Lock account, rotate 501st, invalidate webhooks, audit log review' },
                { k: 'Sabotage Event', s: 'Freeze payouts, isolate actor, pull AAR timeline, command notice' },
                { k: 'Mass-ban Mistake', s: 'Pause discipline actions, restore from queue, announce rollback' },
                { k: 'Comms Outage', s: 'Switch to fallback channels, pin live op summaries, status beacons' },
              ].map(p => <Card key={p.k} accent="#e05c5c"><div style={{ fontWeight: 600 }}>{p.k}</div><div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>{p.s}</div></Card>)}
            </div>
          </>
        )}
      </div>
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40,
        padding: '8px 12px', background: 'rgba(10,11,15,0.95)', borderTop: '1px solid var(--border)',
        display: 'flex', gap: 8, justifyContent: 'space-around',
      }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/events')}>Ops</button>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/roster')}>Roster</button>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/messages')}>Comms</button>
        {profile.tier <= 4 && <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin')}>Admin</button>}
      </div>
    </>
  )
}

