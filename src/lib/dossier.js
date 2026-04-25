// Dossier export — builds self-contained, UEE-styled HTML documents that
// open in a new browser tab. From there the user can:
//   * hit Print → Save as PDF   (browser-native, preserves exact colors)
//   * Save As → .html            (shareable / embeddable anywhere)
//
// No runtime dependency: styling is fully embedded. Colors are protected
// with `print-color-adjust: exact` so the amber classification chrome
// survives the Save-as-PDF step in Chromium, Firefox, and Safari.

const UEE_AMBER = '#c8a55a'

// ─── CSS (inlined) ─────────────────────────────────────────────────────────
// Page-safe typography. Use system font stacks so the file renders the
// same everywhere without embedding font binaries.
const BASE_CSS = /* css */ `
  :root {
    --amber:   ${UEE_AMBER};
    --amber-d: #a8874a;
    --ink-1:   #1a1a1f;
    --ink-2:   #4a4f5a;
    --ink-3:   #7a7f8a;
    --line:    #d6d3c9;
    --paper:   #f5f3ec;
    --paper-2: #ece9dd;
    --accent-red: #b14040;
    --accent-blu: #3a63b5;
    --accent-grn: #3d8f5b;
    --accent-vio: #7a4aaa;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #2a2a30; }
  body {
    font-family: 'Inter', 'Helvetica Neue', Arial, system-ui, sans-serif;
    color: var(--ink-1);
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    max-width: 820px;
    margin: 24px auto;
    background: var(--paper);
    background-image:
      linear-gradient(180deg, rgba(200,165,90,.04), transparent 80%),
      repeating-linear-gradient(0deg, transparent 0, transparent 27px, rgba(0,0,0,.025) 27px, rgba(0,0,0,.025) 28px);
    box-shadow: 0 10px 40px rgba(0,0,0,.4);
    position: relative;
    overflow: hidden;
  }
  .bar-top, .bar-bot {
    display: flex; align-items: center; gap: 18px;
    padding: 10px 28px;
    background: var(--amber);
    color: #1a1a1f;
    font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
    font-size: 10px;
    letter-spacing: .22em;
    text-transform: uppercase;
    font-weight: 600;
  }
  .bar-bot { border-top: 3px double #1a1a1f22; font-size: 9px; opacity: .9; }
  .bar-top::before, .bar-bot::before {
    content: ''; width: 8px; height: 8px; border-radius: 50%;
    background: #1a1a1f; flex-shrink: 0;
  }
  .spacer { flex: 1; }

  .doc {
    padding: 40px 48px 32px;
    position: relative;
  }
  /* amber vertical accent bar on the left inside the sheet */
  .doc::before {
    content: ''; position: absolute; left: 28px; top: 28px; bottom: 28px; width: 2px;
    background: linear-gradient(180deg, var(--amber), transparent 90%);
    opacity: .6;
  }

  .head {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 22px;
    align-items: center;
    padding-bottom: 22px;
    margin-bottom: 24px;
    border-bottom: 1px solid var(--line);
  }
  .seal {
    width: 72px; height: 72px;
    clip-path: polygon(25% 2%, 75% 2%, 98% 50%, 75% 98%, 25% 98%, 2% 50%);
    background: var(--amber);
    display: grid; place-items: center;
    color: #1a1a1f;
    font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
    font-size: 20px; font-weight: 700; letter-spacing: .08em;
    box-shadow: 0 0 0 2px rgba(200,165,90,.3);
  }
  .title-block .kicker {
    font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
    font-size: 10px; letter-spacing: .3em; color: var(--amber-d);
    text-transform: uppercase; margin-bottom: 4px;
  }
  .title-block h1 {
    margin: 0; font-size: 22px; font-weight: 700; letter-spacing: .02em;
    color: var(--ink-1);
  }
  .title-block .sub {
    font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
    font-size: 11px; letter-spacing: .15em; color: var(--ink-2);
    margin-top: 5px; text-transform: uppercase;
  }

  .stamp {
    text-align: right;
    font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
    font-size: 9px; line-height: 1.7; letter-spacing: .14em;
    color: var(--ink-2);
    text-transform: uppercase;
  }
  .stamp .big {
    display: block; font-size: 11px; font-weight: 700; color: var(--ink-1); letter-spacing: .18em;
  }

  .meta-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 24px;
  }
  .meta {
    padding: 10px 12px;
    background: rgba(200,165,90,.07);
    border: 1px solid var(--line);
    border-left: 3px solid var(--amber);
  }
  .meta .k {
    font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
    font-size: 8px; letter-spacing: .22em; color: var(--ink-3);
    text-transform: uppercase; margin-bottom: 3px;
  }
  .meta .v {
    font-size: 13px; font-weight: 600; color: var(--ink-1);
  }

  .section {
    margin-bottom: 24px;
    page-break-inside: avoid;
  }
  .section-h {
    display: flex; align-items: center; gap: 14px;
    font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
    font-size: 10px; letter-spacing: .25em; text-transform: uppercase;
    color: var(--amber-d);
    margin-bottom: 12px;
  }
  .section-h::before {
    content: '◆'; font-size: 11px; color: var(--amber);
  }
  .section-h::after {
    content: ''; flex: 1; height: 1px;
    background: linear-gradient(90deg, var(--amber), transparent);
  }

  .prose {
    font-size: 13px; color: var(--ink-2); line-height: 1.65;
    padding: 14px 16px;
    background: rgba(255,255,255,.4);
    border-left: 2px solid var(--amber);
    margin-bottom: 16px;
  }

  .slots {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .slot {
    padding: 10px 12px;
    background: rgba(255,255,255,.5);
    border: 1px solid var(--line);
    border-left: 3px solid var(--ink-3);
  }
  .slot.filled { border-left-color: var(--amber); }
  .slot .k {
    font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
    font-size: 9px; letter-spacing: .18em; color: var(--amber-d);
    text-transform: uppercase; margin-bottom: 3px;
  }
  .slot.empty .k { color: var(--ink-3); }
  .slot .v { font-size: 12px; color: var(--ink-1); }
  .slot.empty .v { color: var(--ink-3); font-style: italic; }

  .grid-4 {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
  }
  .cell {
    padding: 12px 10px; text-align: center;
    background: rgba(255,255,255,.5);
    border: 1px solid var(--line);
  }
  .cell .num {
    font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
    font-size: 20px; font-weight: 700; color: var(--ink-1);
  }
  .cell .num.amber { color: var(--amber-d); }
  .cell .lbl {
    font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
    font-size: 8px; letter-spacing: .22em; color: var(--ink-3);
    text-transform: uppercase; margin-top: 4px;
  }

  /* Roster table — used by op briefings to list signups
     with handle, role, ship, and RSVP status. */
  .roster {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  .roster th, .roster td {
    text-align: left;
    padding: 7px 10px;
    border-bottom: 1px solid var(--line);
  }
  .roster th {
    font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
    font-size: 8.5px; letter-spacing: .22em; color: var(--amber-d);
    text-transform: uppercase; font-weight: 700;
    background: rgba(200,165,90,.08);
    border-bottom: 2px solid var(--amber);
  }
  .roster td.handle { font-weight: 600; color: var(--ink-1); }
  .roster td.role,
  .roster td.ship  { font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace; color: var(--ink-2); font-size: 10.5px; letter-spacing: .04em; }
  .roster td.rsvp  {
    font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
    font-size: 9px; letter-spacing: .2em; font-weight: 700;
    text-transform: uppercase;
  }
  .roster td.rsvp.go    { color: var(--accent-grn); }
  .roster td.rsvp.maybe { color: var(--amber-d); }
  .roster td.rsvp.other { color: var(--ink-3); }
  .roster tr:last-child td { border-bottom: none; }

  .chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 10px;
    background: rgba(255,255,255,.5);
    border: 1px solid var(--line);
    font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
    font-size: 10px; letter-spacing: .1em; color: var(--ink-2);
    text-transform: uppercase;
  }
  .chip::before { content: '◉'; font-size: 8px; color: var(--amber); }

  .sig {
    margin-top: 32px; padding-top: 16px;
    border-top: 1px dashed var(--line);
    display: flex; justify-content: space-between; align-items: flex-end;
    font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
    font-size: 9px; letter-spacing: .2em; color: var(--ink-3);
    text-transform: uppercase;
  }
  .sig .line {
    width: 220px; border-bottom: 1px solid var(--ink-2); padding-bottom: 3px;
    font-size: 10px; color: var(--ink-1);
  }
  .sig .caption { margin-top: 4px; }

  .watermark {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-22deg);
    font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
    font-size: 140px; font-weight: 900;
    color: rgba(200,165,90,.06);
    letter-spacing: .3em;
    pointer-events: none;
    white-space: nowrap;
    user-select: none;
  }

  /* Floating FAB in viewing mode (not printed) */
  .fab {
    position: fixed;
    bottom: 24px; right: 24px;
    display: flex; gap: 8px;
    font-family: 'JetBrains Mono', 'Menlo', 'Consolas', monospace;
  }
  .fab button {
    padding: 10px 18px;
    border: none; cursor: pointer;
    font-family: inherit;
    font-size: 11px; letter-spacing: .16em; font-weight: 600;
    background: var(--amber); color: #1a1a1f;
    box-shadow: 0 4px 16px rgba(0,0,0,.4);
    text-transform: uppercase;
  }
  .fab button.ghost { background: #2a2a30; color: #e8e6de; }
  .fab button:hover { filter: brightness(1.1); }

  /* Print rules — pin page size, hide FAB, shrink margins */
  @page { size: A4; margin: 14mm; }
  @media print {
    html, body { background: #fff; }
    .sheet { margin: 0; box-shadow: none; max-width: none; }
    .fab { display: none !important; }
  }
`

