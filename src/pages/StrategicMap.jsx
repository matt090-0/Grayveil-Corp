// ─────────────────────────────────────────────────────────────
// StrategicMap — defense-contractor surveillance display.
// Top-down view of Stanton with org-relevant overlays:
//   · CONTRACTS  (open contracts, resolved by `location`)
//   · INTEL      (intel reports, resolved by title+content)
//   · OPERATIONS (scheduled ops, resolved by `location`)
//
// Pan: pointer drag (mouse + touch). Zoom: wheel + pinch +/- keys.
// Click marker → MapDetailDrawer slides in. Layer toggles in
// floating panel top-right. Realtime subscriptions on intelligence
// and events keep the map live during ops.
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import {
  STANTON_SUN, STANTON_PLANETS, STANTON_LANDMARKS,
  ORBITAL_RINGS, DEFAULT_VIEWBOX, resolveLocation,
} from '../lib/stantonMap'
import {
  MapBackdrop, OrbitalRings, LandmarkLayer,
  SunMarker, PlanetMarker, MoonLayer, StationLayer,
  MarkerLayer,
} from '../components/MapLayers'
import MapDetailDrawer from '../components/MapDetailDrawer'
import { ClassificationBar } from '../components/uee'

const COLORS = {
  contract: 'var(--amber)',
  intel:    'var(--blue)',
  op:       'var(--green)',
  hostile:  'var(--red)',
}

