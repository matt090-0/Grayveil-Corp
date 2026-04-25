import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatCredits } from '../lib/ranks'
import {
  UEE_AMBER, ClassificationBar, StatCell, FilterRow, Card,
  EmptyState, UeeModal,
  fmtDate, timeAgo,
} from '../components/uee'

export default function Ledger() {
  const { profile: me } = useAuth()
  const [entries, setEntries]   = useState([])
  const [members, setMembers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [viewMember, setViewMember] = useState(me.id)
  const [search, setSearch]     = useState('')
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

  const balance = useMemo(() => entries.reduce((s, e) => s + e.amount, 0), [entries])
  const earned  = useMemo(() => entries.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0), [entries])
  const spent   = useMemo(() => entries.filter(e => e.amount < 0).reduce((s, e) => s + e.amount, 0), [entries])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(e =>
      (e.description || '').toLowerCase().includes(q)
      || (e.recorded_by?.handle || '').toLowerCase().includes(q))
  }, [entries, search])

  function openAdd() {
    setForm({ member_id: viewMember, amount: '', description: '', type: 'credit' })
    setError(''); setModal(true)
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

  const currentMember = members.find(m => m.id === viewMember) || me
  const handle = (currentMember?.handle || me.handle).toUpperCase()

  return (
    <>
      <ClassificationBar
        section="GRAYVEIL EARNINGS LEDGER"
        label={isAdmin && viewMember !== me.id ? `OPERATIVE · ${handle}` : 'PERSONAL RECORD'}
        right={(
          <>
            <span style={{ color: balance >= 0 ? '#5ce0a1' : '#e05c5c' }}>BALANCE · {formatCredits(balance)}</span>
            <span>EARNED · {formatCredits(earned)}</span>
            <span>SPENT · {formatCredits(Math.abs(spent))}</span>
          </>
        )}
      />

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>EARNINGS LEDGER</h1>
            <div style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 640 }}>
              Per-operative running balance. Credit and debit entries with running totals — your contract payouts, payouts in, fines out.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isAdmin && members.length > 0 && (
              <select className="form-select" value={viewMember}
                onChange={e => setViewMember(e.target.value)}
                style={{ maxWidth: 240 }}>
                {members.map(m => <option key={m.id} value={m.id}>{m.handle}</option>)}
              </select>
            )}
            {isAdmin && <button className="btn btn-primary" onClick={openAdd}>+ ADD ENTRY</button>}
          </div>
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING LEDGER...</div> : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 10, marginBottom: 16,
            }}>
              <StatCell label="BALANCE"      value={formatCredits(balance)}        color={balance >= 0 ? '#5ce0a1' : '#e05c5c'} glyph="◆" desc="net standing" />
              <StatCell label="TOTAL EARNED" value={formatCredits(earned)}         color="#5ce0a1" glyph="↓" desc="credits in" />
              <StatCell label="TOTAL SPENT"  value={formatCredits(Math.abs(spent))} color="#e05c5c" glyph="↑" desc="debits out" />
              <StatCell label="ENTRIES"      value={entries.length}                color={UEE_AMBER} glyph="◎" desc="line items" />
            </div>

            <FilterRow
              search={search} setSearch={setSearch}
              placeholder="Search description, recorder..."
            />

            {filtered.length === 0 ? (
              <EmptyState>NO LEDGER ENTRIES</EmptyState>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(() => {
                  let running = balance
                  // Adjust running for any entries filtered out — keep the running total accurate
                  // for the *unfiltered* list since that's the actual balance trajectory
                  return entries.map((e, idx) => {
                    const isCredit = e.amount >= 0
                    const accent = isCredit ? '#5ce0a1' : '#e05c5c'
                    const row = (
                      <Card key={e.id} accent={accent} style={{
                        flexDirection: 'row', alignItems: 'center', gap: 14,
                        padding: '8px 14px',
                        display: filtered.includes(e) ? 'flex' : 'none',
                      }}>
                        <div style={{
                          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em',
                          color: 'var(--text-3)', minWidth: 90, flexShrink: 0,
                        }}>
                          {fmtDate(e.created_at)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: 'var(--text-1)' }}>
                            {e.description}
                          </div>
                          <div style={{
                            fontSize: 10, color: 'var(--text-3)',
                            fontFamily: 'var(--font-mono)', letterSpacing: '.1em', marginTop: 1,
                          }}>
                            BY {(e.recorded_by?.handle || '—').toUpperCase()} · {timeAgo(e.created_at)}
                          </div>
                        </div>
                        <div style={{
                          fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700,
                          color: accent, minWidth: 110, textAlign: 'right', flexShrink: 0,
                        }}>
                          {isCredit ? '+' : ''}{formatCredits(e.amount)}
                        </div>
                        <div style={{
                          fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.05em',
                          color: 'var(--text-2)', minWidth: 100, textAlign: 'right', flexShrink: 0,
                          paddingLeft: 12, borderLeft: '1px dashed var(--border)',
                        }}>
                          {formatCredits(running)}
                        </div>
                      </Card>
                    )
                    running -= e.amount
                    return row
                  })
                })()}
              </div>
            )}
          </>
        )}
      </div>

      {modal && (
        <UeeModal
          accent={form.type === 'debit' ? '#e05c5c' : '#5ce0a1'}
          kicker="◆ NEW LEDGER ENTRY"
          title={`Record ${form.type === 'debit' ? 'Debit' : 'Credit'}`}
          onClose={() => setModal(false)}
          maxWidth={520}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setModal(false)}>CANCEL</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'SAVING...' : 'ADD ENTRY'}
              </button>
            </>
          )}
        >
          {isAdmin && members.length > 0 && (
            <div className="form-group">
              <label className="form-label">MEMBER</label>
              <select className="form-select" value={form.member_id}
                onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))}>
                {members.map(m => <option key={m.id} value={m.id}>{m.handle}</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">TYPE</label>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {[
                { v: 'credit', label: 'CREDIT (+)', color: '#5ce0a1', glyph: '↓' },
                { v: 'debit',  label: 'DEBIT (−)',  color: '#e05c5c', glyph: '↑' },
              ].map(t => {
                const active = form.type === t.v
                return (
                  <button
                    key={t.v}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type: t.v }))}
                    style={{
                      flex: 1,
                      background: active ? `${t.color}1f` : 'var(--bg-raised)',
                      border: `1px solid ${active ? t.color : 'var(--border)'}`,
                      borderLeft: `3px solid ${t.color}`,
                      color: active ? t.color : 'var(--text-2)',
                      fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.18em', fontWeight: 600,
                      padding: '10px 12px', borderRadius: 3, cursor: 'pointer',
                    }}
                  >{t.glyph} {t.label}</button>
                )
              })}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">AMOUNT (aUEC) *</label>
            <input className="form-input" type="number" min="1" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0" autoFocus
              style={{ fontSize: 16, fontFamily: 'var(--font-mono)' }} />
          </div>
          <div className="form-group">
            <label className="form-label">DESCRIPTION *</label>
            <input className="form-input" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Contract payout, equipment, fine, etc." />
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
        </UeeModal>
      )}
    </>
  )
}