// ─── Helpers ───────────────────────────────────────────────────────────────
function esc(s) {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function todayStr() {
  return new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).toUpperCase()
}
function fmt(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).toUpperCase()
}
function citizenId(uuid) {
  return 'GV-' + (uuid || '').replace(/-/g, '').slice(0, 8).toUpperCase()
}
function fileNo(prefix, uuid) {
  const tail = (uuid || '').replace(/-/g, '').slice(-6).toUpperCase()
  return `${prefix}-${todayStr().replace(/ /g, '')}-${tail}`
}
function initials(handle) {
  if (!handle) return '??'
  const parts = handle.replace(/[-_.]/g, ' ').split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return handle.slice(0, 2).toUpperCase()
}

// ─── Template ──────────────────────────────────────────────────────────────
function buildDossierHTML({ title, subtitle, kicker, watermark, sealText, fileNumber, sections, filename }) {
  const pieces = sections.map(s => {
    if (s.type === 'prose') return `<div class="section"><div class="section-h">${esc(s.heading)}</div><div class="prose">${esc(s.body)}</div></div>`
    if (s.type === 'meta')  return `<div class="section"><div class="meta-grid">${s.items.map(m => `<div class="meta"><div class="k">${esc(m.k)}</div><div class="v">${esc(m.v)}</div></div>`).join('')}</div></div>`
    if (s.type === 'slots') return `<div class="section"><div class="section-h">${esc(s.heading)}</div><div class="slots">${s.items.map(it => `<div class="slot ${it.v ? 'filled' : 'empty'}"><div class="k">${esc(it.k)}</div><div class="v">${esc(it.v || '— empty —')}</div></div>`).join('')}</div></div>`
    if (s.type === 'stats') return `<div class="section"><div class="section-h">${esc(s.heading)}</div><div class="grid-4">${s.items.map(it => `<div class="cell"><div class="num ${it.amber ? 'amber' : ''}">${esc(it.v)}</div><div class="lbl">${esc(it.k)}</div></div>`).join('')}</div></div>`
    if (s.type === 'chips') return `<div class="section"><div class="section-h">${esc(s.heading)}</div><div class="chip-row">${s.items.map(it => `<span class="chip">${esc(it)}</span>`).join('') || '<span style="font-size:11px;color:var(--ink-3);font-style:italic">— none on file —</span>'}</div></div>`
    if (s.type === 'roster') {
      // Multi-column table — handle / role / ship / rsvp.
      // Used by op briefings to print the confirmed-going list.
      if (!s.items.length) {
        return `<div class="section"><div class="section-h">${esc(s.heading)}</div><div style="font-size:11px;color:var(--ink-3);font-style:italic">— roster empty —</div></div>`
      }
      const rsvpClass = v => {
        const u = (v || '').toUpperCase()
        if (u === 'CONFIRMED' || u === 'GOING')  return 'go'
        if (u === 'TENTATIVE' || u === 'MAYBE')  return 'maybe'
        return 'other'
      }
      const rows = s.items.map(it => `<tr>
        <td class="handle">${esc(it.handle)}</td>
        <td class="role">${esc(it.role || '—')}</td>
        <td class="ship">${esc(it.ship || '—')}</td>
        <td class="rsvp ${rsvpClass(it.rsvp)}">${esc((it.rsvp || '').toUpperCase() || 'PENDING')}</td>
      </tr>`).join('')
      return `<div class="section">
        <div class="section-h">${esc(s.heading)}</div>
        <table class="roster">
          <thead><tr>
            <th>OPERATIVE</th><th>ROLE</th><th>SHIP</th><th>RSVP</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
    }
    return ''
  }).join('\n')

  return /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(filename || title)}</title>
<style>${BASE_CSS}</style>
</head>
<body>
<div class="sheet">
  <div class="bar-top">
    <span>UEE · GRAYVEIL CORP</span><span>//</span>
    <span>${esc(kicker || 'OFFICIAL DOSSIER')}</span>
    <span class="spacer"></span>
    <span>CLR · RESTRICTED</span>
  </div>

  <div class="doc">
    ${watermark ? `<div class="watermark">${esc(watermark)}</div>` : ''}
    <div class="head">
      <div class="seal">${esc(sealText || 'GV')}</div>
      <div class="title-block">
        <div class="kicker">${esc(kicker || 'Dossier')}</div>
        <h1>${esc(title)}</h1>
        ${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ''}
      </div>
      <div class="stamp">
        <span class="big">FILE · ${esc(fileNumber)}</span>
        ISSUED ${todayStr()}<br>
        CERT. GRAYVEIL HQ<br>
        REV 01
      </div>
    </div>

    ${pieces}

    <div class="sig">
      <div>
        <div class="line">&nbsp;</div>
        <div class="caption">SIGNATORY · FILING OFFICER</div>
      </div>
      <div style="text-align:right">
        END OF RECORD<br>
        <span style="font-size:14px;color:var(--amber-d);letter-spacing:.3em">◆◆◆</span>
      </div>
    </div>
  </div>

  <div class="bar-bot">
    <span>UEE REGISTRY</span><span>//</span>
    <span>${esc(fileNumber)}</span>
    <span class="spacer"></span>
    <span>PAGE 01 · ${todayStr()}</span>
  </div>
</div>

<div class="fab">
  <button onclick="window.print()">⎙ PRINT / SAVE AS PDF</button>
  <button class="ghost" id="save-btn">↓ SAVE .HTML</button>
  <button class="ghost" onclick="window.close()">CLOSE</button>
</div>
<script>
  // Let the tab save a copy of itself as a .html file. Useful for
  // archiving or sharing outside the browser (Discord attachment, email).
  (function () {
    var btn = document.getElementById('save-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var html = '<!doctype html>\\n' + document.documentElement.outerHTML;
      var blob = new Blob([html], { type: 'text/html' });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href = url;
      a.download = ${JSON.stringify(filename || 'dossier.html')};
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    });
  })();
</script>
</body>
</html>`
}

// ─── Builders per subject ──────────────────────────────────────────────────

/**
 * Citizen Dossier — profile summary document.
 * @param {Object} profile  the full profile row (with wallet_balance, credit_score, division, etc.)
 * @param {Object} extras   { medals:[], certs:[], ships:[], stats:{} }
 */
export function buildCitizenDossier(profile, extras = {}) {
  const { medals = [], certs = [], ships = [], stats = {} } = extras
  const cid = citizenId(profile.id)
  const fileNumber = fileNo('UEE-CITIZEN', profile.id)

  const sections = [
    {
      type: 'meta',
      items: [
        { k: 'HANDLE',       v: profile.handle || '—' },
        { k: 'RANK',         v: profile.rank || '—' },
        { k: 'TIER',         v: `T${profile.tier ?? '—'}` },
        { k: 'STATUS',       v: profile.status || 'ACTIVE' },
        { k: 'DIVISION',     v: profile.division || '— UNASSIGNED —' },
        { k: 'SPECIALITY',   v: profile.speciality || '— UNASSIGNED —' },
        { k: 'CERT. DATE',   v: fmt(profile.joined_at) },
        { k: 'LAST SEEN',    v: fmt(profile.last_seen_at) },
      ],
    },
  ]

  if (profile.motto) {
    sections.push({ type: 'prose', heading: 'Personal Motto', body: profile.motto })
  }
  if (profile.bio) {
    sections.push({ type: 'prose', heading: 'Operational Notes', body: profile.bio })
  }

  sections.push({
    type: 'stats',
    heading: 'Service Metrics',
    items: [
      { k: 'UEC BALANCE', v: (profile.wallet_balance ?? 0).toLocaleString(), amber: true },
      { k: 'CREDIT',      v: String(profile.credit_score ?? '—'), amber: true },
      { k: 'REP',         v: String(profile.rep_score ?? 0) },
      { k: 'KILLS',       v: String(stats.kills ?? 0) },
      { k: 'ASSISTS',     v: String(stats.assists ?? 0) },
      { k: 'CONTRACTS',   v: String(stats.contracts ?? 0) },
      { k: 'INTEL',       v: String(stats.intel ?? 0) },
      { k: 'SHIPS',       v: String(ships.length) },
    ],
  })

  sections.push({
    type: 'chips',
    heading: 'Commendations',
    items: medals.map(m => (m.medal?.name || m.medal?.title || '').toUpperCase()).filter(Boolean),
  })

  sections.push({
    type: 'chips',
    heading: 'Certifications',
    items: certs.map(c => (c.cert?.name || c.cert?.title || '').toUpperCase()).filter(Boolean),
  })

  if (ships.length) {
    sections.push({
      type: 'chips',
      heading: 'Assigned Vessels',
      items: ships.map(s => (s.name || s.ship_class || '').toUpperCase()).filter(Boolean),
    })
  }

  return {
    html: buildDossierHTML({
      kicker:      'Citizen Dossier',
      title:       profile.handle || 'UNKNOWN CITIZEN',
      subtitle:    `${cid} · ${profile.rank || 'UNRANKED'}`,
      sealText:    initials(profile.handle),
      fileNumber,
      watermark:   'OFFICIAL',
      sections,
    }),
    filename: `${(profile.handle || 'citizen').replace(/[^\w.-]+/g, '_')}_dossier_${new Date().toISOString().slice(0,10)}.html`,
  }
}

/**
 * Loadout Brief — ship / weapon / armor build summary.
 * @param {Object} loadout  row from ship_loadouts, weapon_loadouts, or armor_loadouts
 * @param {Object} kind     { key, label, slots:[{key,label}] }  (from Loadouts.jsx KINDS)
 */
export function buildLoadoutBrief(loadout, kind) {
  const comp = loadout.components || {}
  const subtitle = kind.key === 'ship' ? loadout.ship_class : loadout.archetype
  const fileNumber = fileNo('LOAD', loadout.id)

  const sections = [
    {
      type: 'meta',
      items: [
        { k: 'ARCHIVE', v: kind.label },
        { k: 'ROLE',    v: loadout.role || '—' },
        { k: 'FILED',   v: fmt(loadout.created_at) },
        { k: 'AUTHOR',  v: loadout.author?.handle || '—' },
      ],
    },
  ]

  if (loadout.description) {
    sections.push({ type: 'prose', heading: 'Tactical Notes', body: loadout.description })
  }

  sections.push({
    type: 'slots',
    heading: 'Components',
    items: kind.slots.map(s => ({ k: s.label, v: comp[s.key] || '' })),
  })

  return {
    html: buildDossierHTML({
      kicker:     `${kind.label} BRIEF`,
      title:      loadout.name || 'UNTITLED LOADOUT',
      subtitle:   subtitle ? subtitle.toUpperCase() : '',
      sealText:   kind.glyph || '◆',
      fileNumber,
      watermark:  'BRIEF',
      sections,
    }),
    filename: `${(loadout.name || 'loadout').replace(/[^\w.-]+/g, '_')}_brief_${new Date().toISOString().slice(0,10)}.html`,
  }
}

/**
 * Op Briefing — printable handout for a scheduled operation.
 * Includes meta strip (type, location, launch, T-minus, tier),
 * the full briefing prose, optional ship list chips, and a
 * roster table broken into CONFIRMED / TENTATIVE.
 *
 * @param {Object} event   row from `events`
 * @param {Array}  signups rows from `event_signups` for this event
 * @param {Object} opts    { organizerHandle, location }
 */
export function buildOpBriefing(event, signups = [], opts = {}) {
  const { organizerHandle } = opts
  const fileNumber = fileNo('OP', event.id)
  const launch = event.starts_at ? new Date(event.starts_at) : null
  const ends   = event.ends_at   ? new Date(event.ends_at)   : null

  const tMinus = (() => {
    if (!launch) return '—'
    const diff = launch - Date.now()
    if (diff <= 0) {
      // Already started: show how long the op has been running, or "underway"
      const elapsed = Math.abs(diff)
      const h = Math.floor(elapsed / 3600000)
      return h > 0 ? `LIVE · T+${h}H` : 'LIVE · NOW'
    }
    const h = Math.floor(diff / 3600000)
    const d = Math.floor(h / 24)
    if (d > 0) return `T-${d}D ${h % 24}H`
    if (h > 0) return `T-${h}H ${Math.floor((diff % 3600000) / 60000)}M`
    return `T-${Math.floor(diff / 60000)}M`
  })()

  const sections = [
    {
      type: 'meta',
      items: [
        { k: 'STATUS',     v: event.status || 'SCHEDULED' },
        { k: 'TYPE',       v: event.event_type || 'OPERATION' },
        { k: 'LOCATION',   v: event.location || '— TBD —' },
        { k: 'LAUNCH',     v: launch ? launch.toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase() : '— TBD —' },
        { k: 'T-MINUS',    v: tMinus },
        { k: 'WINDOW',     v: ends ? `→ ${ends.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : '— OPEN —' },
        { k: 'MIN TIER',   v: `T-${event.min_tier ?? 9}` },
        { k: 'ORGANIZER',  v: organizerHandle || '—' },
      ],
    },
  ]

  if (event.description) {
    sections.push({ type: 'prose', heading: 'Operation Briefing', body: event.description })
  }

  // Slot/capacity strip — quick read on roster fill rate.
  const confirmed = signups.filter(s => s.status === 'CONFIRMED')
  const tentative = signups.filter(s => s.status === 'TENTATIVE')
  const cap = event.max_slots
  sections.push({
    type: 'stats',
    heading: 'Roster Status',
    items: [
      { k: 'CONFIRMED', v: String(confirmed.length), amber: true },
      { k: 'TENTATIVE', v: String(tentative.length) },
      { k: 'CAPACITY',  v: cap ? String(cap) : '∞' },
      { k: 'OPEN',      v: cap ? String(Math.max(cap - confirmed.length, 0)) : '∞' },
    ],
  })

  if (confirmed.length > 0) {
    sections.push({
      type: 'roster',
      heading: 'Confirmed Roster',
      items: confirmed.map(s => ({
        handle: s.member?.handle || (s.member_id || '').slice(0, 8),
        role:   s.role,
        ship:   s.ship_class,
        rsvp:   'CONFIRMED',
      })),
    })
  }
  if (tentative.length > 0) {
    sections.push({
      type: 'roster',
      heading: 'Tentative Roster',
      items: tentative.map(s => ({
        handle: s.member?.handle || (s.member_id || '').slice(0, 8),
        role:   s.role,
        ship:   s.ship_class,
        rsvp:   'TENTATIVE',
      })),
    })
  }

  return {
    html: buildDossierHTML({
      kicker:    'Operation Briefing',
      title:     event.title || 'UNTITLED OPERATION',
      subtitle:  `${(event.event_type || 'OPERATION').toUpperCase()}${event.location ? ' · ' + event.location.toUpperCase() : ''}`,
      sealText:  '◉',
      fileNumber,
      watermark: 'OP BRIEF',
      sections,
    }),
    filename: `${(event.title || 'operation').replace(/[^\w.-]+/g, '_')}_briefing_${new Date().toISOString().slice(0,10)}.html`,
  }
}

/**
 * Annual Report — org-wide year-end summary.
 *
 * Pulls org totals, top operatives by metric, division roll-ups,
 * and the headline ops of the year. Designed for one-page print
 * or sharing as an HTML attachment.
 *
 * @param {Object} data    — pre-aggregated stats from the caller
 *   {
 *     year, generated_by,
 *     totals: {
 *       members_active, members_joined,
 *       ops_run, ops_cancelled,
 *       contracts_completed, contracts_pool,
 *       kills, assists, deaths,
 *       bounties_collected, bounty_pool,
 *       intel_filed, aars_filed,
 *       loot_distributed, treasury_balance,
 *       medals_awarded
 *     },
 *     top: {
 *       kills:     [{ handle, value }],
 *       contracts: [{ handle, value }],
 *       loot:      [{ handle, value }],
 *       rep:       [{ handle, value }]
 *     },
 *     divisions: [{ name, members }],
 *     headlineOps: [{ title, outcome, attendees, loot }]
 *   }
 */
export function buildAnnualReport(data) {
  const { year, generated_by, totals = {}, top = {}, divisions = [], headlineOps = [] } = data
  const fileNumber = fileNo('UEE-AR', `${year}-grayveil`)

  const sections = [
    // ─── Headline corp totals ───────────────────────────────
    {
      type: 'stats',
      heading: 'Year At A Glance',
      items: [
        { k: 'ACTIVE OPS',   v: String(totals.members_active ?? 0), amber: true },
        { k: 'NEW JOINS',    v: String(totals.members_joined ?? 0) },
        { k: 'OPS RUN',      v: String(totals.ops_run        ?? 0), amber: true },
        { k: 'CONTRACTS',    v: String(totals.contracts_completed ?? 0) },
        { k: 'KILLS',        v: String(totals.kills          ?? 0) },
        { k: 'ASSISTS',      v: String(totals.assists        ?? 0) },
        { k: 'BOUNTIES',     v: String(totals.bounties_collected ?? 0) },
        { k: 'AARs FILED',   v: String(totals.aars_filed     ?? 0) },
      ],
    },

    // ─── Treasury + economic activity ──────────────────────
    {
      type: 'stats',
      heading: 'Economic Activity',
      items: [
        { k: 'CONTRACT POOL',   v: (totals.contracts_pool   ?? 0).toLocaleString(), amber: true },
        { k: 'LOOT DISTRIBUTED', v: (totals.loot_distributed ?? 0).toLocaleString(), amber: true },
        { k: 'BOUNTY POOL',     v: (totals.bounty_pool      ?? 0).toLocaleString() },
        { k: 'TREASURY',        v: (totals.treasury_balance ?? 0).toLocaleString() },
      ],
    },
  ]

  if (totals.intel_filed || totals.medals_awarded || totals.ops_cancelled) {
    sections.push({
      type: 'meta',
      items: [
        { k: 'INTEL FILED',    v: String(totals.intel_filed   ?? 0) },
        { k: 'MEDALS AWARDED', v: String(totals.medals_awarded ?? 0) },
        { k: 'OPS CANCELLED',  v: String(totals.ops_cancelled  ?? 0) },
        { k: 'DEATHS',         v: String(totals.deaths        ?? 0) },
      ],
    })
  }

  // ─── Top performers per category ─────────────────────────
  const topRosterRows = (label, rows, format = String) =>
    rows.length ? {
      type: 'roster',
      heading: label,
      items: rows.slice(0, 5).map((r, i) => ({
        handle: `#${i + 1}  ${r.handle}`,
        role:   '',
        ship:   '',
        rsvp:   format(r.value),
      })),
    } : null

  const fmtNum = v => v.toLocaleString()
  const fmtCred = v => v.toLocaleString() + ' aUEC'

  const topSecs = [
    topRosterRows('Top — Combat Engagements (KILLS)', top.kills || [], fmtNum),
    topRosterRows('Top — Contracts Completed', top.contracts || [], fmtNum),
    topRosterRows('Top — Loot Earned', top.loot || [], fmtCred),
    topRosterRows('Top — Reputation', top.rep || [], fmtNum),
  ].filter(Boolean)
  sections.push(...topSecs)

  // ─── Division strength ───────────────────────────────────
  if (divisions.length > 0) {
    sections.push({
      type: 'chips',
      heading: 'Division Roll-Up',
      items: divisions.map(d => `${d.name.toUpperCase()} · ${d.members}`),
    })
  }

  // ─── Headline ops (most-attended successful ops) ────────
  if (headlineOps.length > 0) {
    sections.push({
      type: 'roster',
      heading: 'Headline Operations',
      items: headlineOps.slice(0, 8).map(op => ({
        handle: op.title,
        role:   `${op.attendees || 0} ops`,
        ship:   op.loot ? `${(op.loot || 0).toLocaleString()} aUEC` : '',
        rsvp:   op.outcome || '—',
      })),
    })
  }

  if (generated_by) {
    sections.push({
      type: 'prose',
      heading: 'Filing Officer',
      body: `This report was compiled by ${generated_by} on ${todayStr()}. ` +
            `Figures sourced live from the Grayveil registry — contracts, kills, AARs, ` +
            `intel, bounties, ledger, treasury. End of fiscal record for ${year}.`,
    })
  }

  return {
    html: buildDossierHTML({
      kicker:    `Annual Report · ${year}`,
      title:     `Grayveil Corporation`,
      subtitle:  `FISCAL YEAR ${year} · COMPLETE`,
      sealText:  '◆',
      fileNumber,
      watermark: 'AR ' + year,
      sections,
    }),
    filename: `grayveil_annual_report_${year}.html`,
  }
}

// ─── Output helpers ────────────────────────────────────────────────────────

/**
 * Open the dossier in a new tab. Writes the HTML into a same-origin blob
 * URL so the Print button can trigger window.print() without a cross-origin
 * issue. Falls back to a data URL if blob URLs are restricted.
 */
export function openDossier(html) {
  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const w    = window.open(url, '_blank', 'noopener')
  // revoke after a beat so the new window has time to fetch it
  setTimeout(() => URL.revokeObjectURL(url), 20000)
  return w
}

/**
 * Force a download of the dossier as a .html file. Useful for sharing
 * outside the browser (Discord, email, archive).
 */
export function downloadDossier(html, filename) {
  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename || 'dossier.html'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
