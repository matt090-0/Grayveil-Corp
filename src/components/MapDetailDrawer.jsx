// ─────────────────────────────────────────────────────────────
// MapDetailDrawer — slide-in panel that shows the selected entity's
// details. Type-aware: planets, moons, stations, contracts, intel,
// ops, hostile orgs. Pure presentational; the host page owns the
// `selected` state and clears it via onClose.
// ─────────────────────────────────────────────────────────────
import { Link } from 'react-router-dom'

const fmt = ts => ts ? new Date(ts).toLocaleString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
}).toUpperCase() : '—'

const Eyebrow = ({ children }) => (
  <div style={{
    fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
    letterSpacing: '.32em', color: 'var(--text-3)',
    textTransform: 'uppercase', marginBottom: 6,
  }}>{children}</div>
)

const Field = ({ label, value }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between',
    padding: '8px 0', borderBottom: '1px solid var(--border)',
    gap: 12,
  }}>
    <span style={{
      fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
      letterSpacing: '.22em', color: 'var(--text-3)',
      textTransform: 'uppercase', flexShrink: 0,
    }}>{label}</span>
    <span style={{
      fontFamily: 'Inter, sans-serif', fontSize: 12,
      color: 'var(--text-1)', textAlign: 'right',
      overflow: 'hidden', textOverflow: 'ellipsis',
    }}>{value}</span>
  </div>
)

const Title = ({ children, color = 'var(--text-1)' }) => (
  <div style={{
    fontFamily: 'Inter Tight, sans-serif', fontSize: 22,
    fontWeight: 700, letterSpacing: '-0.02em',
    color, marginBottom: 2,
  }}>{children}</div>
)

