import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { SC_SHIPS } from '../lib/ships'
import Modal from '../components/Modal'
import { confirmAction } from '../lib/dialogs'

function fmt(ts) { return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) }

export default function Loadouts() {
  const { profile: me } = useAuth()
  const [loadouts, setLoadouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [shipSearch, setShipSearch] = useState('')
  const [showDrop, setShowDrop] = useState(false)

  async function load() {
    const { data } = await supabase.from('ship_loadouts').select('*, author:profiles(handle)').order('ship_class').order('name')
    setLoadouts(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = loadouts.filter(l => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return l.ship_class.toLowerCase().includes(q) || l.name.toLowerCase().includes(q) || (l.role || '').toLowerCase().includes(q)
  })

  const shipResults = useMemo(() => {
    if (!shipSearch) return SC_SHIPS.slice(0, 15)
    return SC_SHIPS.filter(s => s.name.toLowerCase().includes(shipSearch.toLowerCase())).slice(0, 15)
  }, [shipSearch])

  async function saveLoadout() {
    if (!form.ship_class || !form.name) { setError('Ship and name required.'); return }
    setSaving(true)
    const components = { weapons: form.weapons || '', shields: form.shields || '', qd: form.qd || '', coolers: form.coolers || '', powerplant: form.powerplant || '', other: form.other || '' }
    if (modal === 'new') {
      await supabase.from('ship_loadouts').insert({ ship_class: form.ship_class, name: form.name, role: form.role || null, description: form.description || null, components, created_by: me.id })
    } else {
      await supabase.from('ship_loadouts').update({ ship_class: form.ship_class, name: form.name, role: form.role || null, description: form.description || null, components }).eq('id', modal.id)
    }
    setModal(null); setSaving(false); load()
  }

  async function deleteLoadout(id) {
    if (!(await confirmAction('Delete this loadout?'))) return
    await supabase.from('ship_loadouts').delete().eq('id', id); load()
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title">SHIP LOADOUTS</div>
            <div className="page-subtitle">{loadouts.length} shared builds</div>
          </div>
          <button className="btn btn-primary" onClick={() => { setForm({}); setShipSearch(''); setError(''); setModal('new') }}>+ NEW LOADOUT</button>
        </div>
        <input className="form-input" style={{ maxWidth: 300 }} placeholder="Filter by ship, name, or role..." value={filter} onChange={e => setFilter(e.target.value)} />
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING...</div> : filtered.length === 0 ? <div className="empty-state">NO LOADOUTS</div> : (
          <div className="grid-auto">
            {filtered.map(l => {
              const comp = l.components || {}
              return (
                <div key={l.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="flex items-center justify-between">
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{l.name}</span>
                    <div className="flex gap-8">
                      {(l.created_by === me.id || me.tier <= 4) && <button className="btn btn-ghost btn-sm btn-icon" onClick={() => deleteLoadout(l.id)}>✕</button>}
                    </div>
                  </div>
                  <div className="flex gap-8">
                    <span className="badge badge-accent" style={{ fontSize: 10 }}>{l.ship_class}</span>
                    {l.role && <span className="badge badge-muted" style={{ fontSize: 10 }}>{l.role}</span>}
                  </div>
                  {l.description && <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{l.description}</p>}
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {comp.weapons && <div><span style={{ color: 'var(--red)' }}>WPN:</span> {comp.weapons}</div>}
                    {comp.shields && <div><span style={{ color: 'var(--blue)' }}>SHD:</span> {comp.shields}</div>}
                    {comp.qd && <div><span style={{ color: 'var(--accent)' }}>QD:</span> {comp.qd}</div>}
                    {comp.powerplant && <div><span style={{ color: 'var(--amber)' }}>PWR:</span> {comp.powerplant}</div>}
                    {comp.coolers && <div><span style={{ color: 'var(--green)' }}>CLR:</span> {comp.coolers}</div>}
                    {comp.other && <div><span style={{ color: 'var(--text-2)' }}>OTH:</span> {comp.other}</div>}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 'auto' }}>by {l.author?.handle} · {fmt(l.created_at)}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'new' ? 'NEW LOADOUT' : 'EDIT LOADOUT'} onClose={() => setModal(null)} size="modal-lg">
          <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label">SHIP *</label>
            <input className="form-input" value={shipSearch} onChange={e => { setShipSearch(e.target.value); setShowDrop(true) }} onFocus={() => setShowDrop(true)} placeholder="Search ships..." autoComplete="off" />
            {form.ship_class && <div style={{ marginTop: 4 }}><span className="badge badge-accent">{form.ship_class}</span></div>}
            {showDrop && shipResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg-raised)', border: '1px solid var(--border-md)', borderRadius: 'var(--radius-sm)', maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
                {shipResults.map(s => (
                  <div key={s.name} onClick={() => { setForm(f => ({ ...f, ship_class: s.name })); setShipSearch(s.name); setShowDrop(false) }}
                    style={{ padding: '6px 12px', cursor: 'pointer', fontSize: 12, borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {s.name} <span style={{ color: 'var(--text-3)' }}>— {s.manufacturer}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">BUILD NAME *</label><input className="form-input" value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. PvP Brawler, Mining Config" /></div>
            <div className="form-group"><label className="form-label">ROLE</label><input className="form-input" value={form.role || ''} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Dogfighting, Cargo Run" /></div>
          </div>
          <div className="form-group"><label className="form-label">DESCRIPTION</label><textarea className="form-textarea" value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="When to use this build, strategy notes..." /></div>
          <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>◆ COMPONENTS</div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">WEAPONS</label><input className="form-input" value={form.weapons || ''} onChange={e => setForm(f => ({ ...f, weapons: e.target.value }))} placeholder="e.g. 2x S5 AD5B, 2x S4 Attrition" /></div>
            <div className="form-group"><label className="form-label">SHIELDS</label><input className="form-input" value={form.shields || ''} onChange={e => setForm(f => ({ ...f, shields: e.target.value }))} placeholder="e.g. FR-76, Palisade" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">QUANTUM DRIVE</label><input className="form-input" value={form.qd || ''} onChange={e => setForm(f => ({ ...f, qd: e.target.value }))} placeholder="e.g. XL-1" /></div>
            <div className="form-group"><label className="form-label">POWER PLANT</label><input className="form-input" value={form.powerplant || ''} onChange={e => setForm(f => ({ ...f, powerplant: e.target.value }))} placeholder="e.g. Erebus" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">COOLERS</label><input className="form-input" value={form.coolers || ''} onChange={e => setForm(f => ({ ...f, coolers: e.target.value }))} placeholder="e.g. 2x Zero Rush" /></div>
            <div className="form-group"><label className="form-label">OTHER</label><input className="form-input" value={form.other || ''} onChange={e => setForm(f => ({ ...f, other: e.target.value }))} placeholder="Missiles, utility, etc." /></div>
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button><button className="btn btn-primary" onClick={saveLoadout} disabled={saving}>{saving ? 'SAVING...' : 'PUBLISH'}</button></div>
        </Modal>
      )}
    </>
  )
}
