import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { fmtDate } from '../lib/dates'
import { RANKS, canPromote } from '../lib/ranks'
import RankBadge from '../components/RankBadge'
import { SC_DIVISIONS, SC_SPECIALITIES } from '../lib/scdata'
import MemberDossier from '../components/MemberDossier'
import { useToast } from '../components/Toast'
import { discordPromotion } from '../lib/discord'
import { exportCSV } from '../lib/csv'
import {
  UEE_AMBER, ClassificationBar, TabStrip, StatCell, FilterRow, Card,
  StatusBadge, EmptyState, UeeModal,
} from '../components/uee'

const STATUS_META = {
  ACTIVE:    { color: '#6fc29b', glyph: '◉', label: 'ACTIVE' },
  INACTIVE:  { color: '#9099a8', glyph: '○', label: 'INACTIVE' },
  SUSPENDED: { color: '#c36d6d', glyph: '⬢', label: 'SUSPENDED' },
}
const INACTIVE_THRESHOLD_DAYS = 14
const SQUAD_LANES = [
  { key: 'ALPHA', label: 'ALPHA WING', color: '#6e86ae' },
  { key: 'BRAVO', label: 'BRAVO WING', color: '#6ea88f' },
  { key: 'CHARLIE', label: 'CHARLIE WING', color: '#b89d6d' },
  { key: 'SUPPORT', label: 'SUPPORT CELL', color: '#8f7bad' },
]
const READY_HIGH = '#6fc29b'
const READY_MID = '#b89d6d'
const READY_LOW = '#c36d6d'

function lastSeenMeta(ts) {
  if (!ts) return { label: 'NEVER', color: 'var(--text-3)', online: false }
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 300)   return { label: 'ONLINE',          color: READY_HIGH, online: true }
  if (diff < 3600)  return { label: `${Math.floor(diff / 60)}M AGO`,    color: UEE_AMBER, online: false }
  if (diff < 86400) return { label: `${Math.floor(diff / 3600)}H AGO`,  color: 'var(--text-2)', online: false }
  return                  { label: `${Math.floor(diff / 86400)}D AGO`,  color: 'var(--text-3)', online: false }
}

function tierAccent(tier) {
  if (tier <= 2) return '#b89d6d'       // Command
  if (tier <= 4) return '#6e86ae'       // Officer
  if (tier <= 6) return '#6ea88f'       // Specialist
  return '#9099a8'                      // Recruit / Auxiliary
}

function readinessColor(score) {
  return score >= 75 ? READY_HIGH : score >= 45 ? READY_MID : READY_LOW
}

function daysSince(ts) {
  if (!ts) return Number.POSITIVE_INFINITY
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000)
}

function readinessMeta(member, certCount, totalCerts) {
  const certPct = totalCerts > 0 ? Math.round((certCount / totalCerts) * 100) : 0
  const daysAway = daysSince(member.last_seen_at)
  const statusScore = member.status === 'ACTIVE' ? 20 : member.status === 'INACTIVE' ? 8 : 0
  const seenScore = daysAway <= 0 ? 30 : daysAway <= 1 ? 24 : daysAway <= 7 ? 16 : daysAway <= INACTIVE_THRESHOLD_DAYS ? 9 : 2
  const certScore = Math.round((certPct / 100) * 40)
  const repScore = Math.min(10, Math.round((member.rep_score || 0) / 250))
  const score = Math.max(0, Math.min(100, statusScore + seenScore + certScore + repScore))
  return {
    score,
    certPct,
    deployable: member.status === 'ACTIVE' && daysAway <= INACTIVE_THRESHOLD_DAYS && certPct >= 50,
  }
}

