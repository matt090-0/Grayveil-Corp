// ─────────────────────────────────────────────────────────────
// MapLayers — pure SVG render primitives for the Strategic Map.
// All layers are stateless. The host page manages selection,
// viewBox, and overlay data; layers just draw what they're given.
// ─────────────────────────────────────────────────────────────

// Backdrop: 100-unit grid + axes through (0, 0).
// Drawn using CSS pattern-fill so the grid doesn't blow the SVG node
// count up at zoom-out.
export function MapBackdrop({ viewBox }) {
  const minX = viewBox.x
  const minY = viewBox.y
  const maxX = viewBox.x + viewBox.w
  const maxY = viewBox.y + viewBox.h
  return (
    <g>
      <defs>
        <pattern id="map-grid-100" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#e8e3d8" strokeWidth="0.4" opacity="0.06" />
        </pattern>
        <pattern id="map-grid-25" x="0" y="0" width="25" height="25" patternUnits="userSpaceOnUse">
          <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#e8e3d8" strokeWidth="0.2" opacity="0.04" />
        </pattern>
      </defs>
      <rect x={minX} y={minY} width={viewBox.w} height={viewBox.h} fill="url(#map-grid-25)" />
      <rect x={minX} y={minY} width={viewBox.w} height={viewBox.h} fill="url(#map-grid-100)" />
      {/* Center crosshair */}
      <line x1={minX} y1={0} x2={maxX} y2={0} stroke="#e8e3d8" strokeWidth="0.5" opacity="0.12" />
      <line x1={0} y1={minY} x2={0} y2={maxY} stroke="#e8e3d8" strokeWidth="0.5" opacity="0.12" />
    </g>
  )
}

// Orbital rings: dashed concentric circles at planet orbital radii,
// with degree tick marks for situational awareness.
export function OrbitalRings({ orbitalRadii }) {
  return (
    <g>
      {orbitalRadii.map((r, i) => (
        <g key={r}>
          <circle
            cx={0} cy={0} r={r}
            fill="none"
            stroke="#e8e3d8"
            strokeWidth="0.6"
            strokeDasharray="3 5"
            opacity={0.18}
          />
          {/* Degree tick marks every 30 degrees */}
          {Array.from({ length: 12 }, (_, k) => {
            const a = (k * 30) * Math.PI / 180
            const x1 = r * Math.cos(a)
            const y1 = r * Math.sin(a)
            const x2 = (r + 4) * Math.cos(a)
            const y2 = (r + 4) * Math.sin(a)
            return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e8e3d8" strokeWidth="0.5" opacity="0.18" />
          })}
        </g>
      ))}
    </g>
  )
}

// Aaron Halo asteroid belt: dashed ring with a fuzzy fill using a radial gradient.
export function LandmarkLayer({ landmarks, onSelect }) {
  return (
    <g>
      {landmarks.map(l => {
        if (l.type !== 'belt') return null
        const midR = (l.innerR + l.outerR) / 2
        return (
          <g key={l.id} style={{ cursor: 'pointer' }} onClick={() => onSelect?.({ kind: 'landmark', data: l })}>
            <circle
              cx={l.cx} cy={l.cy} r={l.innerR}
              fill="none" stroke="#a8a094" strokeWidth="0.6" strokeDasharray="2 4"
              opacity="0.32"
            />
            <circle
              cx={l.cx} cy={l.cy} r={l.outerR}
              fill="none" stroke="#a8a094" strokeWidth="0.6" strokeDasharray="2 4"
              opacity="0.22"
            />
            <text
              x={0} y={-(midR)}
              textAnchor="middle" dominantBaseline="middle"
              fill="#8a8478" fontFamily="JetBrains Mono, monospace"
              fontSize="9" letterSpacing="0.32em"
              opacity="0.65"
            >{l.name}</text>
          </g>
        )
      })}
    </g>
  )
}

// Sun: filled tan disk with a soft radial halo.
export function SunMarker({ sun, selected, onSelect }) {
  return (
    <g style={{ cursor: 'pointer' }} onClick={() => onSelect?.({ kind: 'star', data: sun })}>
      <defs>
        <radialGradient id="sun-halo">
          <stop offset="0%"  stopColor="#ff8a4a" stopOpacity="0.55" />
          <stop offset="40%" stopColor="#c4a878" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#c4a878" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sun-core">
          <stop offset="0%"   stopColor="#fff5e8" />
          <stop offset="60%"  stopColor="#ff8a4a" />
          <stop offset="100%" stopColor="#c4a878" />
        </radialGradient>
      </defs>
      <circle cx={sun.x} cy={sun.y} r={sun.radius * 3} fill="url(#sun-halo)" />
      <circle cx={sun.x} cy={sun.y} r={sun.radius} fill="url(#sun-core)" />
      <text
        x={sun.x} y={sun.y + sun.radius + 16}
        textAnchor="middle"
        fill="#e8e3d8" fontFamily="Inter Tight, sans-serif"
        fontSize="11" fontWeight="700" letterSpacing="0.18em"
      >{sun.name}</text>
      {selected?.kind === 'star' && (
        <circle cx={sun.x} cy={sun.y} r={sun.radius + 8} fill="none" stroke="#c4a878" strokeWidth="1.2" strokeDasharray="4 3" />
      )}
    </g>
  )
}

