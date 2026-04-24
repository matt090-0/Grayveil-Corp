import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatCredits } from '../lib/ranks'
import { useToast } from '../components/Toast'
import { greenBurst } from '../lib/confetti'
import { discordBounty, discordBountyClaimed } from '../lib/discord'
import { confirmAction } from '../lib/dialogs'
import {
  UEE_AMBER, ClassificationBar, TabStrip, StatCell, FilterRow, Card,
  StatusBadge, Field, EmptyState, UeeModal, btnMicro, fmtDate,
} from '../components/uee'

const RED    = '#e05c5c'
const GREEN  = '#5ce0a1'
const MUTED  = '#9099a8'

const STATUS_META = {
  ACTIVE:    { color: RED,        glyph: '◉', label: 'ACTIVE' },
  CLAIMED:   { color: GREEN,      glyph: '✓', label: 'CLAIMED' },
  CANCELLED: { color: MUTED,      glyph: '○', label: 'CANCELLED' },
  EXPIRED:   { color: '#7a6a6a',  glyph: '⌛', label: 'EXPIRED' },
}

function timeLeft(ts) {
  if (!ts) return null
  const diff = new Date(ts) - Date.now()
  if (diff <= 0) return { text: 'EXPIRED', urgent: true }
  const d = Math.floor(diff / 86400000)
  const h = Math.floor(diff / 3600000)
  if (d > 0) return { text: `${d}D LEFT`, urgent: false }
  return { text: `${h}H LEFT`, urgent: h < 12 }
}

