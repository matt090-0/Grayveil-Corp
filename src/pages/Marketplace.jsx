import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatCredits } from '../lib/ranks'
import { useToast } from '../components/Toast'
import { confirmAction } from '../lib/dialogs'
import {
  MARKET_CATEGORIES,
  MARKET_CATEGORY_KEYS,
  MARKET_GRADES,
  CRAFTABLES,
  catalogFor,
  getGrade,
} from '../lib/craftables'
import InquiryThread, { InquiryList } from '../components/InquiryThread'

const UEE_AMBER = '#c8a55a'

// Corner-chamfer silhouette, same as Profile.jsx citizen panel.
const CLIP_CHAMFER = 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))'

function fmt(ts) {
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()
}

export default function Marketplace() {
  const { profile: me, refreshProfile } = useAuth()
  const toast = useToast()

  const [listings, setListings] = useState([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('browse') // 'browse' | 'mine'
  const [search, setSearch]     = useState('')
  const [category, setCategory] = useState('ALL')
  const [grade, setGrade]       = useState('')
  const [sort, setSort]         = useState('newest')
  const [detail, setDetail]     = useState(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy]         = useState(false)

  async function load() {
    const { data, error } = await supabase
      .from('market_listings')
      .select('*, seller:profiles!seller_id(id, handle, avatar_color, tier)')
      .order('created_at', { ascending: false })
    if (!error) setListings(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const categoryCounts = useMemo(() => {
    const c = { ALL: 0 }
    MARKET_CATEGORY_KEYS.forEach(k => { c[k] = 0 })
    for (const l of listings) {
      if (l.status !== 'ACTIVE') continue
      c.ALL++
      if (c[l.category] !== undefined) c[l.category]++
    }
    return c
  }, [listings])

  const browseItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    let out = listings.filter(l => l.status === 'ACTIVE')
    if (category !== 'ALL') out = out.filter(l => l.category === category)
    if (grade)              out = out.filter(l => l.grade === grade)
    if (q) {
      out = out.filter(l =>
        (l.title || '').toLowerCase().includes(q)
        || (l.manufacturer || '').toLowerCase().includes(q)
        || (l.seller?.handle || '').toLowerCase().includes(q)
      )
    }
    if      (sort === 'newest')   out.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    else if (sort === 'price_asc')  out.sort((a, b) => a.unit_price - b.unit_price)
    else if (sort === 'price_desc') out.sort((a, b) => b.unit_price - a.unit_price)
    return out
  }, [listings, search, category, grade, sort])

  const myItems = useMemo(
    () => listings.filter(l => l.seller_id === me.id),
    [listings, me.id]
  )

  async function purchase(listing, qty) {
    setBusy(true)
    const { error } = await supabase.rpc('purchase_market_listing', {
      p_listing_id: listing.id,
      p_quantity: qty,
    })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Purchase complete', 'success')
    await refreshProfile()
    await load()
    setDetail(null)
  }

  async function cancel(listing) {
    const ok = await confirmAction(
      `Withdraw "${listing.title}" from the market? This cannot be undone.`
    )
    if (!ok) return
    setBusy(true)
    const { error } = await supabase.rpc('cancel_market_listing', { p_listing_id: listing.id })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Listing withdrawn')
    setDetail(null)
    await load()
  }

  async function createListing(form) {
    setBusy(true)
    const { error } = await supabase.from('market_listings').insert({
      seller_id:    me.id,
      title:        form.title.trim(),
      category:     form.category,
      manufacturer: form.manufacturer?.trim() || null,
      grade:        form.grade || null,
      description:  form.description?.trim() || null,
      quantity:     parseInt(form.quantity) || 1,
      unit_price:   parseInt(form.unit_price) || 0,
      location:     form.location?.trim() || null,
    })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Listing posted', 'success')
    setCreating(false)
    await load()
    setTab('mine')
  }

  return (
    <>
      {/* ── CLASSIFICATION BAR ── */}
      <div style={{
        flexShrink: 0,
        background: 'linear-gradient(180deg, #0e0f14 0%, #0a0b0f 100%)',
        borderBottom: `1px solid ${UEE_AMBER}33`,
        padding: '6px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em',
        color: UEE_AMBER,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: UEE_AMBER,
            boxShadow: `0 0 8px ${UEE_AMBER}`, animation: 'pulse 2s ease-in-out infinite',
          }} />
          GRAYVEIL MARKET · MEMBER-TO-MEMBER EXCHANGE
        </div>
        <div style={{ display: 'flex', gap: 20, color: 'var(--text-3)' }}>
          <span>LISTINGS ACTIVE · {categoryCounts.ALL}</span>
          <span style={{ color: UEE_AMBER }}>UEC · AUTHORISED</span>
        </div>
      </div>

      {/* ── HEADER ── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>MARKETPLACE</h1>
            <div style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 540 }}>
              Post crafted goods for sale to other members. Purchases move aUEC from your wallet to the seller instantly.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>+ NEW LISTING</button>
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 6, borderBottom: '1px solid var(--border)' }}>
          <TabButton active={tab === 'browse'} onClick={() => setTab('browse')}>
            BROWSE
            <span style={{ marginLeft: 8, fontSize: 9, color: 'var(--text-3)' }}>{categoryCounts.ALL}</span>
          </TabButton>
          <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>
            MY LISTINGS
            <span style={{ marginLeft: 8, fontSize: 9, color: 'var(--text-3)' }}>{myItems.length}</span>
          </TabButton>
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING MARKET...</div> : (
          tab === 'browse' ? (
            <>
              <FilterBar
                search={search} onSearch={setSearch}
                category={category} setCategory={setCategory}
                counts={categoryCounts}
                grade={grade} setGrade={setGrade}
                sort={sort} setSort={setSort}
              />
              {browseItems.length === 0 ? (
                <EmptyState>
                  No listings match — try clearing a filter, or{' '}
                  <a onClick={() => setCreating(true)} style={{ color: UEE_AMBER, cursor: 'pointer', textDecoration: 'underline' }}>post one yourself</a>.
                </EmptyState>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                  {browseItems.map(l => (
                    <ListingCard key={l.id} listing={l} onOpen={() => setDetail(l)} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <MyListings listings={myItems} onOpen={l => setDetail(l)} />
          )
        )}
      </div>

      {/* ── DETAIL MODAL ── */}
      {detail && (
        <DetailModal
          listing={detail}
          me={me}
          busy={busy}
          onClose={() => setDetail(null)}
          onPurchase={qty => purchase(detail, qty)}
          onCancel={() => cancel(detail)}
        />
      )}

      {/* ── CREATE MODAL ── */}
      {creating && (
        <CreateModal
          busy={busy}
          onClose={() => setCreating(false)}
          onSubmit={createListing}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// SUBCOMPONENTS
// ─────────────────────────────────────────────────────────────

function TabButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        borderBottom: `2px solid ${active ? UEE_AMBER : 'transparent'}`,
        color: active ? UEE_AMBER : 'var(--text-2)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11, letterSpacing: '.2em', fontWeight: 600,
        padding: '10px 16px', cursor: 'pointer',
        marginBottom: -1,
      }}
    >
      {children}
    </button>
  )
}

function FilterBar({ search, onSearch, category, setCategory, counts, grade, setGrade, sort, setSort }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {/* Search + grade + sort row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          className="form-input"
          placeholder="Search by title, manufacturer, or seller..."
          value={search}
          onChange={e => onSearch(e.target.value)}
          style={{ flex: '1 1 260px', minWidth: 200 }}
        />
        <select className="form-select" value={grade} onChange={e => setGrade(e.target.value)} style={{ minWidth: 140 }}>
          <option value="">All grades</option>
          {MARKET_GRADES.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
        <select className="form-select" value={sort} onChange={e => setSort(e.target.value)} style={{ minWidth: 150 }}>
          <option value="newest">Newest first</option>
          <option value="price_asc">Price · low → high</option>
          <option value="price_desc">Price · high → low</option>
        </select>
      </div>

      {/* Category pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <CategoryPill
          active={category === 'ALL'}
          onClick={() => setCategory('ALL')}
          color="#d4d8e0"
          glyph="◇"
          label="ALL"
          count={counts.ALL}
        />
        {MARKET_CATEGORY_KEYS.map(k => {
          const cat = MARKET_CATEGORIES[k]
          return (
            <CategoryPill
              key={k}
              active={category === k}
              onClick={() => setCategory(k)}
              color={cat.color}
              glyph={cat.glyph}
              label={cat.label.toUpperCase()}
              count={counts[k] || 0}
            />
          )
        })}
      </div>
    </div>
  )
}

function CategoryPill({ active, onClick, color, glyph, label, count }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: active ? `${color}22` : 'var(--bg-raised)',
        border: `1px solid ${active ? color : 'var(--border)'}`,
        borderRadius: 4,
        padding: '6px 12px',
        color: active ? color : 'var(--text-2)',
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.15em',
        fontWeight: 600, cursor: 'pointer',
        transition: 'all .15s ease',
      }}
    >
      <span style={{ color, fontSize: 13 }}>{glyph}</span>
      {label}
      <span style={{
        background: active ? `${color}44` : 'rgba(255,255,255,0.06)',
        color: active ? color : 'var(--text-3)',
        padding: '1px 6px', borderRadius: 10, fontSize: 9, minWidth: 20, textAlign: 'center',
      }}>{count}</span>
    </button>
  )
}

function ListingCard({ listing, onOpen }) {
  const cat = MARKET_CATEGORIES[listing.category] || MARKET_CATEGORIES.OTHER
  const gr  = getGrade(listing.grade)
  return (
    <div
      onClick={onOpen}
      style={{
        position: 'relative',
        background: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${cat.color}`,
        borderRadius: 6,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'transform .15s ease, border-color .15s ease, box-shadow .15s ease',
        display: 'flex', flexDirection: 'column', gap: 10, minHeight: 170,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${cat.color}aa`
        e.currentTarget.style.borderLeftColor = cat.color
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px ${cat.color}22`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.borderLeftColor = cat.color
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Floating category glyph top-right */}
      <div style={{
        position: 'absolute', top: 10, right: 12,
        width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${cat.color}18`, border: `1px solid ${cat.color}66`,
        color: cat.color, fontSize: 14, borderRadius: 4,
      }}>
        {cat.glyph}
      </div>

      <div style={{ paddingRight: 36 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, lineHeight: 1.2, color: 'var(--text-1)' }}>
          {listing.title}
        </div>
        {listing.manufacturer && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.15em', color: 'var(--text-3)', marginTop: 3 }}>
            {listing.manufacturer.toUpperCase()}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.2em',
          color: cat.color,
          background: `${cat.color}12`, border: `1px solid ${cat.color}44`,
          padding: '2px 8px', borderRadius: 3,
        }}>{cat.label.toUpperCase()}</span>
        {gr && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.2em',
            color: gr.color,
            background: `${gr.color}12`, border: `1px solid ${gr.color}44`,
            padding: '2px 8px', borderRadius: 3,
          }}>{gr.label.toUpperCase()}</span>
        )}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8,
        paddingTop: 8, borderTop: '1px dashed var(--border)',
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: UEE_AMBER, lineHeight: 1 }}>
            {formatCredits(listing.unit_price)}
          </div>
          <div style={{ fontSize: 9, letterSpacing: '.15em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            PER UNIT · {listing.quantity} AVAILABLE
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>
            {listing.seller?.handle || '—'}
          </div>
          {listing.location && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', color: 'var(--text-3)', marginTop: 2 }}>
              {listing.location.toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MyListings({ listings, onOpen }) {
  if (listings.length === 0) {
    return <EmptyState>You haven't posted any listings yet.</EmptyState>
  }
  const grouped = { ACTIVE: [], SOLD: [], CANCELLED: [], OTHER: [] }
  for (const l of listings) {
    if (grouped[l.status]) grouped[l.status].push(l)
    else grouped.OTHER.push(l)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {grouped.ACTIVE.length > 0 && (
        <MySection color="#5ce0a1" label="ACTIVE" items={grouped.ACTIVE} onOpen={onOpen} />
      )}
      {grouped.SOLD.length > 0 && (
        <MySection color={UEE_AMBER} label="SOLD" items={grouped.SOLD} onOpen={onOpen} />
      )}
      {grouped.CANCELLED.length > 0 && (
        <MySection color="var(--text-3)" label="CANCELLED" items={grouped.CANCELLED} onOpen={onOpen} />
      )}
      {grouped.OTHER.length > 0 && (
        <MySection color="var(--text-3)" label="OTHER" items={grouped.OTHER} onOpen={onOpen} />
      )}
    </div>
  )
}

function MySection({ color, label, items, onOpen }) {
  return (
    <div>
      <div style={{
        fontSize: 10, letterSpacing: '.2em', fontFamily: 'var(--font-mono)',
        color, marginBottom: 10, paddingBottom: 5,
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `1px solid ${color}22`,
      }}>
        <span style={{ width: 4, height: 4, background: color, boxShadow: `0 0 6px ${color}` }} />
        {label} ({items.length})
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {items.map(l => <ListingCard key={l.id} listing={l} onOpen={() => onOpen(l)} />)}
      </div>
    </div>
  )
}

function EmptyState({ children }) {
  return (
    <div style={{
      padding: '40px 24px', textAlign: 'center',
      background: 'var(--bg-raised)', border: '1px dashed var(--border)',
      borderRadius: 8, color: 'var(--text-3)', fontSize: 13,
    }}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// DETAIL / PURCHASE MODAL
// ─────────────────────────────────────────────────────────────
function DetailModal({ listing, me, busy, onClose, onPurchase, onCancel }) {
  const cat = MARKET_CATEGORIES[listing.category] || MARKET_CATEGORIES.OTHER
  const gr  = getGrade(listing.grade)
  const isMine = listing.seller_id === me.id
  const [qty, setQty] = useState(1)
  const [confirming, setConfirming] = useState(false)

  const total = qty * listing.unit_price
  const canAfford = (me.wallet_balance || 0) >= total
  const isActive = listing.status === 'ACTIVE'
  const stockLeft = listing.quantity

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 720, padding: 0, overflow: 'hidden', clipPath: CLIP_CHAMFER }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header strip — category colour */}
        <div style={{
          background: `linear-gradient(135deg, ${cat.color}22, ${cat.color}08)`,
          borderBottom: `1px solid ${cat.color}44`,
          padding: '18px 22px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${cat.color}22`, border: `1px solid ${cat.color}66`,
            color: cat.color, fontSize: 20, borderRadius: 4,
          }}>
            {cat.glyph}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>
              {listing.title}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
              {listing.manufacturer && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.15em', color: 'var(--text-3)' }}>
                  {listing.manufacturer.toUpperCase()}
                </span>
              )}
              {gr && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.2em',
                  color: gr.color, border: `1px solid ${gr.color}66`, padding: '1px 7px',
                  borderRadius: 3,
                }}>{gr.label.toUpperCase()}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none',
              color: 'var(--text-3)', fontSize: 20, cursor: 'pointer',
            }}
          >✕</button>
        </div>

        <div style={{ padding: '18px 22px' }}>
          {listing.description && (
            <div style={{
              fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6,
              marginBottom: 18, whiteSpace: 'pre-wrap',
            }}>
              {listing.description}
            </div>
          )}

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: 12, marginBottom: 18,
          }}>
            <Stat label="PRICE / UNIT" value={formatCredits(listing.unit_price)} color={UEE_AMBER} />
            <Stat label="STOCK" value={stockLeft} />
            <Stat label="SELLER" value={listing.seller?.handle || '—'} />
            {listing.location && <Stat label="LOCATION" value={listing.location} />}
            <Stat label="STATUS" value={listing.status} color={isActive ? '#5ce0a1' : 'var(--text-3)'} />
            <Stat label="POSTED" value={fmt(listing.created_at)} />
          </div>

          {isMine ? (
            <div style={{
              background: 'rgba(200,165,90,0.08)', border: `1px solid ${UEE_AMBER}44`,
              borderRadius: 4, padding: '10px 14px',
              fontSize: 12, color: 'var(--text-2)', marginBottom: 14,
            }}>
              This is your listing. Buyers see the same details you do.
            </div>
          ) : !isActive ? (
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px dashed var(--border)',
              borderRadius: 4, padding: '10px 14px',
              fontSize: 12, color: 'var(--text-3)', marginBottom: 14,
            }}>
              This listing is {listing.status.toLowerCase()} and can't be purchased.
            </div>
          ) : confirming ? (
            <div style={{ padding: '14px 16px', background: `${UEE_AMBER}0c`, border: `1px solid ${UEE_AMBER}44`, borderRadius: 4 }}>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 10 }}>
                Confirm purchase of <b>{qty}</b> × <b>{listing.title}</b> for <b style={{ color: UEE_AMBER }}>{formatCredits(total)}</b> aUEC?
                The transfer is final and moves funds immediately to {listing.seller?.handle}.
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setConfirming(false)} disabled={busy}>BACK</button>
                <button className="btn btn-primary" onClick={() => onPurchase(qty)} disabled={busy}>
                  {busy ? 'PROCESSING...' : 'CONFIRM PURCHASE'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'end', gap: 10, marginBottom: 12 }}>
                <div className="form-group" style={{ marginBottom: 0, flex: '0 0 120px' }}>
                  <label className="form-label">QUANTITY</label>
                  <input
                    type="number" min={1} max={stockLeft}
                    className="form-input" value={qty}
                    onChange={e => setQty(Math.max(1, Math.min(stockLeft, parseInt(e.target.value) || 1)))}
                  />
                </div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontSize: 10, letterSpacing: '.2em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>TOTAL</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: UEE_AMBER, lineHeight: 1 }}>
                    {formatCredits(total)}
                  </div>
                  <div style={{ fontSize: 10, color: canAfford ? 'var(--text-3)' : 'var(--red)', fontFamily: 'var(--font-mono)', letterSpacing: '.1em', marginTop: 2 }}>
                    WALLET · {formatCredits(me.wallet_balance || 0)}
                  </div>
                </div>
              </div>
              <button
                className="btn btn-primary w-full"
                disabled={!canAfford || busy}
                onClick={() => setConfirming(true)}
                style={{ justifyContent: 'center' }}
              >
                {canAfford ? 'PURCHASE' : 'INSUFFICIENT FUNDS'}
              </button>
            </>
          )}

          {/* INQUIRIES SECTION
              - buyers: see/start their thread with the seller
              - sellers: see all open buyer threads on this listing */}
          {!isMine && isActive && (
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em',
                color: UEE_AMBER, marginBottom: 8, paddingBottom: 4,
                borderBottom: `1px solid ${UEE_AMBER}33`,
              }}>
                ◆ CONTACT SELLER
              </div>
              <InquiryThread listing={listing} me={me} />
            </div>
          )}
          {isMine && (
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em',
                color: UEE_AMBER, marginBottom: 8, paddingBottom: 4,
                borderBottom: `1px solid ${UEE_AMBER}33`,
              }}>
                ◆ BUYER INQUIRIES
              </div>
              <InquiryList listingId={listing.id} me={me} />
            </div>
          )}

          {isMine && listing.status === 'ACTIVE' && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
              <button className="btn btn-danger w-full" onClick={onCancel} disabled={busy}>
                WITHDRAW LISTING
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: '.2em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{
        fontSize: 14, fontWeight: 500, color: color || 'var(--text-1)',
        fontFamily: typeof value === 'number' ? 'var(--font-mono)' : 'inherit',
      }}>
        {value}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CREATE MODAL