// Planet: hex-outline marker, dark-fill core, mono cap label.
// Hex vs circle reads as "engineered telemetry" rather than "Earth-style globe".
export function PlanetMarker({ planet, selected, onSelect }) {
  const pts = hexPoints(planet.x, planet.y, planet.radius)
  const isSel = selected?.kind === 'planet' && selected?.data?.id === planet.id
  return (
    <g style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onSelect?.({ kind: 'planet', data: planet }) }}>
      <polygon
        points={pts}
        fill="#11151c"
        stroke={isSel ? '#c4a878' : '#a8a094'}
        strokeWidth={isSel ? '1.6' : '0.9'}
      />
      <circle cx={planet.x} cy={planet.y} r={planet.radius * 0.55} fill="#181d27" stroke="#3a4150" strokeWidth="0.4" />
      {/* Hex inner detail */}
      <polygon
        points={hexPoints(planet.x, planet.y, planet.radius * 0.35)}
        fill="none" stroke="#5a564d" strokeWidth="0.4" opacity="0.6"
      />
      {/* Label */}
      <text
        x={planet.x} y={planet.y + planet.radius + 14}
        textAnchor="middle"
        fill="#e8e3d8" fontFamily="Inter Tight, sans-serif"
        fontSize="11" fontWeight="700" letterSpacing="0.14em"
      >{planet.name}</text>
      <text
        x={planet.x} y={planet.y + planet.radius + 25}
        textAnchor="middle"
        fill="#8a8478" fontFamily="JetBrains Mono, monospace"
        fontSize="7" letterSpacing="0.28em"
      >{planet.jurisdiction}</text>
    </g>
  )
}

// Moons: small triangles. Visible at all zooms but labeled only above
// a zoom threshold.
export function MoonLayer({ planets, zoom, selected, onSelect }) {
  return (
    <g>
      {planets.flatMap(p => p.moons.map(m => {
        const x = p.x + m.dx
        const y = p.y + m.dy
        const isSel = selected?.kind === 'moon' && selected?.data?.id === m.id
        return (
          <g key={`${p.id}-${m.id}`} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onSelect?.({ kind: 'moon', data: { ...m, parent: p }, x, y }) }}>
            <polygon
              points={trianglePoints(x, y, 3)}
              fill={isSel ? '#c4a878' : '#a8a094'}
              opacity={isSel ? 1 : 0.78}
            />
            {zoom > 1.4 && (
              <text
                x={x + 5} y={y + 1.5}
                fill="#8a8478" fontFamily="JetBrains Mono, monospace"
                fontSize="6.5" letterSpacing="0.2em"
              >{m.name.toUpperCase()}</text>
            )}
          </g>
        )
      }))}
    </g>
  )
}

// OM stations (Lagrange L1-L5): tiny diamonds. Visible only at high zoom.
export function StationLayer({ planets, zoom, selected, onSelect }) {
  if (zoom < 1.6) return null
  return (
    <g>
      {planets.flatMap(p => p.stations.map(st => {
        const x = p.x + st.dx
        const y = p.y + st.dy
        const isSel = selected?.kind === 'station' && selected?.data?.id === st.id
        return (
          <g key={st.id} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onSelect?.({ kind: 'station', data: { ...st, parent: p }, x, y }) }}>
            <polygon
              points={diamondPoints(x, y, 2.2)}
              fill="none"
              stroke={isSel ? '#c4a878' : '#7d8696'}
              strokeWidth="0.7"
            />
            {zoom > 2.4 && (
              <text
                x={x + 4} y={y + 1.2}
                fill="#7d8696" fontFamily="JetBrains Mono, monospace"
                fontSize="5.5" letterSpacing="0.18em"
              >{st.name}</text>
            )}
          </g>
        )
      }))}
    </g>
  )
}

// Marker layers — overlay items resolved to (x, y) by the page.
// Each item: { id, x, y, label, color, glyph?, kind }
// Color is passed in so the host page can pin colors per layer
// (red=hostile, amber=contracts, blue=intel, green=ops).

