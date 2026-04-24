// ── MARKETPLACE CATALOG ──
// Reference list of items that have been craftable through the Star Citizen
// 4.x crafting benches. The marketplace UI does NOT lock users to this list
// (title, manufacturer, and description are all free-text) — this is a
// known-good starter set used to populate datalist autocomplete and give
// new listings quick defaults. Members can list anything they've actually
// crafted, even if it isn't in this catalogue yet.

// ── Category metadata — mirrors the DB CHECK constraint on market_listings.category.
export const MARKET_CATEGORIES = {
  WEAPON:      { label: 'Weapons',         color: '#e05c5c', glyph: '⚔', blurb: 'FPS rifles, pistols, shotguns, LMGs, snipers' },
  ARMOR:       { label: 'Armor',           color: '#5a80d9', glyph: '◈', blurb: 'Combat, salvage, and utility armor sets' },
  MEDICAL:     { label: 'Medical',         color: '#5ce0a1', glyph: '✚', blurb: 'Medpens, treatments, rehydration' },
  TOOL:        { label: 'Tools',           color: '#c8a55a', glyph: '⚙', blurb: 'Multi-tools and attachments — mining, salvage, repair' },
  CONSUMABLE:  { label: 'Consumables',     color: '#4ad9d9', glyph: '◉', blurb: 'Food, drink, and ration packs' },
  AMMO:        { label: 'Ammo & Ordnance', color: '#e0a155', glyph: '▣', blurb: 'Rounds, grenades, breaching charges' },
  SHIP_COMP:   { label: 'Ship Components', color: '#a860e0', glyph: '◇', blurb: 'Ship weapons, shields, power plants, coolers' },
  OTHER:       { label: 'Other',           color: '#b4b8c4', glyph: '●', blurb: 'Miscellaneous or custom-crafted goods' },
}

export const MARKET_CATEGORY_KEYS = Object.keys(MARKET_CATEGORIES)

// ── Grades / quality tiers — mirrors the DB CHECK constraint on grade.
export const MARKET_GRADES = [
  { key: 'STOCK',      label: 'Stock',      color: '#8a8f9c' },
  { key: 'CIVILIAN',   label: 'Civilian',   color: '#5a80d9' },
  { key: 'INDUSTRIAL', label: 'Industrial', color: '#5ce0a1' },
  { key: 'MILITARY',   label: 'Military',   color: '#c8a55a' },
  { key: 'PROTOTYPE',  label: 'Prototype',  color: '#a860e0' },
]

export function getGrade(key) {
  return MARKET_GRADES.find(g => g.key === key) || null
}

