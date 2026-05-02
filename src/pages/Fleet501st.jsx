import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ClassificationBar, EmptyState, StatusBadge } from '../components/uee'
import { get501stConfig, is501stChosen, is501stUnlocked } from '../lib/fleet501st'

const ACCENT = '#7b66c8'

export default function Fleet501st() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    async function run() {
      const { config } = await get501stConfig()
      const chosen = is501stChosen(profile, config)
      const open = is501stUnlocked(profile)
      setAllowed(chosen)
      setUnlocked(open)
      setLoading(false)
    }
    run()
  }, [profile?.id])

  if (loading) return <div className="page-body"><div className="loading">AUTHORIZING 501ST ACCESS...</div></div>

  if (!allowed) {
    return (
      <div className="page-body">
        <EmptyState>
          ACCESS RESTRICTED — 501ST invitation required.
        </EmptyState>
      </div>
    )
  }

  if (!unlocked) {
    return (
      <div className="page-body">
        <EmptyState>
          CLEARANCE REQUIRED — click the Grayveil logo and enter your issued passcode.
        </EmptyState>
      </div>
    )
  }

  return (
    <>
      <ClassificationBar
        section="GRAYVEIL BLACK FLEET"
        label="501ST CELL"
        accent={ACCENT}
        right={<span>EYES ONLY</span>}
      />
      <div className="page-header">
        <h1 className="page-title">THE 501ST</h1>
        <div className="page-subtitle">Hand-selected operators. Precision deployment. Zero noise.</div>
      </div>
      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <SecretStat label="CELL STATUS" value="ONLINE" color="#6fc29b" />
          <SecretStat label="ACCESS LEVEL" value="BLACK" color={ACCENT} />
          <SecretStat label="SIGNAL" value="ENCRYPTED" color="#b89d6d" />
          <SecretStat label="AUTH TOKEN" value="VALID" color="#6e86ae" />
        </div>

        <div className="card" style={{ marginTop: 14, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em', color: ACCENT }}>BLACK FLEET DIRECTIVE</div>
            <StatusBadge color={ACCENT} glyph="◆" label="501ST" />
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-2)' }}>
            The 501st executes high-sensitivity operations where command discretion is mandatory.
            Keep this channel compartmentalized. No external references. No open-board chatter.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/events')}>OPEN OPS BOARD</button>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/messages')}>SECURE COMMS</button>
          </div>
        </div>
      </div>
    </>
  )
}

function SecretStat({ label, value, color }) {
  return (
    <div className="card" style={{ padding: 12, borderLeft: `2px solid ${color}` }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.16em', color: 'var(--text-3)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginTop: 4, color }}>{value}</div>
    </div>
  )
}