export default function Bounties() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const [bounties, setBounties] = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('active')
  const [search, setSearch]     = useState('')
  const [modal, setModal]       = useState(null)
  const [form, setForm]         = useState({})
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const canPost = me.tier <= 4

  async function load() {
    const { data } = await supabase.from('bounties').select('*, poster:profiles!bounties_posted_by_fkey(handle), claimer:profiles!bounties_claimed_by_fkey(handle)').order('created_at', { ascending: false })
    setBounties(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const active    = useMemo(() => bounties.filter(b => b.status === 'ACTIVE'),    [bounties])
  const claimed   = useMemo(() => bounties.filter(b => b.status === 'CLAIMED'),   [bounties])
  const history   = useMemo(() => bounties.filter(b => b.status !== 'ACTIVE' && b.status !== 'CLAIMED'), [bounties])
  const totalPool = useMemo(() => active.reduce((s, b) => s + (b.reward || 0), 0), [active])
  const biggest   = useMemo(() => active.reduce((m, b) => b.reward > (m?.reward || 0) ? b : m, null), [active])

  const listForTab = tab === 'active' ? active : tab === 'claimed' ? claimed : history
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return listForTab
    return listForTab.filter(b =>
      (b.target_name || '').toLowerCase().includes(q)
      || (b.target_org || '').toLowerCase().includes(q)
      || (b.reason || '').toLowerCase().includes(q)
      || (b.poster?.handle || '').toLowerCase().includes(q)
      || (b.claimer?.handle || '').toLowerCase().includes(q)
    )
  }, [listForTab, search])

  async function postBounty(e) {
    e.preventDefault()
    if (!form.target_name) { setError('Target name required.'); return }
    setSaving(true)
    const { error: err } = await supabase.from('bounties').insert({
      target_name: form.target_name,
      target_org: form.target_org || null,
      reason: form.reason || null,
      reward: parseInt(form.reward) || 0,
      posted_by: me.id,
      expires_at: form.expires_at || null,
    })
    if (err) { setError(err.message); setSaving(false); return }
    discordBounty(form.target_name, formatCredits(parseInt(form.reward) || 0), me.handle)
    toast('Bounty posted', 'success')
    setModal(null); setSaving(false); setForm({}); load()
  }

  async function claimBounty(b) {
    if (!(await confirmAction(`Claim bounty on ${b.target_name} for ${formatCredits(b.reward)}?`))) return
    const { error: err } = await supabase.rpc('claim_bounty', { p_bounty_id: b.id })
    if (err) { toast(err.message, 'error'); return }
    greenBurst()
    discordBountyClaimed(b.target_name, formatCredits(b.reward), me.handle)
    toast(`Bounty claimed — ${formatCredits(b.reward)} deposited`, 'success')
    load()
  }

  async function cancelBounty(id) {
    if (!(await confirmAction('Cancel this bounty?'))) return
    await supabase.from('bounties').update({ status: 'CANCELLED' }).eq('id', id)
    toast('Bounty cancelled', 'info'); load()
  }

  return (
    <>
      <ClassificationBar
        section="GRAYVEIL BOUNTY REGISTRY"
        label={tab.toUpperCase()}
        accent={RED}
        right={(
          <>
            <span>ACTIVE · {active.length}</span>
            <span style={{ color: RED }}>POOL · {formatCredits(totalPool)}</span>
          </>
        )}
      />

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>BOUNTY BOARD</h1>
            <div style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 600 }}>
              Contracts placed on hostile operators. Claim the target and receipts land in your wallet on confirmation.
            </div>
          </div>
          {canPost && (
            <button className="btn btn-primary" onClick={() => { setForm({}); setError(''); setModal('post') }}>
              + POST BOUNTY
            </button>
          )}
        </div>

        <TabStrip
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'active',  label: 'ACTIVE',  color: RED,   glyph: '◉', count: active.length },
            { key: 'claimed', label: 'CLAIMED', color: GREEN, glyph: '✓', count: claimed.length },
            { key: 'history', label: 'HISTORY', color: MUTED, glyph: '◊', count: history.length },
          ]}
        />
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING REGISTRY...</div> : (
          <>
            {/* Stat strip — only on active tab */}
            {tab === 'active' && active.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 10, marginBottom: 18,
              }}>
                <StatCell label="ACTIVE CONTRACTS" value={active.length}      color={RED}      glyph="◉" />
                <StatCell label="TOTAL POOL"       value={formatCredits(totalPool)} color={UEE_AMBER} glyph="◆" />
                <StatCell label="BIGGEST BOUNTY"   value={biggest ? formatCredits(biggest.reward) : '—'} color={GREEN} glyph="▲"
                  desc={biggest ? `on ${biggest.target_name}` : 'No bounties yet'} />
              </div>
            )}

            <FilterRow
              search={search}
              setSearch={setSearch}
              placeholder="Search target, org, poster, reason..."
            />

            {shown.length === 0 ? (
              <EmptyState>
                {tab === 'active'
                  ? (canPost
                      ? <>No active bounties. <a onClick={() => { setForm({}); setError(''); setModal('post') }} style={{ color: RED, cursor: 'pointer', textDecoration: 'underline' }}>Post the first one</a>.</>
                      : 'No active bounties.')
                  : tab === 'claimed' ? 'No claimed bounties.' : 'No cancelled or expired bounties.'}
              </EmptyState>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 12,
              }}>
                {shown.map(b => (
                  <BountyCard
                    key={b.id} bounty={b} me={me}
                    onClaim={() => claimBounty(b)}
                    onCancel={() => cancelBounty(b.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {modal === 'post' && (
        <UeeModal
          accent={RED}
          kicker="◉ NEW CONTRACT · REGISTRY ENTRY"
          title="POST BOUNTY"
          onClose={() => setModal(null)}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
              <button className="btn btn-primary" onClick={postBounty} disabled={saving}>
                {saving ? 'POSTING...' : 'POST BOUNTY'}
              </button>
            </>
          )}
        >
          <form onSubmit={postBounty}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">TARGET NAME *</label>
                <input className="form-input" value={form.target_name || ''}
                  onChange={e => setForm(f => ({ ...f, target_name: e.target.value }))}
                  placeholder="Player handle" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">TARGET ORG</label>
                <input className="form-input" value={form.target_org || ''}
                  onChange={e => setForm(f => ({ ...f, target_org: e.target.value }))}
                  placeholder="Org tag (optional)" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">REASON</label>
              <textarea className="form-textarea" value={form.reason || ''}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Why this contract exists — prior incidents, hostile actions, standing orders..."
                style={{ minHeight: 70 }} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">REWARD · aUEC</label>
                <input className="form-input" type="number" value={form.reward || ''}
                  onChange={e => setForm(f => ({ ...f, reward: e.target.value }))}
                  placeholder="0" min={0} />
              </div>
              <div className="form-group">
                <label className="form-label">EXPIRES</label>
                <input className="form-input" type="date" value={form.expires_at || ''}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
              </div>
            </div>
            {error && <div className="form-error mb-8">{error}</div>}
          </form>
        </UeeModal>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
function BountyCard({ bounty, me, onClaim, onCancel }) {
  const meta = STATUS_META[bounty.status] || STATUS_META.ACTIVE
  const expiry = timeLeft(bounty.expires_at)
  const canCancel = bounty.posted_by === me.id || me.tier <= 3

  return (
    <Card accent={meta.color} minHeight={180}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700,
            color: bounty.status === 'ACTIVE' ? '#e8e8ea' : 'var(--text-2)',
            lineHeight: 1.2,
          }}>
            {bounty.target_name}
          </div>
          {bounty.target_org && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.15em',
              color: 'var(--text-3)', marginTop: 3,
            }}>
              ORG · {bounty.target_org.toUpperCase()}
            </div>
          )}
        </div>
        <StatusBadge color={meta.color} glyph={meta.glyph} label={meta.label} />
      </div>

      {bounty.reason && (
        <div style={{
          fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {bounty.reason}
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8,
        paddingTop: 8, borderTop: '1px dashed var(--border)',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700,
            color: UEE_AMBER, lineHeight: 1,
          }}>
            {formatCredits(bounty.reward)}
          </div>
          <div style={{ fontSize: 9, letterSpacing: '.15em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            REWARD · aUEC
          </div>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', color: 'var(--text-3)' }}>
          <div>POSTED BY · {(bounty.poster?.handle || '—').toUpperCase()}</div>
          <div>{fmtDate(bounty.created_at)}</div>
          {expiry && (
            <div style={{ color: expiry.urgent ? RED : 'var(--text-3)', marginTop: 2 }}>
              {expiry.text}
            </div>
          )}
          {bounty.claimer && (
            <div style={{ color: GREEN, marginTop: 2 }}>
              ✓ {(bounty.claimer.handle || '').toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {bounty.status === 'ACTIVE' && (
        <div style={{ display: 'flex', gap: 6, paddingTop: 4 }}>
          <button onClick={onClaim} style={btnMicro(GREEN, true)}>✓ CLAIM BOUNTY</button>
          {canCancel && <button onClick={onCancel} style={btnMicro(MUTED)}>✕</button>}
        </div>
      )}
    </Card>
  )
}
