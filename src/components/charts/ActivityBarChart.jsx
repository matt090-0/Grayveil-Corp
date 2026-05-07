// ─────────────────────────────────────────────────────────────
// ActivityBarChart — extracted from Dashboard so the recharts
// vendor chunk (~286KB / 74KB gz) only loads after the rest of the
// SITREP renders. Dashboard imports this via React.lazy + Suspense.
// ─────────────────────────────────────────────────────────────
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { UEE_AMBER } from '../uee'

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#0e0f14', border: `1px solid ${UEE_AMBER}55`, borderRadius: 3,
      padding: '6px 10px', fontSize: 11,
      fontFamily: 'var(--font-mono)', letterSpacing: '.05em',
    }}>
      <div style={{ color: 'var(--text-3)', fontSize: 9, letterSpacing: '.18em' }}>{label}</div>
      <div style={{ color: UEE_AMBER, fontWeight: 600 }}>{payload[0].value}</div>
    </div>
  )
}

export default function ActivityBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 0 }} barCategoryGap="25%">
        <XAxis
          dataKey="name"
          tick={{ fill: '#98917f', fontSize: 9, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}
          axisLine={{ stroke: '#333344' }}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          tick={{ fill: '#7a7468', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
          axisLine={false}
          tickLine={false}
          width={32}
          allowDecimals={false}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(200,165,90,0.06)' }} />
        <Bar dataKey="count" fill={UEE_AMBER} radius={[2, 2, 0, 0]} maxBarSize={60} />
      </BarChart>
    </ResponsiveContainer>
  )
}