function MarkerSquare({ item, selected, onSelect }) {
  const isSel = selected?.kind === item.kind && selected?.data?.id === item.id
  const r = isSel ? 5.5 : 4.5
  return (
    <g style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onSelect?.({ kind: item.kind, data: item, x: item.x, y: item.y }) }}>
      <rect
        x={item.x - r} y={item.y - r} width={r * 2} height={r * 2}
        fill="none" stroke={item.color} strokeWidth={isSel ? '1.6' : '1'}
      />
      <rect
        x={item.x - 1} y={item.y - 1} width={2} height={2}
        fill={item.color}
      />
    </g>
  )
}

function MarkerCircle({ item, selected, onSelect }) {
  const isSel = selected?.kind === item.kind && selected?.data?.id === item.id
  const r = isSel ? 5 : 4
  return (
    <g style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onSelect?.({ kind: item.kind, data: item, x: item.x, y: item.y }) }}>
      <circle cx={item.x} cy={item.y} r={r} fill="none" stroke={item.color} strokeWidth={isSel ? '1.6' : '1'} />
      <line x1={item.x - r - 1.5} y1={item.y} x2={item.x + r + 1.5} y2={item.y} stroke={item.color} strokeWidth="0.6" />
      <line x1={item.x} y1={item.y - r - 1.5} x2={item.x} y2={item.y + r + 1.5} stroke={item.color} strokeWidth="0.6" />
    </g>
  )
}

function MarkerBracket({ item, selected, onSelect }) {
  const isSel = selected?.kind === item.kind && selected?.data?.id === item.id
  const r = 5
  const w = isSel ? '1.6' : '1.2'
  return (
    <g style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onSelect?.({ kind: item.kind, data: item, x: item.x, y: item.y }) }}>
      <path d={`M ${item.x - r} ${item.y - r + 2} L ${item.x - r} ${item.y - r} L ${item.x - r + 2} ${item.y - r}`} stroke={item.color} strokeWidth={w} fill="none" />
      <path d={`M ${item.x + r - 2} ${item.y - r} L ${item.x + r} ${item.y - r} L ${item.x + r} ${item.y - r + 2}`} stroke={item.color} strokeWidth={w} fill="none" />
      <path d={`M ${item.x + r} ${item.y + r - 2} L ${item.x + r} ${item.y + r} L ${item.x + r - 2} ${item.y + r}`} stroke={item.color} strokeWidth={w} fill="none" />
      <path d={`M ${item.x - r + 2} ${item.y + r} L ${item.x - r} ${item.y + r} L ${item.x - r} ${item.y + r - 2}`} stroke={item.color} strokeWidth={w} fill="none" />
    </g>
  )
}

function MarkerPulse({ item, selected, onSelect }) {
  const isSel = selected?.kind === item.kind && selected?.data?.id === item.id
  return (
    <g style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onSelect?.({ kind: item.kind, data: item, x: item.x, y: item.y }) }}>
      <circle cx={item.x} cy={item.y} r="3" fill={item.color} />
      <circle cx={item.x} cy={item.y} r="3" fill="none" stroke={item.color} strokeWidth="1">
        <animate attributeName="r" values="3;9;3" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8;0;0.8" dur="2.4s" repeatCount="indefinite" />
      </circle>
      {isSel && (
        <circle cx={item.x} cy={item.y} r="8" fill="none" stroke={item.color} strokeWidth="1.4" strokeDasharray="2 2" />
      )}
    </g>
  )
}

export function MarkerLayer({ items, kind, selected, onSelect }) {
  const Glyph = { contract: MarkerSquare, intel: MarkerCircle, hostile: MarkerBracket, op: MarkerPulse }[kind]
  if (!Glyph) return null
  return (
    <g>{items.map(item => <Glyph key={item.id} item={{ ...item, kind }} selected={selected} onSelect={onSelect} />)}</g>
  )
}

// ── Geometry helpers ──────────────────────────────────────────
function hexPoints(cx, cy, r) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 - 90) * Math.PI / 180
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
  }).join(' ')
}
function trianglePoints(cx, cy, r) {
  return [
    [cx, cy - r],
    [cx + r * 0.9, cy + r * 0.7],
    [cx - r * 0.9, cy + r * 0.7],
  ].map(([x, y]) => `${x},${y}`).join(' ')
}
function diamondPoints(cx, cy, r) {
  return [
    [cx, cy - r],
    [cx + r, cy],
    [cx, cy + r],
    [cx - r, cy],
  ].map(([x, y]) => `${x},${y}`).join(' ')
}
