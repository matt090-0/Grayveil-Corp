import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { getRankByTier, formatCredits } from '../lib/ranks'
import RankBadge from './RankBadge'
import MedalPatch from './MedalPatch'
import Modal from './Modal'
import { useToast } from '../components/Toast'
import { goldBurst } from '../lib/confetti'
import { discordMedal } from '../lib/discord'
import MemberNotes from './MemberNotes'

function fmt(ts) { return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }

export default function MemberDossier({ member, onClose }) {
  const { profile: me } = useAuth()
  const toast = useToast()
  const [medals, setMedals] = useState([])
  const [certs, setCerts] = useState([])
  const [ships, setShips] = useState([])
  const [stats, setStats] = useState({ kills: 0, deaths: 0, assists: 0, contracts: 0 })
  const [allMedals, setAllMedals] = useState([])
  const [allCerts, setAllCerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [awarding, setAwarding] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const canAward = me.tier <= 4
  const accentColor = member.avatar_color || '#d4d8e0'
  const initials = member.handle.slice(0, 2).toUpperCase()
  const kd = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(1) : stats.kills > 0 ? '∞' : '—'

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

  async function awardMedal() {
    if (!form.medal_id) return
    setSaving(true)
    await supabase.from('member_medals').insert({ member_id: member.id, medal_id: form.medal_id, awarded_by: me.id, reason: form.reason || null })
    const medal = allMedals.find(m => m.id === form.medal_id)
    await supabase.from('notifications').insert({ recipient_id: member.id, type: 'promotion', title: `Medal: ${medal?.name}`, message: `Awarded by ${me.handle}${form.reason ? ' — ' + form.reason : ''}`, link: '/medals' })
    await supabase.from('activity_log').insert({ actor_id: me.id, action: 'medal_awarded', target_type: 'profile', target_id: member.id, details: { title: `${medal?.name} → ${member.handle}` } })
    await supabase.rpc('award_rep', { p_member_id: member.id, p_amount: 5, p_reason: 'Medal awarded' }).catch(() => {})
    const { data } = await supabase.from('member_medals').select('*, medal:medals(*)').eq('member_id', member.id).order('awarded_at', { ascending: false })
    setMedals(data || [])
    goldBurst()
    discordMedal(member.handle, medal?.name, medal?.rarity, me.handle)
    toast(`${medal?.name} awarded to ${member.handle}`, 'success')
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
    toast(`${cert?.name} granted to ${member.handle}`, 'success')
    setAwarding(null); setSaving(false); setForm({})
  }

  // Section wrapper
  const Section = ({ label, children, mt }) => (
    <div style={{ marginTop: mt || 0 }}>
      <div style={{ fontSize: 9, letterSpacing: '.2em', color: accentColor, fontFamily: 'var(--font-mono)', marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${accentColor}22` }}>{label}</div>
      {children}
    </div>
  )

  return (
    <Modal title="" onClose={onClose} size="modal-lg">
      <div style={{ margin: '-20px -24px -16px', overflow: 'hidden' }}>

        {/* ═══ HEADER BANNER ═══ */}
        <div style={{
          position: 'relative', overflow: 'hidden',
          background: member.is_founder
            ? `linear-gradient(160deg, #0e0e16 0%, #1a1520 40%, #0e0e16 100%)`
            : `linear-gradient(135deg, ${accentColor}08, ${accentColor}15)`,
          borderBottom: member.is_founder ? `2px solid ${accentColor}40` : `1px solid ${accentColor}30`,
          padding: member.is_founder ? '28px 28px' : '24px 28px',
        }}>
          {/* Founder-only background effects */}
          {member.is_founder && (
            <>
              <div style={{
                position: 'absolute', top: '-40%', left: '-20%', width: '70%', height: '180%',
                background: `radial-gradient(ellipse, ${accentColor}08 0%, transparent 70%)`,
              }} />
              <div style={{
                position: 'absolute', inset: 0, opacity: 0.02,
                backgroundImage: 'linear-gradient(rgba(212,216,224,1) 1px, transparent 1px), linear-gradient(90deg, rgba(212,216,224,1) 1px, transparent 1px)',
                backgroundSize: '30px 30px',
              }} />
            </>
          )}

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Avatar */}
          <div style={{
            width: member.is_founder ? 80 : 72, height: member.is_founder ? 80 : 72,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${accentColor}15, ${accentColor}30)`,
            border: `${member.is_founder ? '3px' : '2px'} solid ${accentColor}${member.is_founder ? '' : '60'}`,
            boxShadow: member.is_founder ? `0 0 30px ${accentColor}20` : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: member.is_founder ? 28 : 24, fontWeight: 700,
            color: accentColor, flexShrink: 0,
          }}>
            {initials}
          </div>

          {/* Identity */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: member.is_founder ? 26 : 22, fontWeight: 700, letterSpacing: member.is_founder ? '.04em' : 0 }}>{member.handle}</span>
              {member.is_founder && <span style={{ fontSize: 9, letterSpacing: '.15em', color: accentColor, fontFamily: 'var(--font-mono)', background: `${accentColor}15`, border: `1px solid ${accentColor}40`, borderRadius: 4, padding: '2px 8px' }}>FOUNDER</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <RankBadge tier={member.tier} />
              {member.division && <span style={{ fontSize: 11, color: 'var(--text-2)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px' }}>{member.division}</span>}
              {member.speciality && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{member.speciality}</span>}
            </div>
            {member.motto && <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>"{member.motto}"</div>}
          </div>

          {/* Action buttons */}
          {canAward && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
              <button className="btn btn-primary btn-sm" onClick={() => { setForm({}); setAwarding('medal') }}>AWARD MEDAL</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setForm({}); setAwarding('cert') }}>GRANT CERT</button>
            </div>
          )}
        </div>
        </div>

        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Loading dossier...</div> : (
          <div style={{ padding: '20px 28px 24px' }}>

            {/* ═══ COMBAT STATS ═══ */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0,
              background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
              overflow: 'hidden', marginBottom: 16,
            }}>
              {[
                { l: 'KILLS', v: stats.kills, c: 'var(--green)' },
                { l: 'DEATHS', v: stats.deaths, c: 'var(--red)' },
                { l: 'K/D RATIO', v: kd, c: accentColor },
                { l: 'CONTRACTS', v: stats.contracts, c: 'var(--text-1)' },
              ].map((s, i) => (
                <div key={s.l} style={{
                  padding: '18px 0', textAlign: 'center',
                  borderRight: i < 3 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: s.c, lineHeight: 1 }}>{s.v}</div>
                  <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* ═══ SECONDARY STATS ═══ */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 24,
            }}>
              {[
                { l: 'MEDALS', v: medals.length, c: accentColor },
                { l: 'CERTS', v: certs.length, c: 'var(--green)' },
                { l: 'REP', v: member.rep_score || 0, c: accentColor },
                { l: 'SHIPS', v: ships.length, c: 'var(--text-1)' },
              ].map(s => (
                <div key={s.l} style={{
                  padding: '14px 0', textAlign: 'center',
                  background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
                }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: s.c, lineHeight: 1 }}>{s.v}</div>
                  <div style={{ fontSize: 9, letterSpacing: '.15em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* ═══ TWO COLUMN LAYOUT ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: medals.length > 0 || certs.length > 0 ? '1fr 1fr' : '1fr', gap: 24 }}>

              {/* LEFT: Commendations + Certs */}
              <div>
                {medals.length > 0 && (
                  <Section label="COMMENDATIONS">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {medals.map(mm => (
                        <div key={mm.id} style={{
                          textAlign: 'center', width: 72, padding: '6px 0',
                          background: 'var(--bg-surface)', borderRadius: 6,
                          border: '1px solid var(--border)',
                        }}>
                          <MedalPatch name={mm.medal?.name} rarity={mm.medal?.rarity} size={48} />
                          <div style={{ fontSize: 8, fontWeight: 600, marginTop: 2, lineHeight: 1.2, padding: '0 4px' }}>{mm.medal?.name}</div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {certs.length > 0 && (
                  <Section label="CERTIFICATIONS" mt={medals.length > 0 ? 16 : 0}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {certs.map(mc => (
                        <div key={mc.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 10px', background: 'var(--bg-surface)',
                          border: '1px solid var(--border)', borderRadius: 6, fontSize: 12,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                          <span style={{ fontWeight: 500 }}>{mc.cert?.name}</span>
                          <span style={{ fontSize: 9, color: 'var(--text-3)', marginLeft: 'auto' }}>{mc.cert?.category}</span>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {medals.length === 0 && certs.length === 0 && (
                  <div style={{ padding: '16px 0', fontSize: 12, color: 'var(--text-3)' }}>No commendations or certifications yet.</div>
                )}
              </div>

              {/* RIGHT: Ships + Bio + Info */}
              <div>
                {ships.length > 0 && (
                  <Section label="ASSIGNED SHIPS">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {ships.map((s, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '6px 10px', background: 'var(--bg-surface)',
                          border: '1px solid var(--border)', borderRadius: 6,
                        }}>
                          <span style={{ fontWeight: 500, fontSize: 12 }}>{s.vessel_name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.ship_class}</span>
                            <span style={{
                              fontSize: 8, letterSpacing: '.05em', fontFamily: 'var(--font-mono)',
                              padding: '2px 6px', borderRadius: 3,
                              background: s.status === 'AVAILABLE' ? 'rgba(90,184,112,0.1)' : s.status === 'DEPLOYED' ? 'rgba(212,216,224,0.1)' : 'var(--bg-raised)',
                              color: s.status === 'AVAILABLE' ? 'var(--green)' : s.status === 'DEPLOYED' ? 'var(--accent)' : 'var(--text-3)',
                              border: `1px solid ${s.status === 'AVAILABLE' ? 'rgba(90,184,112,0.2)' : s.status === 'DEPLOYED' ? 'rgba(212,216,224,0.2)' : 'var(--border)'}`,
                            }}>{s.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {member.bio && (
                  <Section label="BIO" mt={ships.length > 0 ? 16 : 0}>
                    <div style={{
                      padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)',
                      borderRadius: 6, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.8,
                      whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto',
                    }}>{member.bio}</div>
                  </Section>
                )}

                {/* Info footer */}
                <Section label="SERVICE RECORD" mt={16}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 11 }}>
                    <div><span style={{ color: 'var(--text-3)' }}>Joined</span> <span style={{ fontWeight: 500 }}>{fmt(member.joined_at)}</span></div>
                    {member.last_seen_at && <div><span style={{ color: 'var(--text-3)' }}>Last seen</span> <span style={{ fontWeight: 500 }}>{fmt(member.last_seen_at)}</span></div>}
                    {member.timezone && <div><span style={{ color: 'var(--text-3)' }}>Timezone</span> <span style={{ fontWeight: 500 }}>{member.timezone}</span></div>}
                    {member.preferred_ship && <div><span style={{ color: 'var(--text-3)' }}>Main ship</span> <span style={{ fontWeight: 500 }}>{member.preferred_ship}</span></div>}
                  </div>
                </Section>

                {/* Officer Notes */}
                {canAward && (
                  <div style={{ marginTop: 16 }}>
                    <MemberNotes memberId={member.id} canManage={canAward} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ AWARD PANELS ═══ */}
        {awarding && (
          <div style={{ padding: '0 28px 20px' }}>
            <div style={{
              background: 'var(--bg-surface)', border: `1px solid ${accentColor}40`,
              borderRadius: 8, padding: 16,
            }}>
              <div style={{ fontSize: 9, letterSpacing: '.15em', color: accentColor, fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
                {awarding === 'medal' ? 'AWARD COMMENDATION' : 'GRANT CERTIFICATION'} — {member.handle.toUpperCase()}
              </div>

              {awarding === 'medal' ? (
                <>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <select className="form-select" value={form.medal_id || ''} onChange={e => setForm(f => ({ ...f, medal_id: e.target.value }))}>
                      <option value="">— Select Medal —</option>
                      {allMedals.map(m => <option key={m.id} value={m.id}>[{m.rarity}] {m.name}</option>)}
                    </select>
                  </div>
                  {form.medal_id && (
                    <div style={{ textAlign: 'center', margin: '8px 0' }}>
                      <MedalPatch name={allMedals.find(m => m.id === form.medal_id)?.name} rarity={allMedals.find(m => m.id === form.medal_id)?.rarity} size={72} />
                    </div>
                  )}
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <input className="form-input" value={form.reason || ''} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Citation / reason..." style={{ fontSize: 12 }} />
                  </div>
                  <div className="flex gap-8">
                    <button className="btn btn-primary btn-sm" onClick={awardMedal} disabled={saving || !form.medal_id}>{saving ? 'AWARDING...' : 'AWARD'}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setAwarding(null)}>CANCEL</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group" style={{ marginBottom: 10 }}>
                    <select className="form-select" value={form.cert_id || ''} onChange={e => setForm(f => ({ ...f, cert_id: e.target.value }))}>
                      <option value="">— Select Certification —</option>
                      {allCerts.map(c => <option key={c.id} value={c.id}>[{c.category}] {c.name}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-8">
                    <button className="btn btn-primary btn-sm" onClick={grantCert} disabled={saving || !form.cert_id}>{saving ? 'GRANTING...' : 'GRANT'}</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setAwarding(null)}>CANCEL</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
