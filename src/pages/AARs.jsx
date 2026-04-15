import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'

function fmt(ts) { return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
const OUTCOME_BADGE = { SUCCESS: 'badge-green', PARTIAL: 'badge-amber', FAILURE: 'badge-red', ABORTED: 'badge-muted' }

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

  const canFile = me.tier <= 4

  async function load() {
    const [{ data: r }, { data: e }, { data: m }] = await Promise.all([
      supabase.from('after_action_reports').select('*, filer:profiles!after_action_reports_filed_by_fkey(handle), event:events(title)').order('created_at', { ascending: false }),
      supabase.from('events').select('id, title, status').order('starts_at', { ascending: false }).limit(30),
      supabase.from('profiles').select('id, handle').eq('status', 'ACTIVE').order('handle'),
    ])
    setReports(r || []); setEvents(e || []); setMembers(m || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

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
    // Award rep to attendees
    for (const mid of (form.attendees || [])) {
      await supabase.rpc('award_rep', { p_member_id: mid, p_amount: 5, p_reason: 'Op attendance' })
    }
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
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title">AFTER ACTION REPORTS</div>
            <div className="page-subtitle">{reports.length} reports filed</div>
          </div>
          {canFile && <button className="btn btn-primary" onClick={() => { setForm({ outcome: 'SUCCESS', attendees: [] }); setError(''); setModal('file') }}>FILE AAR</button>}
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING...</div> : reports.length === 0 ? (
          <div className="empty-state">NO REPORTS FILED</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reports.map(r => (
              <div key={r.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setViewing(r)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</span>
                    <span className={`badge ${OUTCOME_BADGE[r.outcome]}`}>{r.outcome}</span>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{fmt(r.created_at)}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.summary}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', display: 'flex', gap: 16 }}>
                  {r.event && <span>OP: {r.event.title}</span>}
                  <span>Filed by {r.filer?.handle}</span>
                  <span>{(r.attendees || []).length} attended</span>
                  {r.loot_total > 0 && <span>Loot: {r.loot_total.toLocaleString()} aUEC</span>}
                  {r.casualties > 0 && <span style={{ color: 'var(--red)' }}>Casualties: {r.casualties}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View AAR */}
      {viewing && (
        <Modal title="AFTER ACTION REPORT" onClose={() => setViewing(null)} size="modal-lg">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>{viewing.title}</span>
            <span className={`badge ${OUTCOME_BADGE[viewing.outcome]}`}>{viewing.outcome}</span>
          </div>
          {viewing.event && <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 8 }}>LINKED OP: {viewing.event.title}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 6, padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 8, letterSpacing: '.1em', color: 'var(--text-3)' }}>ATTENDEES</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{(viewing.attendees || []).length}</div>
            </div>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 6, padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 8, letterSpacing: '.1em', color: 'var(--text-3)' }}>LOOT</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--green)' }}>{(viewing.loot_total || 0).toLocaleString()}</div>
            </div>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 6, padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 8, letterSpacing: '.1em', color: 'var(--text-3)' }}>CASUALTIES</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: viewing.casualties > 0 ? 'var(--red)' : 'var(--text-1)' }}>{viewing.casualties || 0}</div>
            </div>
          </div>

          <div style={{ fontSize: 10, letterSpacing: '.1em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>SUMMARY</div>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 6, padding: 14, fontSize: 13, lineHeight: 1.8, color: 'var(--text-2)', whiteSpace: 'pre-wrap', marginBottom: 16 }}>{viewing.summary}</div>

          {viewing.lessons && (
            <>
              <div style={{ fontSize: 10, letterSpacing: '.1em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>LESSONS LEARNED</div>
              <div style={{ background: 'var(--bg-surface)', borderRadius: 6, padding: 14, fontSize: 13, lineHeight: 1.8, color: 'var(--text-2)', whiteSpace: 'pre-wrap', marginBottom: 16 }}>{viewing.lessons}</div>
            </>
          )}

          {(viewing.attendees || []).length > 0 && (
            <>
              <div style={{ fontSize: 10, letterSpacing: '.1em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>PERSONNEL</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(viewing.attendees || []).map(aid => {
                  const m = members.find(x => x.id === aid)
                  return <span key={aid} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 8px', fontSize: 11 }}>{m?.handle || aid.slice(0, 8)}</span>
                })}
              </div>
            </>
          )}
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 12 }}>Filed by {viewing.filer?.handle} · {fmt(viewing.created_at)}</div>
        </Modal>
      )}

      {/* File AAR */}
      {modal === 'file' && (
        <Modal title="FILE AFTER ACTION REPORT" onClose={() => setModal(null)} size="modal-lg">
          <form onSubmit={fileAAR}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}><label className="form-label">TITLE *</label><input className="form-input" value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Operation name / summary" /></div>
              <div className="form-group"><label className="form-label">LINKED EVENT</label>
                <select className="form-select" value={form.event_id || ''} onChange={e => setForm(f => ({ ...f, event_id: e.target.value || null }))}>
                  <option value="">— None —</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">SUMMARY *</label><textarea className="form-textarea" style={{ minHeight: 100 }} value={form.summary || ''} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} placeholder="What happened, objectives met, key moments..." /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">OUTCOME</label>
                <select className="form-select" value={form.outcome || 'SUCCESS'} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}>
                  <option>SUCCESS</option><option>PARTIAL</option><option>FAILURE</option><option>ABORTED</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">LOOT (aUEC)</label><input className="form-input" type="number" value={form.loot_total || ''} onChange={e => setForm(f => ({ ...f, loot_total: e.target.value }))} placeholder="0" /></div>
              <div className="form-group"><label className="form-label">CASUALTIES</label><input className="form-input" type="number" value={form.casualties || ''} onChange={e => setForm(f => ({ ...f, casualties: e.target.value }))} placeholder="0" /></div>
            </div>
            <div className="form-group"><label className="form-label">LESSONS LEARNED</label><textarea className="form-textarea" value={form.lessons || ''} onChange={e => setForm(f => ({ ...f, lessons: e.target.value }))} placeholder="What to do differently next time..." /></div>
            <div className="form-group">
              <label className="form-label">ATTENDEES (click to select — +5 rep each)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
                {members.map(m => (
                  <span key={m.id} onClick={() => toggleAttendee(m.id)} style={{
                    padding: '4px 10px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
                    background: (form.attendees || []).includes(m.id) ? 'var(--accent-dim)' : 'var(--bg-surface)',
                    border: `1px solid ${(form.attendees || []).includes(m.id) ? 'var(--accent)' : 'var(--border)'}`,
                    color: (form.attendees || []).includes(m.id) ? 'var(--accent)' : 'var(--text-2)',
                  }}>{m.handle}</span>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>{(form.attendees || []).length} selected</div>
            </div>
            {error && <div className="form-error mb-8">{error}</div>}
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'FILING...' : 'FILE REPORT'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
