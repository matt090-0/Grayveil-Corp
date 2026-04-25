// ─────────────────────────────────────────────────────────────
// UEE style primitives — shared across the archive-styled pages.
//
// All pages that adopt the UEE archive look should import from
// here rather than redefining these inline. Keep this file pure
// presentation (no data fetching, no supabase calls). Consumers
// pass in colors and content and wire up their own state.
//
// The constants and components here follow the visual language
// established in src/pages/Marketplace.jsx, Loadouts.jsx,
// Profile.jsx, and Recruitment.jsx.
// ─────────────────────────────────────────────────────────────

export const UEE_AMBER = '#c8a55a'

// Corner-chamfered polygon clip-paths. SM for compact cards
// and stat cells, regular for modals and larger panels.
export const CLIP_CHAMFER    = 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))'
export const CLIP_CHAMFER_SM = 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))'

// ─────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────
export function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()
}
export function fmtDateTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).toUpperCase()
}
export function timeAgo(ts) {
  if (!ts) return '—'
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60) return 'JUST NOW'
  if (diff < 3600) return `${Math.floor(diff / 60)}M AGO`
  if (diff < 86400) return `${Math.floor(diff / 3600)}H AGO`
  return `${Math.floor(diff / 86400)}D AGO`
}
export function timeUntil(ts) {
  if (!ts) return '—'
  const diff = new Date(ts) - Date.now()
  if (diff <= 0) return 'NOW'
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}D ${h % 24}H`
  return `${h}H ${Math.floor((diff % 3600000) / 60000)}M`
}

// ─────────────────────────────────────────────────────────────
// CLASSIFICATION BAR
// Thin strip at the top of a page: pulsing beacon · section label,
// with optional right-side context fields.
// ─────────────────────────────────────────────────────────────
export function ClassificationBar({
  section = 'GRAYVEIL',
  label,
  accent = UEE_AMBER,
  right,
}) {
  return (
    <div className="gv-classbar" style={{
      flexShrink: 0,
      background: 'linear-gradient(180deg, #0e0f14 0%, #0a0b0f 100%)',
      borderBottom: `1px solid ${accent}33`,
      padding: '6px 28px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em',
      color: accent,
      gap: 12,
    }}>
      <div className="gv-classbar-section" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: accent,
          boxShadow: `0 0 8px ${accent}`, animation: 'pulse 2s ease-in-out infinite',
          flexShrink: 0,
        }} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {section}{label ? ` · ${label}` : ''}
        </span>
      </div>
      {right && (
        <div className="gv-classbar-right" style={{ display: 'flex', gap: 20, color: 'var(--text-3)' }}>
          {right}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB STRIP
// Horizontal tabs with per-tab accent, count chips, and optional
// pulsing "attention" badges (e.g. pending-review counts).
//
// Props:
//   tabs: [{ key, label, color, glyph, count, attention }]
//   active: current tab key
//   onChange: (key) => void
// ─────────────────────────────────────────────────────────────
export function TabStrip({ tabs, active, onChange }) {
  return (
    <div className="gv-tabstrip" style={{ marginTop: 16, display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
      {tabs.map(t => {
        const isActive = active === t.key
        const color = t.color || UEE_AMBER
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              background: isActive ? `${color}10` : 'transparent',
              border: 'none',
              borderBottom: `2px solid ${isActive ? color : 'transparent'}`,
              color: isActive ? color : 'var(--text-2)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11, letterSpacing: '.2em', fontWeight: 600,
              padding: '10px 16px', cursor: 'pointer',
              marginBottom: -1,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              transition: 'color .15s ease, background .15s ease',
            }}
          >
            {t.glyph && <span style={{ color, fontSize: 13 }}>{t.glyph}</span>}
            {t.label}
            {typeof t.count === 'number' && (
              <span style={{
                background: isActive ? `${color}33` : 'rgba(255,255,255,0.05)',
                color: isActive ? color : 'var(--text-3)',
                padding: '1px 7px', borderRadius: 10, fontSize: 9, minWidth: 22, textAlign: 'center',
              }}>{t.count}</span>
            )}
            {t.attention > 0 && (
              <span title="Pending attention" style={{
                background: `${UEE_AMBER}33`,
                color: UEE_AMBER,
                padding: '1px 7px', borderRadius: 10, fontSize: 9, minWidth: 18, textAlign: 'center',
                boxShadow: `0 0 6px ${UEE_AMBER}66`,
              }}>!{t.attention}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// STAT CELL
// Corner-chamfered cell with amber-or-custom left accent stripe,
// mono label, big value, optional description. Optionally
// clickable as a filter toggle.
// ─────────────────────────────────────────────────────────────
export function StatCell({ label, value, color = UEE_AMBER, glyph, desc, onClick, active }) {
  const clickable = !!onClick
  return (
    <div
      className="gv-statcell"
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      style={{
        textAlign: 'left',
        cursor: clickable ? 'pointer' : 'default',
        background: active ? `${color}12` : 'var(--bg-raised)',
        border: `1px solid ${active ? color : 'var(--border)'}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 4,
        padding: '12px 14px',
        clipPath: CLIP_CHAMFER_SM,
        transition: 'all .15s ease',
      }}
    >
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em',
        color, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {glyph && <span>{glyph}</span>} {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700,
        color: 'var(--text-1)', lineHeight: 1,
      }}>
        {value}
      </div>
      {desc && (
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 5 }}>{desc}</div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// FILTER ROW
// Search input + optional filter pills. Pills carry color,
// optional glyph, and count. `active` is the currently-selected
// pill key; `setActive(key)` updates it.
// ─────────────────────────────────────────────────────────────
export function FilterRow({ search, setSearch, placeholder, pills = [], active, setActive, right }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {typeof search !== 'undefined' && (
        <div style={{ display: 'flex', gap: 10, marginBottom: pills.length ? 10 : 0 }}>
          <input
            className="form-input"
            placeholder={placeholder || 'Search...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          {right}
        </div>
      )}
      {pills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {pills.map(p => (
            <FilterPill
              key={p.key}
              active={active === p.key}
              onClick={() => setActive(p.key)}
              color={p.color || UEE_AMBER}
              glyph={p.glyph}
              label={p.label}
              count={p.count}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FilterPill({ active, onClick, color = UEE_AMBER, glyph, label, count }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        background: active ? `${color}22` : 'var(--bg-raised)',
        border: `1px solid ${active ? color : 'var(--border)'}`,
        borderRadius: 4,
        padding: '5px 11px',
        color: active ? color : 'var(--text-2)',
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.15em',
        fontWeight: 600, cursor: 'pointer',
        transition: 'all .15s ease',
      }}
    >
      {glyph && <span style={{ color, fontSize: 12 }}>{glyph}</span>}
      {label}
      {typeof count === 'number' && (
        <span style={{
          background: active ? `${color}44` : 'rgba(255,255,255,0.05)',
          color: active ? color : 'var(--text-3)',
          padding: '1px 6px', borderRadius: 10, fontSize: 9, minWidth: 18, textAlign: 'center',
        }}>{count}</span>
      )}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// CARD SHELL
// Chamfered card with a coloured left accent. Pass `onClick` to
// make it interactive (adds cursor + light lift on hover).
// ─────────────────────────────────────────────────────────────
export function Card({ accent = UEE_AMBER, onClick, children, style, minHeight }) {
  const interactive = !!onClick
  return (
    <div
      className="gv-card"
      onClick={onClick}
      style={{
        position: 'relative',
        background: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 4,
        padding: '14px 16px',
        cursor: interactive ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', gap: 10,
        minHeight: minHeight,
        clipPath: CLIP_CHAMFER_SM,
        transition: 'transform .15s ease, border-color .15s ease, box-shadow .15s ease',
        ...(style || {}),
      }}
      onMouseEnter={interactive ? e => {
        e.currentTarget.style.borderColor = `${accent}aa`
        e.currentTarget.style.borderLeftColor = accent
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px ${accent}22`
      } : undefined}
      onMouseLeave={interactive ? e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.borderLeftColor = accent
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = 'none'
      } : undefined}
    >
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// STATUS BADGE
// Small mono chip with a colour, optional glyph, and label.
// ─────────────────────────────────────────────────────────────
export function StatusBadge({ color = UEE_AMBER, glyph, label, title }) {
  return (
    <span title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em', fontWeight: 600,
      color,
      background: `${color}14`, border: `1px solid ${color}55`,
      padding: '3px 8px', borderRadius: 3, whiteSpace: 'nowrap',
    }}>
      {glyph && <span>{glyph}</span>}
      {label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// FIELD
// Tiny label-over-value block used inside card field grids.
// ─────────────────────────────────────────────────────────────
export function Field({ label, value, mono, color }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        fontSize: 8.5, letterSpacing: '.2em', color: 'var(--text-3)',
        fontFamily: 'var(--font-mono)', marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 11.5, fontWeight: 500, color: color || 'var(--text-2)',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {value}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// EMPTY STATE
// Dashed-border pane with centered copy.
// ─────────────────────────────────────────────────────────────
export function EmptyState({ children }) {
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
// MODAL SHELL
// Chamfered modal with a gradient kicker header. Pass `footer`
// for a right-aligned button row at the bottom. Replaces the
// plain <Modal> component for UEE-styled flows.
// ─────────────────────────────────────────────────────────────
export function UeeModal({ accent = UEE_AMBER, kicker, title, onClose, children, footer, maxWidth = 580 }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal gv-uee-modal"
        style={{ maxWidth, padding: 0, overflow: 'hidden', clipPath: CLIP_CHAMFER }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          background: `linear-gradient(135deg, ${accent}22, ${accent}08)`,
          borderBottom: `1px solid ${accent}44`,
          padding: '14px 22px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {kicker && (
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.25em',
                color: accent, marginBottom: 3,
              }}>
                {kicker}
              </div>
            )}
            {title && (
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600,
                color: 'var(--text-1)', lineHeight: 1.2,
              }}>
                {title}
              </div>
            )}
          </div>
          <button onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', fontSize: 20, cursor: 'pointer', marginLeft: 8 }}>✕</button>
        </div>
        <div style={{ padding: '18px 22px' }}>
          {children}
        </div>
        {footer && (
          <div style={{
            borderTop: '1px solid var(--border)',
            background: 'rgba(0,0,0,0.15)',
            padding: '12px 22px',
            display: 'flex', justifyContent: 'flex-end', gap: 8,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SECTION HEADER
// Amber "◆ SECTION TITLE" header with a faint gradient underline,
// used inside modals and card bodies to separate subsections.
// ─────────────────────────────────────────────────────────────
export function SectionHeader({ label, color = UEE_AMBER, glyph = '◆', children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      paddingBottom: 5, marginBottom: 10,
      borderBottom: `1px solid ${color}22`,
      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em',
      color,
    }}>
      <span>{glyph}</span>
      {label}
      {children && <div style={{ marginLeft: 'auto' }}>{children}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MICRO BUTTON STYLE
// Small outlined button in a given accent colour. Use on card
// action rows. Returns an inline style object; spread into a
// <button> element.
// ─────────────────────────────────────────────────────────────
export function btnMicro(color = UEE_AMBER, grow = false) {
  return {
    flex: grow ? 1 : undefined,
    background: `${color}10`,
    border: `1px solid ${color}55`,
    color,
    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', fontWeight: 600,
    padding: '5px 10px', borderRadius: 3, cursor: 'pointer',
    transition: 'all .12s ease',
  }
}
