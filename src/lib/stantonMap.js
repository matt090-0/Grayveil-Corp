// ─────────────────────────────────────────────────────────────
// STANTON SYSTEM — Static cartography for the Strategic Map.
//
// Coordinate space is unitless and centered on the sun (0, 0).
// All values are display-friendly approximations, NOT astronomically
// accurate. Strategic-map utility prioritizes readable layout over
// orbital fidelity. Each planet sits on a fixed orbital ring; moons
// and OM stations are placed in a planet-local frame.
//
// LOCATION_LOOKUP at the bottom maps freeform `location` strings used
// across intel/contracts/ops/blacklist to a stable anchor in this
// system tree. resolveLocation() returns absolute (x, y) coordinates
// for any text that matches a known place; unmatched strings return
// null and surface in the "UNKNOWN COORDINATES" tray on the map page.
// ─────────────────────────────────────────────────────────────

// Helper: lay out N items as a tight cluster around (cx, cy) at radius r.
// Used for moons + OM stations so we don't repeat trig math.
function ring(cx, cy, n, r, startDeg = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = (startDeg + (i * 360) / n) * Math.PI / 180
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
}

// Sun
export const STANTON_SUN = {
  id:           'stanton',
  name:         'STANTON',
  type:         'star',
  jurisdiction: 'UEE',
  x: 0, y: 0,
  radius: 26,
  desc:         'A1IV-class star, system primary.',
}

// Each planet placed at a static angular position on its orbital ring.
// Numbers are tuned for visual clarity, not orbital mechanics.
const PLANET_DEFS = [
  // [ id, name, jurisdiction, owner, orbitR, angleDeg, radius ]
  ['hurston',   'HURSTON',   'CORPORATE', 'Hurston Dynamics',     230,  -25, 14],
  ['crusader',  'CRUSADER',  'CORPORATE', 'Crusader Industries',  330,  140, 16],
  ['arccorp',   'ARCCORP',   'CORPORATE', 'ArcCorp',              420, -150, 14],
  ['microtech', 'MICROTECH', 'CORPORATE', 'microTech',            520,   55, 15],
]

// Per-planet child catalog. Coordinates are LOCAL to the parent planet,
// so the renderer can translate them by the planet's (x, y).
const PLANET_CHILDREN = {
  hurston: {
    moons: [
      { id: 'arial',    name: 'Arial',    dx:  26, dy:   0 },
      { id: 'aberdeen', name: 'Aberdeen', dx:  16, dy: -22 },
      { id: 'magda',    name: 'Magda',    dx:  -8, dy: -26 },
      { id: 'ita',      name: 'Ita',      dx: -22, dy:  18 },
    ],
  },
  crusader: {
    moons: [
      { id: 'cellin', name: 'Cellin', dx:  28, dy:  -8 },
      { id: 'daymar', name: 'Daymar', dx: -10, dy:  28 },
      { id: 'yela',   name: 'Yela',   dx: -26, dy: -10 },
    ],
  },
  arccorp: {
    moons: [
      { id: 'lyria', name: 'Lyria', dx:  20, dy: -18 },
      { id: 'wala',  name: 'Wala',  dx: -22, dy:  16 },
    ],
  },
  microtech: {
    moons: [
      { id: 'clio',     name: 'Clio',     dx:  22, dy:  20 },
      { id: 'calliope', name: 'Calliope', dx:  -2, dy: -28 },
      { id: 'euterpe',  name: 'Euterpe',  dx: -24, dy:   8 },
    ],
  },
}

// Build the full planet array, attaching moons and 5 OM stations
// (L1-L5) at a fixed local radius. OM angle offsets are hard-coded
// so they read consistently across the map.
export const STANTON_PLANETS = PLANET_DEFS.map(([id, name, jurisdiction, owner, orbitR, angleDeg, radius]) => {
  const a  = angleDeg * Math.PI / 180
  const x  = orbitR * Math.cos(a)
  const y  = orbitR * Math.sin(a)
  const omPositions = ring(0, 0, 5, radius + 22, -90) // L1 at top, clockwise
  const stations = omPositions.map((p, i) => ({
    id:    `${id}-om${i + 1}`,
    name:  `${id.slice(0, 3).toUpperCase()}-L${i + 1}`,
    type:  'om',
    dx:    p.x, dy: p.y,
  }))
  const moons = (PLANET_CHILDREN[id]?.moons || []).map(m => ({ ...m, type: 'moon', parent: id }))
  return {
    id, name, type: 'planet',
    jurisdiction, owner,
    orbitR, angleDeg,
    x, y, radius,
    moons, stations,
  }
})

// Belts / Lagrange-region landmarks that aren't tied to one planet.
export const STANTON_LANDMARKS = [
  {
    id: 'aaron-halo', name: 'AARON HALO', type: 'belt',
    cx: 0, cy: 0,
    innerR: 285, outerR: 320,
    desc: 'Asteroid belt between Crusader and ArcCorp orbits.',
  },
]

