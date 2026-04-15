import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { goldBurst } from '../lib/confetti'
import { discordNewOp } from '../lib/discord'
import ReactMarkdown from 'react-markdown'

const CATEGORIES = ['ALL', 'COMBAT', 'MINING', 'TRADE', 'ESCORT', 'RECON', 'SALVAGE', 'RACING', 'GENERAL']
const CAT_BADGE = { COMBAT: 'badge-red', MINING: 'badge-amber', TRADE: 'badge-green', ESCORT: 'badge-blue', RECON: 'badge-purple', SALVAGE: 'badge-muted', RACING: 'badge-accent', GENERAL: 'badge-muted' }

export default function OpTemplates() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('ALL')

  const canCreate = me.tier <= 4

  async function load() {
    const { data } = await supabase.from('op_templates').select('*, creator:profiles!op_templates_created_by_fkey(handle)').order('use_count', { ascending: false })
    setTemplates(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = filter === 'ALL' ? templates : templates.filter(t => t.category === filter)

  async function saveTemplate(e) {
    e.preventDefault()
    if (!form.name || !form.briefing) { setError('Name and briefing are required.'); return }
    setSaving(true)
    const payload = {
      name: form.name, description: form.description || '',
      event_type: form.event_type || 'OPERATION', location: form.location || null,
      duration_hours: parseFloat(form.duration_hours) || 2,
      min_slots: parseInt(form.min_slots) || 4, max_slots: parseInt(form.max_slots) || 12,
      min_tier: parseInt(form.min_tier) || 9,
      required_roles: (form.roles_text || '').split('\n').map(s => s.trim()).filter(Boolean),
      required_ships: (form.ships_text || '').split('\n').map(s => s.trim()).filter(Boolean),
      briefing: form.briefing, category: form.category || 'GENERAL',
      is_public: form.is_public !== false, created_by: me.id,
    }
    if (form.editing_id) {
      await supabase.from('op_templates').update(payload).eq('id', form.editing_id)
      toast('Template updated', 'success')
    } else {
      await supabase.from('op_templates').insert(payload)
      toast('Template created', 'success')
    }
    setModal(null); setSaving(false); setForm({}); load()
  }

  async function launchOp(tpl) {
    const startsAt = new Date()
    startsAt.setHours(startsAt.getHours() + 1)
    const { error: err } = await supabase.from('events').insert({
      title: tpl.name,
      description: tpl.briefing,
      event_type: tpl.event_type || 'OPERATION',
      location: tpl.location || 'TBD',
      starts_at: startsAt.toISOString(),
      min_tier: tpl.min_tier || 9,
      max_slots: tpl.max_slots || 12,
      created_by: me.id,
      status: 'SCHEDULED',
    })
    if (err) { toast(err.message, 'error'); return }
    await supabase.from('op_templates').update({ use_count: (tpl.use_count || 0) + 1 }).eq('id', tpl.id)
    goldBurst()
    discordNewOp(tpl.name, tpl.event_type, tpl.location, 'In 1 hour', me.handle)
    toast(`Op "${tpl.name}" scheduled — starts in 1 hour`, 'success')
    navigate('/events')
  }

  function openEdit(tpl) {
    setForm({
      editing_id: tpl.id, name: tpl.name, description: tpl.description,
      event_type: tpl.event_type, location: tpl.location,
      duration_hours: tpl.duration_hours, min_slots: tpl.min_slots, max_slots: tpl.max_slots,
      min_tier: tpl.min_tier, roles_text: (tpl.required_roles || []).join('\n'),
      ships_text: (tpl.required_ships || []).join('\n'),
      briefing: tpl.briefing, category: tpl.category, is_public: tpl.is_public,
    })
    setError(''); setModal('create')
  }

  async function deleteTemplate(id) {
    if (!confirm('Delete this template?')) return
    await supabase.from('op_templates').delete().eq('id', id)
    toast('Template deleted', 'info'); setViewing(null); load()
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title">OP TEMPLATES</div>
            <div className="page-subtitle">{templates.length} saved briefings · Launch ops in one click</div>
          </div>
          {canCreate && <button className="btn btn-primary" onClick={() => { setForm({ category: 'GENERAL', min_tier: 9, min_slots: 4, max_slots: 12, duration_hours: 2, event_type: 'OPERATION', is_public: true }); setError(''); setModal('create') }}>+ NEW TEMPLATE</button>}
        </div>
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <button key={c} className="btn btn-ghost btn-sm" style={filter === c ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}} onClick={() => setFilter(c)}>{c}</button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING...</div> : filtered.length === 0 ? (
          <div className="empty-state">NO TEMPLATES{filter !== 'ALL' ? ` IN ${filter}` : ''}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {filtered.map(t => (
              <div key={t.id} className="card" style={{ cursor: 'pointer', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }} onClick={() => setViewing(t)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{t.name}</span>
                  <span className={`badge ${CAT_BADGE[t.category]}`} style={{ fontSize: 10 }}>{t.category}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{t.description}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(t.required_roles || []).slice(0, 3).map((r, i) => (
                    <span key={i} style={{ fontSize: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px', color: 'var(--text-2)' }}>{r}</span>
                  ))}
                  {(t.required_roles || []).length > 3 && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>+{t.required_roles.length - 3} more</span>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  <span>{t.min_slots}-{t.max_slots} players · {t.duration_hours}h · {t.location || 'TBD'}</span>
                  <span>{t.use_count || 0}x used</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ VIEW TEMPLATE ═══ */}
      {viewing && (
        <Modal title="" onClose={() => setViewing(null)} size="modal-lg">
          <div style={{ margin: '-20px -24px -16px' }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, rgba(200,165,90,0.06), rgba(200,165,90,0.12))', borderBottom: '1px solid rgba(200,165,90,0.2)', padding: '24px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>{viewing.name}</span>
                  <span className={`badge ${CAT_BADGE[viewing.category]}`} style={{ fontSize: 10 }}>{viewing.category}</span>
                </div>
                <div className="flex gap-8">
                  {canCreate && <button className="btn btn-primary btn-sm" onClick={() => launchOp(viewing)}>LAUNCH OP</button>}
                  {(viewing.created_by === me.id || me.tier <= 3) && (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={() => { openEdit(viewing); setViewing(null) }}>EDIT</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => deleteTemplate(viewing.id)}>DELETE</button>
                    </>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>{viewing.description}</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                <span>{viewing.min_slots}-{viewing.max_slots} players</span>
                <span>{viewing.duration_hours}h estimated</span>
                <span>{viewing.location || 'Location TBD'}</span>
                <span>Min tier: {viewing.min_tier}</span>
                <span>Used {viewing.use_count || 0} times</span>
              </div>
            </div>

            <div style={{ padding: '20px 28px 24px' }}>
              {/* Required roles + ships */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                {(viewing.required_roles || []).length > 0 && (
                  <div>
                    <div style={{ fontSize: 9, letterSpacing: '.2em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid rgba(200,165,90,0.15)' }}>REQUIRED ROLES</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {viewing.required_roles.map((r, i) => (
                        <div key={i} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                          {r}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(viewing.required_ships || []).length > 0 && (
                  <div>
                    <div style={{ fontSize: 9, letterSpacing: '.2em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid rgba(200,165,90,0.15)' }}>RECOMMENDED SHIPS</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {viewing.required_ships.map((s, i) => (
                        <span key={i} style={{ fontSize: 11, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 8px' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Briefing */}
              <div style={{ fontSize: 9, letterSpacing: '.2em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid rgba(200,165,90,0.15)' }}>OPERATION BRIEFING</div>
              <div className="wiki-content" style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
                padding: 20, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.8,
                fontFamily: 'var(--font-mono)', maxHeight: 400, overflowY: 'auto', whiteSpace: 'pre-wrap',
              }}>
                <ReactMarkdown>{viewing.briefing}</ReactMarkdown>
              </div>

              <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 12 }}>
                Created by {viewing.creator?.handle || '—'}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══ CREATE/EDIT TEMPLATE ═══ */}
      {modal === 'create' && (
        <Modal title={form.editing_id ? 'EDIT TEMPLATE' : 'NEW OP TEMPLATE'} onClose={() => setModal(null)} size="modal-lg">
          <form onSubmit={saveTemplate}>
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">TEMPLATE NAME *</label>
                <input className="form-input" value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Jumptown Lockdown" />
              </div>
              <div className="form-group">
                <label className="form-label">CATEGORY</label>
                <select className="form-select" value={form.category || 'GENERAL'} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.filter(c => c !== 'ALL').map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">SHORT DESCRIPTION</label>
              <input className="form-input" value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="One-line summary of this operation type" />
            </div>

            <div className="form-row">
              <div className="form-group"><label className="form-label">TYPE</label>
                <select className="form-select" value={form.event_type || 'OPERATION'} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}>
                  <option>OPERATION</option><option>TRAINING</option><option>SOCIAL</option><option>MEETING</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">LOCATION</label><input className="form-input" value={form.location || ''} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Yela Belt" /></div>
              <div className="form-group"><label className="form-label">DURATION (h)</label><input className="form-input" type="number" step="0.5" value={form.duration_hours || ''} onChange={e => setForm(f => ({ ...f, duration_hours: e.target.value }))} /></div>
            </div>

            <div className="form-row">
              <div className="form-group"><label className="form-label">MIN PLAYERS</label><input className="form-input" type="number" value={form.min_slots || ''} onChange={e => setForm(f => ({ ...f, min_slots: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">MAX PLAYERS</label><input className="form-input" type="number" value={form.max_slots || ''} onChange={e => setForm(f => ({ ...f, max_slots: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">MIN TIER</label><input className="form-input" type="number" min="1" max="9" value={form.min_tier || ''} onChange={e => setForm(f => ({ ...f, min_tier: e.target.value }))} /></div>
            </div>

            <div className="form-row">
              <div className="form-group"><label className="form-label">REQUIRED ROLES (one per line)</label><textarea className="form-textarea" style={{ minHeight: 60 }} value={form.roles_text || ''} onChange={e => setForm(f => ({ ...f, roles_text: e.target.value }))} placeholder="Fighter Escort x3&#10;Ground Team x2&#10;Cargo Hauler x1" /></div>
              <div className="form-group"><label className="form-label">RECOMMENDED SHIPS (one per line)</label><textarea className="form-textarea" style={{ minHeight: 60 }} value={form.ships_text || ''} onChange={e => setForm(f => ({ ...f, ships_text: e.target.value }))} placeholder="Gladius&#10;Arrow&#10;Cutlass Black" /></div>
            </div>

            <div className="form-group">
              <label className="form-label">FULL BRIEFING *</label>
              <textarea className="form-textarea" style={{ minHeight: 180, fontFamily: 'var(--font-mono)', fontSize: 12 }} value={form.briefing || ''} onChange={e => setForm(f => ({ ...f, briefing: e.target.value }))} placeholder="Full operation briefing — phases, procedures, contingencies, payout..." />
            </div>

            {error && <div className="form-error mb-8">{error}</div>}
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'SAVING...' : form.editing_id ? 'UPDATE TEMPLATE' : 'CREATE TEMPLATE'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