// Spread duplicate markers around their anchor so they don't pile.
// Sorted-stable: same anchor + same id always renders at same offset.
function spreadAtAnchor(items) {
  const buckets = new Map()
  items.forEach(it => {
    const key = `${it.x.toFixed(1)},${it.y.toFixed(1)}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(it)
  })
  const out = []
  buckets.forEach(group => {
    if (group.length === 1) { out.push(group[0]); return }
    const r = 14
    group.forEach((g, i) => {
      const a = (i / group.length) * Math.PI * 2 - Math.PI / 2
      out.push({ ...g, x: g.x + r * Math.cos(a), y: g.y + r * Math.sin(a) })
    })
  })
  return out
}

export default function StrategicMap() {
  const { profile } = useAuth()

  // ── viewBox + interaction state ──
  const [viewBox, setViewBox] = useState(DEFAULT_VIEWBOX)
  const svgRef = useRef(null)
  const panRef = useRef(null)
  const pinchRef = useRef(null)

  // ── data + overlay state ──
  const [layers, setLayers] = useState({ contracts: true, intel: true, ops: true, hostile: false })
  // Layer panel collapses to a chip on mobile (flipped open by default
  // on tablet+; closed by default on phones via media query auto-detect).
  const [layerPanelOpen, setLayerPanelOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth > 720 : true)
  const [contractsRows, setContractsRows] = useState([])
  const [intelRows,     setIntelRows]     = useState([])
  const [opsRows,       setOpsRows]       = useState([])
  const [selected, setSelected] = useState(null)
  const [search,   setSearch]   = useState('')

  // ── load + realtime ──
  useEffect(() => {
    let cancelled = false
    async function load() {
      const [c, i, e] = await Promise.all([
        supabase.from('contracts')
          .select('id, title, location, contract_type, reward, status, created_at')
          .eq('status', 'OPEN'),
        supabase.from('intelligence')
          .select('id, title, content, classification, min_tier, created_at')
          .lte('min_tier', profile.tier ?? 9),
        supabase.from('events')
          .select('id, title, location, event_type, status, starts_at')
          .in('status', ['SCHEDULED', 'LIVE']),
      ])
      if (cancelled) return
      setContractsRows(c.data || [])
      setIntelRows(i.data     || [])
      setOpsRows(e.data       || [])
    }
    load()

    // Realtime: refresh the relevant slice when rows change.
    const channel = supabase.channel('strategic-map-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intelligence' }, () => {
        supabase.from('intelligence')
          .select('id, title, content, classification, min_tier, created_at')
          .lte('min_tier', profile.tier ?? 9)
          .then(({ data }) => { if (data) setIntelRows(data) })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        supabase.from('events')
          .select('id, title, location, event_type, status, starts_at')
          .in('status', ['SCHEDULED', 'LIVE'])
          .then(({ data }) => { if (data) setOpsRows(data) })
      })
      .subscribe()
    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [profile.tier])

  // ── resolve raw rows to (x, y) markers via LOCATION_LOOKUP ──
  const { contracts, intel, ops, unresolved } = useMemo(() => {
    const contracts = []
    const intel     = []
    const ops       = []
    const unresolved = []

    contractsRows.forEach(c => {
      const r = resolveLocation(c.location || '')
      if (r) contracts.push({ ...c, x: r.x, y: r.y, color: COLORS.contract })
      else   unresolved.push({ ...c, kind: 'contract', label: c.title, color: COLORS.contract })
    })
    intelRows.forEach(it => {
      const r = resolveLocation(`${it.title} ${it.content || ''}`)
      if (r) intel.push({ ...it, x: r.x, y: r.y, color: COLORS.intel, location: r.label })
      else   unresolved.push({ ...it, kind: 'intel', label: it.title, color: COLORS.intel })
    })
    opsRows.forEach(op => {
      const r = resolveLocation(op.location || '')
      if (r) ops.push({ ...op, x: r.x, y: r.y, color: COLORS.op })
      else   unresolved.push({ ...op, kind: 'op', label: op.title, color: COLORS.op })
    })

    return {
      contracts:  spreadAtAnchor(contracts),
      intel:      spreadAtAnchor(intel),
      ops:        spreadAtAnchor(ops),
      unresolved,
    }
  }, [contractsRows, intelRows, opsRows])

  const overlayCounts = {
    contract: contractsRows.length,
    intel:    intelRows.length,
    op:       opsRows.length,
  }

  // ── pan + zoom ──
  const screenToSvg = (clientX, clientY) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (!r) return { x: 0, y: 0 }
    const sx = (clientX - r.left) / r.width
    const sy = (clientY - r.top)  / r.height
    return { x: viewBox.x + sx * viewBox.w, y: viewBox.y + sy * viewBox.h }
  }

  const onWheel = (e) => {
    if (!svgRef.current) return
    e.preventDefault()
    const r = svgRef.current.getBoundingClientRect()
    const sx = (e.clientX - r.left) / r.width
    const sy = (e.clientY - r.top)  / r.height
    const factor = Math.exp(e.deltaY * 0.0015)
    const newW = clamp(viewBox.w * factor, 80,  3000)
    const newH = clamp(viewBox.h * factor, 80,  3000)
    setViewBox({
      x: viewBox.x + (viewBox.w - newW) * sx,
      y: viewBox.y + (viewBox.h - newH) * sy,
      w: newW, h: newH,
    })
  }

  // Pan with a 6px drag threshold so a quick tap on a marker doesn't
  // get swallowed as a "pan that moved 0.5px". Until the pointer
  // crosses the threshold we don't capture the pointer or update the
  // viewBox — leaves the click event alone for marker handlers.
  const PAN_THRESHOLD = 6

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    panRef.current = {
      x: e.clientX, y: e.clientY,
      vbX: viewBox.x, vbY: viewBox.y,
      panning: false,
    }
  }

  const onPointerMove = (e) => {
    if (!panRef.current || !svgRef.current) return
    const dx = e.clientX - panRef.current.x
    const dy = e.clientY - panRef.current.y
    if (!panRef.current.panning) {
      if (Math.hypot(dx, dy) < PAN_THRESHOLD) return
      panRef.current.panning = true
      svgRef.current.setPointerCapture?.(e.pointerId)
    }
    const r = svgRef.current.getBoundingClientRect()
    const vbDx = -dx * (viewBox.w / r.width)
    const vbDy = -dy * (viewBox.h / r.height)
    setViewBox(vb => ({ ...vb, x: panRef.current.vbX + vbDx, y: panRef.current.vbY + vbDy }))
  }

  const onPointerUp = (e) => {
    if (panRef.current?.panning) svgRef.current?.releasePointerCapture?.(e.pointerId)
    panRef.current = null
  }

  // Background-click clears selection. Markers stop propagation.
  const onBackgroundClick = (e) => {
    if (e.target === svgRef.current) setSelected(null)
  }

  // Keyboard: +/- zoom around center, 0 to reset, Esc to deselect
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === '+' || e.key === '=') {
        const factor = 0.85
        setViewBox(vb => ({
          x: vb.x + (vb.w * (1 - factor)) / 2,
          y: vb.y + (vb.h * (1 - factor)) / 2,
          w: vb.w * factor, h: vb.h * factor,
        }))
      } else if (e.key === '-' || e.key === '_') {
        const factor = 1.18
        setViewBox(vb => ({
          x: vb.x - (vb.w * (factor - 1)) / 2,
          y: vb.y - (vb.h * (factor - 1)) / 2,
          w: vb.w * factor, h: vb.h * factor,
        }))
      } else if (e.key === '0') {
        setViewBox(DEFAULT_VIEWBOX)
      } else if (e.key === 'Escape') {
        setSelected(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Compute zoom factor relative to default for level-of-detail toggles
  const zoom = DEFAULT_VIEWBOX.w / viewBox.w

  // Search → resolve and fly to
  const onSearchSubmit = (e) => {
    e.preventDefault()
    if (!search.trim()) return
    const r = resolveLocation(search)
    if (r) {
      setViewBox({ x: r.x - 90, y: r.y - 90, w: 180, h: 180 })
      setSelected(planetSelectionFor(r.anchorId))
    }
  }

  function planetSelectionFor(anchorId) {
    if (!anchorId) return null
    if (anchorId === 'stanton') return { kind: 'star', data: STANTON_SUN }
    const planet = STANTON_PLANETS.find(p => p.id === anchorId)
    if (planet) return { kind: 'planet', data: planet }
    const [pid, sub] = anchorId.split('/')
    const parent = STANTON_PLANETS.find(p => p.id === pid)
    if (!parent) return null
    const moon = parent.moons.find(m => m.id === sub)
    if (moon) return { kind: 'moon', data: { ...moon, parent } }
    return { kind: 'planet', data: parent }
  }

  // Reset to default view
  const resetView = () => setViewBox(DEFAULT_VIEWBOX)

  return (
    <>
      <ClassificationBar
        section="GRAYVEIL CORPORATION · STRATEGIC MAP"
        label={`OPERATIVE ${profile.handle?.toUpperCase()}`}
        right={(
          <>
            <span>STANTON SYSTEM</span>
            <span style={{ color: 'var(--accent)' }}>{contracts.length + intel.length + ops.length} OVERLAYS · LIVE</span>
          </>
        )}
      />

      {/* Header with search + actions */}
      <div className="page-header" style={{ paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>STRATEGIC MAP</h1>
            <div style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 640 }}>
              Stanton system surveillance. Click any marker for details. Drag to pan, scroll to zoom, "0" to reset.
            </div>
          </div>
          <form onSubmit={onSearchSubmit} className="gv-map-search" style={{ display: 'flex', gap: 8 }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search location (e.g. Lorville, Daymar)"
              className="form-input"
              style={{ width: 260 }}
            />
            <button type="submit" className="btn btn-ghost btn-sm" style={{ borderRadius: 2 }}>JUMP →</button>
          </form>
        </div>
      </div>

      {/* Map body */}
      <div style={{
        position: 'relative',
        flex: 1,
        background: '#040608',
        overflow: 'hidden',
        borderTop: '1px solid var(--border)',
      }}>
        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          preserveAspectRatio="xMidYMid meet"
          width="100%" height="100%"
          style={{ display: 'block', cursor: panRef.current ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' }}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={onBackgroundClick}
        >
          <MapBackdrop viewBox={viewBox} />
          <OrbitalRings orbitalRadii={ORBITAL_RINGS} />
          <LandmarkLayer landmarks={STANTON_LANDMARKS} onSelect={setSelected} />
          <SunMarker sun={STANTON_SUN} selected={selected} onSelect={setSelected} />
          {STANTON_PLANETS.map(p => (
            <PlanetMarker key={p.id} planet={p} selected={selected} onSelect={setSelected} />
          ))}
          <MoonLayer planets={STANTON_PLANETS} zoom={zoom} selected={selected} onSelect={setSelected} />
          <StationLayer planets={STANTON_PLANETS} zoom={zoom} selected={selected} onSelect={setSelected} />
          {layers.contracts && <MarkerLayer items={contracts} kind="contract" selected={selected} onSelect={setSelected} />}
          {layers.intel     && <MarkerLayer items={intel}     kind="intel"    selected={selected} onSelect={setSelected} />}
          {layers.ops       && <MarkerLayer items={ops}       kind="op"       selected={selected} onSelect={setSelected} />}
        </svg>

        {/* Floating layer toggle panel — collapsible on mobile */}
        <div className={`gv-map-layers ${layerPanelOpen ? '' : 'gv-collapsed'}`} style={{
          position: 'absolute', top: 18, right: 18,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-md)',
          padding: '14px 16px',
          minWidth: 200,
        }}>
          <div
            onClick={() => setLayerPanelOpen(o => !o)}
            role="button"
            tabIndex={0}
            aria-expanded={layerPanelOpen}
            aria-label={layerPanelOpen ? 'Collapse overlay panel' : 'Expand overlay panel'}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLayerPanelOpen(o => !o) } }}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: 10, marginBottom: layerPanelOpen ? 12 : 0,
              cursor: 'pointer', userSelect: 'none',
            }}
          >
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
              letterSpacing: '.32em', color: 'var(--text-3)',
              textTransform: 'uppercase',
            }}>
              OVERLAYS{!layerPanelOpen && ` · ${overlayCounts.contract + overlayCounts.intel + overlayCounts.op}`}
            </span>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
              color: 'var(--accent)', lineHeight: 1,
            }}>{layerPanelOpen ? '−' : '+'}</span>
          </div>
          <div className="gv-map-layers-body">
            <LayerToggle label="Contracts"  count={overlayCounts.contract} color={COLORS.contract} active={layers.contracts} onClick={() => setLayers(l => ({ ...l, contracts: !l.contracts }))} />
            <LayerToggle label="Intel"      count={overlayCounts.intel}    color={COLORS.intel}    active={layers.intel}     onClick={() => setLayers(l => ({ ...l, intel: !l.intel }))} />
            <LayerToggle label="Operations" count={overlayCounts.op}       color={COLORS.op}       active={layers.ops}       onClick={() => setLayers(l => ({ ...l, ops: !l.ops }))} />
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <button onClick={resetView} className="h-accent-edge" style={{
                width: '100%', background: 'transparent', color: 'var(--text-2)',
                border: '1px solid var(--border-md)', borderRadius: 2,
                padding: '6px 8px', fontSize: 9, letterSpacing: '.22em',
                fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase',
                cursor: 'pointer', transition: 'border-color .15s, color .15s',
              }}>RESET VIEW · 0</button>
            </div>
          </div>
        </div>

        {/* Coordinates readout bottom-left */}
        <div className="gv-map-coords" style={{
          position: 'absolute', bottom: 14, left: 14,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
          letterSpacing: '.22em', color: 'var(--text-3)',
          textTransform: 'uppercase',
          background: 'rgba(6,8,11,0.5)', padding: '4px 8px',
          border: '1px solid var(--border)',
          pointerEvents: 'none',
        }}>
          C: {viewBox.x.toFixed(0)}, {viewBox.y.toFixed(0)} · ZOOM {zoom.toFixed(2)}× · STANTON FRAME
        </div>

        {/* Unresolved tray bottom-right */}
        {unresolved.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 14, right: 14,
            background: 'var(--bg-surface)',
            border: '1px dashed var(--amber)',
            padding: '8px 12px',
            maxWidth: 280,
          }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
              letterSpacing: '.28em', color: 'var(--amber)',
              textTransform: 'uppercase', marginBottom: 4,
            }}>⚠ {unresolved.length} UNRESOLVED COORDINATES</div>
            <div style={{
              fontFamily: 'Inter, sans-serif', fontSize: 11,
              color: 'var(--text-2)', lineHeight: 1.5,
            }}>
              {unresolved.length === 1 ? '1 entity has' : `${unresolved.length} entities have`} a location string the resolver couldn't place. Improve their location text on their detail page.
            </div>
          </div>
        )}

        {/* Detail drawer */}
        <MapDetailDrawer selected={selected} onClose={() => setSelected(null)} />
      </div>
    </>
  )
}

function LayerToggle({ label, count, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', gap: 12,
        padding: '6px 8px', marginBottom: 4,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        opacity: active ? 1 : 0.45,
        transition: 'opacity .15s',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 10, height: 10, borderRadius: 1,
          background: active ? color : 'transparent',
          border: `1px solid ${color}`,
        }} />
        <span style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
          letterSpacing: '.18em', color: 'var(--text-1)',
          textTransform: 'uppercase',
        }}>{label}</span>
      </span>
      <span style={{
        fontFamily: 'Inter Tight, sans-serif', fontSize: 11,
        fontWeight: 700, color: 'var(--text-2)',
        fontVariantNumeric: 'tabular-nums',
      }}>{count}</span>
    </button>
  )
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }
