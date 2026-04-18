import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatCredits, getRankByTier } from '../lib/ranks'
import { SC_SHIPS } from '../lib/ships'
import { SC_DIVISIONS } from '../lib/scdata'
import Modal from '../components/Modal'
import GrayveilLogo from '../components/GrayveilLogo'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { greenBurst } from '../lib/confetti'
import { useToast } from '../components/Toast'
import { timeAgo, fmtDate as fmt } from '../lib/dates'

// Card number derived from profile ID — 16 digits in 4 groups of 4.
// Deterministic so a member's card number is stable.
function cardNumber(id) {
  const hex = (id || '').replace(/-/g, '').slice(0, 16).padEnd(16, '0')
  let out = ''
  for (let i = 0; i < 16; i++) out += (parseInt(hex[i], 16) % 10).toString()
  return out.match(/.{1,4}/g).join(' ')
}

function cardGradient(tier) {
  if (tier === 1) return 'linear-gradient(135deg, #2a2418 0%, #4a3a20 45%, #1a1610 100%)'
  if (tier <= 3) return 'linear-gradient(135deg, #1c1e26 0%, #2e3140 50%, #14161c 100%)'
  if (tier <= 5) return 'linear-gradient(135deg, #14182a 0%, #1e2a4a 50%, #0c0f1c 100%)'
  if (tier <= 7) return 'linear-gradient(135deg, #1a1c24 0%, #242832 50%, #101218 100%)'
  return 'linear-gradient(135deg, #121318 0%, #1a1c24 50%, #0a0b0f 100%)'
}

