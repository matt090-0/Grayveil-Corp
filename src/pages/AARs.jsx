import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { greenBurst } from '../lib/confetti'
import { formatCredits } from '../lib/ranks'
import { confirmAction } from '../lib/dialogs'
import {
  UEE_AMBER, ClassificationBar, TabStrip, StatCell, FilterRow, Card,
  StatusBadge, Field, EmptyState, UeeModal, SectionHeader, btnMicro,
  fmtDate, timeAgo,
} from '../components/uee'

const OUTCOME_META = {
  SUCCESS: { color: '#5ce0a1', glyph: '✓', label: 'SUCCESS' },
  PARTIAL: { color: UEE_AMBER, glyph: '◐', label: 'PARTIAL' },
  FAILURE: { color: '#e05c5c', glyph: '✕', label: 'FAILURE' },
  ABORTED: { color: '#9099a8', glyph: '○', label: 'ABORTED' },
}

const AAR_GREEN = '#5ce0a1'

// Loot distribution UI
function LootDistributor({ aar, members, onDone }) {
  const toast = useToast()
  const [total, setTotal] = useState(aar.loot_total || 0)
  const [orgTax, setOrgTax] = useState(10)
  const [shipOwnerPct, setShipOwnerPct] = useState(0)
  const [shipOwnerId, setShipOwnerId] = useState('')
  const [distributing, setDistributing] = useState(false)

  const attendees = aar.attendees || []
  const orgCut = Math.floor((total * orgTax) / 100)
  const shipCut = Math.floor((total * shipOwnerPct) / 100)
  const remaining = total - orgCut - shipCut
  const perMember = attendees.length > 0 ? Math.floor(remaining / attendees.length) : 0

  async function distribute() {
    if (!total || total <= 0) { toast('Enter a loot total', 'error'); return }
    if (orgTax + shipOwnerPct > 100) { toast('Splits exceed 100%', 'error'); return }
    if (shipOwnerPct > 0 && !shipOwnerId) { toast('Select ship owner', 'error'); return }
    if (!(await confirmAction(`Distribute ${formatCredits(total)} aUEC? This cannot be undone.`))) return
    setDistributing(true)
    const { error } = await supabase.rpc('distribute_loot', {
      p_aar_id: aar.id, p_total: parseInt(total), p_org_tax_pct: orgTax,
      p_ship_owner_id: shipOwnerId || null, p_ship_owner_pct: shipOwnerPct,
      p_attendees: attendees,
    })
    if (error) { toast(error.message, 'error'); setDistributing(false); return }
    greenBurst()
    toast(`Distributed ${formatCredits(total)} aUEC`, 'success')
    onDone()
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '.2em', color: 'var(--text-3)', marginBottom: 3, fontFamily: 'var(--font-mono)' }}>TOTAL LOOT (aUEC)</div>
          <input className="form-input" type="number" value={total}
            onChange={e => setTotal(e.target.value)}
            style={{ fontSize: 14, fontFamily: 'var(--font-mono)' }} />
        </div>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '.2em', color: 'var(--text-3)', marginBottom: 3, fontFamily: 'var(--font-mono)' }}>ORG TAX %</div>
          <input className="form-input" type="number" min="0" max="100" value={orgTax}
            onChange={e => setOrgTax(parseInt(e.target.value) || 0)} style={{ fontSize: 14 }} />
        </div>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '.2em', color: 'var(--text-3)', marginBottom: 3, fontFamily: 'var(--font-mono)' }}>SHIP OWNER %</div>
          <input className="form-input" type="number" min="0" max="100" value={shipOwnerPct}
            onChange={e => setShipOwnerPct(parseInt(e.target.value) || 0)} style={{ fontSize: 14 }} />
        </div>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '.2em', color: 'var(--text-3)', marginBottom: 3, fontFamily: 'var(--font-mono)' }}>SHIP OWNER {shipOwnerPct > 0 && '*'}</div>
          <select className="form-select" value={shipOwnerId}
            onChange={e => setShipOwnerId(e.target.value)}
            disabled={shipOwnerPct === 0} style={{ fontSize: 12 }}>
            <option value="">— None —</option>
            {attendees.map(aid => {
              const m = members.find(x => x.id === aid)
              return <option key={aid} value={aid}>{m?.handle || aid.slice(0, 8)}</option>
            })}
          </select>
        </div>
      </div>

      <div style={{
        background: 'rgba(0,0,0,0.25)',
        border: `1px solid ${AAR_GREEN}33`,
        borderLeft: `3px solid ${AAR_GREEN}`,
        borderRadius: 3, padding: '10px 12px', marginBottom: 10,
        fontFamily: 'var(--font-mono)', fontSize: 11,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
          <span style={{ color: 'var(--text-3)' }}>Org Treasury ({orgTax}%)</span>
          <span style={{ color: UEE_AMBER }}>+{formatCredits(orgCut)}</span>
        </div>
        {shipOwnerPct > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
            <span style={{ color: 'var(--text-3)' }}>Ship Owner ({shipOwnerPct}%)</span>
            <span style={{ color: UEE_AMBER }}>+{formatCredits(shipCut)}</span>
          </div>
        )}
        <div style={{
          display: 'flex', justifyContent: 'space-between', padding: '5px 0 3px',
          borderTop: '1px solid var(--border)', marginTop: 4,
        }}>
          <span style={{ color: 'var(--text-3)' }}>Per member ({attendees.length} ways)</span>
          <span style={{ color: AAR_GREEN, fontWeight: 600 }}>+{formatCredits(perMember)}</span>
        </div>
      </div>

      <button
        onClick={distribute} disabled={distributing || !total || total <= 0}
        style={{
          ...btnMicro(AAR_GREEN, true),
          padding: '10px 16px', fontSize: 11, justifyContent: 'center',
          textAlign: 'center', display: 'block', width: '100%',
        }}
      >
        {distributing ? 'DISTRIBUTING...' : `◆ DISTRIBUTE ${formatCredits(total)} aUEC`}
      </button>
    </div>
  )
}

