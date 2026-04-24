// Star Citizen gear + component catalog (Alpha 4.x era)
// Used as suggestion source for loadout builders via <datalist>. Catalog
// entries are advisory — the text inputs accept anything the user types so
// new patches / limited releases can still be logged without shipping a new
// build.
//
// Each category is a flat list of strings so <datalist> can render them
// directly. Keep entries canonical (manufacturer + model) to avoid duplicate
// styling variations.

// ─── SHIP COMPONENTS ───────────────────────────────────────────────────────
// Grouped by slot type. Size markers (S1, S2…) are included in the string
// so users can pick the right size at a glance.

export const SHIP_WEAPONS = [
  // Size 1 — ballistic
  'S1 Behring GT-210 Gatling',
  'S1 Klaus & Werner CF-117 Bulldog Repeater',
  'S1 Behring Sawbuck Scattergun',
  'S1 Gallenson Mantis GT-200',
  // Size 1 — energy
  'S1 Behring M3A Laser Cannon',
  'S1 Joker Suckerpunch Distortion',
  'S1 Klaus & Werner Neutron Mark-1',
  // Size 2 — ballistic
  'S2 Behring GT-220 Gatling',
  'S2 Klaus & Werner CF-227 Panther Repeater',
  'S2 Gallenson Mantis GT-220',
  'S2 Apocalypse Arms Scourge Railgun',
  // Size 2 — energy
  'S2 Behring AD4B Laser Cannon',
  'S2 Behring M4A Laser Cannon',
  'S2 MaxOx NN-13 Neutron',
  'S2 Joker Screech Distortion',
  'S2 Klaus & Werner 9-Series Longsword',
  // Size 3 — ballistic
  'S3 Behring GT-230 Gatling',
  'S3 Klaus & Werner CF-337 Panther Repeater',
  'S3 Gallenson Tarantula GT-870',
  'S3 Behring SW16BR3',
  // Size 3 — energy
  'S3 Behring AD5B Laser Cannon',
  'S3 MaxOx NN-14 Neutron',
  'S3 Klaus & Werner Attrition-3 Laser Repeater',
  'S3 Amon & Reese Omnisky VI',
  'S3 Behring M5A Laser Cannon',
  'S3 Preacher Inquisitor Scattergun',
  // Size 4
  'S4 Behring AD6B Laser Cannon',
  'S4 Klaus & Werner Attrition-4 Laser Repeater',
  'S4 Gallenson CF-447 Rhino Repeater',
  'S4 Hurston Dynamics Lightstrike II',
  'S4 Amon & Reese Omnisky IX',
  'S4 Behring M6A Laser Cannon',
  'S4 Preacher Distortion Scattergun',
  // Size 5
  'S5 Behring AD7B Laser Cannon',
  'S5 Klaus & Werner Attrition-5 Laser Repeater',
  'S5 MaxOx NN-15 Neutron',
  'S5 Hurston Dynamics Strife Mass Driver',
  // Size 6
  'S6 Behring M7A Laser Cannon',
  'S6 Gallenson Mantis-6 Gatling',
  'S6 Klaus & Werner Attrition-6 Laser Repeater',
  // Size 7
  'S7 Behring AD8B Laser Cannon',
  'S7 Klaus & Werner Attrition-7 Laser Repeater',
  // Size 8+
  'S8 Behring M9A Laser Cannon',
  'S9 Hurston Artemis-9',
  'S10 Behring Apocalypse Torpedo Launcher',
]

export const SHIP_MISSILES = [
  'S1 Arrester I IR',
  'S1 Firestorm I IR',
  'S1 Tempest I CS',
  'S2 Arrester II IR',
  'S2 Thunderbolt II CS',
  'S2 Stalker II CS',
  'S3 Strike Force III IR',
  'S3 Tempest III CS',
  'S3 Dominator III EM',
  'S4 Stalker IV CS',
  'S4 Arc Lightning IV EM',
  'S5 Typhoon V IR',
  'S5 Pillar V CS',
  'S6 Blaze VI Torpedo',
  'S7 Tempest VII Torpedo',
  'S9 Spartan IX Torpedo',
  'S10 Ordinance Delivery Torpedo',
]

