import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { getRankByTier, formatCredits } from '../lib/ranks'
import RankBadge from './RankBadge'
import MedalPatch from './MedalPatch'
import Modal from './Modal'

function fmt(ts) { return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }

export default function MemberDossier({ member, onClose }) {
  const { profile: me } = useAuth()
  const [medals, setMedals] = useState([])
  const [certs, setCerts] = useState([])
  const [ships, setShips] = useState([])
  const [stats, setStats] = useState({ kills: 0, deaths: 0, assists: 0, contracts: 0 })
  const [allMedals, setAllMedals] = useState([])
  const [allCerts, setAllCerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [awarding, setAwarding] = useState(null) // 'medal' or 'cert'
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const canAward = me.tier <= 4
  const accentColor = member.avatar_color || '#c8a55a'
  const rankInfo = getRankByTier(member.tier)
  const initials = member.handle.slice(0, 2).toUpperCase()

  useEffect(() => {
    async function load() {
      const [{ data: mm }, { data: mc }, { data: fl }, { data: kills }, { data: claims }, { data: am }, { data: ac }] = await Promise.all([
        supabase.from('member_medals').select('*, medal:medals(*)').eq('member_id', member.id).order('awarded_at', { ascending: false }),
        supabase.from('member_certifications').select('*, cert:certifications(*)').eq('member_id', member.id),
        supabase.from('fleet').select('vessel_name, ship_class, status').eq('assigned_to', member.id),
        supabase.from('kill_log').select('outcome').eq('reporter_id', member.id),
        supabase.from('contract_claims').select('contract_id').eq('member_id', member.id),
        supabase.from('medals').select('*').order('rarity').order('name'),
        supabase.from('certifications').select('*').order('category').order('name'),
      ])
      setMedals(mm || []); setCerts(mc || []); setShips(fl || [])
      setStats({
        kills: (kills || []).filter(k => k.outcome === 'KILL').length,
        deaths: (kills || []).filter(k => k.outcome === 'DEATH').length,
        assists: (kills || []).filter(k => k.outcome === 'ASSIST').length,
        contracts: (claims || []).length,
      })
      setAllMedals(am || []); setAllCerts(ac || [])
      setLoading(false)
    }
    load()
  }, [member.id])

  const kd = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(1) : stats.kills > 0 ? '∞' : '—'

  async function awardMedal() {
    if (!form.medal_id) return
    setSaving(true)
    await supabase.from('member_medals').insert({ member_id: member.id, medal_id: form.medal_id, awarded_by: me.id, reason: form.reason || null })
    const medal = allMedals.find(m => m.id === form.medal_id)
    await supabase.from('notifications').insert({ recipient_id: member.id, type: 'promotion', title: `Medal: ${medal?.name}`, message: `Awarded by ${me.handle}${form.reason ? ' — ' + form.reason : ''}`, link: '/medals' })
    await supabase.from('activity_log').insert({ actor_id: me.id, action: 'medal_awarded', target_type: 'profile', target_id: member.id, details: { title: `${medal?.name} → ${member.handle}` } })
    // Refresh medals
    const { data } = await supabase.from('member_medals').select('*, medal:medals(*)').eq('member_id', member.id).order('awarded_at', { ascending: false })
    setMedals(data || [])
    setAwarding(null); setSaving(false); setForm({})
  }

  async function grantCert() {
    if (!form.cert_id) return
    setSaving(true)
    await supabase.from('member_certifications').upsert({ member_id: member.id, cert_id: form.cert_id, certified_by: me.id }, { onConflict: 'member_id,cert_id' })
    const cert = allCerts.find(c => c.id === form.cert_id)
    await supabase.from('notifications').insert({ recipient_id: member.id, type: 'promotion', title: `Certified: ${cert?.name}`, message: `Signed off by ${me.handle}`, link: '/medals' })
    const { data } = await supabase.from('member_certifications').select('*, cert:certifications(*)').eq('member_id', member.id)
    setCerts(data || [])
    setAwarding(null); setSaving(false); setForm({})
  }

  return (
    <Modal title={`OPERATIVE DOSSIER`} onClose={onClose} size="modal-lg">
      {/* Hero */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}44)`,
          border: `2.5px solid ${accentColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: accentColor,
        }}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
            {member.handle}
            {member.is_founder && <span className="badge badge-accent" style={{ marginLeft: 8 }}>FOUNDER</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RankBadge tier={member.tier} />
            {member.division && <span className="badge badge-muted">{member.division}</span>}
          </div>
          {member.motto && <div style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic', marginTop: 4 }}>"{member.motto}"</div>}
        </div>
        {canAward && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={() => { setForm({}); setAwarding('medal') }}>AWARD MEDAL</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setForm({}); setAwarding('cert') }}>GRANT CERT</button>
          </div>
        )}
      </div>

      {loading ? <div className="loading">LOADING...</div> : (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 20 }}>
            {[
              { l: 'KILLS', v: stats.kills, c: 'var(--green)' },
              { l: 'DEATHS', v: stats.deaths, c: 'var(--red)' },
              { l: 'K/D', v: kd, c: 'var(--accent)' },
              { l: 'CONTRACTS', v: stats.contracts },
              { l: 'MEDALS', v: medals.length, c: 'var(--accent)' },
              { l: 'REP', v: member.rep_score || 0, c: 'var(--accent)' },
              { l: 'CERTS', v: certs.length },
            ].map(s => (
              <div key={s.l} style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 8, letterSpacing: '.1em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{s.l}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: s.c || 'var(--text-1)' }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Medals */}
          {medals.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, letterSpacing: '.15em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>COMMENDATIONS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {medals.map(mm => (
                  <div key={mm.id} style={{ textAlign: 'center', width: 70 }}>
                    <MedalPatch name={mm.medal?.name} rarity={mm.medal?.rarity} size={56} />
                    <div style={{ fontSize: 8, fontWeight: 600, marginTop: 2, lineHeight: 1.2 }}>{mm.medal?.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certs */}
          {certs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, letterSpacing: '.15em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>CERTIFICATIONS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {certs.map(mc => (
                  <span key={mc.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 8px', fontSize: 10 }}>
                    {mc.cert?.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Ships */}
          {ships.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, letterSpacing: '.15em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>ASSIGNED SHIPS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ships.map((s, i) => (
                  <span key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 10px', fontSize: 11 }}>
                    <strong>{s.vessel_name}</strong> <span style={{ color: 'var(--text-3)' }}>{s.ship_class}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Bio */}
          {member.bio && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 12, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {member.bio}
            </div>
          )}

          {/* Info row */}
          <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            <span>JOINED: {fmt(member.joined_at)}</span>
            {member.timezone && <span>TZ: {member.timezone}</span>}
            {member.preferred_ship && <span>MAIN: {member.preferred_ship}</span>}
            {member.last_seen_at && <span>LAST SEEN: {fmt(member.last_seen_at)}</span>}
          </div>
        </>
      )}

      {/* Award Medal Panel */}
      {awarding === 'medal' && (
        <div style={{ marginTop: 16, background: 'var(--bg-surface)', border: '1px solid var(--accent)', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: '.1em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>AWARD COMMENDATION TO {member.handle.toUpperCase()}</div>
          <div className="form-group">
            <select className="form-select" value={form.medal_id || ''} onChange={e => setForm(f => ({ ...f, medal_id: e.target.value }))}>
              <option value="">— Select Medal —</option>
              {allMedals.map(m => <option key={m.id} value={m.id}>[{m.rarity}] {m.name}</option>)}
            </select>
          </div>
          {form.medal_id && (
            <div style={{ textAlign: 'center', margin: '8px 0' }}>
              <MedalPatch name={allMedals.find(m => m.id === form.medal_id)?.name} rarity={allMedals.find(m => m.id === form.medal_id)?.rarity} size={80} />
            </div>
          )}
          <div className="form-group">
            <input className="form-input" value={form.reason || ''} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Citation / reason..." />
          </div>
          <div className="flex gap-8">
            <button className="btn btn-primary btn-sm" onClick={awardMedal} disabled={saving || !form.medal_id}>{saving ? 'AWARDING...' : 'AWARD'}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAwarding(null)}>CANCEL</button>
          </div>
        </div>
      )}

      {awarding === 'cert' && (
        <div style={{ marginTop: 16, background: 'var(--bg-surface)', border: '1px solid var(--accent)', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: '.1em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>GRANT CERTIFICATION TO {member.handle.toUpperCase()}</div>
          <div className="form-group">
            <select className="form-select" value={form.cert_id || ''} onChange={e => setForm(f => ({ ...f, cert_id: e.target.value }))}>
              <option value="">— Select Certification —</option>
              {allCerts.map(c => <option key={c.id} value={c.id}>[{c.category}] {c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-8">
            <button className="btn btn-primary btn-sm" onClick={grantCert} disabled={saving || !form.cert_id}>{saving ? 'GRANTING...' : 'GRANT'}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAwarding(null)}>CANCEL</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
