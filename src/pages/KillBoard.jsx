import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { SC_LOCATIONS } from '../lib/scdata'
import { SC_SHIPS } from '../lib/ships'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { discordKill } from '../lib/discord'
import { exportCSV } from '../lib/csv'

const TYPES = ['PVP', 'PVE', 'BOUNTY', 'DEFENSE']
const OUTCOMES = ['KILL', 'ASSIST', 'DEATH']
const OUTCOME_BADGE = { KILL: 'badge-green', ASSIST: 'badge-blue', DEATH: 'badge-red' }

function fmt(ts) { return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }

export default function KillBoard() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const [kills, setKills] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('feed')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await supabase.from('kill_log').select('*, reporter:profiles(handle)').order('created_at', { ascending: false }).limit(200)
    setKills(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function logKill() {
    if (!form.target_name) { setError('Target name required.'); return }
    setSaving(true)
    await supabase.from('kill_log').insert({ reporter_id: me.id, target_name: form.target_name, target_org: form.target_org || null, location: form.location || null, ship_used: form.ship_used || null, target_ship: form.target_ship || null, engagement_type: form.engagement_type || 'PVP', outcome: form.outcome || 'KILL', notes: form.notes || null })
    setModal(false); setSaving(false); load()
  }

  // Leaderboard
  const leaderboard = useMemo(() => {
    const map = {}
    kills.forEach(k => {
      if (!map[k.reporter_id]) map[k.reporter_id] = { handle: k.reporter?.handle, kills: 0, assists: 0, deaths: 0 }
      if (k.outcome === 'KILL') map[k.reporter_id].kills++
      else if (k.outcome === 'ASSIST') map[k.reporter_id].assists++
      else if (k.outcome === 'DEATH') map[k.reporter_id].deaths++
    })
    return Object.values(map).sort((a, b) => b.kills - a.kills)
  }, [kills])

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title">KILL BOARD</div>
            <div className="page-subtitle">{kills.filter(k => k.outcome === 'KILL').length} confirmed kills</div>
          </div>
          <button className="btn btn-primary" onClick={() => { setForm({ engagement_type: 'PVP', outcome: 'KILL' }); setError(''); setModal(true) }}>+ LOG ENGAGEMENT</button>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-ghost btn-sm" style={tab === 'feed' ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}} onClick={() => setTab('feed')}>FEED</button>
          <button className="btn btn-ghost btn-sm" style={tab === 'leaderboard' ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}} onClick={() => setTab('leaderboard')}>LEADERBOARD</button>
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING...</div> : tab === 'feed' ? (
          kills.length === 0 ? <div className="empty-state">NO ENGAGEMENTS LOGGED</div> : (
            <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table className="data-table">
              <thead><tr><th>DATE</th><th>OPERATIVE</th><th>TARGET</th><th>ORG</th><th>SHIP</th><th>VS</th><th>LOCATION</th><th>TYPE</th><th>RESULT</th></tr></thead>
              <tbody>
                {kills.map(k => (
                  <tr key={k.id}>
                    <td className="mono text-muted" style={{ fontSize: 11 }}>{fmt(k.created_at)}</td>
                    <td style={{ fontWeight: 500 }}>{k.reporter?.handle}</td>
                    <td style={{ color: 'var(--red)' }}>{k.target_name}</td>
                    <td className="mono text-muted">{k.target_org || '—'}</td>
                    <td className="mono text-muted" style={{ fontSize: 11 }}>{k.ship_used || '—'}</td>
                    <td className="mono text-muted" style={{ fontSize: 11 }}>{k.target_ship || '—'}</td>
                    <td className="text-muted">{k.location || '—'}</td>
                    <td className="mono" style={{ fontSize: 10 }}>{k.engagement_type}</td>
                    <td><span className={`badge ${OUTCOME_BADGE[k.outcome]}`}>{k.outcome}</span></td>
                  </tr>
                ))}
              </tbody>
            </table></div></div>
          )
        ) : (
          <div style={{ maxWidth: 500 }}>
            {leaderboard.map((p, i) => {
              const kd = p.deaths > 0 ? (p.kills / p.deaths).toFixed(1) : p.kills > 0 ? '∞' : '—'
              return (
                <div key={p.handle} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 28, fontSize: 14, fontFamily: 'var(--font-mono)', color: i < 3 ? 'var(--accent)' : 'var(--text-3)', fontWeight: 600 }}>#{i + 1}</span>
                  <span style={{ flex: 1, fontWeight: 500, fontSize: 14 }}>{p.handle}</span>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: 'var(--green)' }}>{p.kills}K</span>
                    <span style={{ color: 'var(--blue)' }}>{p.assists}A</span>
                    <span style={{ color: 'var(--red)' }}>{p.deaths}D</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{kd} K/D</span>
                  </div>
                </div>
              )
            })}
            {leaderboard.length === 0 && <div className="empty-state">NO DATA</div>}
          </div>
        )}
      </div>

      {modal && (
        <Modal title="LOG ENGAGEMENT" onClose={() => setModal(false)}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">TARGET NAME *</label><input className="form-input" value={form.target_name || ''} onChange={e => setForm(f => ({ ...f, target_name: e.target.value }))} placeholder="Player or NPC name" /></div>
            <div className="form-group"><label className="form-label">TARGET ORG</label><input className="form-input" value={form.target_org || ''} onChange={e => setForm(f => ({ ...f, target_org: e.target.value }))} placeholder="Org tag" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">YOUR SHIP</label><input className="form-input" value={form.ship_used || ''} onChange={e => setForm(f => ({ ...f, ship_used: e.target.value }))} placeholder="Ship you were flying" /></div>
            <div className="form-group"><label className="form-label">TARGET SHIP</label><input className="form-input" value={form.target_ship || ''} onChange={e => setForm(f => ({ ...f, target_ship: e.target.value }))} placeholder="What they were flying" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">LOCATION</label><select className="form-select" value={form.location || ''} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}><option value="">—</option>{SC_LOCATIONS.map(l => <option key={l.name} value={l.name}>{l.name}</option>)}</select></div>
            <div className="form-group"><label className="form-label">TYPE</label><select className="form-select" value={form.engagement_type} onChange={e => setForm(f => ({ ...f, engagement_type: e.target.value }))}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          </div>
          <div className="form-group"><label className="form-label">OUTCOME</label><select className="form-select" value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}>{OUTCOMES.map(o => <option key={o}>{o}</option>)}</select></div>
          <div className="form-group"><label className="form-label">NOTES</label><textarea className="form-textarea" value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Combat details..." /></div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setModal(false)}>CANCEL</button><button className="btn btn-primary" onClick={logKill} disabled={saving}>{saving ? 'LOGGING...' : 'LOG ENGAGEMENT'}</button></div>
        </Modal>
      )}
    </>
  )
}