export const SHIP_SHIELDS = [
  'S1 FR-66 (Civilian)',
  'S1 FR-76 (Civilian)',
  'S1 Yagi (Industrial)',
  'S1 Vigil (Military)',
  'S2 FR-76 (Civilian)',
  'S2 FR-86 (Civilian)',
  'S2 Palisade (Industrial)',
  'S2 Tempest II (Military)',
  'S3 FR-86 (Civilian)',
  'S3 Trainwreck (Industrial)',
  'S3 Avalanche (Military)',
  'S3 Sukoran (Industrial)',
  'S4 FR-96 (Civilian)',
  'S4 Kiesel (Industrial)',
  'S4 Aegis Dynamics Aegis (Military)',
  'S5 Ranger (Military)',
  'S6 Horizon (Industrial)',
  'S7 Stronghold (Military)',
]

export const SHIP_QUANTUM_DRIVES = [
  'VK-00 Beacon (Civilian)',
  'VK-00 Goliath (Industrial)',
  'XL-1 Long Jump (Civilian)',
  'J-Span Atlas (Civilian)',
  'J-Span Icarus (Military)',
  'J-Span Tarsus (Industrial)',
  'Wei-Tek Navigator (Civilian)',
  'Wei-Tek Expedition (Industrial)',
  'RSI Vortex II (Military)',
  'Amon & Reese Crossfield (Stealth)',
  'Jota Bolide (Size 2)',
  'Jota Radiant (Size 2)',
]

export const SHIP_POWER_PLANTS = [
  'Anvil JS-300 (Civilian)',
  'Voyage Erebus SR (Civilian)',
  'Voyage Slipstream (Industrial)',
  'Juno Starwerk Gemini (Military)',
  'Juno Starwerk Charger (Military)',
  'Aegis Dynamics StarHeart (Military)',
  'RSI Mercury (Civilian)',
  'Lightning Power SparkDrive (Industrial)',
  'Lightning Power Stronghold (Military)',
]

export const SHIP_COOLERS = [
  'Heliotrope Zero Rush (Civilian)',
  'Heliotrope Kestrel (Industrial)',
  'Heliotrope Polar (Military)',
  'Aegis FrostBurn (Military)',
  'Aegis Snowblind (Stealth)',
  'Reventon ICE (Industrial)',
  'JuiceBox (Civilian)',
]

export const SHIP_QED = [
  'Stor-All QED Dampener',
  'Klaus & Werner Quantum Jammer',
  'Wei-Tek QuantEnforcer',
  'RSI Snare (Interdictor)',
]

// ─── INFANTRY WEAPONS ──────────────────────────────────────────────────────

export const PRIMARY_WEAPONS = [
  // Rifles
  'Behring P4-AR (Ballistic Rifle)',
  'Behring P8-AR (Energy Rifle)',
  'Kastak Arms Karna (Ballistic Rifle)',
  'Kastak Arms Custodian (Ballistic SMG)',
  'Kastak Arms Lumin V (Energy SMG)',
  'Klaus & Werner Gallant (Energy Rifle)',
  'Klaus & Werner Demeco (Ballistic LMG)',
  'Gemini F55 (Ballistic LMG)',
  'Gemini L86 (Ballistic Rifle)',
  // Snipers
  'Klaus & Werner Arrowhead (Energy Sniper)',
  'Kastak Arms Atzkav (Ballistic Sniper)',
  'Apocalypse Arms Scalpel (Ballistic Sniper)',
  'Behring P6-LR (Ballistic Sniper)',
  // Shotguns
  'Kastak Arms Ravager-212 (Ballistic Shotgun)',
  'Behring BR-2 (Energy Shotgun)',
  'Devastator R97 (Ballistic Shotgun)',
  // Special
  'Esperia Rhino Railgun (EM)',
  'Apocalypse Arms Animus (Ballistic LMG)',
  'Greycat FSK-8 Grenade Launcher',
]

export const SECONDARY_WEAPONS = [
  'Behring P4-SC (Ballistic Pistol)',
  'Behring P8-SC (Energy Pistol)',
  'Behring S-38 (Ballistic Pistol)',
  'Klaus & Werner Arclight II (Energy Pistol)',
  'Klaus & Werner Salvo (Frag Pistol)',
  'Kastak Arms Coda (Ballistic Pistol)',
  'Kastak Arms LH86 (Ballistic Pistol)',
  'Gemini LH86 (Ballistic Pistol)',
  'Apocalypse Arms Yubarev (Energy Pistol)',
]

export const MELEE_WEAPONS = [
  'Kastak Arms Pyro Knife',
  'Civilian Combat Knife',
  'Hurston Security Baton',
  'Greycat Multi-tool (Blunt)',
]

