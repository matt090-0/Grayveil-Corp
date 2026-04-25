import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
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
  ACTIVE:    { color: '#5ce0a1', glyph: '◉', label: 'ACTIVE' },
  INACTIVE:  { color: '#9099a8', glyph: '○', label: 'INACTIVE' },
  SUSPENDED: { color: '#e05c5c', glyph: '⬢', label: 'SUSPENDED' },
}

function lastSeenMeta(ts) {
  if (!ts) return { label: 'NEVER', color: 'var(--text-3)', online: false }
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 300)   return { label: 'ONLINE',          color: '#5ce0a1', online: true }
  if (diff < 3600)  return { label: `${Math.floor(diff / 60)}M AGO`,    color: UEE_AMBER, online: false }
  if (diff < 86400) return { label: `${Math.floor(diff / 3600)}H AGO`,  color: 'var(--text-2)', online: false }
  return                  { label: `${Math.floor(diff / 86400)}D AGO`,  color: 'var(--text-3)', online: false }
}

function tierAccent(tier) {
  if (tier <= 2) return UEE_AMBER       // Command
  if (tier <= 4) return '#5a80d9'       // Officer
  if (tier <= 6) return '#5ce0a1'       // Specialist
  return '#9099a8'                      // Recruit / Auxiliary
}

export default function Roster() {
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

  async function load() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('tier')
      .order('handle')
    setMembers(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

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
      .filter(m => !q
        || m.handle.toLowerCase().includes(q)
        || (m.rank || '').toLowerCase().includes(q)
        || (m.division || '').toLowerCase().includes(q)
        || (m.speciality || '').toLowerCase().includes(q))
  }, [members, tab, search])

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
            <span style={{ color: '#5ce0a1' }}>ONLINE · {onlineCount}</span>
            <span style={{ color: UEE_AMBER }}>COMMAND · {counts.COMMAND || 0}</span>
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
          <button className="btn btn-ghost btn-sm" onClick={exportRoster}>EXPORT CSV</button>
        </div>

        <TabStrip
          active={tab} onChange={setTab}
          tabs={[
            { key: 'ALL',        label: 'ALL',        color: '#d4d8e0',     count: counts.ALL || 0 },
            { key: 'COMMAND',    label: 'COMMAND',    color: UEE_AMBER, glyph: '◆', count: counts.COMMAND || 0 },
            { key: 'OFFICER',    label: 'OFFICER',    color: '#5a80d9', glyph: '◉', count: counts.OFFICER || 0 },
            { key: 'SPECIALIST', label: 'SPECIALIST', color: '#5ce0a1', glyph: '◎', count: counts.SPECIALIST || 0 },
            { key: 'AUXILIARY',  label: 'AUXILIARY',  color: '#9099a8', glyph: '○', count: counts.AUXILIARY || 0 },
            { key: 'SUSPENDED',  label: 'SUSPENDED',  color: '#e05c5c', glyph: '⬢', count: counts.SUSPENDED || 0 },
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
              <StatCell label="ACTIVE"     value={counts.ACTIVE || 0}    color="#5ce0a1" glyph="◉" desc="full standing" />
              <StatCell label="ONLINE NOW" value={onlineCount}            color="#5ce0a1" glyph="●" desc="last seen <5m" />
              <StatCell label="INACTIVE"   value={counts.INACTIVE || 0}  color="#9099a8" glyph="○" desc="dormant" />
              <StatCell label="SUSPENDED"  value={counts.SUSPENDED || 0} color="#e05c5c" glyph="⬢" desc="restricted access" />
            </div>

            <FilterRow
              search={search} setSearch={setSearch}
              placeholder="Search handle, rank, division, speciality..."
            />

            {filtered.length === 0 ? (
              <EmptyState>NO OPERATIVES MATCH THE CURRENT FILTER</EmptyState>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 10,
              }}>
                {filtered.map(m => (
                  <RosterCard
                    key={m.id} member={m}
                    isMe={m.id === me.id}
                    canEdit={canEdit && m.id !== me.id && me.tier < m.tier}
                    onOpen={() => setViewing(m)}
                    onEdit={e => { e.stopPropagation(); openEdit(m) }}
                  />
                ))}
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
function RosterCard({ member: m, isMe, canEdit, onOpen, onEdit }) {
  const accent = tierAccent(m.tier)
  const sm = STATUS_META[m.status] || STATUS_META.ACTIVE
  const seen = lastSeenMeta(m.last_seen_at)
  const initials = m.handle.slice(0, 2).toUpperCase()

  return (
    <Card accent={accent} onClick={onOpen} minHeight={140}>
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
              background: '#5ce0a1',
              border: '2px solid var(--bg-raised)',
              boxShadow: '0 0 6px #5ce0a1',
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
            {isMe && <StatusBadge color={UEE_AMBER} glyph="◆" label="YOU" />}
            {m.is_founder && <StatusBadge color={UEE_AMBER} glyph="✦" label="FOUNDER" />}
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

      <div style={{ flex: 1 }} />

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        paddingTop: 6, borderTop: '1px dashed var(--border)',
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em',
      }}>
        <span style={{ color: seen.color }}>● {seen.label}</span>
        <span style={{ color: UEE_AMBER, fontWeight: 600 }}>REP {m.rep_score || 0}</span>
        {canEdit && (
          <button onClick={onEdit} style={{
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-3)', cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em',
            padding: '2px 8px', borderRadius: 3,
          }}>EDIT</button>
        )}
      </div>
    </Card>
  )
}