// Quick lookup of the full system tree as a flat indexable map.
// Used by resolveLocation to translate anchor IDs back to coords.
export const STANTON_INDEX = (() => {
  const m = new Map()
  m.set('stanton', { ...STANTON_SUN })
  STANTON_PLANETS.forEach(p => {
    m.set(p.id, p)
    p.moons.forEach(mn => m.set(`${p.id}/${mn.id}`, { ...mn, x: p.x + mn.dx, y: p.y + mn.dy }))
    p.stations.forEach(st => m.set(`${p.id}/${st.id}`, { ...st, x: p.x + st.dx, y: p.y + st.dy }))
    // Convenience aliases used in LOCATION_LOOKUP:
    m.set(`${p.id}/om`, { x: p.x, y: p.y - (p.radius + 22), type: 'om', parent: p.id })
    m.set(`${p.id}/orbit`, { x: p.x, y: p.y, type: 'orbit', parent: p.id })
  })
  STANTON_LANDMARKS.forEach(l => m.set(l.id, { x: l.cx, y: l.cy - l.innerR, type: l.type, ...l }))
  return m
})()

// ─────────────────────────────────────────────────────────────
// LOCATION_LOOKUP — fuzzy text → anchor mapping.
//
// Order matters: more specific patterns first. The first match wins.
// `anchor` is a key in STANTON_INDEX. Optional `nudge` adds a small
// (dx, dy) offset so multiple markers at the same anchor don't pile.
// ─────────────────────────────────────────────────────────────
export const LOCATION_LOOKUP = [
  // Hurston system
  { match: /\bhdms-edmond|hdms-pinewood|hdms-stanhope|hdms-hadley|hdms-ryder|hdms-thedus|hdms-perlman|hdms-lathan/i, anchor: 'hurston' },
  { match: /\b(arial)\b/i,    anchor: 'hurston/arial' },
  { match: /\b(aberdeen|klescher)\b/i, anchor: 'hurston/aberdeen' },
  { match: /\b(magda)\b/i,    anchor: 'hurston/magda' },
  { match: /\b(ita)\b/i,      anchor: 'hurston/ita' },
  { match: /\bhur-l[1-5]\b/i, anchor: 'hurston/om' },
  { match: /\b(lorville|hurston)\b/i, anchor: 'hurston' },

  // Crusader system
  { match: /\b(grimhex|grim ?hex|yela)\b/i, anchor: 'crusader/yela' },
  { match: /\b(daymar|shubin sm0-?13|kudre ore|brio's breaker)\b/i, anchor: 'crusader/daymar' },
  { match: /\b(cellin)\b/i,   anchor: 'crusader/cellin' },
  { match: /\b(port olisar|\bpo\b)\b/i, anchor: 'crusader' },
  { match: /\bcru-l[1-5]\b/i, anchor: 'crusader/om' },
  { match: /\b(orison|crusader)\b/i, anchor: 'crusader' },

  // ArcCorp system
  { match: /\b(area ?18|riker mem|baijini)\b/i, anchor: 'arccorp' },
  { match: /\b(lyria|shubin scd-1|humboldt mines)\b/i, anchor: 'arccorp/lyria' },
  { match: /\b(wala|arccorp mining 141|arccorp 141)\b/i, anchor: 'arccorp/wala' },
  { match: /\barc-l[1-5]\b/i, anchor: 'arccorp/om' },
  { match: /\barccorp\b/i,    anchor: 'arccorp' },

  // microTech system
  { match: /\b(new babbage|nb)\b/i, anchor: 'microtech' },
  { match: /\b(clio|rayari deltana|rayari kaltag)\b/i, anchor: 'microtech/clio' },
  { match: /\b(calliope|shubin sml-?5|outpost 12)\b/i, anchor: 'microtech/calliope' },
  { match: /\b(euterpe|devlin|gallete fam)\b/i, anchor: 'microtech/euterpe' },
  { match: /\bmic-l[1-5]\b/i, anchor: 'microtech/om' },
  { match: /\bmicrotech\b/i,  anchor: 'microtech' },

  // Belts and POIs
  { match: /\baaron halo|halo|asteroid belt\b/i, anchor: 'aaron-halo' },
  { match: /\bjumptown|kareah\b/i, anchor: 'crusader/yela' },

  // Stanton-system fallback (catches "Stanton" alone)
  { match: /\bstanton\b/i, anchor: 'stanton' },
]

// Resolve a freeform location string to absolute (x, y) + anchor info.
// Returns { x, y, anchor, anchorId, label } or null.
export function resolveLocation(text) {
  if (!text || typeof text !== 'string') return null
  for (const rule of LOCATION_LOOKUP) {
    if (rule.match.test(text)) {
      const node = STANTON_INDEX.get(rule.anchor)
      if (!node) continue
      const dx = rule.nudge?.dx || 0
      const dy = rule.nudge?.dy || 0
      return {
        x: node.x + dx,
        y: node.y + dy,
        anchor: node,
        anchorId: rule.anchor,
        label: text,
      }
    }
  }
  return null
}

// Compute the orbital radius of each planet so renderer can draw rings.
export const ORBITAL_RINGS = STANTON_PLANETS.map(p => p.orbitR)

// Default viewBox the map opens with (centered on Stanton, fits all
// orbits + a margin for HUD chrome).
export const DEFAULT_VIEWBOX = { x: -650, y: -650, w: 1300, h: 1300 }