export const THROWABLES = [
  'Behring FSK-8 Frag Grenade',
  'Behring FSK-9 Smoke Grenade',
  'Voltaic Disruptor EMP Grenade',
  'Stor-All Incendiary Grenade',
  'Hurston Flashbang',
  'CureLife Medical Smoke',
]

export const TOOLS = [
  'Greycat Cambio-SRT (Medical)',
  'Greycat Multi-tool (Base)',
  'Greycat OreBit Mining Attachment',
  'Greycat Cutter Salvage Attachment',
  'Greycat Healing Beam Attachment',
  'Greycat Tractor Beam Attachment',
  'Greycat Repair Attachment',
  'Klaus & Werner MT Scanner',
  'Stor-All Cargo Tool',
]

export const MEDICAL_GEAR = [
  'Cure MedPen (Healing)',
  'Cure OxyPen (Oxygen)',
  'Hemozal (Bleed stop)',
  'Resurgera (Revive)',
  'Roxaphen-T (Analgesic)',
  'Demexatrine (Stimulant)',
  'Adrenaval (Combat stim)',
  'Detatrine (Detox)',
  'Sterogen (Stamina)',
]

export const CONSUMABLES = [
  "Big Benny's Noodles",
  'CureLife Protein Bar',
  'CryAstro Water',
  'Moon Pops',
  'Flashfire Energy Drink',
  'Urban Green Tea',
  'Vanduul Moonshine',
]

// ─── ARMOR ─────────────────────────────────────────────────────────────────
// Armor pieces come in helmet / core (chest+back) / arms / legs / backpack /
// undersuit. Each brand ships a set; we list the canonical named sets plus
// loose pieces that are worth calling out.

export const ARMOR_HELMETS = [
  'Clark Defense RRS Light Helmet',
  'Stor-Amor Novikov Medium Helmet',
  'Stor-Amor Paladin Heavy Helmet',
  'CDF Overlord Heavy Helmet',
  'Pembrook Industrial Heavy Helmet',
  'Artimex Medium Helmet',
  'ODP Heavy Helmet',
  'Venture Medium Helmet',
  'Strix EVA Helmet',
  'Silverline Heavy Helmet',
  'Drake Cutlass Pirate Helmet',
  'RSI Mantis Helmet',
  'Concept-C Medium Helmet',
  'ORC-mkX Outlander Helmet',
  'Caldera Heavy Tower Helmet',
]

export const ARMOR_CORES = [
  'Clark Defense RRS Light Core',
  'Stor-Amor Novikov Medium Core',
  'Stor-Amor Paladin Heavy Core',
  'CDF Overlord Heavy Core',
  'Pembrook Industrial Heavy Core',
  'Artimex Medium Core',
  'ODP Heavy Core',
  'Venture Medium Core',
  'Strix EVA Core',
  'Silverline Heavy Core',
  'Drake Cutlass Pirate Core',
  'RSI Mantis Core',
  'Concept-C Medium Core',
  'ORC-mkX Outlander Core',
  'Caldera Heavy Tower Core',
]

export const ARMOR_ARMS = [
  'Clark Defense RRS Light Arms',
  'Stor-Amor Novikov Medium Arms',
  'Stor-Amor Paladin Heavy Arms',
  'CDF Overlord Heavy Arms',
  'Pembrook Industrial Arms',
  'Artimex Medium Arms',
  'ODP Heavy Arms',
  'Venture Medium Arms',
  'Silverline Heavy Arms',
  'Concept-C Medium Arms',
  'ORC-mkX Outlander Arms',
]

export const ARMOR_LEGS = [
  'Clark Defense RRS Light Legs',
  'Stor-Amor Novikov Medium Legs',
  'Stor-Amor Paladin Heavy Legs',
  'CDF Overlord Heavy Legs',
  'Pembrook Industrial Legs',
  'Artimex Medium Legs',
  'ODP Heavy Legs',
  'Venture Medium Legs',
  'Silverline Heavy Legs',
  'Concept-C Medium Legs',
  'ORC-mkX Outlander Legs',
]

export const ARMOR_BACKPACKS = [
  'CureLife Medical Backpack',
  'Stor-All Ammo Backpack',
  'Greycat Mining Backpack',
  'Lightweight Utility Backpack',
  'Heavy Tactical Backpack',
  'ARC Core Backpack',
  'Pembrook Oxygen Pack',
]

export const ARMOR_UNDERSUITS = [
  'Stor-Amor Core Suit',
  'Argo Astronautics Pilot Suit',
  'RSI Platinum Undersuit',
  'Venture Exploration Undersuit',
  'Drake Pirate Undersuit',
  'Civilian Flight Suit',
  'Hurston Security Undersuit',
]

