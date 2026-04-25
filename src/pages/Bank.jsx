import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatCredits, getRankByTier } from '../lib/ranks'
import { SC_SHIPS } from '../lib/ships'
import { SC_DIVISIONS } from '../lib/scdata'
import Modal from '../components/Modal'
import GrayveilLogo from '../components/GrayveilLogo'
import { greenBurst } from '../lib/confetti'
import { useToast } from '../components/Toast'
import { timeAgo, fmtDate as fmt } from '../lib/dates'
import { UEE_AMBER, ClassificationBar, TabStrip } from '../components/uee'

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

function cvv(id) {
  const hex = (id || '').replace(/-/g, '').slice(-3).padEnd(3, '0')
  let out = ''
  for (let i = 0; i < 3; i++) out += (parseInt(hex[i], 16) % 10).toString()
  return out
}

function issuedYear(createdAt) {
  if (!createdAt) return new Date().getFullYear()
  return new Date(createdAt).getFullYear()
}

function expiryLabel(createdAt) {
  const base = createdAt ? new Date(createdAt) : new Date()
  const yy = (base.getFullYear() + 5).toString().slice(-2)
  const mm = String(base.getMonth() + 1).padStart(2, '0')
  return `${mm}/${yy}`
}

function BankCard({ member, size = 'md', flippable = false }) {
  const [flipped, setFlipped] = useState(false)
  const rank = getRankByTier(member.tier || 9)
  const accent = rank.color
  const bg = cardGradient(member.tier || 9)
  const maxWidth = size === 'lg' ? 440 : size === 'sm' ? 300 : 360

  const num = cardNumber(member.id)
  const code = cvv(member.id)
  const exp = expiryLabel(member.created_at)

  return (
    <div
      onClick={() => flippable && setFlipped(f => !f)}
      style={{
        position: 'relative',
        width: maxWidth, maxWidth: '100%', aspectRatio: '1.586 / 1',
        perspective: 1400,
        cursor: flippable ? 'pointer' : 'default',
      }}
    >
      <div style={{
        position: 'relative', width: '100%', height: '100%',
        transformStyle: 'preserve-3d',
        transition: 'transform .6s cubic-bezier(.22,.9,.3,1)',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>
        {/* ── FRONT ── */}
        <div style={{
          position: 'absolute', inset: 0,
          background: bg,
          border: `1px solid ${accent}55`,
          borderRadius: 14,
          padding: 20,
          color: '#ededf2',
          boxShadow: `0 10px 38px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px ${accent}22`,
          overflow: 'hidden',
          fontFamily: 'JetBrains Mono, monospace',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}>
          {/* Shimmer sweep */}
          <div style={{
            position: 'absolute', top: 0, left: '-40%', width: '40%', height: '100%',
            background: `linear-gradient(120deg, transparent 0%, ${accent}18 50%, transparent 100%)`,
            animation: 'gvCardShimmer 6s linear infinite',
            pointerEvents: 'none',
          }} />
          {/* Holo blob */}
          <div style={{
            position: 'absolute', top: -50, right: -50, width: 160, height: 160, borderRadius: '50%',
            background: `radial-gradient(circle, ${accent}33 0%, transparent 65%)`,
            pointerEvents: 'none',
          }} />
          {/* Accent bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
            opacity: 0.75,
          }} />

          {/* Top row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
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

          {/* EMV chip + contactless */}
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
            <div style={{
              width: 42, height: 32, borderRadius: 5,
              background: 'linear-gradient(135deg, #e0c878 0%, #b8985a 40%, #d4b571 70%, #8a7448 100%)',
              position: 'relative', boxShadow: 'inset 0 0 2px rgba(0,0,0,0.4)',
            }}>
              <div style={{ position: 'absolute', inset: 4, border: '1px solid rgba(0,0,0,0.25)', borderRadius: 3 }} />
              <div style={{ position: 'absolute', left: 4, right: 4, top: '50%', height: 1, background: 'rgba(0,0,0,0.3)' }} />
              <div style={{ position: 'absolute', top: 4, bottom: 4, left: '50%', width: 1, background: 'rgba(0,0,0,0.3)' }} />
            </div>
            {/* Contactless wave */}
            <svg width="18" height="20" viewBox="0 0 18 20" style={{ opacity: 0.45 }}>
              <path d="M4 4 A 10 10 0 0 1 4 16" stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" />
              <path d="M8 4 A 10 10 0 0 1 8 16" stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" />
              <path d="M12 4 A 10 10 0 0 1 12 16" stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </div>

          {/* Card number */}
          <div style={{
            marginTop: 14, fontSize: size === 'lg' ? 20 : 'clamp(13px, 2.4vw, 16px)',
            letterSpacing: '.18em', color: '#e4e6ed',
            textShadow: '0 1px 0 rgba(0,0,0,0.45)', position: 'relative',
          }}>{num}</div>

          {/* Bottom row */}
          <div style={{
            position: 'absolute', left: 20, right: 20, bottom: 18,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 8, letterSpacing: '.2em', color: '#8a8f9c', marginBottom: 3 }}>OPERATIVE</div>
              <div style={{
                fontSize: size === 'lg' ? 15 : 13, letterSpacing: '.08em', color: '#ededf2',
                fontFamily: 'Syne, sans-serif', fontWeight: 600,
                textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{member.handle}</div>
              <div style={{ fontSize: 9, letterSpacing: '.15em', color: accent, marginTop: 2 }}>{rank.rank}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 8, letterSpacing: '.2em', color: '#8a8f9c', marginBottom: 3 }}>VALID THRU</div>
              <div style={{ fontSize: 12, color: '#d4d8e0', letterSpacing: '.1em' }}>{exp}</div>
            </div>
          </div>
        </div>

        {/* ── BACK ── */}
        <div style={{
          position: 'absolute', inset: 0,
          background: bg,
          border: `1px solid ${accent}55`,
          borderRadius: 14,
          color: '#ededf2',
          boxShadow: `0 10px 38px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)`,
          overflow: 'hidden',
          fontFamily: 'JetBrains Mono, monospace',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          padding: 0,
        }}>
          {/* Magnetic stripe */}
          <div style={{
            marginTop: 24, height: 42,
            background: 'linear-gradient(180deg, #0a0b0f 0%, #14161c 50%, #0a0b0f 100%)',
            borderTop: '1px solid rgba(0,0,0,0.5)',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }} />
          {/* Signature + CVV */}
          <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'stretch', gap: 12 }}>
            <div style={{
              flex: 1,
              background: 'repeating-linear-gradient(45deg, #d4d8e0 0 4px, #b8bcc8 4px 8px)',
              border: '1px solid rgba(0,0,0,0.3)',
              borderRadius: 3, height: 28, position: 'relative',
              display: 'flex', alignItems: 'center', paddingLeft: 10,
            }}>
              <div style={{
                fontFamily: 'Syne, sans-serif', fontStyle: 'italic',
                fontSize: 14, color: '#0a0b0f', letterSpacing: '.05em',
              }}>{(member.handle || '').slice(0, 18)}</div>
            </div>
            <div style={{
              width: 64, background: '#fff', color: '#0a0b0f',
              borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700,
              letterSpacing: '.1em',
            }}>{code}</div>
          </div>
          {/* Metadata */}
          <div style={{
            position: 'absolute', left: 20, right: 20, bottom: 18,
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 8, letterSpacing: '.2em', color: '#8a8f9c', marginBottom: 3 }}>ISSUED</div>
              <div style={{ fontSize: 11, color: '#d4d8e0', letterSpacing: '.1em' }}>{issuedYear(member.created_at)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 8, letterSpacing: '.2em', color: '#6a7280' }}>GRAYVEIL CORPORATION · STANTON</div>
              <div style={{ fontSize: 8, letterSpacing: '.2em', color: accent, marginTop: 2 }}>AUTHORIZED USE ONLY</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 8, letterSpacing: '.2em', color: '#8a8f9c', marginBottom: 3 }}>BALANCE</div>
              <div style={{ fontSize: 13, fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#d4d8e0' }}>{formatCredits(member.wallet_balance || 0)}</div>
            </div>
          </div>
        </div>
      </div>
      {flippable && (
        <div style={{
          position: 'absolute', bottom: -22, left: 0, right: 0, textAlign: 'center',
          fontSize: 9, letterSpacing: '.3em', color: 'var(--text-3)',
          fontFamily: 'JetBrains Mono, monospace', pointerEvents: 'none',
        }}>{flipped ? '◂ TAP TO FLIP BACK ▸' : '◂ TAP CARD TO FLIP ▸'}</div>
      )}
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

// FICO-style bands. Keep tiers + labels centralized so the pill, ring, and
// tab summary all read from the same source.
const CREDIT_TIERS = [
  { min: 800, label: 'EXCELLENT', color: '#c8a55a' },  // gold
  { min: 740, label: 'VERY GOOD', color: '#5ce0a1' },  // green
  { min: 670, label: 'GOOD',      color: '#5a80d9' },  // blue
  { min: 580, label: 'FAIR',      color: '#e0a155' },  // amber
  { min: 300, label: 'POOR',      color: '#e05c5c' },  // red
]
function creditTier(score) {
  const s = Number(score) || 0
  return CREDIT_TIERS.find(t => s >= t.min) || CREDIT_TIERS[CREDIT_TIERS.length - 1]
}

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
      supabase.from('profiles').select('id, handle, wallet_balance, tier, division, credit_score, is_founder').eq('status', 'ACTIVE').order('wallet_balance', { ascending: false }),
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
    if (!form.recipient) { setError('Look up a recipient by handle first.'); return }
    setSaving(true)
    const { error } = await supabase.rpc('transfer_funds', { p_recipient_id: form.recipient, p_amount: amt, p_description: form.desc || null })
    if (error) { setError(error.message); setSaving(false); return }
    greenBurst(); toast('Transfer complete', 'success')
    await refreshProfile()
    setForm({}); setSaving(false); load()
  }

  // ── REQUEST PAYMENT ──
  async function requestPayment() {
    const amt = parseInt(form.amount)
    if (!amt || amt <= 0) { setError('Enter a valid amount.'); return }
    if (!form.recipient) { setError('Look up a recipient by handle first.'); return }
    setSaving(true)
    const recip = members.find(m => m.id === form.recipient)
    const msg = `${me.handle} is requesting ${formatCredits(amt)}${form.desc ? ' — ' + form.desc : ''}.`
    const { error } = await supabase.from('notifications').insert({
      recipient_id: form.recipient,
      type: 'payment_request',
      title: `Payment request from ${me.handle}`,
      message: msg,
      link: '/bank',
    })
    if (error) { setError(error.message); setSaving(false); return }
    toast(`Request sent to ${recip?.handle || 'operative'}`, 'success')
    setForm({}); setSaving(false)
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
  const myTxns = useMemo(
    () => txns.filter(t => t.from_id === me.id || t.to_id === me.id),
    [txns, me.id]
  )
  const myStats = useMemo(() => {
    let sent = 0, received = 0
    for (const t of myTxns) {
      if (t.from_id === me.id) sent += t.amount || 0
      if (t.to_id === me.id) received += t.amount || 0
    }
    return { sent, received, net: received - sent, count: myTxns.length }
  }, [myTxns, me.id])

  const filteredFundShips = useMemo(() => {
    if (!shipSearch) return []
    return SC_SHIPS.filter(s => s.name.toLowerCase().includes(shipSearch.toLowerCase())).slice(0, 10)
  }, [shipSearch])

  const handleMatches = useMemo(() => {
    const q = (form.recipientHandle || '').trim().toLowerCase()
    if (!q) return []
    return members.filter(m => m.id !== me.id && m.handle.toLowerCase().includes(q)).slice(0, 6)
  }, [form.recipientHandle, members, me.id])

  const recipientMember = useMemo(
    () => members.find(m => m.id === form.recipient),
    [form.recipient, members]
  )

  const TABS = [
    { key: 'overview',     label: 'OVERVIEW',     glyph: '◆' },
    { key: 'my card',      label: 'MY CARD',      glyph: '◈' },
    { key: 'credit',       label: 'CREDIT',       glyph: '✦' },
    { key: 'transactions', label: 'TRANSACTIONS', glyph: '◎' },
    { key: 'transfers',    label: 'TRANSFERS',    glyph: '⇄' },
    { key: 'loans',        label: 'LOANS',        glyph: '◐' },
    { key: 'ship funds',   label: 'SHIP FUNDS',   glyph: '◉' },
    { key: 'budgets',      label: 'BUDGETS',      glyph: '◇' },
  ]
  const myCreditTier = creditTier(me.credit_score)

  return (
    <>
      <ClassificationBar
        section="GRAYVEIL RESERVE · FINANCIAL CONTROL"
        label={tab.toUpperCase()}
        right={(
          <>
            <span>WALLET · <span style={{ color: UEE_AMBER }}>{formatCredits(me.wallet_balance || 0)}</span></span>
            <span style={{ color: myCreditTier.color }}>CREDIT · {me.credit_score || 0} ({myCreditTier.label})</span>
            {isOfficer && <span style={{ color: UEE_AMBER }}>TREASURY · {formatCredits(treasury)}</span>}
          </>
        )}
      />

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>GRAYVEIL RESERVE</h1>
            <div style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 640 }}>
              Wallet operations, credit standing, treasury control, ship-fund pooling, and division budgets.
            </div>
          </div>
          <div style={{
            textAlign: 'right',
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            borderLeft: `3px solid ${UEE_AMBER}`,
            borderRadius: 3, padding: '8px 14px',
          }}>
            <div style={{
              fontSize: 9, letterSpacing: '.22em', color: 'var(--text-3)',
              fontFamily: 'var(--font-mono)',
            }}>◆ YOUR WALLET</div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700,
              color: UEE_AMBER, lineHeight: 1.1,
            }}>{formatCredits(me.wallet_balance || 0)}</div>
          </div>
        </div>

        <TabStrip
          active={tab} onChange={setTab}
          tabs={TABS.map(t => ({ ...t, color: UEE_AMBER }))}
        />
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING BANK DATA...</div> : (
          <>
            {/* ── OVERVIEW ── */}
            {tab === 'overview' && (
              <>
                <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
                  <div className="stat-card">
                    <div className="stat-label">YOUR WALLET</div>
                    <div className="stat-value" style={{ color: 'var(--green)' }}>{formatCredits(me.wallet_balance || 0)}</div>
                    <div className="stat-sub">personal balance</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">TREASURY</div>
                    <div className="stat-value" style={{ color: 'var(--accent)' }}>{formatCredits(treasury)}</div>
                    <div className="stat-sub">org treasury balance</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">ORG TAX RATE</div>
                    <div className="stat-value">{taxRate}%</div>
                    <div className="stat-sub">on contract payouts</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">YOUR TXNS</div>
                    <div className="stat-value">{myStats.count}</div>
                    <div className="stat-sub">on record</div>
                  </div>
                </div>

                <div className="grid-2" style={{ gap: 20 }}>
                  <div>
                    <div className="section-header"><div className="section-title">YOUR RECENT ACTIVITY</div></div>
                    {myTxns.slice(0, 8).map(t => {
                      const outgoing = t.from_id === me.id
                      return (
                        <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 16, color: TXN_COLORS[t.type] || 'var(--text-3)', width: 24, textAlign: 'center' }}>{TXN_ICONS[t.type] || '·'}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description || t.type}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{timeAgo(t.created_at)}</div>
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: outgoing ? 'var(--red)' : 'var(--green)' }}>
                            {outgoing ? '−' : '+'}{formatCredits(t.amount)}
                          </span>
                        </div>
                      )
                    })}
                    {myTxns.length === 0 && <div className="empty-state" style={{ padding: '24px 0' }}>NO ACTIVITY YET</div>}
                  </div>
                  <div>
                    {funds.filter(f => f.status === 'ACTIVE').length > 0 && (
                      <>
                        <div className="section-header"><div className="section-title">ACTIVE SHIP FUNDS</div></div>
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
                    {funds.filter(f => f.status === 'ACTIVE').length === 0 && (
                      <>
                        <div className="section-header"><div className="section-title">QUICK ACTIONS</div></div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <button className="btn btn-ghost" onClick={() => setTab('my card')}>VIEW MY CARD</button>
                          <button className="btn btn-ghost" onClick={() => setTab('transfers')}>SEND / REQUEST aUEC</button>
                          <button className="btn btn-ghost" onClick={() => setTab('transactions')}>FULL TRANSACTION LEDGER</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── MY CARD ── */}
            {tab === 'my card' && (
              <div style={{ maxWidth: 960, margin: '0 auto' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                  gap: 28, alignItems: 'start',
                }} className="my-card-grid">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
                    <div style={{ animation: 'gvCardFloat 6s ease-in-out infinite' }}>
                      <BankCard member={me} size="lg" flippable />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '.2em', fontFamily: 'var(--font-mono)', textAlign: 'center', lineHeight: 1.7 }}>
                      ISSUED {issuedYear(me.created_at)} · GRAYVEIL RESERVE<br />
                      LINKED WALLET · T-{(getRankByTier(me.tier || 9)).tier} {(getRankByTier(me.tier || 9)).rank}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div className="card" style={{ padding: 20 }}>
                      <div style={{ fontSize: 10, letterSpacing: '.25em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>CURRENT BALANCE</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, color: 'var(--accent)', lineHeight: 1 }}>
                        {formatCredits(me.wallet_balance || 0)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>aUEC · {getRankByTier(me.tier || 9).rank}</div>
                    </div>

                    <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }}>
                      <div className="stat-card" style={{ padding: 12 }}>
                        <div className="stat-label" style={{ fontSize: 9 }}>RECEIVED</div>
                        <div className="stat-value" style={{ fontSize: 16, color: 'var(--green)' }}>{formatCredits(myStats.received)}</div>
                      </div>
                      <div className="stat-card" style={{ padding: 12 }}>
                        <div className="stat-label" style={{ fontSize: 9 }}>SENT</div>
                        <div className="stat-value" style={{ fontSize: 16, color: 'var(--red)' }}>{formatCredits(myStats.sent)}</div>
                      </div>
                      <div className="stat-card" style={{ padding: 12 }}>
                        <div className="stat-label" style={{ fontSize: 9 }}>NET FLOW</div>
                        <div className="stat-value" style={{ fontSize: 16, color: myStats.net >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {myStats.net >= 0 ? '+' : ''}{formatCredits(myStats.net)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <button className="btn btn-primary" onClick={() => setTab('transfers')}>SEND aUEC</button>
                      <button className="btn btn-ghost" onClick={() => setTab('transfers')}>REQUEST PAYMENT</button>
                      <button className="btn btn-ghost" style={{ gridColumn: '1 / -1' }} onClick={() => setTab('transactions')}>VIEW LEDGER</button>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.7, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                      Your card is private. No other operative can see your balance, card number, or CVV. To pay someone, you need their handle — to receive payment, send a request.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── CREDIT ── */}
            {tab === 'credit' && (
              <CreditTab
                me={me}
                members={members}
                onEdit={(member) => {
                  setForm({ creditTarget: member.id, creditTargetHandle: member.handle, creditScore: member.credit_score || 600, creditReason: '' })
                  setError(''); setModal('credit')
                }}
                isFounder={!!me.is_founder}
              />
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
              <div style={{ maxWidth: 560 }}>
                <div className="card mb-20">
                  <div className="section-title mb-16">SEND OR REQUEST aUEC</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 14, lineHeight: 1.7 }}>
                    You must know the operative's handle — members are not publicly listed.
                  </div>

                  <div className="form-group">
                    <label className="form-label">RECIPIENT HANDLE</label>
                    {recipientMember ? (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', background: 'var(--accent-glow)',
                        border: '1px solid var(--accent)', borderRadius: 6,
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>{recipientMember.handle}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em' }}>
                            {getRankByTier(recipientMember.tier || 9).rank.toUpperCase()} · VERIFIED
                          </div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => setForm(f => ({ ...f, recipient: '', recipientHandle: '' }))}>CLEAR</button>
                      </div>
                    ) : (
                      <>
                        <input
                          className="form-input"
                          value={form.recipientHandle || ''}
                          onChange={e => setForm(f => ({ ...f, recipientHandle: e.target.value, recipient: '' }))}
                          placeholder="Type a handle..."
                          autoComplete="off"
                        />
                        {handleMatches.length > 0 && (
                          <div style={{
                            marginTop: 6, border: '1px solid var(--border)', borderRadius: 6,
                            background: 'var(--bg-raised)', maxHeight: 180, overflowY: 'auto',
                          }}>
                            {handleMatches.map(m => (
                              <button
                                key={m.id}
                                onClick={() => setForm(f => ({ ...f, recipient: m.id, recipientHandle: m.handle }))}
                                style={{
                                  display: 'flex', width: '100%', padding: '8px 12px',
                                  background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)',
                                  color: 'var(--text-1)', fontSize: 13, cursor: 'pointer', textAlign: 'left',
                                  alignItems: 'center', justifyContent: 'space-between', gap: 8,
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <span>{m.handle}</span>
                                <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em' }}>
                                  {getRankByTier(m.tier || 9).rank.toUpperCase()}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                        {form.recipientHandle && handleMatches.length === 0 && (
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                            NO OPERATIVE MATCHES "{form.recipientHandle}"
                          </div>
                        )}
                      </>
                    )}
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
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={() => { setError(''); doTransfer() }} disabled={saving || !form.recipient}>
                      {saving ? 'SENDING...' : 'SEND aUEC'}
                    </button>
                    <button className="btn btn-ghost" onClick={() => { setError(''); requestPayment() }} disabled={saving || !form.recipient}>
                      {saving ? 'SENDING REQUEST...' : 'REQUEST PAYMENT'}
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10, fontFamily: 'var(--font-mono)' }}>
                    YOUR BALANCE: {formatCredits(me.wallet_balance || 0)}
                  </div>
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

      {modal === 'credit' && (
        <Modal title={`CREDIT SCORE — ${form.creditTargetHandle || 'Operative'}`} onClose={() => setModal(null)}>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.5 }}>
            Set this operative's Grayveil credit rating. Score must be between <strong>300</strong> (delinquent) and <strong>850</strong> (excellent).
          </p>
          <div className="form-group">
            <label className="form-label">SCORE</label>
            <input
              className="form-input"
              type="number"
              min={300}
              max={850}
              value={form.creditScore ?? 600}
              onChange={e => setForm(f => ({ ...f, creditScore: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">REASON (optional, audit log only)</label>
            <input
              className="form-input"
              placeholder="e.g. Late loan repayment / consistent op attendance"
              value={form.creditReason || ''}
              onChange={e => setForm(f => ({ ...f, creditReason: e.target.value }))}
            />
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
            <button
              className="btn btn-primary"
              disabled={saving}
              onClick={async () => {
                const score = parseInt(form.creditScore)
                if (!score || score < 300 || score > 850) { setError('Score must be 300–850.'); return }
                setSaving(true); setError('')
                const { error: err } = await supabase.rpc('set_credit_score', {
                  p_target_id: form.creditTarget,
                  p_score: score,
                  p_reason: form.creditReason || null,
                })
                if (err) { setError(err.message); setSaving(false); return }
                toast(`Credit score updated to ${score}`, 'success')
                setModal(null); setSaving(false); setForm({}); load()
              }}
            >
              {saving ? 'SAVING...' : 'APPLY'}
            </button>
          </div>
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

// ─── CREDIT SCORE TAB ───────────────────────────────────────────
// Shows the operative's own score prominently, plus the full roster so
// founders can bump scores. Non-founders see the roster read-only.
function CreditTab({ me, members, onEdit, isFounder }) {
  const [search, setSearch] = useState('')
  const myScore = me.credit_score ?? 600
  const myTier  = creditTier(myScore)

  const avg = useMemo(() => {
    if (!members.length) return 0
    const sum = members.reduce((acc, m) => acc + (m.credit_score || 0), 0)
    return Math.round(sum / members.length)
  }, [members])

  const q = search.trim().toLowerCase()
  const visibleMembers = q
    ? members.filter(m => (m.handle || '').toLowerCase().includes(q))
    : members

  return (
    <>
      {/* Your own score — prominent ring + tier label */}
      <div className="card" style={{ padding: 24, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
        <CreditDial score={myScore} tier={myTier} size={140} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 10, letterSpacing: '.25em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
            YOUR GRAYVEIL CREDIT SCORE
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, color: myTier.color, lineHeight: 1 }}>
            {myScore} <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 400, letterSpacing: '.15em' }}>· {myTier.label}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginTop: 10, maxWidth: 520 }}>
            Score reflects reliability on org operations — loan repayment, op attendance, contract completion, and standing with the treasury. Only the founder can adjust scores.
          </div>
        </div>
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2,minmax(120px,1fr))', gap: 10, minWidth: 240 }}>
          <div className="stat-card" style={{ padding: 12 }}>
            <div className="stat-label" style={{ fontSize: 9 }}>ORG AVERAGE</div>
            <div className="stat-value" style={{ fontSize: 20 }}>{avg}</div>
          </div>
          <div className="stat-card" style={{ padding: 12 }}>
            <div className="stat-label" style={{ fontSize: 9 }}>OPERATIVES</div>
            <div className="stat-value" style={{ fontSize: 20 }}>{members.length}</div>
          </div>
        </div>
      </div>

      {/* Band legend */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {CREDIT_TIERS.map(t => (
          <div key={t.label} style={{
            fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '.15em',
            padding: '4px 10px', borderRadius: 14,
            background: `${t.color}18`,
            border: `1px solid ${t.color}55`,
            color: t.color,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.color }} />
            {t.label} <span style={{ opacity: 0.6 }}>≥ {t.min}</span>
          </div>
        ))}
      </div>

      {/* Roster table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, letterSpacing: '.2em', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
            ROSTER · {visibleMembers.length} OPERATIVES
          </div>
          <input
            className="form-input"
            style={{ maxWidth: 240 }}
            placeholder="Search handle..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>OPERATIVE</th>
                <th>DIVISION</th>
                <th style={{ textAlign: 'right' }}>SCORE</th>
                <th>TIER</th>
                <th style={{ textAlign: 'right' }}>WALLET</th>
                {isFounder && <th style={{ width: 1, whiteSpace: 'nowrap' }}></th>}
              </tr>
            </thead>
            <tbody>
              {visibleMembers.length === 0 ? (
                <tr><td colSpan={isFounder ? 6 : 5} className="empty-state">NO OPERATIVES</td></tr>
              ) : visibleMembers.map(m => {
                const score = m.credit_score ?? 600
                const tier = creditTier(score)
                const isMe = m.id === me.id
                return (
                  <tr key={m.id}>
                    <td>
                      <span style={{ fontWeight: isMe ? 600 : 400 }}>{m.handle}</span>
                      {isMe && <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--accent)', fontFamily: 'var(--font-mono)', letterSpacing: '.2em' }}>YOU</span>}
                      {m.is_founder && <span style={{ marginLeft: 6, fontSize: 9, color: '#c8a55a', fontFamily: 'var(--font-mono)', letterSpacing: '.2em' }}>★ FOUNDER</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{m.division || '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: tier.color }}>{score}</td>
                    <td>
                      <span style={{
                        fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '.15em',
                        padding: '2px 8px', borderRadius: 10,
                        background: `${tier.color}22`, color: tier.color,
                        border: `1px solid ${tier.color}55`,
                      }}>{tier.label}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>
                      {formatCredits(m.wallet_balance || 0)}
                    </td>
                    {isFounder && (
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => onEdit(m)}>ADJUST</button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// Simple dial / ring showing the score as a 300-850 sweep.
function CreditDial({ score, tier, size = 140 }) {
  const s = Math.max(300, Math.min(850, Number(score) || 0))
  const pct = (s - 300) / (850 - 300)              // 0..1
  const stroke = 10
  const r = (size / 2) - (stroke / 2) - 2
  const cx = size / 2
  const cy = size / 2
  const C = 2 * Math.PI * r
  const arcLen = pct * C
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-surface)" strokeWidth={stroke} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={tier.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${C}`}
          style={{ transition: 'stroke-dasharray .6s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: tier.color, lineHeight: 1 }}>{s}</div>
        <div style={{ fontSize: 9, letterSpacing: '.25em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
          {tier.label}
        </div>
      </div>
    </div>
  )
}