// ─────────────────────────────────────────────────────────────
function CreateModal({ busy, onClose, onSubmit }) {
  const [form, setForm] = useState({
    category: 'WEAPON',
    title: '',
    manufacturer: '',
    grade: 'CIVILIAN',
    quantity: 1,
    unit_price: 1000,
    location: '',
    description: '',
  })

  // When user types into title, see if it matches a catalog entry and
  // auto-fill manufacturer / grade. Only prefills empty fields.
  function pickFromCatalog(name) {
    const hit = CRAFTABLES.find(c => c.name.toLowerCase() === name.toLowerCase())
    if (!hit) return
    setForm(f => ({
      ...f,
      title: hit.name,
      category: hit.category,
      manufacturer: f.manufacturer || hit.manufacturer || '',
      grade: f.grade || hit.grade || 'CIVILIAN',
      description: f.description || hit.blurb || '',
    }))
  }

  const total = (parseInt(form.quantity) || 0) * (parseInt(form.unit_price) || 0)
  const canSubmit = form.title.trim().length > 1 && total >= 0 && !busy
  const catalogForCat = catalogFor(form.category)

  function submit(e) {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit(form)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 620, padding: 0, overflow: 'hidden', clipPath: CLIP_CHAMFER }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          background: `linear-gradient(135deg, ${UEE_AMBER}22, ${UEE_AMBER}08)`,
          borderBottom: `1px solid ${UEE_AMBER}44`,
          padding: '16px 22px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.25em', color: UEE_AMBER }}>
            NEW LISTING
          </div>
          <button onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={submit} style={{ padding: '18px 22px' }}>
          {/* Category pills */}
          <div className="form-group">
            <label className="form-label">CATEGORY</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {MARKET_CATEGORY_KEYS.map(k => {
                const cat = MARKET_CATEGORIES[k]
                const active = form.category === k
                return (
                  <button
                    type="button"
                    key={k}
                    onClick={() => setForm(f => ({ ...f, category: k }))}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: active ? `${cat.color}22` : 'var(--bg-raised)',
                      border: `1px solid ${active ? cat.color : 'var(--border)'}`,
                      borderRadius: 4,
                      padding: '5px 10px',
                      color: active ? cat.color : 'var(--text-2)',
                      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em',
                      cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    <span style={{ color: cat.color }}>{cat.glyph}</span>
                    {cat.label.toUpperCase()}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">ITEM NAME</label>
            <input
              className="form-input"
              list="craftables-list"
              value={form.title}
              onChange={e => {
                const v = e.target.value
                setForm(f => ({ ...f, title: v }))
                pickFromCatalog(v)
              }}
              placeholder={`e.g. ${catalogForCat[0]?.name || 'Karna Rifle'}`}
              maxLength={120}
              required
            />
            <datalist id="craftables-list">
              {catalogForCat.map(c => <option key={c.name} value={c.name} />)}
            </datalist>
            <div className="form-hint">Pick from the list or type a custom item. Free text is fine.</div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">MANUFACTURER</label>
              <input
                className="form-input"
                value={form.manufacturer}
                onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))}
                placeholder="e.g. Gemini"
                maxLength={80}
              />
            </div>
            <div className="form-group">
              <label className="form-label">GRADE</label>
              <select
                className="form-select"
                value={form.grade}
                onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
              >
                <option value="">—</option>
                {MARKET_GRADES.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">QUANTITY</label>
              <input
                type="number" min={1} max={10000}
                className="form-input"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">UNIT PRICE (aUEC)</label>
              <input
                type="number" min={0} max={1000000000}
                className="form-input"
                value={form.unit_price}
                onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">PICKUP LOCATION</label>
            <input
              className="form-input"
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="e.g. Area 18, New Babbage"
              maxLength={120}
            />
          </div>

          <div className="form-group">
            <label className="form-label">DESCRIPTION</label>
            <textarea
              className="form-textarea"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Condition, any bundled items, contact preferences..."
              maxLength={1000}
              style={{ minHeight: 70 }}
            />
          </div>

          {/* Total bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', marginTop: 4, marginBottom: 12,
            background: `${UEE_AMBER}0c`, border: `1px solid ${UEE_AMBER}44`, borderRadius: 4,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em', color: 'var(--text-3)' }}>
              LISTING TOTAL
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: UEE_AMBER, lineHeight: 1 }}>
              {formatCredits(total)}
            </span>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>CANCEL</button>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {busy ? 'POSTING...' : 'POST LISTING'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