function BankCard({ member, highlight }) {
  const rank = getRankByTier(member.tier || 9)
  const accent = rank.color
  const bg = cardGradient(member.tier || 9)
  return (
    <div style={{
      position: 'relative',
      width: '100%', aspectRatio: '1.586 / 1', maxWidth: 360,
      background: bg,
      border: `1px solid ${highlight ? accent : 'rgba(212,216,224,0.18)'}`,
      borderRadius: 12,
      padding: 18,
      color: '#ededf2',
      boxShadow: highlight
        ? `0 6px 28px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px ${accent}40`
        : '0 6px 22px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
      overflow: 'hidden',
      fontFamily: 'JetBrains Mono, monospace',
    }}>
      {/* Decorative accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        opacity: 0.55,
      }} />
      {/* Holographic stripe */}
      <div style={{
        position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%',
        background: `radial-gradient(circle, ${accent}22 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />

      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GrayveilLogo size={22} />
          <div style={{
            fontSize: 10, letterSpacing: '.25em', color: '#d4d8e0',
            fontFamily: 'Syne, sans-serif', fontWeight: 700,
          }}>GRAYVEIL RESERVE</div>
        </div>
        <div style={{
          fontSize: 9, letterSpacing: '.2em', color: accent,
          border: `1px solid ${accent}55`, padding: '2px 7px', borderRadius: 3,
          background: `${accent}14`,
        }}>T-{rank.tier}</div>
      </div>

      {/* EMV chip */}
      <div style={{
        marginTop: 18, width: 40, height: 30, borderRadius: 5,
        background: 'linear-gradient(135deg, #d4c078 0%, #a8925a 40%, #cdb571 70%, #8a7448 100%)',
        position: 'relative', boxShadow: 'inset 0 0 2px rgba(0,0,0,0.4)',
      }}>
        <div style={{ position: 'absolute', inset: 4, border: '1px solid rgba(0,0,0,0.25)', borderRadius: 3 }} />
        <div style={{ position: 'absolute', left: 4, right: 4, top: '50%', height: 1, background: 'rgba(0,0,0,0.3)' }} />
        <div style={{ position: 'absolute', top: 4, bottom: 4, left: '50%', width: 1, background: 'rgba(0,0,0,0.3)' }} />
      </div>

      {/* Card number */}
      <div style={{
        marginTop: 14, fontSize: 'clamp(13px, 2.4vw, 16px)',
        letterSpacing: '.18em', color: '#d4d8e0',
        textShadow: '0 1px 0 rgba(0,0,0,0.45)',
      }}>{cardNumber(member.id)}</div>

      {/* Bottom row */}
      <div style={{
        position: 'absolute', left: 18, right: 18, bottom: 16,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 8, letterSpacing: '.2em', color: '#8a8f9c', marginBottom: 3 }}>OPERATIVE</div>
          <div style={{
            fontSize: 13, letterSpacing: '.08em', color: '#ededf2',
            fontFamily: 'Syne, sans-serif', fontWeight: 600,
            textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{member.handle}</div>
          <div style={{ fontSize: 9, letterSpacing: '.15em', color: accent, marginTop: 2 }}>{rank.rank}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 8, letterSpacing: '.2em', color: '#8a8f9c', marginBottom: 3 }}>BALANCE</div>
          <div style={{
            fontSize: 15, fontFamily: 'Syne, sans-serif', fontWeight: 700,
            color: '#d4d8e0', letterSpacing: '.02em',
          }}>{formatCredits(member.wallet_balance || 0)}</div>
        </div>
      </div>
    </div>
  )
}

const TXN_ICONS = {
  deposit: '↓', withdrawal: '↑', transfer: '⇄', payout: '◆',
  tax: '%', loan_out: '📤', loan_repay: '📥', fund_contrib: '♦',
}
const TXN_COLORS = {
  deposit: 'var(--green)', withdrawal: 'var(--red)', transfer: 'var(--accent)',
  payout: 'var(--green)', tax: 'var(--amber)', loan_out: 'var(--blue)',
  loan_repay: 'var(--green)', fund_contrib: 'var(--accent)',
}
const LOAN_BADGE = { PENDING: 'badge-amber', APPROVED: 'badge-green', DENIED: 'badge-red', ACTIVE: 'badge-blue', REPAID: 'badge-muted' }

export default function Bank() {
  const { profile: me, refreshProfile } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('overview')
  const [treasury, setTreasury] = useState(0)
  const [txns, setTxns] = useState([])
  const [members, setMembers] = useState([])
  const [loans, setLoans] = useState([])
  const [funds, setFunds] = useState([])
  const [contributions, setContributions] = useState([])
  const [budgets, setBudgets] = useState([])
  const [taxRate, setTaxRate] = useState(10)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [shipSearch, setShipSearch] = useState('')

  const isOfficer = me.tier <= 3

  async function load() {
    const [
      { data: t }, { data: tx }, { data: m }, { data: l },
      { data: f }, { data: c }, { data: b }, { data: settings },
    ] = await Promise.all([
      supabase.from('treasury').select('balance').eq('id', 1).single(),
      supabase.from('transactions').select('*, from_profile:profiles!transactions_from_id_fkey(handle), to_profile:profiles!transactions_to_id_fkey(handle)').order('created_at', { ascending: false }).limit(50),
      supabase.from('profiles').select('id, handle, wallet_balance, tier, division').eq('status', 'ACTIVE').order('wallet_balance', { ascending: false }),
      supabase.from('loans').select('*, borrower:profiles!loans_borrower_id_fkey(handle), approver:profiles!loans_approved_by_fkey(handle)').order('created_at', { ascending: false }),
      supabase.from('ship_funds').select('*').order('created_at', { ascending: false }),
      supabase.from('ship_fund_contributions').select('*, contributor:profiles(handle)').order('created_at', { ascending: false }),
      supabase.from('division_budgets').select('*').order('division'),
      supabase.from('org_settings').select('value').eq('key', 'tax_rate').maybeSingle(),
    ])
    setTreasury(t?.balance || 0)
    setTxns(tx || [])
    setMembers(m || [])
    setLoans(l || [])
    setFunds(f || [])
    setContributions(c || [])
    setBudgets(b || [])
    if (settings?.value?.percent !== undefined) setTaxRate(settings.value.percent)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── TRANSFER ──
  async function doTransfer() {
    const amt = parseInt(form.amount)
    if (!amt || amt <= 0) { setError('Enter a valid amount.'); return }
    if (!form.recipient) { setError('Select a recipient.'); return }
    setSaving(true)
    const { error } = await supabase.rpc('transfer_funds', { p_recipient_id: form.recipient, p_amount: amt, p_description: form.desc || null })
    if (error) { setError(error.message); setSaving(false); return }
    greenBurst(); toast('Transfer complete', 'success')
    await refreshProfile()
    setModal(null); setSaving(false); load()
  }

  // ── TREASURY OPS (officers) ──
  async function doTreasuryOp() {
    const amt = parseInt(form.amount)
    if (!amt || amt <= 0) { setError('Enter a valid amount.'); return }
    setSaving(true)
    let err = null
    if (form.op === 'deposit_to_treasury') {
      const { error } = await supabase.rpc('treasury_deposit', { p_amount: amt, p_description: form.desc || null })
      err = error
    } else if (form.op === 'pay_from_treasury') {
      if (!form.recipient) { setError('Select recipient.'); setSaving(false); return }
      const { error } = await supabase.rpc('treasury_payout', { p_recipient_id: form.recipient, p_amount: amt, p_description: form.desc || null })
      err = error
    } else if (form.op === 'add_external') {
      if (!form.recipient) { setError('Select recipient.'); setSaving(false); return }
      // External deposits still need admin — only tier <= 2 can update other profiles
      const { error } = await supabase.rpc('treasury_payout', { p_recipient_id: form.recipient, p_amount: amt, p_description: form.desc || 'External deposit' })
      err = error
    }
    if (err) { setError(err.message); setSaving(false); return }
    await refreshProfile()
    setModal(null); setSaving(false); load()
  }

  // ── LOANS ──
  async function requestLoan() {
    const amt = parseInt(form.amount)
    if (!amt || amt <= 0) { setError('Enter a valid amount.'); return }
    if (!form.reason) { setError('Provide a reason.'); return }
    setSaving(true)
    await supabase.from('loans').insert({ borrower_id: me.id, amount: amt, reason: form.reason })
    setModal(null); setSaving(false); load()
  }

  async function approveLoan(loan) {
    await supabase.from('loans').update({ status: 'ACTIVE', approved_by: me.id }).eq('id', loan.id)
    // Disburse from treasury via server-side function
    const { error } = await supabase.rpc('treasury_payout', { p_recipient_id: loan.borrower_id, p_amount: loan.amount, p_description: `Loan approved: ${loan.reason}` })
    if (error) { alert(error.message); return }
    load()
  }

  async function denyLoan(id) {
    await supabase.from('loans').update({ status: 'DENIED', approved_by: me.id }).eq('id', id); load()
  }

  async function repayLoan(loan) {
    const amt = parseInt(form.repayAmount)
    if (!amt || amt <= 0) return
    setSaving(true)
    const { error } = await supabase.rpc('repay_loan', { p_loan_id: loan.id, p_amount: amt })
    if (error) { setError(error.message); setSaving(false); return }
    await refreshProfile()
    setModal(null); setSaving(false); load()
  }

  // ── SHIP FUNDS ──
  async function createFund() {
    if (!form.fundName || !form.fundTarget) { setError('Name and target are required.'); return }
    setSaving(true)
    await supabase.from('ship_funds').insert({ name: form.fundName, target_amount: parseInt(form.fundTarget), ship_class: form.fundShip || null, description: form.fundDesc || null, created_by: me.id })
    setModal(null); setSaving(false); load()
  }

  async function contributeFund(fund) {
    const amt = parseInt(form.contribAmount)
    if (!amt || amt <= 0) { setError('Enter a valid amount.'); return }
    setSaving(true)
    const { error } = await supabase.rpc('contribute_to_fund', { p_fund_id: fund.id, p_amount: amt })
    if (error) { setError(error.message); setSaving(false); return }
    await refreshProfile()
    setModal(null); setSaving(false); load()
  }

  // ── TAX RATE ──
  async function saveTaxRate() {
    await supabase.from('org_settings').upsert({ key: 'tax_rate', value: { percent: parseInt(form.newTax) || 0 }, updated_by: me.id })
    setModal(null); load()
  }

  // ── DIVISION BUDGETS ──
  async function saveBudget() {
    if (!form.budgetDiv || !form.budgetAmt) return
    setSaving(true)
    await supabase.from('division_budgets').upsert({ division: form.budgetDiv, allocated: parseInt(form.budgetAmt), spent: 0, updated_by: me.id }, { onConflict: 'division' })
    setModal(null); setSaving(false); load()
  }

  const myLoans = loans.filter(l => l.borrower_id === me.id)
  const topEarners = [...members].sort((a, b) => (b.wallet_balance || 0) - (a.wallet_balance || 0)).slice(0, 8)
  const totalOrgWealth = members.reduce((s, m) => s + (m.wallet_balance || 0), 0) + treasury

  const filteredFundShips = useMemo(() => {
    if (!shipSearch) return []
    return SC_SHIPS.filter(s => s.name.toLowerCase().includes(shipSearch.toLowerCase())).slice(0, 10)
  }, [shipSearch])

  const TABS = ['overview', 'cards', 'transactions', 'transfers', 'loans', 'ship funds', 'budgets']

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title">BANK</div>
            <div className="page-subtitle">Grayveil financial operations</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>YOUR WALLET</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'var(--accent)' }}>{formatCredits(me.wallet_balance || 0)}</div>
          </div>
        </div>
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t} className="btn btn-ghost btn-sm"
              style={tab === t ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
              onClick={() => setTab(t)}>{t.toUpperCase()}</button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING BANK DATA...</div> : (
          <>
            {/* ── OVERVIEW ── */}
            {tab === 'overview' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                  <BankCard member={me} highlight />
                </div>

                <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
                  <div className="stat-card">
                    <div className="stat-label">TREASURY</div>
                    <div className="stat-value" style={{ color: 'var(--accent)' }}>{formatCredits(treasury)}</div>
                    <div className="stat-sub">org treasury balance</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">YOUR WALLET</div>
                    <div className="stat-value" style={{ color: 'var(--green)' }}>{formatCredits(me.wallet_balance || 0)}</div>
                    <div className="stat-sub">personal balance</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">ORG TAX RATE</div>
                    <div className="stat-value">{taxRate}%</div>
                    <div className="stat-sub">on contract payouts</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">TOTAL ORG WEALTH</div>
                    <div className="stat-value">{formatCredits(totalOrgWealth)}</div>
                    <div className="stat-sub">treasury + all wallets</div>
                  </div>
                </div>

                <div className="grid-2" style={{ gap: 20 }}>
                  <div>
                    <div className="section-header"><div className="section-title">RECENT TRANSACTIONS</div></div>
                    {txns.slice(0, 8).map(t => (
                      <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16, color: TXN_COLORS[t.type] || 'var(--text-3)', width: 24, textAlign: 'center' }}>{TXN_ICONS[t.type] || '·'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12 }}>{t.description || t.type}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{timeAgo(t.created_at)}</div>
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: TXN_COLORS[t.type] }}>{formatCredits(t.amount)}</span>
                      </div>
                    ))}
                    {txns.length === 0 && <div className="empty-state" style={{ padding: '24px 0' }}>NO TRANSACTIONS YET</div>}
                  </div>
                  <div>
                    {/* Wealth Distribution Chart */}
                    {topEarners.length > 1 && (() => {
                      const PIE_COLORS = ['#d4d8e0', '#4a7ad9', '#5ab870', '#d94a7a', '#9060c8', '#d9904a', '#4ad9d9', '#c86060']
                      const chartData = [
                        { name: 'Treasury', value: treasury },
                        ...topEarners.slice(0, 6).map(m => ({ name: m.handle, value: m.wallet_balance || 0 })),
                      ].filter(d => d.value > 0)
                      return (
                        <div style={{ marginBottom: 16 }}>
                          <div className="section-header"><div className="section-title">WEALTH DISTRIBUTION</div></div>
                          <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 0' }}>
                            <ResponsiveContainer width="100%" height={160}>
                              <PieChart>
                                <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2} strokeWidth={0}>
                                  {chartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(v) => formatCredits(v)} contentStyle={{ background: '#1a1a24', border: '1px solid #333344', borderRadius: 6, fontSize: 11 }} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', padding: '0 12px', justifyContent: 'center' }}>
                              {chartData.map((d, i) => (
                                <span key={d.name} style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                  <span style={{ color: 'var(--text-3)' }}>{d.name}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                    <div className="section-header"><div className="section-title">TOP EARNERS</div></div>
                    {topEarners.map((m, i) => (
                      <div key={m.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, color: i < 3 ? 'var(--accent)' : 'var(--text-3)', fontFamily: 'var(--font-mono)', width: 20 }}>#{i+1}</span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: m.id === me.id ? 500 : 400 }}>{m.handle}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--green)' }}>{formatCredits(m.wallet_balance || 0)}</span>
                      </div>
                    ))}

                    {/* Active ship funds preview */}
                    {funds.filter(f => f.status === 'ACTIVE').length > 0 && (
                      <>
                        <div className="section-header" style={{ marginTop: 20 }}><div className="section-title">ACTIVE SHIP FUNDS</div></div>
                        {funds.filter(f => f.status === 'ACTIVE').map(f => {
                          const pct = Math.min(100, Math.round((f.current_amount / f.target_amount) * 100))
                          return (
                            <div key={f.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                              <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: 500 }}>{f.name}</span>
                                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{pct}%</span>
                              </div>
                              {f.ship_class && <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>{f.ship_class}</div>}
                              <div style={{ height: 6, background: 'var(--bg-surface)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 3, transition: 'width .3s' }} />
                              </div>
                              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginTop: 4 }}>
                                {formatCredits(f.current_amount)} / {formatCredits(f.target_amount)}
                              </div>
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── CARDS ── */}
            {tab === 'cards' && (
              <>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.7 }}>
                  Each active operative is issued a Grayveil Reserve card linked to their wallet. Card colour reflects their tier.
                </div>
                {members.length === 0 ? (
                  <div className="empty-state">NO ACTIVE OPERATIVES</div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: 18,
                    justifyItems: 'center',
                  }}>
                    {members.map(m => (
                      <BankCard key={m.id} member={m} highlight={m.id === me.id} />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── TRANSACTIONS ── */}
            {tab === 'transactions' && (
              <div className="card" style={{ padding: 0 }}>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>DATE</th><th>TYPE</th><th>FROM</th><th>TO</th><th>DESCRIPTION</th><th style={{ textAlign: 'right' }}>AMOUNT</th></tr></thead>
                    <tbody>
                      {txns.length === 0 ? <tr><td colSpan={6} className="empty-state">NO TRANSACTIONS</td></tr> : txns.map(t => (
                        <tr key={t.id}>
                          <td className="mono text-muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmt(t.created_at)}</td>
                          <td><span style={{ fontSize: 11, color: TXN_COLORS[t.type], fontFamily: 'var(--font-mono)' }}>{t.type.toUpperCase()}</span></td>
                          <td className="text-muted">{t.from_type === 'treasury' ? 'TREASURY' : t.from_profile?.handle || t.from_type || '—'}</td>
                          <td className="text-muted">{t.to_type === 'treasury' ? 'TREASURY' : t.to_profile?.handle || t.to_type || '—'}</td>
                          <td style={{ fontSize: 12 }}>{t.description || '—'}</td>
                          <td className="mono" style={{ textAlign: 'right', color: TXN_COLORS[t.type], fontWeight: 500 }}>{formatCredits(t.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TRANSFERS ── */}
            {tab === 'transfers' && (
              <div style={{ maxWidth: 500 }}>
                <div className="card mb-20">
                  <div className="section-title mb-16">SEND aUEC</div>
                  <div className="form-group">
                    <label className="form-label">RECIPIENT</label>
                    <select className="form-select" value={form.recipient || ''} onChange={e => setForm(f => ({ ...f, recipient: e.target.value }))}>
                      <option value="">— Select Member —</option>
                      {members.filter(m => m.id !== me.id).map(m => <option key={m.id} value={m.id}>{m.handle}</option>)}
                    </select>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">AMOUNT (aUEC)</label>
                      <input className="form-input" type="number" min="1" value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">NOTE (optional)</label>
                      <input className="form-input" value={form.desc || ''} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="Payment for..." />
                    </div>
                  </div>
                  {error && <div className="form-error mb-8">{error}</div>}
                  <button className="btn btn-primary" onClick={() => { setError(''); doTransfer() }} disabled={saving}>
                    {saving ? 'SENDING...' : 'SEND'}
                  </button>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>YOUR BALANCE: {formatCredits(me.wallet_balance || 0)}</div>
                </div>

                {isOfficer && (
                  <div className="card">
                    <div className="section-title mb-16">TREASURY OPERATIONS</div>
                    <div className="form-group">
                      <label className="form-label">OPERATION</label>
                      <select className="form-select" value={form.op || ''} onChange={e => setForm(f => ({ ...f, op: e.target.value }))}>
                        <option value="">— Select —</option>
                        <option value="deposit_to_treasury">Deposit to Treasury (from my wallet)</option>
                        <option value="pay_from_treasury">Pay Member from Treasury</option>
                        <option value="add_external">Add External aUEC to Member</option>
                      </select>
                    </div>
                    {(form.op === 'pay_from_treasury' || form.op === 'add_external') && (
                      <div className="form-group">
                        <label className="form-label">MEMBER</label>
                        <select className="form-select" value={form.recipient || ''} onChange={e => setForm(f => ({ ...f, recipient: e.target.value }))}>
                          <option value="">— Select —</option>
                          {members.map(m => <option key={m.id} value={m.id}>{m.handle}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">AMOUNT</label>
                        <input className="form-input" type="number" min="1" value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">NOTE</label>
                        <input className="form-input" value={form.desc || ''} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} />
                      </div>
                    </div>
                    {error && <div className="form-error mb-8">{error}</div>}
                    <button className="btn btn-primary" onClick={() => { setError(''); doTreasuryOp() }} disabled={saving || !form.op}>
                      {saving ? 'PROCESSING...' : 'EXECUTE'}
                    </button>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>TREASURY: {formatCredits(treasury)}</div>

                    {/* Tax rate config */}
                    <div className="divider" style={{ margin: '16px 0' }} />
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Contract tax rate: <strong>{taxRate}%</strong></span>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ newTax: taxRate }); setModal('tax') }}>CHANGE</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── LOANS ── */}
            {tab === 'loans' && (
              <>
                <div className="flex items-center justify-between mb-16">
                  <span></span>
                  <button className="btn btn-primary" onClick={() => { setForm({ amount: '', reason: '' }); setError(''); setModal('loan') }}>REQUEST LOAN</button>
                </div>
                {loans.length === 0 ? <div className="empty-state">NO LOANS ON RECORD</div> : (
                  <div className="card" style={{ padding: 0 }}>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead><tr><th>BORROWER</th><th>AMOUNT</th><th>REPAID</th><th>REMAINING</th><th>REASON</th><th>STATUS</th><th></th></tr></thead>
                        <tbody>
                          {loans.map(l => {
                            const remaining = l.amount - l.repaid
                            const isMine = l.borrower_id === me.id
                            return (
                              <tr key={l.id} style={{ background: isMine ? 'var(--accent-glow)' : undefined }}>
                                <td style={{ fontWeight: 500 }}>{l.borrower?.handle || '—'}</td>
                                <td className="mono">{formatCredits(l.amount)}</td>
                                <td className="mono" style={{ color: 'var(--green)' }}>{formatCredits(l.repaid)}</td>
                                <td className="mono" style={{ color: remaining > 0 ? 'var(--red)' : 'var(--green)' }}>{formatCredits(remaining)}</td>
                                <td style={{ fontSize: 12, color: 'var(--text-2)', maxWidth: 200 }}>{l.reason || '—'}</td>
                                <td><span className={`badge ${LOAN_BADGE[l.status]}`}>{l.status}</span></td>
                                <td>
                                  <div className="flex gap-8">
                                    {isOfficer && l.status === 'PENDING' && (
                                      <>
                                        <button className="btn btn-primary btn-sm" onClick={() => approveLoan(l)}>APPROVE</button>
                                        <button className="btn btn-danger btn-sm" onClick={() => denyLoan(l.id)}>DENY</button>
                                      </>
                                    )}
                                    {isMine && l.status === 'ACTIVE' && remaining > 0 && (
                                      <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ repayAmount: remaining }); setError(''); setModal({ type: 'repay', loan: l }) }}>REPAY</button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── SHIP FUNDS ── */}
            {tab === 'ship funds' && (
              <>
                <div className="flex items-center justify-between mb-16">
                  <span></span>
                  {isOfficer && <button className="btn btn-primary" onClick={() => { setForm({}); setShipSearch(''); setError(''); setModal('fund') }}>+ CREATE FUND</button>}
                </div>
                {funds.length === 0 ? <div className="empty-state">NO SHIP FUNDS</div> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {funds.map(f => {
                      const pct = Math.min(100, Math.round((f.current_amount / f.target_amount) * 100))
                      const fundContribs = contributions.filter(c => c.fund_id === f.id)
                      return (
                        <div key={f.id} className="card">
                          <div className="flex items-center justify-between mb-8">
                            <div>
                              <span style={{ fontWeight: 500, fontSize: 15 }}>{f.name}</span>
                              {f.ship_class && <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 10 }}>{f.ship_class}</span>}
                            </div>
                            <span className={`badge ${f.status === 'ACTIVE' ? 'badge-green' : f.status === 'COMPLETED' ? 'badge-accent' : 'badge-muted'}`}>{f.status}</span>
                          </div>
                          {f.description && <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 10 }}>{f.description}</p>}
                          <div style={{ height: 8, background: 'var(--bg-surface)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? 'var(--green)' : 'var(--accent)', borderRadius: 4, transition: 'width .3s' }} />
                          </div>
                          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-2)' }}>{formatCredits(f.current_amount)} / {formatCredits(f.target_amount)}</span>
                            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{pct}%</span>
                          </div>
                          {fundContribs.length > 0 && (
                            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>
                              Contributors: {fundContribs.map(c => `${c.contributor?.handle} (${formatCredits(c.amount)})`).join(', ')}
                            </div>
                          )}
                          {f.status === 'ACTIVE' && (
                            <button className="btn btn-primary btn-sm" onClick={() => { setForm({ contribAmount: '' }); setError(''); setModal({ type: 'contrib', fund: f }) }}>CONTRIBUTE</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── BUDGETS ── */}
            {tab === 'budgets' && (
              <>
                {isOfficer && (
                  <div className="flex items-center justify-between mb-16">
                    <span></span>
                    <button className="btn btn-primary" onClick={() => { setForm({ budgetDiv: '', budgetAmt: '' }); setError(''); setModal('budget') }}>+ ALLOCATE BUDGET</button>
                  </div>
                )}
                {budgets.length === 0 ? <div className="empty-state">NO DIVISION BUDGETS SET</div> : (
                  <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>
                    {budgets.map(b => {
                      const remaining = b.allocated - b.spent
                      const pct = b.allocated > 0 ? Math.round((b.spent / b.allocated) * 100) : 0
                      return (
                        <div key={b.id} className="stat-card">
                          <div className="stat-label">{b.division.toUpperCase()}</div>
                          <div className="stat-value" style={{ fontSize: 20 }}>{formatCredits(remaining)}</div>
                          <div style={{ height: 4, background: 'var(--bg-surface)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: pct > 80 ? 'var(--red)' : 'var(--accent)', borderRadius: 2 }} />
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                            {formatCredits(b.spent)} spent / {formatCredits(b.allocated)} allocated
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── MODALS ── */}
      {modal === 'loan' && (
        <Modal title="REQUEST LOAN" onClose={() => setModal(null)}>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>Request aUEC from the Grayveil treasury. An officer will review and approve or deny.</p>
          <div className="form-group"><label className="form-label">AMOUNT (aUEC)</label><input className="form-input" type="number" min="1" value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">REASON</label><textarea className="form-textarea" value={form.reason || ''} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Ship purchase, equipment, operation funding..." /></div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button><button className="btn btn-primary" onClick={requestLoan} disabled={saving}>{saving ? 'SUBMITTING...' : 'REQUEST LOAN'}</button></div>
        </Modal>
      )}

      {modal?.type === 'repay' && (
        <Modal title="REPAY LOAN" onClose={() => setModal(null)}>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>Outstanding: <strong style={{ color: 'var(--red)' }}>{formatCredits(modal.loan.amount - modal.loan.repaid)}</strong></p>
          <div className="form-group"><label className="form-label">REPAYMENT AMOUNT</label><input className="form-input" type="number" min="1" value={form.repayAmount || ''} onChange={e => setForm(f => ({ ...f, repayAmount: e.target.value }))} /></div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button><button className="btn btn-primary" onClick={() => repayLoan(modal.loan)} disabled={saving}>{saving ? 'PAYING...' : 'REPAY'}</button></div>
        </Modal>
      )}

      {modal === 'fund' && (
        <Modal title="CREATE SHIP FUND" onClose={() => setModal(null)}>
          <div className="form-group"><label className="form-label">FUND NAME *</label><input className="form-input" value={form.fundName || ''} onChange={e => setForm(f => ({ ...f, fundName: e.target.value }))} placeholder="e.g. Polaris Acquisition Fund" /></div>
          <div className="form-group"><label className="form-label">TARGET AMOUNT (aUEC) *</label><input className="form-input" type="number" value={form.fundTarget || ''} onChange={e => setForm(f => ({ ...f, fundTarget: e.target.value }))} placeholder="0" /></div>
          <div className="form-group"><label className="form-label">SHIP (optional)</label><input className="form-input" value={form.fundShip || ''} onChange={e => { setForm(f => ({ ...f, fundShip: e.target.value })); setShipSearch(e.target.value) }} placeholder="Search SC ships..." /></div>
          <div className="form-group"><label className="form-label">DESCRIPTION</label><textarea className="form-textarea" value={form.fundDesc || ''} onChange={e => setForm(f => ({ ...f, fundDesc: e.target.value }))} placeholder="What is this fund for?" /></div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button><button className="btn btn-primary" onClick={createFund} disabled={saving}>{saving ? 'CREATING...' : 'CREATE FUND'}</button></div>
        </Modal>
      )}

      {modal?.type === 'contrib' && (
        <Modal title={`CONTRIBUTE — ${modal.fund.name}`} onClose={() => setModal(null)}>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>Remaining: <strong style={{ color: 'var(--accent)' }}>{formatCredits(modal.fund.target_amount - modal.fund.current_amount)}</strong></p>
          <div className="form-group"><label className="form-label">CONTRIBUTION (aUEC)</label><input className="form-input" type="number" min="1" value={form.contribAmount || ''} onChange={e => setForm(f => ({ ...f, contribAmount: e.target.value }))} /></div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>YOUR BALANCE: {formatCredits(me.wallet_balance || 0)}</div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button><button className="btn btn-primary" onClick={() => contributeFund(modal.fund)} disabled={saving}>{saving ? 'CONTRIBUTING...' : 'CONTRIBUTE'}</button></div>
        </Modal>
      )}

      {modal === 'tax' && (
        <Modal title="SET TAX RATE" onClose={() => setModal(null)}>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>Percentage automatically deducted from contract payouts into the treasury.</p>
          <div className="form-group"><label className="form-label">TAX RATE (%)</label><input className="form-input" type="number" min="0" max="100" value={form.newTax} onChange={e => setForm(f => ({ ...f, newTax: e.target.value }))} /></div>
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button><button className="btn btn-primary" onClick={saveTaxRate}>SAVE</button></div>
        </Modal>
      )}

      {modal === 'budget' && (
        <Modal title="ALLOCATE DIVISION BUDGET" onClose={() => setModal(null)}>
          <div className="form-group"><label className="form-label">DIVISION</label><select className="form-select" value={form.budgetDiv || ''} onChange={e => setForm(f => ({ ...f, budgetDiv: e.target.value }))}><option value="">— Select —</option>{SC_DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
          <div className="form-group"><label className="form-label">BUDGET (aUEC)</label><input className="form-input" type="number" value={form.budgetAmt || ''} onChange={e => setForm(f => ({ ...f, budgetAmt: e.target.value }))} /></div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button><button className="btn btn-primary" onClick={saveBudget} disabled={saving}>{saving ? 'SAVING...' : 'ALLOCATE'}</button></div>
        </Modal>
      )}
    </>
  )
}