export default function MapDetailDrawer({ selected, onClose }) {
  if (!selected) return null

  return (
    <aside className="gv-map-drawer" style={{
      position: 'absolute', top: 0, right: 0, bottom: 0,
      width: 'min(380px, 100vw)',
      background: 'var(--bg-surface)',
      borderLeft: '1px solid var(--border-md)',
      padding: '20px 22px',
      overflowY: 'auto',
      zIndex: 10,
      animation: 'drawer-in .25s cubic-bezier(.2,.7,.3,1)',
    }}>
      {/* Close + classification chip */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 22,
      }}>
        <Eyebrow>{kindEyebrow(selected.kind)}</Eyebrow>
        <button
          onClick={onClose}
          aria-label="Close detail panel"
          style={{
            background: 'transparent', color: 'var(--text-2)',
            border: '1px solid var(--border-md)', borderRadius: 2,
            padding: '4px 10px', fontSize: 11, lineHeight: 1, cursor: 'pointer',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >✕</button>
      </div>

      {renderBody(selected)}

      <style>{`
        @keyframes drawer-in {
          from { transform: translateX(20px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </aside>
  )
}

function kindEyebrow(kind) {
  return ({
    star:     '★ SYSTEM PRIMARY',
    planet:   '◇ PLANET',
    moon:     '△ MOON',
    station:  '◇ LAGRANGE STATION',
    landmark: '☷ LANDMARK',
    contract: '□ OPEN CONTRACT',
    intel:    '◎ INTELLIGENCE PIN',
    op:       '● SCHEDULED OPERATION',
    hostile:  '[] HOSTILE / KOS',
  }[kind]) || 'ENTITY'
}

function renderBody(selected) {
  const { kind, data } = selected
  switch (kind) {
    case 'star':     return <StarBody     data={data} />
    case 'planet':   return <PlanetBody   data={data} />
    case 'moon':     return <MoonBody     data={data} />
    case 'station':  return <StationBody  data={data} />
    case 'landmark': return <LandmarkBody data={data} />
    case 'contract': return <ContractBody data={data} />
    case 'intel':    return <IntelBody    data={data} />
    case 'op':       return <OpBody       data={data} />
    case 'hostile':  return <HostileBody  data={data} />
    default:         return null
  }
}

// ── Planet / moon / station / landmark ────────────────────────
function StarBody({ data }) {
  return (
    <>
      <Title>{data.name}</Title>
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 18 }}>{data.desc}</div>
      <Field label="Type" value="A1IV-class star" />
      <Field label="Jurisdiction" value={data.jurisdiction} />
      <Field label="Coordinates" value="0.00, 0.00" />
    </>
  )
}

function PlanetBody({ data }) {
  return (
    <>
      <Title>{data.name}</Title>
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 18 }}>
        {data.owner} · {data.moons.length} moon{data.moons.length === 1 ? '' : 's'} · {data.stations.length} L-stations
      </div>
      <Field label="Jurisdiction" value={data.jurisdiction} />
      <Field label="Owner" value={data.owner} />
      <Field label="Orbital R" value={data.orbitR.toFixed(0)} />
      <Field label="Coordinates" value={`${data.x.toFixed(1)}, ${data.y.toFixed(1)}`} />
      {data.moons.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <Eyebrow>Moons</Eyebrow>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {data.moons.map(m => (
              <span key={m.id} style={chip}>{m.name}</span>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function MoonBody({ data }) {
  return (
    <>
      <Title>{data.name}</Title>
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 18 }}>
        Moon of {data.parent?.name}
      </div>
      <Field label="Parent body" value={data.parent?.name} />
      <Field label="Jurisdiction" value={data.parent?.jurisdiction} />
    </>
  )
}

function StationBody({ data }) {
  return (
    <>
      <Title>{data.name}</Title>
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 18 }}>
        Lagrange station orbiting {data.parent?.name}
      </div>
      <Field label="Parent body" value={data.parent?.name} />
      <Field label="Type" value="Rest stop · refuel · repair" />
    </>
  )
}

function LandmarkBody({ data }) {
  return (
    <>
      <Title>{data.name}</Title>
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 18 }}>{data.desc}</div>
      <Field label="Type" value={data.type.toUpperCase()} />
      <Field label="Inner R" value={data.innerR} />
      <Field label="Outer R" value={data.outerR} />
    </>
  )
}

// ── Operational overlays ──────────────────────────────────────
function ContractBody({ data }) {
  return (
    <>
      <Title color="var(--amber)">{data.title}</Title>
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 18 }}>{data.location || 'Location unspecified'}</div>
      <Field label="Type" value={data.contract_type || '—'} />
      <Field label="Reward" value={data.reward ? `${data.reward.toLocaleString()} aUEC` : '—'} />
      <Field label="Status" value={data.status} />
      <Field label="Posted" value={fmt(data.created_at)} />
      <DrawerLink to="/contracts">VIEW IN CONTRACTS BOARD →</DrawerLink>
    </>
  )
}

function IntelBody({ data }) {
  return (
    <>
      <Title color="var(--blue)">{data.title}</Title>
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 18 }}>{data.location || 'Location unspecified'}</div>
      <Field label="Classification" value={data.classification} />
      <Field label="Min tier" value={`T-${data.min_tier}`} />
      <Field label="Filed" value={fmt(data.created_at)} />
      <DrawerLink to="/intelligence">VIEW IN INTEL ARCHIVE →</DrawerLink>
    </>
  )
}

function OpBody({ data }) {
  const startsIn = data.starts_at ? Math.max(0, Math.floor((new Date(data.starts_at).getTime() - Date.now()) / 60000)) : null
  const inLabel = startsIn === null ? '—'
    : startsIn === 0 ? 'NOW'
    : startsIn < 60 ? `${startsIn}m`
    : startsIn < 60 * 24 ? `${Math.floor(startsIn / 60)}h ${startsIn % 60}m`
    : `${Math.floor(startsIn / 1440)}d ${Math.floor((startsIn % 1440) / 60)}h`
  return (
    <>
      <Title color="var(--green)">{data.title}</Title>
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 18 }}>{data.location || 'Location unspecified'}</div>
      <Field label="Type" value={data.event_type || '—'} />
      <Field label="Status" value={data.status || '—'} />
      <Field label="Starts" value={fmt(data.starts_at)} />
      <Field label="T-minus" value={inLabel} />
      <DrawerLink to="/events">VIEW IN OPERATIONS BOARD →</DrawerLink>
    </>
  )
}

function HostileBody({ data }) {
  return (
    <>
      <Title color="var(--red)">{data.name || data.org_name}</Title>
      <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 18 }}>{data.location || 'Location unspecified'}</div>
      <Field label="Status" value={data.status || data.relation || 'HOSTILE'} />
      {data.notes && <Field label="Notes" value={data.notes} />}
      <DrawerLink to="/diplomacy">VIEW IN DIPLOMACY →</DrawerLink>
    </>
  )
}

const chip = {
  display: 'inline-block',
  padding: '3px 8px',
  border: '1px solid var(--border-md)',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 9, letterSpacing: '.18em',
  color: 'var(--text-2)',
  textTransform: 'uppercase',
}

function DrawerLink({ to, children }) {
  return (
    <Link
      to={to}
      className="h-accent-edge"
      style={{
        display: 'block', marginTop: 22,
        padding: '10px 14px',
        background: 'transparent',
        border: '1px solid var(--border-md)',
        color: 'var(--text-1)',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10, letterSpacing: '.22em',
        textTransform: 'uppercase',
        textAlign: 'center',
        textDecoration: 'none',
        transition: 'border-color .15s, color .15s',
      }}
    >{children}</Link>
  )
}
