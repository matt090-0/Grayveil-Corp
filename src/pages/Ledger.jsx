import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatCredits } from '../lib/ranks'
import Modal from '../components/Modal'

function fmt(ts) {
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Ledger() {
  const { profile: me } = useAuth()
  const [entries, setEntries]   = useState([])
  const [members, setMembers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [viewMember, setViewMember] = useState(me.id)
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState({})
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const isAdmin = me.tier <= 3

  async function load() {
    const [{ data: ent }, { data: mem }] = await Promise.all([
      supabase.from('ledger')
        .select('*, recorded_by:profiles!ledger_recorded_by_fkey(handle), member:profiles!ledger_member_id_fkey(handle)')
        .eq('member_id', viewMember)
        .order('created_at', { ascending: false }),
      isAdmin
        ? supabase.from('profiles').select('id, handle').eq('status', 'ACTIVE').order('handle')
        : Promise.resolve({ data: [] }),
    ])
    setEntries(ent || [])
    setMembers(mem || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [viewMember])

  const balance = entries.reduce((sum, e) => sum + e.amount, 0)
  const earned  = entries.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0)
  const spent   = entries.filter(e => e.amount < 0).reduce((s, e) => s + e.amount, 0)

  function openAdd() {
    setForm({ member_id: viewMember, amount: '', description: '', type: 'credit' })
    setError('')
    setModal(true)
  }

  async function save() {
    if (!form.amount || !form.description) { setError('Amount and description are required.'); return }
    const amount = parseInt(form.amount) * (form.type === 'debit' ? -1 : 1)
    if (isNaN(amount) || amount === 0) { setError('Enter a valid non-zero amount.'); return }
    setSaving(true)
    const { error } = await supabase.from('ledger').insert({
      member_id: form.member_id || viewMember,
      amount,
      description: form.description,
      recorded_by: me.id,
    })
    if (error) { setError(error.message); setSaving(false); return }
    setModal(false); setSaving(false); load()
  }

  const currentMember = members.find(m => m.id === viewMember)

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title">LEDGER</div>
            <div className="page-subtitle">Credits & earnings register</div>
          </div>
          {isAdmin && <button className="btn btn-primary" onClick={openAdd}>+ ADD ENTRY</button>}
        </div>
        {isAdmin && members.length > 0 && (
          <div className="flex items-center gap-8" style={{ paddingBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>VIEWING:</span>
            <select className="form-select" value={viewMember} onChange={e => setViewMember(e.target.value)}
              style={{ maxWidth: 220 }}>
              {members.map(m => <option key={m.id} value={m.id}>{m.handle}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING LEDGER...</div> : (
          <>
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-label">BALANCE</div>
                <div className="stat-value" style={{ color: balance >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {formatCredits(balance)}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">TOTAL EARNED</div>
                <div className="stat-value" style={{ fontSize: 20 }}>{formatCredits(earned)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">TOTAL SPENT</div>
                <div className="stat-value" style={{ fontSize: 20, color: 'var(--red)' }}>{formatCredits(spent)}</div>
              </div>
            </div>

            {entries.length === 0 ? (
              <div className="empty-state">NO LEDGER ENTRIES</div>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>DATE</th>
                        <th>DESCRIPTION</th>
                        <th>RECORDED BY</th>
                        <th style={{ textAlign: 'right' }}>AMOUNT</th>
                        <th style={{ textAlign: 'right' }}>RUNNING BALANCE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let running = balance
                        return entries.map(e => {
                          const row = (
                            <tr key={e.id}>
                              <td className="mono" style={{ color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{fmt(e.created_at)}</td>
                              <td>{e.description}</td>
                              <td className="text-muted">{e.recorded_by?.handle || '—'}</td>
                              <td className="mono" style={{ textAlign: 'right', color: e.amount >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                {e.amount >= 0 ? '+' : ''}{formatCredits(e.amount)}
                              </td>
                              <td className="mono" style={{ textAlign: 'right', color: 'var(--text-2)' }}>
                                {formatCredits(running)}
                              </td>
                            </tr>
                          )
                          running -= e.amount
                          return row
                        })
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {modal && (
        <Modal title="ADD LEDGER ENTRY" onClose={() => setModal(false)}>
          {isAdmin && members.length > 0 && (
            <div className="form-group">
              <label className="form-label">MEMBER</label>
              <select className="form-select" value={form.member_id} onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))}>
                {members.map(m => <option key={m.id} value={m.id}>{m.handle}</option>)}
              </select>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">TYPE</label>
              <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="credit">CREDIT (+)</option>
                <option value="debit">DEBIT (−)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">AMOUNT (aUEC) *</label>
              <input className="form-input" type="number" min="1" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">DESCRIPTION *</label>
            <input className="form-input" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Contract payout, equipment, etc." />
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setModal(false)}>CANCEL</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'SAVING...' : 'ADD ENTRY'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