// ─── ARCHETYPE PRESETS ─────────────────────────────────────────────────────
// Used as dropdown suggestions for the "ARCHETYPE" field when creating a
// weapon or armor loadout.

export const WEAPON_ARCHETYPES = [
  'Assault',
  'Sniper / Marksman',
  'Breacher / Shotgun',
  'SMG / CQB',
  'Anti-Armor',
  'Support / LMG',
  'Stealth / Silent',
  'Medic',
  'Boarding',
  'Bounty Hunter',
]

export const ARMOR_ARCHETYPES = [
  'Light Recon',
  'Light Infiltration',
  'Medium Utility',
  'Medium Assault',
  'Heavy Assault',
  'Heavy Breacher',
  'EVA / Zero-G',
  'Medic Support',
  'Mining / Salvage',
  'Pilot Flight',
]

// ─── HELPER EXPORTS ────────────────────────────────────────────────────────

export const WEAPON_SLOTS = [
  { key: 'primary',     label: 'PRIMARY',     list: PRIMARY_WEAPONS,   color: '#e05c5c', glyph: '▲' },
  { key: 'secondary',   label: 'SECONDARY',   list: PRIMARY_WEAPONS,   color: '#e0a155', glyph: '▼' },
  { key: 'sidearm',     label: 'SIDEARM',     list: SECONDARY_WEAPONS, color: '#5a80d9', glyph: '◆' },
  { key: 'melee',       label: 'MELEE',       list: MELEE_WEAPONS,     color: '#a860e0', glyph: '✱' },
  { key: 'throwables',  label: 'THROWABLES',  list: THROWABLES,        color: '#c8a55a', glyph: '◉' },
  { key: 'tool',        label: 'TOOL',        list: TOOLS,             color: '#5ce0a1', glyph: '⚙' },
  { key: 'medical',     label: 'MEDICAL',     list: MEDICAL_GEAR,      color: '#4ad9d9', glyph: '✚' },
  { key: 'consumables', label: 'CONSUMABLES', list: CONSUMABLES,       color: '#b4b8c4', glyph: '●' },
]

export const ARMOR_SLOTS = [
  { key: 'helmet',    label: 'HELMET',    list: ARMOR_HELMETS,    color: '#c8a55a', glyph: '◈' },
  { key: 'core',      label: 'CORE',      list: ARMOR_CORES,      color: '#5a80d9', glyph: '▣' },
  { key: 'arms',      label: 'ARMS',      list: ARMOR_ARMS,       color: '#5ce0a1', glyph: '◐' },
  { key: 'legs',      label: 'LEGS',      list: ARMOR_LEGS,       color: '#e0a155', glyph: '◑' },
  { key: 'backpack',  label: 'BACKPACK',  list: ARMOR_BACKPACKS,  color: '#a860e0', glyph: '▦' },
  { key: 'undersuit', label: 'UNDERSUIT', list: ARMOR_UNDERSUITS, color: '#4ad9d9', glyph: '◇' },
]

export const SHIP_SLOTS = [
  { key: 'weapons',    label: 'WEAPONS',       list: SHIP_WEAPONS,        color: '#e05c5c', glyph: '◤', short: 'WPN' },
  { key: 'missiles',   label: 'MISSILES',      list: SHIP_MISSILES,       color: '#e0a155', glyph: '▲', short: 'MSL' },
  { key: 'shields',    label: 'SHIELDS',       list: SHIP_SHIELDS,        color: '#5a80d9', glyph: '◉', short: 'SHD' },
  { key: 'qd',         label: 'QUANTUM DRIVE', list: SHIP_QUANTUM_DRIVES, color: '#c8a55a', glyph: '◆', short: 'QD'  },
  { key: 'powerplant', label: 'POWER PLANT',   list: SHIP_POWER_PLANTS,   color: '#c8a55a', glyph: '◎', short: 'PWR' },
  { key: 'coolers',    label: 'COOLERS',       list: SHIP_COOLERS,        color: '#5ce0a1', glyph: '❄', short: 'CLR' },
  { key: 'qed',        label: 'QED / JAMMER',  list: SHIP_QED,            color: '#a860e0', glyph: '◇', short: 'QED' },
  { key: 'other',      label: 'OTHER',         list: [],                  color: '#b4b8c4', glyph: '●', short: 'OTH' },
]