function LootSummary({ aarId, members }) {
  const [splits, setSplits] = useState([])
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('loot_splits').select('*').eq('aar_id', aarId).order('amount', { ascending: false })
      setSplits(data || [])
    })()
  }, [aarId])

  if (splits.length === 0) {
    return <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Loading splits...</div>
  }
  return (
    <div style={{ display: 'grid', gap: 3, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
      {splits.map(s => {
        const m = members.find(x => x.id === s.member_id)
        return (
          <div key={s.id} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '4px 0', borderBottom: '1px solid var(--border)',
          }}>
            <span>
              {m?.handle || s.member_id.slice(0, 8)}
              {s.is_ship_owner && <span style={{ color: UEE_AMBER, marginLeft: 6 }}>· SHIP</span>}
            </span>
            <span style={{ color: AAR_GREEN, fontWeight: 600 }}>+{formatCredits(s.amount)}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function AARs() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const [reports, setReports] = useState([])
  const [events, setEvents] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [outcomeFilter, setOutcomeFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  const canFile = me.tier <= 4

  async function load() {
    const [{ data: r }, { data: e }, { data: m }] = await Promise.all([
      supabase.from('after_action_reports')
        .select('*, filer:profiles!after_action_reports_filed_by_fkey(handle), event:events(title)')
        .order('created_at', { ascending: false }),
      supabase.from('events').select('id, title, status').order('starts_at', { ascending: false }).limit(30),
      supabase.from('profiles').select('id, handle').eq('status', 'ACTIVE').order('handle'),
    ])
    setReports(r || [])
    setEvents(e || [])
    setMembers(m || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const counts = useMemo(() => {
    const c = { ALL: reports.length }
    Object.keys(OUTCOME_META).forEach(k => {
      c[k] = reports.filter(r => r.outcome === k).length
    })
    return c
  }, [reports])

  const totals = useMemo(() => ({
    loot: reports.reduce((s, r) => s + (r.loot_total || 0), 0),
    casualties: reports.reduce((s, r) => s + (r.casualties || 0), 0),
    attendees: reports.reduce((s, r) => s + (r.attendees || []).length, 0),
  }), [reports])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return reports
      .filter(r => outcomeFilter === 'ALL' || r.outcome === outcomeFilter)
      .filter(r => !q
        || (r.title || '').toLowerCase().includes(q)
        || (r.summary || '').toLowerCase().includes(q)
        || (r.lessons || '').toLowerCase().includes(q)
        || (r.event?.title || '').toLowerCase().includes(q)
        || (r.filer?.handle || '').toLowerCase().includes(q))
  }, [reports, outcomeFilter, search])

  async function fileAAR(e) {
    e.preventDefault()
    if (!form.title || !form.summary) { setError('Title and summary required.'); return }
    setSaving(true)
    const { error: err } = await supabase.from('after_action_reports').insert({
      event_id: form.event_id || null, title: form.title, summary: form.summary,
      outcome: form.outcome || 'SUCCESS', loot_total: parseInt(form.loot_total) || 0,
      casualties: parseInt(form.casualties) || 0, lessons: form.lessons || null,
      attendees: form.attendees || [], filed_by: me.id,
    })
    if (err) { setError(err.message); setSaving(false); return }
    for (const mid of (form.attendees || [])) {
      await supabase.rpc('award_rep', { p_member_id: mid, p_amount: 5, p_reason: 'Op attendance' })
    }
    // Notify each attendee that they got rep + the AAR was filed
    const attendees = (form.attendees || []).filter(mid => mid && mid !== me.id)
    if (attendees.length > 0) {
      await supabase.from('notifications').insert(attendees.map(mid => ({
        recipient_id: mid,
        type: 'aar',
        title: `AAR filed: ${form.title}`,
        message: `${me.handle} filed an after-action report. You earned +5 rep for attendance.`,
        link: '/aars',
      })))
    }
    await supabase.from('activity_log').insert({
      actor_id: me.id, action: 'aar_filed',
      target_type: 'aar', details: { title: form.title },
    })
    toast('AAR filed — rep awarded to attendees', 'success')
    setModal(null); setSaving(false); setForm({}); load()
  }

  function toggleAttendee(id) {
    setForm(f => {
      const list = f.attendees || []
      return { ...f, attendees: list.includes(id) ? list.filter(x => x !== id) : [...list, id] }
    })
  }

  return (
    <>
      <ClassificationBar
        section="GRAYVEIL POST-OP DEBRIEF ARCHIVE"
        label={outcomeFilter === 'ALL' ? 'ALL REPORTS' : outcomeFilter}
        accent={AAR_GREEN}
        right={(
          <>
            <span>FILED · {reports.length}</span>
            <span style={{ color: AAR_GREEN }}>LOOT BANKED · {formatCredits(totals.loot)}</span>
            {totals.casualties > 0 && <span style={{ color: '#e05c5c' }}>KIA · {totals.casualties}</span>}
          </>
        )}
      />

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>AFTER ACTION REPORTS</h1>
            <div style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 640 }}>
              Op debriefs, casualty counts, lessons learned, and loot distribution. Filing an AAR awards +5 rep per attendee.
            </div>
          </div>
          {canFile && (
            <button className="btn btn-primary" onClick={() => {
              setForm({ outcome: 'SUCCESS', attendees: [] })
              setError(''); setModal('file')
            }}>+ FILE AAR</button>
          )}
        </div>

        <TabStrip
          active={outcomeFilter} onChange={setOutcomeFilter}
          tabs={[
            { key: 'ALL',     label: 'ALL',     color: '#d4d8e0',                count: counts.ALL || 0 },
            { key: 'SUCCESS', label: 'SUCCESS', color: OUTCOME_META.SUCCESS.color, glyph: OUTCOME_META.SUCCESS.glyph, count: counts.SUCCESS || 0 },
            { key: 'PARTIAL', label: 'PARTIAL', color: OUTCOME_META.PARTIAL.color, glyph: OUTCOME_META.PARTIAL.glyph, count: counts.PARTIAL || 0 },
            { key: 'FAILURE', label: 'FAILURE', color: OUTCOME_META.FAILURE.color, glyph: OUTCOME_META.FAILURE.glyph, count: counts.FAILURE || 0 },
            { key: 'ABORTED', label: 'ABORTED', color: OUTCOME_META.ABORTED.color, glyph: OUTCOME_META.ABORTED.glyph, count: counts.ABORTED || 0 },
          ]}
        />
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING ARCHIVE...</div> : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 10, marginBottom: 16,
            }}>
              <StatCell label="REPORTS"      value={reports.length}        color={AAR_GREEN}  glyph="◆" desc="ops debriefed" />
              <StatCell label="LOOT BANKED"  value={formatCredits(totals.loot)} color={UEE_AMBER}  glyph="✦" desc="aUEC distributed" />
              <StatCell label="ATTENDANCE"   value={totals.attendees}      color="#5a80d9"    glyph="◉" desc="op slots filled" />
              <StatCell label="CASUALTIES"   value={totals.casualties}     color={totals.casualties > 0 ? '#e05c5c' : '#9099a8'} glyph="⬢" desc="losses logged" />
            </div>

            <FilterRow
              search={search} setSearch={setSearch}
              placeholder="Search title, summary, lessons, op, filer..."
            />

            {filtered.length === 0 ? (
              <EmptyState>
                {canFile
                  ? <>No reports match. <a onClick={() => { setForm({ outcome: 'SUCCESS', attendees: [] }); setError(''); setModal('file') }} style={{ color: AAR_GREEN, cursor: 'pointer', textDecoration: 'underline' }}>File one</a>.</>
                  : 'No reports filed yet.'}
              </EmptyState>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: 12,
              }}>
                {filtered.map(r => (
                  <AARCard key={r.id} report={r} onOpen={() => setViewing(r)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* VIEW AAR */}
      {viewing && (
        <UeeModal
          accent={(OUTCOME_META[viewing.outcome] || OUTCOME_META.SUCCESS).color}
          kicker={`◆ AAR · ${viewing.outcome}`}
          title={viewing.title}
          onClose={() => setViewing(null)}
          maxWidth={760}
        >
          {viewing.event && (
            <div style={{
              fontSize: 11, color: UEE_AMBER, marginBottom: 12,
              fontFamily: 'var(--font-mono)', letterSpacing: '.18em',
            }}>
              ◆ LINKED OP · {viewing.event.title.toUpperCase()}
            </div>
          )}

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16,
          }}>
            <StatCell label="ATTENDEES"  value={(viewing.attendees || []).length} color="#5a80d9" />
            <StatCell label="LOOT (aUEC)" value={(viewing.loot_total || 0).toLocaleString()} color={AAR_GREEN} />
            <StatCell label="CASUALTIES" value={viewing.casualties || 0} color={viewing.casualties > 0 ? '#e05c5c' : '#9099a8'} />
          </div>

          <SectionHeader label="SUMMARY" color={AAR_GREEN} />
          <div style={{
            background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)',
            borderRadius: 3, padding: 14, fontSize: 13, lineHeight: 1.7,
            color: 'var(--text-2)', whiteSpace: 'pre-wrap', marginBottom: 16,
          }}>
            {viewing.summary}
          </div>

          {viewing.lessons && (
            <>
              <SectionHeader label="LESSONS LEARNED" color={UEE_AMBER} />
              <div style={{
                background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)',
                borderRadius: 3, padding: 14, fontSize: 13, lineHeight: 1.7,
                color: 'var(--text-2)', whiteSpace: 'pre-wrap', marginBottom: 16,
              }}>
                {viewing.lessons}
              </div>
            </>
          )}

          {(viewing.attendees || []).length > 0 && (
            <>
              <SectionHeader label={`PERSONNEL · ${(viewing.attendees || []).length}`} color="#5a80d9" />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
                {(viewing.attendees || []).map(aid => {
                  const m = members.find(x => x.id === aid)
                  return (
                    <span key={aid} style={{
                      background: 'var(--bg-raised)', border: '1px solid var(--border)',
                      borderRadius: 3, padding: '3px 8px', fontSize: 11,
                      fontFamily: 'var(--font-mono)', letterSpacing: '.05em',
                    }}>
                      {m?.handle || aid.slice(0, 8)}
                    </span>
                  )
                })}
              </div>
            </>
          )}

          {/* LOOT DISTRIBUTION */}
          {canFile && (viewing.attendees || []).length > 0 && (
            <div style={{
              padding: 14,
              background: `${AAR_GREEN}0a`,
              border: `1px solid ${AAR_GREEN}33`,
              borderLeft: `3px solid ${AAR_GREEN}`,
              borderRadius: 3,
            }}>
              <div style={{
                fontSize: 10, letterSpacing: '.22em', color: AAR_GREEN,
                fontFamily: 'var(--font-mono)', fontWeight: 600,
                marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>◆ LOOT DISTRIBUTION</span>
                {viewing.loot_distributed && <span>✓ DISTRIBUTED</span>}
              </div>
              {!viewing.loot_distributed ? (
                <LootDistributor aar={viewing} members={members} onDone={() => { load(); setViewing(null) }} />
              ) : (
                <LootSummary aarId={viewing.id} members={members} />
              )}
            </div>
          )}

          <div style={{
            fontSize: 10, color: 'var(--text-3)',
            fontFamily: 'var(--font-mono)', letterSpacing: '.15em',
            marginTop: 14, paddingTop: 10, borderTop: '1px dashed var(--border)',
          }}>
            FILED BY · {(viewing.filer?.handle || '—').toUpperCase()} · {fmtDate(viewing.created_at)}
          </div>
        </UeeModal>
      )}

      {/* FILE AAR */}
      {modal === 'file' && (
        <UeeModal
          accent={AAR_GREEN}
          kicker="◆ NEW AAR · POST-OP DEBRIEF"
          title="FILE AFTER ACTION REPORT"
          onClose={() => setModal(null)}
          maxWidth={720}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
              <button className="btn btn-primary" onClick={fileAAR} disabled={saving}>
                {saving ? 'FILING...' : 'FILE REPORT'}
              </button>
            </>
          )}
        >
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">TITLE *</label>
              <input className="form-input" value={form.title || ''}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Operation name / summary" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">LINKED OP</label>
              <select className="form-select" value={form.event_id || ''}
                onChange={e => setForm(f => ({ ...f, event_id: e.target.value || null }))}>
                <option value="">— None —</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">OUTCOME</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 4 }}>
              {Object.keys(OUTCOME_META).map(k => {
                const m = OUTCOME_META[k]
                const active = form.outcome === k
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, outcome: k }))}
                    style={{
                      background: active ? `${m.color}1f` : 'var(--bg-raised)',
                      border: `1px solid ${active ? m.color : 'var(--border)'}`,
                      borderLeft: `3px solid ${m.color}`,
                      color: active ? m.color : 'var(--text-2)',
                      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em', fontWeight: 600,
                      padding: '8px 10px', borderRadius: 3, cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {m.glyph} {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">SUMMARY *</label>
            <textarea className="form-textarea" style={{ minHeight: 100 }}
              value={form.summary || ''}
              onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
              placeholder="What happened, objectives met, key moments..." />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">LOOT (aUEC)</label>
              <input className="form-input" type="number"
                value={form.loot_total || ''}
                onChange={e => setForm(f => ({ ...f, loot_total: e.target.value }))}
                placeholder="0" />
            </div>
            <div className="form-group">
              <label className="form-label">CASUALTIES</label>
              <input className="form-input" type="number"
                value={form.casualties || ''}
                onChange={e => setForm(f => ({ ...f, casualties: e.target.value }))}
                placeholder="0" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">LESSONS LEARNED</label>
            <textarea className="form-textarea" value={form.lessons || ''}
              onChange={e => setForm(f => ({ ...f, lessons: e.target.value }))}
              placeholder="What to do differently next time..." />
          </div>

          <div className="form-group">
            <label className="form-label">ATTENDEES (click to select — +5 rep each)</label>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 4,
              maxHeight: 140, overflowY: 'auto',
              padding: 8, border: '1px solid var(--border)', borderRadius: 3,
            }}>
              {members.map(m => {
                const selected = (form.attendees || []).includes(m.id)
                return (
                  <span key={m.id} onClick={() => toggleAttendee(m.id)} style={{
                    padding: '4px 10px', fontSize: 11, borderRadius: 3, cursor: 'pointer',
                    fontFamily: 'var(--font-mono)', letterSpacing: '.05em',
                    background: selected ? `${AAR_GREEN}1f` : 'var(--bg-raised)',
                    border: `1px solid ${selected ? AAR_GREEN : 'var(--border)'}`,
                    color: selected ? AAR_GREEN : 'var(--text-2)',
                  }}>{m.handle}</span>
                )
              })}
            </div>
            <div style={{
              fontSize: 10, color: 'var(--text-3)', marginTop: 4,
              fontFamily: 'var(--font-mono)', letterSpacing: '.15em',
            }}>
              {(form.attendees || []).length} SELECTED · +{(form.attendees || []).length * 5} REP TOTAL
            </div>
          </div>

          {error && <div className="form-error mb-8">{error}</div>}
        </UeeModal>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
function AARCard({ report: r, onOpen }) {
  const meta = OUTCOME_META[r.outcome] || OUTCOME_META.SUCCESS
  return (
    <Card accent={meta.color} onClick={onOpen} minHeight={170}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 14.5, fontWeight: 600,
            color: 'var(--text-1)', lineHeight: 1.25,
          }}>
            {r.title}
          </div>
          {r.event && (
            <div style={{
              fontSize: 10, color: UEE_AMBER, marginTop: 4,
              fontFamily: 'var(--font-mono)', letterSpacing: '.15em',
            }}>
              ◆ {r.event.title.toUpperCase()}
            </div>
          )}
        </div>
        <StatusBadge color={meta.color} glyph={meta.glyph} label={meta.label} />
      </div>

      <div style={{
        fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {r.summary}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6,
        paddingTop: 8, borderTop: '1px dashed var(--border)',
      }}>
        <Field label="ATTENDEES" value={(r.attendees || []).length} mono />
        <Field label="LOOT" value={r.loot_total > 0 ? r.loot_total.toLocaleString() : '—'} mono color={r.loot_total > 0 ? AAR_GREEN : undefined} />
        <Field label="KIA" value={r.casualties || 0} mono color={r.casualties > 0 ? '#e05c5c' : undefined} />
      </div>

      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.15em',
        color: 'var(--text-3)',
      }}>
        FILED BY {(r.filer?.handle || '—').toUpperCase()} · {timeAgo(r.created_at)}
        {r.loot_distributed && <span style={{ color: AAR_GREEN, marginLeft: 8 }}>✓ DISTRIBUTED</span>}
      </div>
    </Card>
  )
}