export default function Roster() {
  const navigate = useNavigate()
  const { profile: me } = useAuth()
  const toast = useToast()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [tab, setTab]         = useState('ALL')
  const [editing, setEditing] = useState(null)
  const [editData, setEditData] = useState({})
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [viewing, setViewing] = useState(null)
  const [preset, setPreset]   = useState('ALL')
  const [viewMode, setViewMode] = useState('CARDS')
  const [selectedId, setSelectedId] = useState(null)
  const [squadPlan, setSquadPlan] = useState({})
  const [draggedMemberId, setDraggedMemberId] = useState(null)
  const [certCounts, setCertCounts] = useState({})
  const [certNamesByMember, setCertNamesByMember] = useState({})
  const [totalCerts, setTotalCerts] = useState(0)
  const [panelLoading, setPanelLoading] = useState(false)
  const [panelData, setPanelData] = useState({ medals: 0, ships: 0, recentActivity: [] })

  async function load() {
    const [{ data: rosterData }, { data: memberCertRows }, { count: certTotal }] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .order('tier')
        .order('handle'),
      supabase
        .from('member_certifications')
        .select('member_id, cert:certifications(name)'),
      supabase
        .from('certifications')
        .select('id', { count: 'exact', head: true }),
    ])
    const nextCounts = {}
    const nextNames = {}
    ;(memberCertRows || []).forEach(row => {
      nextCounts[row.member_id] = (nextCounts[row.member_id] || 0) + 1
      if (!nextNames[row.member_id]) nextNames[row.member_id] = []
      if (row.cert?.name) nextNames[row.member_id].push(row.cert.name)
    })
    setMembers(rosterData || [])
    setCertCounts(nextCounts)
    setCertNamesByMember(nextNames)
    setTotalCerts(certTotal || 0)
    if (!selectedId) {
      const mine = (rosterData || []).find(m => m.id === me.id)
      setSelectedId(mine?.id || rosterData?.[0]?.id || null)
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [me.id])

  useEffect(() => {
    if (!members.length) return
    if (!selectedId || !members.some(m => m.id === selectedId)) {
      const mine = members.find(m => m.id === me.id)
      setSelectedId(mine?.id || members[0]?.id || null)
    }
  }, [members, selectedId, me.id])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('gv_roster_squad_plan')
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') setSquadPlan(parsed)
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem('gv_roster_squad_plan', JSON.stringify(squadPlan)) } catch {}
  }, [squadPlan])

  useEffect(() => {
    if (!members.length) return
    const validIds = new Set(members.map(m => m.id))
    setSquadPlan(prev => {
      const next = {}
      let changed = false
      Object.entries(prev || {}).forEach(([memberId, lane]) => {
        if (validIds.has(memberId)) next[memberId] = lane
        else changed = true
      })
      return changed ? next : prev
    })
  }, [members])

  const canEdit = me.tier <= 5

  const counts = useMemo(() => {
    const c = { ALL: members.length, COMMAND: 0, OFFICER: 0, SPECIALIST: 0, AUXILIARY: 0 }
    members.forEach(m => {
      if (m.tier <= 2)      c.COMMAND++
      else if (m.tier <= 4) c.OFFICER++
      else if (m.tier <= 6) c.SPECIALIST++
      else                  c.AUXILIARY++
    })
    Object.keys(STATUS_META).forEach(s => {
      c[s] = members.filter(m => m.status === s).length
    })
    return c
  }, [members])

  const onlineCount = useMemo(() =>
    members.filter(m => lastSeenMeta(m.last_seen_at).online).length,
  [members])

  const deployableCount = useMemo(
    () => members.filter(m => readinessMeta(m, certCounts[m.id] || 0, totalCerts).deployable).length,
    [members, certCounts, totalCerts],
  )
  const avgReadiness = useMemo(() => {
    if (!members.length) return 0
    const sum = members.reduce((acc, m) => acc + readinessMeta(m, certCounts[m.id] || 0, totalCerts).score, 0)
    return Math.round(sum / members.length)
  }, [members, certCounts, totalCerts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return members
      .filter(m => {
        if (tab === 'ALL') return true
        if (tab === 'COMMAND')    return m.tier <= 2
        if (tab === 'OFFICER')    return m.tier > 2 && m.tier <= 4
        if (tab === 'SPECIALIST') return m.tier > 4 && m.tier <= 6
        if (tab === 'AUXILIARY')  return m.tier > 6
        return m.status === tab
      })
      .filter(m => {
        const meta = readinessMeta(m, certCounts[m.id] || 0, totalCerts)
        if (preset === 'ALL') return true
        if (preset === 'DEPLOYABLE') return meta.deployable
        if (preset === 'NEEDS_CERTS') return meta.certPct < 50
        if (preset === 'INACTIVE_14D') return daysSince(m.last_seen_at) > INACTIVE_THRESHOLD_DAYS
        if (preset === 'COMMAND_CHAIN') return m.tier <= 4
        return true
      })
      .filter(m => !q
        || m.handle.toLowerCase().includes(q)
        || (m.rank || '').toLowerCase().includes(q)
        || (m.division || '').toLowerCase().includes(q)
        || (m.speciality || '').toLowerCase().includes(q)
        || (certNamesByMember[m.id] || []).some(name => name.toLowerCase().includes(q)))
      .sort((a, b) => {
        if (preset !== 'ALL') {
          const ar = readinessMeta(a, certCounts[a.id] || 0, totalCerts).score
          const br = readinessMeta(b, certCounts[b.id] || 0, totalCerts).score
          if (br !== ar) return br - ar
        }
        return a.tier - b.tier || a.handle.localeCompare(b.handle)
      })
  }, [members, tab, preset, search, certCounts, certNamesByMember, totalCerts])

  const selectedMember = useMemo(
    () => members.find(m => m.id === selectedId) || null,
    [members, selectedId],
  )
  const selectedReadiness = useMemo(
    () => selectedMember ? readinessMeta(selectedMember, certCounts[selectedMember.id] || 0, totalCerts) : null,
    [selectedMember, certCounts, totalCerts],
  )

  useEffect(() => {
    async function loadPanel() {
      if (!selectedMember?.id) return
      setPanelLoading(true)
      const [{ count: medals }, { count: ships }, { data: recentActivity }] = await Promise.all([
        supabase.from('member_medals').select('id', { count: 'exact', head: true }).eq('member_id', selectedMember.id),
        supabase.from('fleet').select('id', { count: 'exact', head: true }).eq('assigned_to', selectedMember.id),
        supabase.from('activity_log')
          .select('id, action, created_at, details')
          .eq('actor_id', selectedMember.id)
          .order('created_at', { ascending: false })
          .limit(6),
      ])
      setPanelData({
        medals: medals || 0,
        ships: ships || 0,
        recentActivity: recentActivity || [],
      })
      setPanelLoading(false)
    }
    loadPanel()
  }, [selectedMember?.id])

  const chainSections = useMemo(() => {
    const buckets = [
      { key: 'COMMAND', label: 'COMMAND CHAIN', color: '#b89d6d', filter: m => m.tier <= 2 },
      { key: 'OFFICERS', label: 'OFFICER CORPS', color: '#6e86ae', filter: m => m.tier > 2 && m.tier <= 4 },
      { key: 'SPECIALISTS', label: 'SPECIALIST WINGS', color: '#6ea88f', filter: m => m.tier > 4 && m.tier <= 6 },
      { key: 'AUXILIARY', label: 'AUXILIARY POOL', color: '#9099a8', filter: m => m.tier > 6 },
    ]
    return buckets.map(b => {
      const sectionMembers = filtered.filter(b.filter)
      const byDivision = {}
      sectionMembers.forEach(m => {
        const div = m.division || 'UNASSIGNED'
        if (!byDivision[div]) byDivision[div] = []
        byDivision[div].push(m)
      })
      Object.keys(byDivision).forEach(div => {
        byDivision[div] = byDivision[div].sort((a, z) => a.tier - z.tier || a.handle.localeCompare(z.handle))
      })
      return { ...b, sectionMembers, byDivision }
    }).filter(s => s.sectionMembers.length > 0)
  }, [filtered])

  const memberMap = useMemo(() => {
    const map = {}
    members.forEach(m => { map[m.id] = m })
    return map
  }, [members])
  const candidates = useMemo(
    () => filtered.filter(m => m.status === 'ACTIVE'),
    [filtered],
  )
  const unassignedCandidates = useMemo(
    () => candidates.filter(m => !squadPlan[m.id]),
    [candidates, squadPlan],
  )
  const laneMembers = useMemo(() => {
    const out = {}
    SQUAD_LANES.forEach(l => { out[l.key] = [] })
    Object.entries(squadPlan).forEach(([memberId, lane]) => {
      if (!out[lane]) return
      const member = memberMap[memberId]
      if (!member) return
      out[lane].push(member)
    })
    SQUAD_LANES.forEach(l => {
      out[l.key] = out[l.key].sort((a, b) => a.tier - b.tier || a.handle.localeCompare(b.handle))
    })
    return out
  }, [squadPlan, memberMap])

  function assignMemberToLane(memberId, laneKey) {
    if (!memberId || !laneKey) return
    setSquadPlan(prev => ({ ...prev, [memberId]: laneKey }))
  }
  function unassignMember(memberId) {
    setSquadPlan(prev => {
      const next = { ...prev }
      delete next[memberId]
      return next
    })
  }
  function clearPlan() {
    setSquadPlan({})
    toast('Squad assignment board cleared', 'info')
  }
  function draftOpFromPlan() {
    const hasAssignments = Object.keys(squadPlan).length > 0
    if (!hasAssignments) {
      toast('Assign at least one operative before drafting an op', 'info')
      return
    }
    const now = new Date()
    const starts = new Date(now.getTime() + 60 * 60 * 1000)
    const rosterLines = SQUAD_LANES
      .map(l => {
        const rows = laneMembers[l.key] || []
        if (!rows.length) return null
        return `## ${l.label}\n${rows.map(m => `- ${m.handle} · ${m.rank} · T${m.tier}`).join('\n')}`
      })
      .filter(Boolean)
      .join('\n\n')
    const payload = {
      title: `Task Force Draft · ${now.toLocaleDateString('en-GB')}`,
      event_type: 'OPERATION',
      location: 'TBD',
      starts_at: starts.toISOString().slice(0, 16),
      min_tier: 9,
      max_slots: Math.max(Object.keys(squadPlan).length, 12),
      description: `Roster-generated deployment draft.\n\n${rosterLines}`,
      created_from: 'roster_squad_plan',
      squad_plan: squadPlan,
      created_at: new Date().toISOString(),
    }
    try { localStorage.setItem('gv_ops_draft', JSON.stringify(payload)) } catch {}
    toast('Operation draft pushed to Ops Board', 'success')
    navigate('/events')
  }

  function openEdit(m) {
    setEditing(m)
    setEditData({
      rank: m.rank, tier: m.tier,
      division: m.division || '',
      speciality: m.speciality || '',
      status: m.status || 'ACTIVE',
    })
    setError('')
  }

  async function saveEdit() {
    if (!canPromote(me.tier, editData.tier)) {
      setError('You do not have the authority to assign this rank.')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        rank: editData.rank,
        tier: parseInt(editData.tier),
        division: editData.division || null,
        speciality: editData.speciality || null,
        status: editData.status,
      })
      .eq('id', editing.id)
    if (error) { setError(error.message); setSaving(false); return }
    if (parseInt(editData.tier) !== editing.tier) {
      const newRankInfo = RANKS.find(r => r.tier === parseInt(editData.tier))
      await supabase.from('activity_log').insert({
        actor_id: me.id, action: 'member_promoted',
        target_type: 'profile', target_id: editing.id,
        details: { title: editing.handle, new_rank: newRankInfo?.label || editData.rank },
      })
      await supabase.from('notifications').insert({
        recipient_id: editing.id, type: 'promotion',
        title: 'Rank Updated',
        message: `You have been assigned ${newRankInfo?.label || editData.rank} by ${me.handle}.`,
        link: '/roster',
      })
      discordPromotion(editing.handle, newRankInfo?.label || editData.rank, me.handle)
    }
    setEditing(null)
    setSaving(false)
    toast(`${editing.handle} updated`, 'success')
    load()
  }

  function exportRoster() {
    exportCSV(members.map(m => ({
      handle: m.handle, rank: m.rank, tier: m.tier,
      division: m.division || '', speciality: m.speciality || '',
      status: m.status, rep: m.rep_score || 0,
      cert_count: certCounts[m.id] || 0,
      cert_completion_pct: readinessMeta(m, certCounts[m.id] || 0, totalCerts).certPct,
      readiness: readinessMeta(m, certCounts[m.id] || 0, totalCerts).score,
      joined: m.joined_at?.slice(0, 10),
    })), 'grayveil_roster')
    toast('Roster exported', 'info')
  }

  return (
    <>
      <ClassificationBar
        section="GRAYVEIL PERSONNEL ROSTER"
        label={tab === 'ALL' ? 'FULL DIRECTORY' : tab}
        right={(
          <>
            <span>OPERATIVES · {members.length}</span>
            <span style={{ color: 'var(--text-2)' }}>ONLINE · {onlineCount}</span>
            <span style={{ color: 'var(--text-2)' }}>COMMAND · {counts.COMMAND || 0}</span>
          </>
        )}
      />

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>ROSTER</h1>
            <div style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 640 }}>
              Division membership directory. {filtered.length} of {members.length} operatives match the current filter.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setViewMode(viewMode === 'CARDS' ? 'CHAIN' : 'CARDS')}>
              {viewMode === 'CARDS' ? 'CHAIN VIEW' : 'CARD VIEW'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={exportRoster}>EXPORT CSV</button>
          </div>
        </div>

        <TabStrip
          active={tab} onChange={setTab}
          tabs={[
            { key: 'ALL',        label: 'ALL',        color: '#e8e3d8',     count: counts.ALL || 0 },
            { key: 'COMMAND',    label: 'COMMAND',    color: '#b89d6d', glyph: '◆', count: counts.COMMAND || 0 },
            { key: 'OFFICER',    label: 'OFFICER',    color: '#6e86ae', glyph: '◉', count: counts.OFFICER || 0 },
            { key: 'SPECIALIST', label: 'SPECIALIST', color: '#6ea88f', glyph: '◎', count: counts.SPECIALIST || 0 },
            { key: 'AUXILIARY',  label: 'AUXILIARY',  color: '#9099a8', glyph: '○', count: counts.AUXILIARY || 0 },
            { key: 'SUSPENDED',  label: 'SUSPENDED',  color: READY_LOW, glyph: '⬢', count: counts.SUSPENDED || 0 },
          ]}
        />
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING ROSTER...</div> : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 10, marginBottom: 16,
            }}>
              <StatCell label="ACTIVE"     value={counts.ACTIVE || 0}    color={READY_HIGH} glyph="◉" desc="full standing" />
              <StatCell label="ONLINE NOW" value={onlineCount}            color="#7f9585" glyph="●" desc="last seen <5m" />
              <StatCell label="DEPLOYABLE" value={deployableCount}        color={READY_MID} glyph="◆" desc="ready to assign" />
              <StatCell label="AVG READY"  value={`${avgReadiness}%`}      color="#6e86ae" glyph="◉" desc="org readiness index" />
              <StatCell label="SUSPENDED"  value={counts.SUSPENDED || 0} color={READY_LOW} glyph="⬢" desc="restricted access" />
            </div>

            <FilterRow
              search={search} setSearch={setSearch}
              placeholder="Search handle, rank, division, speciality, certification..."
              pills={[
                { key: 'ALL', label: 'ALL', color: '#9099a8', count: filtered.length },
                { key: 'DEPLOYABLE', label: 'DEPLOYABLE NOW', color: READY_MID, glyph: '◆', count: members.filter(m => readinessMeta(m, certCounts[m.id] || 0, totalCerts).deployable).length },
                { key: 'NEEDS_CERTS', label: 'NEEDS CERTS', color: '#9f8661', glyph: '⬢', count: members.filter(m => readinessMeta(m, certCounts[m.id] || 0, totalCerts).certPct < 50).length },
                { key: 'INACTIVE_14D', label: 'INACTIVE 14D+', color: '#9099a8', glyph: '○', count: members.filter(m => daysSince(m.last_seen_at) > INACTIVE_THRESHOLD_DAYS).length },
                { key: 'COMMAND_CHAIN', label: 'COMMAND CHAIN', color: '#6e86ae', glyph: '◉', count: members.filter(m => m.tier <= 4).length },
              ]}
              active={preset}
              setActive={setPreset}
            />

            {filtered.length === 0 ? (
              <EmptyState>NO OPERATIVES MATCH THE CURRENT FILTER</EmptyState>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)', gap: 12, alignItems: 'start' }}>
                  <div>
                  {viewMode === 'CARDS' ? (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                      gap: 10,
                    }}>
                      {filtered.map(m => (
                        <RosterCard
                          key={m.id} member={m}
                          isMe={m.id === me.id}
                          selected={m.id === selectedId}
                          certCount={certCounts[m.id] || 0}
                          totalCerts={totalCerts}
                          canEdit={canEdit && m.id !== me.id && me.tier < m.tier}
                          onSelect={() => setSelectedId(m.id)}
                          onView={e => { e.stopPropagation(); setViewing(m) }}
                          onEdit={e => { e.stopPropagation(); openEdit(m) }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {chainSections.map(section => (
                        <div key={section.key} className="card" style={{ padding: 12, borderLeft: `2px solid ${section.color}aa` }}>
                          <div style={{
                            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em',
                            color: section.color, marginBottom: 10,
                          }}>
                            {section.label} · {section.sectionMembers.length}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {Object.entries(section.byDivision).sort((a, b) => a[0].localeCompare(b[0])).map(([division, group]) => (
                              <div key={division} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8, background: 'var(--bg-surface)' }}>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.16em', color: 'var(--text-3)', marginBottom: 6 }}>
                                  {division}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {group.map(m => {
                                    const readiness = readinessMeta(m, certCounts[m.id] || 0, totalCerts)
                                    return (
                                      <button
                                        key={m.id}
                                        onClick={() => setSelectedId(m.id)}
                                        style={{
                                          border: `1px solid ${m.id === selectedId ? '#8fa2be' : 'var(--border)'}`,
                                          background: m.id === selectedId ? 'rgba(143,162,190,0.13)' : 'var(--bg-raised)',
                                          color: m.id === selectedId ? '#9bb0ce' : 'var(--text-2)',
                                          padding: '6px 8px', borderRadius: 4, cursor: 'pointer',
                                          fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 7,
                                        }}
                                      >
                                        <span style={{ fontWeight: 600 }}>{m.handle}</span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>T{m.tier}</span>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: readinessColor(readiness.score) }}>
                                          {readiness.score}%
                                        </span>
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  </div>

                  <MemberIntelPanel
                    member={selectedMember}
                    readiness={selectedReadiness}
                    certCount={selectedMember ? certCounts[selectedMember.id] || 0 : 0}
                    certNames={selectedMember ? certNamesByMember[selectedMember.id] || [] : []}
                    totalCerts={totalCerts}
                    panelData={panelData}
                    loading={panelLoading}
                    canEdit={selectedMember ? canEdit && selectedMember.id !== me.id && me.tier < selectedMember.tier : false}
                    onViewDossier={() => selectedMember && setViewing(selectedMember)}
                    onEdit={() => selectedMember && openEdit(selectedMember)}
                    onMessage={() => navigate('/messages')}
                  />
                </div>

                <div className="card" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em', color: 'var(--text-2)' }}>SQUAD ASSIGNMENT BOARD</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Drag operatives into lanes, then draft an operation from the plan.</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={clearPlan}>CLEAR PLAN</button>
                      <button className="btn btn-primary btn-sm" onClick={draftOpFromPlan}>DRAFT OP FROM PLAN</button>
                    </div>
                  </div>

                  <div
                    style={{ border: '1px dashed var(--border)', borderRadius: 6, padding: 8, marginBottom: 10, background: 'var(--bg-surface)' }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault()
                      const memberId = e.dataTransfer.getData('text/plain') || draggedMemberId
                      unassignMember(memberId)
                      setDraggedMemberId(null)
                    }}
                  >
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em', color: 'var(--text-3)', marginBottom: 6 }}>
                      UNASSIGNED POOL · {unassignedCandidates.length}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {unassignedCandidates.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>No unassigned candidates in current filter.</span>}
                      {unassignedCandidates.map(m => (
                        <MemberChip
                          key={m.id}
                          member={m}
                          onClick={() => setSelectedId(m.id)}
                          onDragStart={() => setDraggedMemberId(m.id)}
                        />
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                    {SQUAD_LANES.map(lane => (
                      <div
                        key={lane.key}
                        style={{ border: `1px solid ${lane.color}33`, borderRadius: 6, padding: 8, background: 'var(--bg-surface)', minHeight: 110 }}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => {
                          e.preventDefault()
                          const memberId = e.dataTransfer.getData('text/plain') || draggedMemberId
                          assignMemberToLane(memberId, lane.key)
                          setDraggedMemberId(null)
                        }}
                      >
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em', color: lane.color, marginBottom: 6 }}>
                          {lane.label} · {(laneMembers[lane.key] || []).length}
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {(laneMembers[lane.key] || []).map(m => (
                            <MemberChip
                              key={m.id}
                              member={m}
                              compact
                              onClick={() => setSelectedId(m.id)}
                              onDragStart={() => setDraggedMemberId(m.id)}
                            />
                          ))}
                          {(laneMembers[lane.key] || []).length === 0 && (
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Drop members here</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* EDIT */}
      {editing && (
        <UeeModal
          accent={tierAccent(editData.tier || editing.tier)}
          kicker={`◆ PERSONNEL FILE · ${editing.handle.toUpperCase()}`}
          title="ASSIGN ORDERS"
          onClose={() => setEditing(null)}
          maxWidth={580}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>CANCEL</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                {saving ? 'SAVING...' : 'CONFIRM CHANGES'}
              </button>
            </>
          )}
        >
          <div className="form-group">
            <label className="form-label">RANK</label>
            <select className="form-select" value={editData.tier}
              onChange={e => {
                const t = parseInt(e.target.value)
                const r = RANKS.find(x => x.tier === t)
                setEditData(d => ({ ...d, tier: t, rank: r.rank }))
              }}>
              {RANKS.filter(r => r.tier > me.tier || me.tier === 1).map(r => (
                <option key={r.tier} value={r.tier}>{r.label} (Tier {r.tier})</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">DIVISION</label>
              <select className="form-select" value={editData.division}
                onChange={e => setEditData(d => ({ ...d, division: e.target.value }))}>
                <option value="">— Select —</option>
                {SC_DIVISIONS.map(d => (
                  <option key={d} value={d} disabled={d === 'High Command' && !me.is_head_founder}>
                    {d}{d === 'High Command' && !me.is_head_founder ? ' · head-only' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">SPECIALITY</label>
              <select className="form-select" value={editData.speciality}
                onChange={e => setEditData(d => ({ ...d, speciality: e.target.value }))}>
                <option value="">— Select —</option>
                {SC_SPECIALITIES.map(s => (
                  <option key={s} value={s} disabled={s === 'Strategic Command' && !me.is_head_founder}>
                    {s}{s === 'Strategic Command' && !me.is_head_founder ? ' · head-only' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">STATUS</label>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {Object.keys(STATUS_META).map(s => {
                const sm = STATUS_META[s]
                const active = editData.status === s
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEditData(d => ({ ...d, status: s }))}
                    style={{
                      flex: 1,
                      background: active ? `${sm.color}1f` : 'var(--bg-raised)',
                      border: `1px solid ${active ? sm.color : 'var(--border)'}`,
                      borderLeft: `3px solid ${sm.color}`,
                      color: active ? sm.color : 'var(--text-2)',
                      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em', fontWeight: 600,
                      padding: '8px 10px', borderRadius: 3, cursor: 'pointer',
                    }}
                  >
                    {sm.glyph} {sm.label}
                  </button>
                )
              })}
            </div>
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
        </UeeModal>
      )}

      {viewing && <MemberDossier member={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
function RosterCard({ member: m, isMe, selected, certCount, totalCerts, canEdit, onSelect, onView, onEdit }) {
  const accent = tierAccent(m.tier)
  const sm = STATUS_META[m.status] || STATUS_META.ACTIVE
  const seen = lastSeenMeta(m.last_seen_at)
  const initials = m.handle.slice(0, 2).toUpperCase()
  const readiness = readinessMeta(m, certCount, totalCerts)
  const readinessTone = readinessColor(readiness.score)

  return (
    <Card accent={selected ? '#8ea4bf' : accent} onClick={onSelect} minHeight={140}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            border: `1.5px solid ${m.avatar_color || accent}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: m.avatar_color || accent,
            background: 'var(--bg-surface)',
          }}>{initials}</div>
          {seen.online && (
            <span style={{
              position: 'absolute', bottom: -1, right: -1,
              width: 12, height: 12, borderRadius: '50%',
              background: READY_HIGH,
              border: '2px solid var(--bg-raised)',
              boxShadow: '0 0 3px rgba(111,194,155,0.6)',
            }} />
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600,
            color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          }}>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {m.handle}
            </span>
            {isMe && <StatusBadge color="#9bb0ce" glyph="◆" label="YOU" />}
            {m.is_founder && <StatusBadge color="#b89d6d" glyph="✦" label="FOUNDER" />}
          </div>
          <div style={{ marginTop: 3 }}>
            <RankBadge tier={m.tier} />
          </div>
        </div>
        <StatusBadge color={sm.color} glyph={sm.glyph} label={sm.label} />
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em',
        color: 'var(--text-3)',
      }}>
        <div>
          <div style={{ fontSize: 8.5, letterSpacing: '.2em' }}>DIVISION</div>
          <div style={{ color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {m.division || '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 8.5, letterSpacing: '.2em' }}>SPECIALITY</div>
          <div style={{ color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {m.speciality || '—'}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 4 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em',
          color: 'var(--text-3)', marginBottom: 4,
        }}>
          <span>CERTS {certCount}/{totalCerts || 0}</span>
          <span style={{ color: readinessTone }}>READINESS {readiness.score}%</span>
        </div>
        <div style={{ height: 6, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${readiness.score}%`, background: readinessTone }} />
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        paddingTop: 6, borderTop: '1px dashed var(--border)',
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em',
      }}>
        <span style={{ color: seen.color }}>● {seen.label}</span>
        <span style={{ color: readiness.deployable ? READY_HIGH : 'var(--text-2)', fontWeight: 600 }}>
          {readiness.deployable ? 'DEPLOYABLE' : `REP ${m.rep_score || 0}`}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onView} style={{
            background: 'transparent', border: '1px solid #7f8ea655',
            color: '#a8b7cd', cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em',
            padding: '2px 7px', borderRadius: 3,
          }}>FILE</button>
          {canEdit && (
            <button onClick={onEdit} style={{
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-3)', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em',
              padding: '2px 8px', borderRadius: 3,
            }}>EDIT</button>
          )}
        </div>
      </div>
    </Card>
  )
}

function MemberIntelPanel({
  member,
  readiness,
  certCount,
  certNames,
  totalCerts,
  panelData,
  loading,
  canEdit,
  onViewDossier,
  onEdit,
  onMessage,
}) {
  if (!member) {
    return (
      <div className="card" style={{ padding: 14, minHeight: 320 }}>
        <div className="empty-state" style={{ margin: 0 }}>Select an operative to view intelligence.</div>
      </div>
    )
  }

  const statusMeta = STATUS_META[member.status] || STATUS_META.ACTIVE
  const readinessTone = readinessColor(readiness?.score || 0)

  return (
    <div className="card" style={{ padding: 14, position: 'sticky', top: 12 }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em',
        color: 'var(--text-2)', marginBottom: 8,
      }}>
        OPERATIVE INTEL PANEL
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>{member.handle}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{member.rank} · T{member.tier}</div>
        </div>
        <StatusBadge color={statusMeta.color} glyph={statusMeta.glyph} label={statusMeta.label} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
        <MiniStat label="READINESS" value={`${readiness?.score || 0}%`} color={readinessTone} />
        <MiniStat label="CERTS" value={`${certCount}/${totalCerts || 0}`} color="#9bb0ce" />
        <MiniStat label="MEDALS" value={panelData.medals} color="var(--text-2)" />
        <MiniStat label="SHIPS" value={panelData.ships} color="var(--text-2)" />
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{
          fontSize: 9, letterSpacing: '.18em', fontFamily: 'var(--font-mono)',
          color: 'var(--text-3)', marginBottom: 4,
        }}>
          CERTIFICATION COVERAGE
        </div>
        <div style={{ height: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${readiness?.certPct || 0}%`, background: readinessTone }} />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{
          fontSize: 9, letterSpacing: '.18em', fontFamily: 'var(--font-mono)',
          color: 'var(--text-3)', marginBottom: 6,
        }}>
          CERTS ON FILE
        </div>
        {certNames.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>No certifications on record.</div>
        ) : (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {certNames.slice(0, 10).map(name => (
              <span key={name} style={{
                fontSize: 9.5, fontFamily: 'var(--font-mono)', letterSpacing: '.08em',
                border: '1px solid var(--border)', borderRadius: 3, padding: '2px 6px',
                background: 'var(--bg-surface)', color: 'var(--text-2)',
              }}>
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{
          fontSize: 9, letterSpacing: '.18em', fontFamily: 'var(--font-mono)',
          color: 'var(--text-3)', marginBottom: 6,
        }}>
          RECENT ACTIVITY
        </div>
        {loading ? <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Loading activity...</div> : null}
        {!loading && panelData.recentActivity.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>No recent activity entries.</div>
        ) : null}
        {!loading && panelData.recentActivity.map(a => (
          <div key={a.id} style={{ padding: '5px 0', borderBottom: '1px dashed var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{(a.action || '').replace(/_/g, ' ').toUpperCase()}</div>
            <div style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{fmtDate(a.created_at)}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={onViewDossier}>OPEN DOSSIER</button>
        <button className="btn btn-ghost btn-sm" onClick={onMessage}>MESSAGE</button>
        {canEdit && <button className="btn btn-primary btn-sm" onClick={onEdit}>EDIT</button>}
      </div>
    </div>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8, background: 'var(--bg-surface)' }}>
      <div style={{ fontSize: 8.5, letterSpacing: '.15em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

function MemberChip({ member, compact, onClick, onDragStart }) {
  const accent = member.avatar_color || tierAccent(member.tier)
  return (
    <button
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('text/plain', member.id)
        onDragStart?.()
      }}
      onClick={onClick}
      style={{
        border: '1px solid var(--border)',
        background: 'var(--bg-raised)',
        borderRadius: 4,
        padding: compact ? '3px 6px' : '4px 7px',
        cursor: 'grab',
        color: 'var(--text-2)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
      }}
      title={`${member.handle} · ${member.rank}`}
    >
      <span style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: accent,
        boxShadow: `0 0 2px ${accent}`,
        flexShrink: 0,
      }} />
      <span>{member.handle}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-3)' }}>T{member.tier}</span>
    </button>
  )
}
