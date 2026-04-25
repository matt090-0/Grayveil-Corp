import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatCredits, RANKS } from '../lib/ranks'
import { SC_CONTRACT_TYPES, SC_LOCATIONS } from '../lib/scdata'
import { useToast } from '../components/Toast'
import { greenBurst } from '../lib/confetti'
import { discordContract } from '../lib/discord'
import {
  UEE_AMBER, ClassificationBar, TabStrip, StatCell, FilterRow, Card,
  StatusBadge, Field, EmptyState, UeeModal, SectionHeader, btnMicro,
  timeAgo,
} from '../components/uee'

const STATUS_ORDER = ['OPEN', 'ACTIVE', 'COMPLETE', 'CANCELLED']
const STATUS_META = {
  OPEN:      { color: '#5ce0a1', glyph: '◉', label: 'OPEN' },
  ACTIVE:    { color: UEE_AMBER, glyph: '◎', label: 'ACTIVE' },
  COMPLETE:  { color: '#5a80d9', glyph: '✓', label: 'COMPLETE' },
  CANCELLED: { color: '#9099a8', glyph: '○', label: 'CANCELLED' },
}

export default function Contracts() {
  const { profile: me } = useAuth()
  const toast = useToast()

  const [contracts, setContracts] = useState([])
  const [claims, setClaims]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch]       = useState('')
  const [modal, setModal]         = useState(null)
  const [form, setForm]           = useState({})
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  // Detail view + ops log
  const [viewContract, setViewContract]     = useState(null)
  const [comments, setComments]             = useState([])
  const [commentText, setCommentText]       = useState('')
  const [commentLoading, setCommentLoading] = useState(false)

  const canPost = me.tier <= 4

  async function load() {
    const [{ data: c }, { data: cl }] = await Promise.all([
      supabase.from('contracts').select('*, posted_by:profiles(id, handle, tier)').order('created_at', { ascending: false }),
      supabase.from('contract_claims').select('*, member:profiles(handle)').eq('member_id', me.id),
    ])
    setContracts(c || [])
    setClaims(cl || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const myClaims = useMemo(() => new Set(claims.map(c => c.contract_id)), [claims])

  const counts = useMemo(() => {
    const c = { ALL: contracts.length }
    STATUS_ORDER.forEach(s => { c[s] = contracts.filter(x => x.status === s).length })
    return c
  }, [contracts])

  const openPool = useMemo(() =>
    contracts.filter(c => c.status === 'OPEN').reduce((s, c) => s + (c.reward || 0), 0),
  [contracts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contracts
      .filter(c => statusFilter === 'ALL' || c.status === statusFilter)
      .filter(c => !q
        || (c.title || '').toLowerCase().includes(q)
        || (c.description || '').toLowerCase().includes(q)
        || (c.contract_type || '').toLowerCase().includes(q)
        || (c.location || '').toLowerCase().includes(q)
        || (c.posted_by?.handle || '').toLowerCase().includes(q))
  }, [contracts, statusFilter, search])

  function openPost() {
    setForm({
      title: '', contract_type: 'COMBAT', description: '',
      location: '', reward: '', min_tier: 9, status: 'OPEN',
    })
    setError(''); setModal('post')
  }

  async function savePost() {
    if (!form.title) { setError('Title is required.'); return }
    setSaving(true)
    const { data, error } = await supabase.from('contracts').insert({
      ...form,
      reward: parseInt(form.reward) || 0,
      min_tier: parseInt(form.min_tier),
      posted_by: me.id,
    }).select().single()
    if (error) { setError(error.message); setSaving(false); return }
    await supabase.from('activity_log').insert({
      actor_id: me.id, action: 'contract_posted',
      target_type: 'contract', target_id: data.id,
      details: { title: form.title },
    })
    discordContract(form.title, form.contract_type, parseInt(form.reward) || 0, 'OPEN', me.handle)
    toast('Contract posted', 'success')
    setModal(null); setSaving(false); load()
  }

  async function claimContract(id) {
    const c = contracts.find(x => x.id === id)
    await supabase.from('contract_claims').insert({ contract_id: id, member_id: me.id })
    await supabase.from('contracts').update({ status: 'ACTIVE' }).eq('id', id).eq('status', 'OPEN')
    await supabase.from('activity_log').insert({
      actor_id: me.id, action: 'contract_claimed',
      target_type: 'contract', target_id: id,
      details: { title: c?.title },
    })
    // Notify the poster that someone took their contract
    if (c?.posted_by?.handle && c.posted_by.id !== me.id) {
      await supabase.from('notifications').insert({
        recipient_id: c.posted_by.id || c.posted_by_id,
        type: 'contract',
        title: `Contract claimed: ${c.title}`,
        message: `${me.handle} has claimed your contract and started work.`,
        link: '/contracts',
      })
    }
    toast('Contract claimed', 'success')
    load()
  }

  async function updateStatus(id, status) {
    const c = contracts.find(x => x.id === id)
    if (status === 'COMPLETE') {
      const { error } = await supabase.rpc('complete_contract', { p_contract_id: id })
      if (error) { toast(error.message, 'error'); return }
      greenBurst()
      discordContract(c?.title, c?.contract_type, c?.reward, 'COMPLETE', me.handle)
      // Notify the poster of completion
      if (c?.posted_by?.id && c.posted_by.id !== me.id) {
        await supabase.from('notifications').insert({
          recipient_id: c.posted_by.id,
          type: 'contract',
          title: `Contract complete: ${c.title}`,
          message: `${me.handle} has marked the contract complete and the payout has been released.`,
          link: '/contracts',
        })
      }
      toast('Contract complete — payout released', 'success')
    } else {
      await supabase.from('contracts').update({ status }).eq('id', id)
    }
    load()
  }

  async function openDetail(c) {
    setViewContract(c)
    setCommentText('')
    setCommentLoading(true)
    const { data } = await supabase.from('contract_comments')
      .select('*, author:profiles(handle)')
      .eq('contract_id', c.id)
      .order('created_at', { ascending: true })
    setComments(data || [])
    setCommentLoading(false)
  }

  async function postComment() {
    if (!commentText.trim()) return
    setSaving(true)
    await supabase.from('contract_comments').insert({
      contract_id: viewContract.id, author_id: me.id, content: commentText.trim(),
    })
    setCommentText('')
    const { data } = await supabase.from('contract_comments')
      .select('*, author:profiles(handle)')
      .eq('contract_id', viewContract.id)
      .order('created_at', { ascending: true })
    setComments(data || [])
    setSaving(false)
  }

  return (
    <>
      <ClassificationBar
        section="GRAYVEIL OPERATIONS CONTRACT REGISTRY"
        label={statusFilter}
        right={(
          <>
            <span>OPEN · {counts.OPEN || 0}</span>
            <span style={{ color: UEE_AMBER }}>POOL · {formatCredits(openPool)}</span>
          </>
        )}
      />

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>CONTRACTS</h1>
            <div style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 620 }}>
              Available assignments from Operations. Claim an OPEN contract to take lead; the first claimer activates the job.
            </div>
          </div>
          {canPost && <button className="btn btn-primary" onClick={openPost}>+ POST CONTRACT</button>}
        </div>

        <TabStrip
          active={statusFilter} onChange={setStatusFilter}
          tabs={[
            { key: 'ALL',       label: 'ALL',       color: '#d4d8e0',         count: counts.ALL || 0 },
            { key: 'OPEN',      label: 'OPEN',      color: STATUS_META.OPEN.color,      glyph: STATUS_META.OPEN.glyph,      count: counts.OPEN || 0 },
            { key: 'ACTIVE',    label: 'ACTIVE',    color: STATUS_META.ACTIVE.color,    glyph: STATUS_META.ACTIVE.glyph,    count: counts.ACTIVE || 0 },
            { key: 'COMPLETE',  label: 'COMPLETE',  color: STATUS_META.COMPLETE.color,  glyph: STATUS_META.COMPLETE.glyph,  count: counts.COMPLETE || 0 },
            { key: 'CANCELLED', label: 'CANCELLED', color: STATUS_META.CANCELLED.color, glyph: STATUS_META.CANCELLED.glyph, count: counts.CANCELLED || 0 },
          ]}
        />
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING CONTRACT REGISTRY...</div> : (
          <>
            <FilterRow
              search={search} setSearch={setSearch}
              placeholder="Search title, type, location, poster..."
            />
            {filtered.length === 0 ? (
              <EmptyState>
                {canPost
                  ? <>No contracts match. <a onClick={openPost} style={{ color: UEE_AMBER, cursor: 'pointer', textDecoration: 'underline' }}>Post one</a>.</>
                  : 'No contracts match the current filter.'}
              </EmptyState>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 12,
              }}>
                {filtered.map(c => (
                  <ContractCard
                    key={c.id} contract={c}
                    claimed={myClaims.has(c.id)} canPost={canPost}
                    onOpen={() => openDetail(c)}
                    onClaim={e => { e.stopPropagation(); claimContract(c.id) }}
                    onComplete={e => { e.stopPropagation(); updateStatus(c.id, 'COMPLETE') }}
                    onCancel={e => { e.stopPropagation(); updateStatus(c.id, 'CANCELLED') }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* DETAIL / OPS LOG */}
      {viewContract && (
        <ContractDetail
          contract={viewContract}
          comments={comments}
          commentLoading={commentLoading}
          commentText={commentText}
          setCommentText={setCommentText}
          onPostComment={postComment}
          saving={saving}
          onClose={() => setViewContract(null)}
        />
      )}

      {/* POST MODAL */}
      {modal === 'post' && (
        <UeeModal
          accent={UEE_AMBER}
          kicker="◆ NEW CONTRACT · OPS REGISTRY"
          title="POST CONTRACT"
          onClose={() => setModal(null)}
          maxWidth={640}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
              <button className="btn btn-primary" onClick={savePost} disabled={saving}>
                {saving ? 'POSTING...' : 'POST CONTRACT'}
              </button>
            </>
          )}
        >
          <div className="form-group">
            <label className="form-label">CONTRACT TITLE *</label>
            <input className="form-input" value={form.title || ''}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Operation name or contract description" autoFocus />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">TYPE</label>
              <select className="form-select" value={form.contract_type}
                onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))}>
                {SC_CONTRACT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">CLEARANCE · TIER</label>
              <select className="form-select" value={form.min_tier}
                onChange={e => setForm(f => ({ ...f, min_tier: parseInt(e.target.value) }))}>
                {RANKS.map(r => <option key={r.tier} value={r.tier}>{r.label} (Tier {r.tier})</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">LOCATION</label>
              <select className="form-select" value={form.location || ''}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}>
                <option value="">— Select Location —</option>
                {SC_LOCATIONS.map(l => <option key={l.name} value={l.name}>{l.name} ({l.category})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">REWARD · aUEC</label>
              <input className="form-input" type="number" value={form.reward || ''}
                onChange={e => setForm(f => ({ ...f, reward: e.target.value }))}
                placeholder="0" min={0} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">BRIEFING</label>
            <textarea className="form-textarea" value={form.description || ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Operation details, objectives, requirements..." />
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
        </UeeModal>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
function ContractCard({ contract: c, claimed, canPost, onOpen, onClaim, onComplete, onCancel }) {
  const meta = STATUS_META[c.status] || STATUS_META.OPEN
  return (
    <Card accent={meta.color} onClick={onOpen} minHeight={200}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600,
            color: 'var(--text-1)', lineHeight: 1.25,
          }}>
            {c.title}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.2em',
              color: 'var(--text-3)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: 3,
            }}>{c.contract_type}</span>
            {c.min_tier < 9 && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.2em',
                color: '#b566d9', border: '1px solid #b566d955', padding: '1px 6px', borderRadius: 3,
              }}>TIER {c.min_tier}+</span>
            )}
            {claimed && <StatusBadge color="#5a80d9" glyph="◎" label="CLAIMED" />}
          </div>
        </div>
        <StatusBadge color={meta.color} glyph={meta.glyph} label={c.status} />
      </div>

      {c.description && (
        <div style={{
          fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {c.description}
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8,
        paddingTop: 8, borderTop: '1px dashed var(--border)',
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: UEE_AMBER, lineHeight: 1 }}>
            {formatCredits(c.reward)}
          </div>
          <div style={{ fontSize: 9, letterSpacing: '.15em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            REWARD · aUEC
          </div>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', color: 'var(--text-3)' }}>
          {c.location && <div>📍 {c.location.toUpperCase()}</div>}
          <div>{(c.posted_by?.handle || '—').toUpperCase()}</div>
          <div>{timeAgo(c.created_at)}</div>
        </div>
      </div>

      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {c.status === 'OPEN' && !claimed && (
          <button onClick={onClaim} style={btnMicro(STATUS_META.OPEN.color, true)}>✓ CLAIM</button>
        )}
        {claimed && c.status !== 'COMPLETE' && c.status !== 'CANCELLED' && (
          <button onClick={onComplete} style={btnMicro('#5a80d9', true)}>◆ MARK COMPLETE</button>
        )}
        {canPost && c.status !== 'COMPLETE' && c.status !== 'CANCELLED' && (
          <button onClick={onCancel} style={btnMicro('#9099a8')}>✕</button>
        )}
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
function ContractDetail({ contract: c, comments, commentLoading, commentText, setCommentText, onPostComment, saving, onClose }) {
  const meta = STATUS_META[c.status] || STATUS_META.OPEN
  return (
    <UeeModal
      accent={meta.color}
      kicker={`◆ CONTRACT FILE · ${c.contract_type}`}
      title={c.title}
      onClose={onClose}
      maxWidth={680}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <StatusBadge color={meta.color} glyph={meta.glyph} label={c.status} />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em',
          color: 'var(--text-3)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 3,
        }}>{c.contract_type}</span>
        {c.min_tier < 9 && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em',
            color: '#b566d9', border: '1px solid #b566d955', padding: '2px 7px', borderRadius: 3,
          }}>TIER {c.min_tier}+</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
          {(c.posted_by?.handle || '—')} · {timeAgo(c.created_at)}
        </span>
      </div>

      {c.description && (
        <div style={{
          fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7,
          whiteSpace: 'pre-wrap', marginBottom: 16,
        }}>
          {c.description}
        </div>
      )}

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10,
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border)',
        borderRadius: 3, marginBottom: 18,
      }}>
        <Field label="LOCATION" value={c.location || '—'} />
        <Field label="REWARD"   value={formatCredits(c.reward)} mono color={UEE_AMBER} />
        <Field label="MIN TIER" value={c.min_tier} mono />
      </div>

      <SectionHeader label="OPS LOG" />
      <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 12 }}>
        {commentLoading ? (
          <div style={{ padding: 14, textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>LOADING...</div>
        ) : comments.length === 0 ? (
          <div style={{ padding: 14, textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>
            No entries yet. First to log opens the thread.
          </div>
        ) : comments.map(cm => (
          <div key={cm.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)' }}>{cm.author?.handle || '—'}</span>
              <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em' }}>
                {timeAgo(cm.created_at)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap' }}>
              {cm.content}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input className="form-input" placeholder="Add ops log entry..." value={commentText}
          onChange={e => setCommentText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onPostComment()}
          style={{ flex: 1, fontSize: 12 }} />
        <button className="btn btn-primary btn-sm" onClick={onPostComment} disabled={saving || !commentText.trim()}>
          {saving ? '...' : 'POST'}
        </button>
      </div>
    </UeeModal>
  )
}