// ── Catalog. Free-text friendly: every field can be overridden on a
// listing, this is purely the suggestion source for the <datalist>.
export const CRAFTABLES = [
  // WEAPONS — FPS rifles
  { name: 'Karna Rifle',          manufacturer: 'Gemini',             category: 'WEAPON', grade: 'MILITARY', blurb: 'Military-grade assault rifle, balanced recoil.' },
  { name: 'P4-AR',                manufacturer: 'Behring',            category: 'WEAPON', grade: 'MILITARY', blurb: 'UEE Marines standard-issue assault rifle.' },
  { name: 'Arrowhead',            manufacturer: 'Klaus & Werner',     category: 'WEAPON', grade: 'MILITARY', blurb: 'Precision energy sniper rifle.' },
  { name: 'Scalpel',              manufacturer: 'Klaus & Werner',     category: 'WEAPON', grade: 'MILITARY', blurb: 'Long-range ballistic sniper.' },
  { name: 'Demeco LMG',           manufacturer: 'Klaus & Werner',     category: 'WEAPON', grade: 'MILITARY', blurb: 'Belt-fed energy LMG.' },
  { name: 'F55 LMG',              manufacturer: 'Kastak Arms',        category: 'WEAPON', grade: 'MILITARY', blurb: 'Sustained-fire ballistic LMG.' },
  { name: 'Custodian SMG',        manufacturer: 'Kastak Arms',        category: 'WEAPON', grade: 'CIVILIAN', blurb: 'Compact SMG favoured by security contractors.' },
  { name: 'Lumin V SMG',          manufacturer: 'Kastak Arms',        category: 'WEAPON', grade: 'CIVILIAN', blurb: 'Energy SMG with low recoil.' },
  { name: 'Devastator Shotgun',   manufacturer: 'Kastak Arms',        category: 'WEAPON', grade: 'CIVILIAN', blurb: 'Pump-action shotgun, breach & clear.' },
  { name: 'Ravager-212 Shotgun',  manufacturer: 'Behring',            category: 'WEAPON', grade: 'MILITARY', blurb: 'Military-pattern combat shotgun.' },
  // WEAPONS — FPS pistols
  { name: 'Coda Pistol',          manufacturer: 'Gemini',             category: 'WEAPON', grade: 'CIVILIAN', blurb: 'Heavy-caliber revolver.' },
  { name: 'LH-86 Pistol',         manufacturer: 'Gemini',             category: 'WEAPON', grade: 'CIVILIAN', blurb: 'Reliable ballistic sidearm.' },
  { name: 'Arclight II',          manufacturer: 'Klaus & Werner',     category: 'WEAPON', grade: 'CIVILIAN', blurb: 'Energy pistol with regenerating magazine.' },
  { name: 'Salvo Frag Pistol',    manufacturer: 'Kastak Arms',        category: 'WEAPON', grade: 'MILITARY', blurb: 'Explosive frag launcher in pistol form.' },

  // ARMOR
  { name: 'Novikov Light Armor',  manufacturer: 'Clark Defense Systems', category: 'ARMOR', grade: 'CIVILIAN', blurb: 'Scout-grade light armor.' },
  { name: 'Novikov Medium Armor', manufacturer: 'Clark Defense Systems', category: 'ARMOR', grade: 'CIVILIAN', blurb: 'Balanced medium loadout.' },
  { name: 'Novikov Heavy Armor',  manufacturer: 'Clark Defense Systems', category: 'ARMOR', grade: 'MILITARY', blurb: 'Heavy infantry plating.' },
  { name: 'Pembroke Light Armor', manufacturer: 'Kastak Arms',        category: 'ARMOR', grade: 'CIVILIAN', blurb: 'Operator-style light armor.' },
  { name: 'Artimex Medium Armor', manufacturer: 'Stor-Amor',          category: 'ARMOR', grade: 'CIVILIAN', blurb: 'Exploration-rated medium armor.' },
  { name: 'Paladin Heavy Armor',  manufacturer: 'Lynx Armor',         category: 'ARMOR', grade: 'MILITARY', blurb: 'Assault-grade heavy armor.' },
  { name: 'Overlord Heavy Armor', manufacturer: 'RSI',                category: 'ARMOR', grade: 'MILITARY', blurb: 'RSI-issue heavy combat armor.' },
  { name: 'Grenadier Heavy Armor',manufacturer: 'Clark Defense Systems', category: 'ARMOR', grade: 'MILITARY', blurb: 'Breacher loadout plating.' },
  { name: 'Vanduul-Hunter Armor', manufacturer: 'Shubin',             category: 'ARMOR', grade: 'PROTOTYPE', blurb: 'Experimental EVA-rated armor.' },

  // MEDICAL
  { name: 'MedPen (Cure)',        manufacturer: 'Cure',               category: 'MEDICAL', grade: 'CIVILIAN',   blurb: 'Standard field auto-injector.' },
  { name: 'Hemozal',              manufacturer: 'Cure',               category: 'MEDICAL', grade: 'INDUSTRIAL', blurb: 'Stops internal bleeding, stabilises BP.' },
  { name: 'Resurgera',            manufacturer: 'Cure',               category: 'MEDICAL', grade: 'MILITARY',   blurb: 'Revival compound for incapacitated operatives.' },
  { name: 'Detatrine',            manufacturer: 'Cure',               category: 'MEDICAL', grade: 'CIVILIAN',   blurb: 'Rapid rehydration injector.' },
  { name: 'OxyPen',               manufacturer: 'Cure',               category: 'MEDICAL', grade: 'CIVILIAN',   blurb: 'Emergency oxygen injector for EVA.' },
  { name: 'Roxaphen',             manufacturer: 'Cure',               category: 'MEDICAL', grade: 'INDUSTRIAL', blurb: 'High-grade analgesic, masks BDS symptoms.' },

  // TOOLS
  { name: 'Cambio-SRT Multi-tool',manufacturer: 'Greycat',            category: 'TOOL', grade: 'INDUSTRIAL', blurb: 'Standard issue multi-tool frame.' },
  { name: 'Pyro RYT Multi-tool',  manufacturer: 'Greycat',            category: 'TOOL', grade: 'INDUSTRIAL', blurb: 'Heavy-duty multi-tool frame.' },
  { name: 'Mining Attachment',    manufacturer: 'Greycat',            category: 'TOOL', grade: 'INDUSTRIAL', blurb: 'Hand-mining laser attachment.' },
  { name: 'Salvage Attachment',   manufacturer: 'Greycat',            category: 'TOOL', grade: 'INDUSTRIAL', blurb: 'Handheld hull-stripping beam.' },
  { name: 'Repair Attachment',    manufacturer: 'Greycat',            category: 'TOOL', grade: 'INDUSTRIAL', blurb: 'Field welder / hull patcher.' },
  { name: 'Tractor Attachment',   manufacturer: 'Greycat',            category: 'TOOL', grade: 'CIVILIAN',   blurb: 'Tractor beam for moving cargo.' },
  { name: 'Cutter Attachment',    manufacturer: 'Greycat',            category: 'TOOL', grade: 'INDUSTRIAL', blurb: 'High-power cutting laser.' },

  // CONSUMABLES
  { name: "Big Benny's Noodles",  manufacturer: "Big Benny's",        category: 'CONSUMABLE', grade: 'CIVILIAN', blurb: 'Shelf-stable instant noodles.' },
  { name: 'Wakalaka Nutri-block', manufacturer: 'Wakalaka',           category: 'CONSUMABLE', grade: 'CIVILIAN', blurb: 'Compressed nutrition block.' },
  { name: 'CalciPro Ration',      manufacturer: 'CalciPro',           category: 'CONSUMABLE', grade: 'CIVILIAN', blurb: 'Calcium-fortified ration bar.' },
  { name: 'GreenCircle Water',    manufacturer: 'GreenCircle',        category: 'CONSUMABLE', grade: 'STOCK',    blurb: 'Hydration pouch.' },
  { name: 'FlipNik Energy Drink', manufacturer: 'FlipNik',            category: 'CONSUMABLE', grade: 'CIVILIAN', blurb: 'Caffeinated ops-stimulant.' },

  // AMMO / ORDNANCE
  { name: 'Frag Grenade (Fernoast)', manufacturer: 'Fernoast',        category: 'AMMO', grade: 'MILITARY', blurb: 'Standard fragmentation grenade.' },
  { name: 'EMP Grenade (Dyne)',      manufacturer: 'Dyne',            category: 'AMMO', grade: 'MILITARY', blurb: 'Disables electronics in a small radius.' },
  { name: 'Smoke Grenade (Sawbuck)', manufacturer: 'Sawbuck',         category: 'AMMO', grade: 'CIVILIAN', blurb: 'Visual concealment, lingers ~30s.' },
  { name: 'Flashbang (FSK-8)',       manufacturer: 'FSK',             category: 'AMMO', grade: 'MILITARY', blurb: 'Breaching / crowd suppression grenade.' },
  { name: 'Breaching Charge',        manufacturer: 'Berenek',         category: 'AMMO', grade: 'MILITARY', blurb: 'Plants on doors, 5-second fuse.' },
  { name: '9.5mm AR Magazine',       manufacturer: 'Behring',         category: 'AMMO', grade: 'STOCK',    blurb: '30-round ballistic AR magazine.' },
  { name: '7.62mm LMG Belt',         manufacturer: 'Kastak Arms',     category: 'AMMO', grade: 'STOCK',    blurb: '100-round LMG belt.' },
  { name: '.50 Cal Sniper Mag',      manufacturer: 'Klaus & Werner',  category: 'AMMO', grade: 'STOCK',    blurb: 'Anti-materiel sniper magazine.' },
  { name: '20mm Shotgun Shells',     manufacturer: 'Behring',         category: 'AMMO', grade: 'STOCK',    blurb: '12-round shotgun shell pack.' },
]

// Fast lookup helper — category key → full catalog subset.
export function catalogFor(categoryKey) {
  if (!categoryKey) return CRAFTABLES
  return CRAFTABLES.filter(c => c.category === categoryKey)
}
