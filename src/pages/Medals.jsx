import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import MedalPatch from '../components/MedalPatch'
import { useToast } from '../components/Toast'
import { goldBurst } from '../lib/confetti'
import { discordMedal } from '../lib/discord'
import { confirmAction } from '../lib/dialogs'
import {
  UEE_AMBER, ClassificationBar, TabStrip, StatCell, FilterRow, Card,
  StatusBadge, EmptyState, UeeModal, SectionHeader, btnMicro,
  fmtDate, timeAgo,
} from '../components/uee'
import {
  ACH_CATEGORY_META, ACH_CATEGORY_ORDER, ACH_RARITY_META,
  progressLabel, progressRatio, totalPoints, METRIC_LABEL,
} from '../lib/achievements'

const MAX_REASON_LEN = 500

const RARITY_META = {
  LEGENDARY: { color: UEE_AMBER, glyph: '✦', label: 'LEGENDARY' },
  RARE:      { color: '#5a80d9', glyph: '◆', label: 'RARE' },
  UNCOMMON:  { color: '#5ce0a1', glyph: '◇', label: 'UNCOMMON' },
  COMMON:    { color: '#9099a8', glyph: '◯', label: 'COMMON' },
}

const CERT_CAT_META = {
  GENERAL:  { color: '#9099a8', glyph: '○' },
  COMBAT:   { color: '#e05c5c', glyph: '⚔' },
  MINING:   { color: UEE_AMBER, glyph: '⬢' },
  MEDICAL:  { color: '#5ce0a1', glyph: '✚' },
  CAPITAL:  { color: '#b566d9', glyph: '◆' },
  RECON:    { color: '#5a80d9', glyph: '◐' },
  TRADE:    { color: UEE_AMBER, glyph: '◇' },
}

export default function Medals() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('medals')
  const [medals, setMedals] = useState([])
  const [memberMedals, setMM] = useState([])
  const [certs, setCerts] = useState([])
  const [memberCerts, setMC] = useState([])
  const [members, setMembers] = useState([])
  const [achievements, setAchievements] = useState([])
  const [memberAchievements, setMA] = useState([])
  const [myMetrics, setMyMetrics] = useState({})  // metric_key → bigint
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const canAward = me.tier <= 4

  async function load() {
    // Trigger an instant refresh so any newly-earned achievements
    // land before we fetch the list. Returns the count newly
    // earned but we don't care about the value here — we'll re-fetch
    // member_achievements + show a toast if it's > 0.
    const { data: newCount } = await supabase.rpc('check_my_achievements')

    const [
      { data: med },
      { data: mm },
      { data: cer },
      { data: mc },
      { data: mem },
      { data: achs },
      { data: ma },
      { data: metrics },
    ] = await Promise.all([
      supabase.from('medals').select('*').order('rarity').order('name'),
      supabase.from('member_medals')
        .select('*, medal:medals(*), member:profiles(handle), awarder:profiles!member_medals_awarded_by_fkey(handle)')
        .order('awarded_at', { ascending: false }),
      supabase.from('certifications').select('*').order('category').order('name'),
      supabase.from('member_certifications')
        .select('*, cert:certifications(*), member:profiles(handle), certifier:profiles!member_certifications_certified_by_fkey(handle)')
        .order('certified_at', { ascending: false }),
      supabase.from('profiles').select('id, handle').eq('status', 'ACTIVE').order('handle'),
      supabase.from('achievements').select('*').eq('active', true).order('display_order'),
      supabase.from('member_achievements')
        .select('*, achievement:achievements(*), member:profiles(handle)')
        .order('earned_at', { ascending: false }),
      supabase.rpc('current_metrics_for', { p_member_id: me.id }),
    ])

    setMedals(med || []); setMM(mm || [])
    setCerts(cer || []); setMC(mc || [])
    setMembers(mem || [])
    setAchievements(achs || [])
    setMA(ma || [])
    setMyMetrics(Object.fromEntries((metrics || []).map(r => [r.metric_key, Number(r.value)])))
    setLoading(false)

    // Celebrate freshly-earned achievements with a toast + confetti.
    // The count > 0 means check_my_achievements added some this load.
    if (newCount && newCount > 0) {
      goldBurst()
      toast(`Achievement${newCount === 1 ? '' : 's'} unlocked · ${newCount}`, 'success')
    }
  }
  useEffect(() => { load() }, [])

  const myMedals = memberMedals.filter(m => m.member_id === me.id)
  const myCerts = memberCerts.filter(c => c.member_id === me.id)
  const myAchievements = useMemo(
    () => memberAchievements.filter(a => a.member_id === me.id),
    [memberAchievements, me.id]
  )
  const myEarnedIds = useMemo(
    () => new Set(myAchievements.map(a => a.achievement_id)),
    [myAchievements]
  )

  // Group achievements by category for the ACHIEVEMENTS tab,
  // ordered by display_order within each category. A category
  // only renders if it has at least one achievement.
  const achievementsByCategory = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ACH_CATEGORY_ORDER.map(cat => ({
      category: cat,
      meta: ACH_CATEGORY_META[cat] || ACH_CATEGORY_META.SPECIAL,
      items: achievements
        .filter(a => a.category === cat)
        .filter(a => !q
          || (a.name || '').toLowerCase().includes(q)
          || (a.description || '').toLowerCase().includes(q))
        // Hide secret + locked achievements from the list. They
        // appear when the member earns them.
        .filter(a => !a.secret || myEarnedIds.has(a.id)),
    })).filter(g => g.items.length > 0)
  }, [achievements, search, myEarnedIds])

  const myAchievementPoints = useMemo(() => totalPoints(myAchievements), [myAchievements])

  const byRarity = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ['LEGENDARY', 'RARE', 'UNCOMMON', 'COMMON'].map(r => ({
      rarity: r,
      items: medals.filter(m => m.rarity === r && (
        !q
        || (m.name || '').toLowerCase().includes(q)
        || (m.description || '').toLowerCase().includes(q)
        || (m.category || '').toLowerCase().includes(q)
      )),
    })).filter(g => g.items.length > 0)
  }, [medals, search])

  async function awardMedal() {
    if (!form.member_id || !form.medal_id) { setError('Select member and medal.'); return }
    const reason = (form.reason || '').trim().slice(0, MAX_REASON_LEN) || null
    setSaving(true)
    await supabase.from('member_medals').insert({
      member_id: form.member_id, medal_id: form.medal_id,
      awarded_by: me.id, reason,
    })
    const medal = medals.find(m => m.id === form.medal_id)
    const member = members.find(m => m.id === form.member_id)
    await supabase.from('notifications').insert({
      recipient_id: form.member_id, type: 'promotion',
      title: `Medal: ${medal?.name || 'Award'}`,
      message: `Awarded by ${me.handle}${reason ? ' — ' + reason : ''}`,
      link: '/medals',
    })
    goldBurst()
    discordMedal(member?.handle || 'Unknown', medal?.name, medal?.rarity, me.handle)
    toast(`${medal?.name} awarded`, 'success')
    setModal(null); setSaving(false); load()
  }

  async function grantCert() {
    if (!form.member_id || !form.cert_id) { setError('Select member and certification.'); return }
    setSaving(true)
    await supabase.from('member_certifications').upsert({
      member_id: form.member_id, cert_id: form.cert_id, certified_by: me.id,
    }, { onConflict: 'member_id,cert_id' })
    const cert = certs.find(c => c.id === form.cert_id)
    await supabase.from('notifications').insert({
      recipient_id: form.member_id, type: 'promotion',
      title: `Certified: ${cert?.name || ''}`,
      message: `Signed off by ${me.handle}`,
      link: '/medals',
    })
    toast(`${cert?.name} granted`, 'success')
    setModal(null); setSaving(false); load()
  }

  async function revokeCert(id) {
    if (!(await confirmAction('Revoke this certification?'))) return
    await supabase.from('member_certifications').delete().eq('id', id)
    toast('Certification revoked', 'info'); load()
  }

  return (
    <>
      <ClassificationBar
        section="GRAYVEIL HONOURS & QUALIFICATIONS"
        label={
          tab === 'medals'       ? 'COMMENDATIONS'  :
          tab === 'certs'        ? 'CERTIFICATIONS' :
          tab === 'achievements' ? 'ACHIEVEMENTS'   :
                                   'PERSONAL RECORD'
        }
        right={(
          <>
            <span>MEDALS · {medals.length}</span>
            <span>CERTS · {certs.length}</span>
            <span>ACHIEVEMENTS · {achievements.length}</span>
            <span style={{ color: UEE_AMBER }}>
              YOUR RECORD · {myMedals.length}M / {myCerts.length}C / {myAchievements.length}A · {myAchievementPoints}pts
            </span>
          </>
        )}
      />

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>COMMENDATIONS</h1>
            <div style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 640 }}>
              Awards, decorations, and skill certifications. Medals recognise valour; certifications gate operational duties.
            </div>
          </div>
          {canAward && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={() => { setForm({}); setError(''); setModal('award') }}>+ AWARD MEDAL</button>
              <button className="btn btn-ghost" onClick={() => { setForm({}); setError(''); setModal('cert') }}>+ GRANT CERT</button>
            </div>
          )}
        </div>

        <TabStrip
          active={tab} onChange={setTab}
          tabs={[
            { key: 'medals',       label: 'MEDALS',         color: UEE_AMBER, glyph: '✦', count: medals.length },
            { key: 'achievements', label: 'ACHIEVEMENTS',   color: UEE_AMBER, glyph: '◆', count: achievements.length },
            { key: 'certs',        label: 'CERTIFICATIONS', color: '#5a80d9', glyph: '◆', count: certs.length },
            { key: 'mine',         label: 'MY RECORD',      color: '#5ce0a1', glyph: '◉', count: myMedals.length + myCerts.length + myAchievements.length },
          ]}
        />
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING...</div> : (
          <>
            {tab === 'medals' && (
              <>
                <FilterRow
                  search={search} setSearch={setSearch}
                  placeholder="Search medal name, description, category..."
                />

                {byRarity.length === 0 ? (
                  <EmptyState>NO MEDALS MATCH</EmptyState>
                ) : byRarity.map(group => {
                  const rm = RARITY_META[group.rarity]
                  return (
                    <div key={group.rarity} style={{ marginBottom: 28 }}>
                      <SectionHeader label={`${rm.label} · ${group.items.length} MEDAL${group.items.length === 1 ? '' : 'S'}`} color={rm.color} glyph={rm.glyph} />
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: 10,
                      }}>
                        {group.items.map(m => (
                          <Card key={m.id} accent={rm.color} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: '14px 16px' }}>
                            <div style={{ flexShrink: 0, paddingTop: 2 }}>
                              <MedalPatch name={m.name} rarity={m.rarity} size={64} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14.5,
                                marginBottom: 4, lineHeight: 1.3, color: 'var(--text-1)',
                              }}>{m.name}</div>
                              <div style={{ display: 'flex', gap: 5, marginBottom: 6, flexWrap: 'wrap' }}>
                                <StatusBadge color={rm.color} glyph={rm.glyph} label={rm.label} />
                                <span style={{
                                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em',
                                  color: 'var(--text-3)', border: '1px solid var(--border)',
                                  padding: '1px 6px', borderRadius: 3,
                                }}>{m.category}</span>
                              </div>
                              {m.description && (
                                <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55 }}>
                                  {m.description}
                                </div>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )
                })}

                <SectionHeader label="RECENT AWARDS" color={UEE_AMBER} />
                {memberMedals.length === 0 ? <EmptyState>NO AWARDS YET</EmptyState> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {memberMedals.slice(0, 20).map(mm => {
                      const rm = RARITY_META[mm.medal?.rarity] || RARITY_META.COMMON
                      return (
                        <Card key={mm.id} accent={rm.color} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: '10px 14px' }}>
                          <MedalPatch name={mm.medal?.name} rarity={mm.medal?.rarity} size={44} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <strong style={{ color: 'var(--text-1)' }}>{mm.member?.handle}</strong>
                              <span style={{ color: 'var(--text-3)' }}>received</span>
                              <strong style={{ color: rm.color }}>{mm.medal?.name}</strong>
                              {!mm.awarded_by && <StatusBadge color={UEE_AMBER} label="AUTO" />}
                            </div>
                            {mm.reason && (
                              <div style={{
                                fontSize: 11.5, color: 'var(--text-3)',
                                fontFamily: 'var(--font-mono)', marginTop: 2, lineHeight: 1.5,
                              }}>
                                "{mm.reason}"
                              </div>
                            )}
                          </div>
                          <span style={{
                            fontSize: 10, color: 'var(--text-3)',
                            fontFamily: 'var(--font-mono)', letterSpacing: '.15em', flexShrink: 0,
                          }}>{fmtDate(mm.awarded_at)}</span>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {tab === 'certs' && (
              <>
                <FilterRow
                  search={search} setSearch={setSearch}
                  placeholder="Search certification..."
                />
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: 12, marginBottom: 28,
                }}>
                  {certs
                    .filter(c => !search.trim() || (c.name + ' ' + (c.description||'') + ' ' + c.category).toLowerCase().includes(search.toLowerCase()))
                    .map(c => {
                      const cm = CERT_CAT_META[c.category] || CERT_CAT_META.GENERAL
                      const holders = memberCerts.filter(mc => mc.cert_id === c.id).length
                      return (
                        <Card key={c.id} accent={cm.color} minHeight={140}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{
                              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14.5,
                              color: 'var(--text-1)',
                            }}>{c.name}</span>
                            <StatusBadge color={cm.color} glyph={cm.glyph} label={c.category} />
                          </div>
                          {c.description && (
                            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                              {c.description}
                            </div>
                          )}
                          <div style={{ flex: 1 }} />
                          <div style={{
                            paddingTop: 6, borderTop: '1px dashed var(--border)',
                            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.15em',
                            color: holders > 0 ? cm.color : 'var(--text-3)',
                          }}>
                            ◆ {holders} CERTIFIED
                          </div>
                        </Card>
                      )
                    })}
                </div>

                <SectionHeader label="ALL CERTIFICATIONS GRANTED" color="#5a80d9" />
                {memberCerts.length === 0 ? <EmptyState>NO CERTIFICATIONS GRANTED</EmptyState> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {memberCerts.map(mc => {
                      const cm = CERT_CAT_META[mc.cert?.category] || CERT_CAT_META.GENERAL
                      return (
                        <div key={mc.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px',
                          background: 'var(--bg-raised)',
                          border: '1px solid var(--border)',
                          borderLeft: `3px solid ${cm.color}`,
                          borderRadius: 3, fontSize: 12,
                        }}>
                          <span style={{ fontWeight: 600, minWidth: 110, color: 'var(--text-1)' }}>{mc.member?.handle}</span>
                          <span style={{ flex: 1 }}>{mc.cert?.name}</span>
                          <StatusBadge color={cm.color} glyph={cm.glyph} label={mc.cert?.category} />
                          <span style={{
                            fontSize: 10, color: 'var(--text-3)',
                            fontFamily: 'var(--font-mono)', letterSpacing: '.15em',
                          }}>
                            BY {(mc.certifier?.handle || '—').toUpperCase()} · {fmtDate(mc.certified_at)}
                          </span>
                          {canAward && (
                            <button onClick={() => revokeCert(mc.id)} style={btnMicro('#e05c5c')}>✕</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {tab === 'achievements' && (
              <>
                <FilterRow
                  search={search} setSearch={setSearch}
                  placeholder="Search achievement name or description..."
                />

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: 10, marginBottom: 22,
                }}>
                  <StatCell label="UNLOCKED"    value={myAchievements.length}                color="#5ce0a1" glyph="✓" desc={`of ${achievements.length}`} />
                  <StatCell label="POINTS"      value={myAchievementPoints}                  color={UEE_AMBER} glyph="✦" desc="achievement score" />
                  <StatCell label="LEGENDARY"   value={myAchievements.filter(a => a.achievement?.rarity === 'LEGENDARY').length} color={UEE_AMBER} glyph="✦" desc="rarest tier" />
                  <StatCell label="COMPLETION"  value={`${Math.round((myAchievements.length / Math.max(1, achievements.length)) * 100)}%`} color="#5a80d9" glyph="◆" desc="of available" />
                </div>

                {achievementsByCategory.length === 0 ? (
                  <EmptyState>NO ACHIEVEMENTS MATCH</EmptyState>
                ) : achievementsByCategory.map(group => (
                  <div key={group.category} style={{ marginBottom: 28 }}>
                    <SectionHeader
                      label={`${group.meta.label} · ${group.items.filter(a => myEarnedIds.has(a.id)).length}/${group.items.length}`}
                      color={group.meta.color}
                      glyph={group.meta.glyph}
                    />
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                      gap: 10,
                    }}>
                      {group.items.map(a => {
                        const earned = myEarnedIds.has(a.id)
                        const earnedRow = myAchievements.find(x => x.achievement_id === a.id)
                        const rarity = ACH_RARITY_META[a.rarity] || ACH_RARITY_META.COMMON
                        const currentMetric = myMetrics[a.metric_key] || 0
                        const ratio = progressRatio(a, currentMetric)
                        return (
                          <Card
                            key={a.id}
                            accent={earned ? a.color : 'var(--border)'}
                            style={{
                              opacity: earned ? 1 : 0.7,
                              filter: earned ? 'none' : 'saturate(0.3)',
                              minHeight: 120,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                              {/* Glyph badge */}
                              <div style={{
                                width: 44, height: 44, borderRadius: 4,
                                background: earned ? `${a.color}22` : 'var(--bg-surface)',
                                border: `1px solid ${earned ? a.color : 'var(--border)'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: earned ? a.color : 'var(--text-3)',
                                fontSize: 22, flexShrink: 0,
                                boxShadow: earned ? `0 0 16px ${a.color}33` : 'none',
                              }}>
                                {a.glyph}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600,
                                  color: earned ? 'var(--text-1)' : 'var(--text-2)',
                                  lineHeight: 1.25, marginBottom: 3,
                                }}>
                                  {a.name}
                                </div>
                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
                                  <StatusBadge color={rarity.color} glyph={rarity.glyph} label={rarity.label} />
                                  <span style={{
                                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em',
                                    color: 'var(--text-3)',
                                  }}>+{a.points} PTS</span>
                                </div>
                                <div style={{
                                  fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.5,
                                }}>
                                  {a.description}
                                </div>
                              </div>
                            </div>

                            {earned ? (
                              <div style={{
                                fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.18em',
                                color: '#5ce0a1', paddingTop: 6, borderTop: '1px dashed var(--border)',
                                display: 'flex', justifyContent: 'space-between',
                              }}>
                                <span>✓ UNLOCKED</span>
                                <span>{fmtDate(earnedRow?.earned_at)}</span>
                              </div>
                            ) : (
                              <div style={{ paddingTop: 6, borderTop: '1px dashed var(--border)' }}>
                                {/* Progress bar */}
                                <div style={{
                                  height: 6, background: 'rgba(255,255,255,0.05)',
                                  border: `1px solid ${a.color}33`, borderRadius: 3,
                                  overflow: 'hidden', marginBottom: 4,
                                }}>
                                  <div style={{
                                    height: '100%',
                                    width: `${ratio * 100}%`,
                                    background: `linear-gradient(90deg, ${a.color}aa, ${a.color})`,
                                    transition: 'width .3s ease',
                                  }} />
                                </div>
                                <div style={{
                                  fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.15em',
                                  color: 'var(--text-3)', display: 'flex', justifyContent: 'space-between',
                                }}>
                                  <span>{progressLabel(a, currentMetric)}</span>
                                  <span style={{ color: ratio >= 1 ? '#5ce0a1' : a.color }}>
                                    {Math.round(ratio * 100)}%
                                  </span>
                                </div>
                              </div>
                            )}
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* Recent unlocks across the org — social proof, brag wall */}
                <SectionHeader label="RECENT UNLOCKS · ORG-WIDE" color={UEE_AMBER} />
                {memberAchievements.length === 0 ? (
                  <EmptyState>NO UNLOCKS YET</EmptyState>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {memberAchievements.slice(0, 12).map(ma => {
                      const a = ma.achievement
                      if (!a) return null
                      return (
                        <div key={ma.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px',
                          background: 'var(--bg-raised)',
                          border: '1px solid var(--border)',
                          borderLeft: `3px solid ${a.color}`,
                          borderRadius: 3, fontSize: 12,
                        }}>
                          <span style={{ color: a.color, fontSize: 14, width: 16, textAlign: 'center' }}>
                            {a.glyph}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--text-1)', minWidth: 110 }}>
                            {ma.member?.handle || '—'}
                          </span>
                          <span style={{ color: 'var(--text-3)' }}>unlocked</span>
                          <span style={{ color: a.color, fontWeight: 600 }}>{a.name}</span>
                          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '.15em' }}>
                            {timeAgo(ma.earned_at)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {tab === 'mine' && (
              <>
                <SectionHeader label={`MY MEDALS · ${myMedals.length}`} color={UEE_AMBER} glyph="✦" />
                {myMedals.length === 0 ? (
                  <EmptyState>NO MEDALS EARNED YET</EmptyState>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                    gap: 10, marginBottom: 28,
                  }}>
                    {myMedals.map(mm => {
                      const rm = RARITY_META[mm.medal?.rarity] || RARITY_META.COMMON
                      return (
                        <Card key={mm.id} accent={rm.color} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
                          <MedalPatch name={mm.medal?.name} rarity={mm.medal?.rarity} size={56} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600 }}>
                              {mm.medal?.name}
                            </div>
                            <div style={{ marginTop: 4 }}>
                              <StatusBadge color={rm.color} glyph={rm.glyph} label={rm.label} />
                            </div>
                            <div style={{
                              fontSize: 10, color: 'var(--text-3)', marginTop: 4,
                              fontFamily: 'var(--font-mono)', letterSpacing: '.15em',
                            }}>{fmtDate(mm.awarded_at)}</div>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}

                <SectionHeader label={`MY CERTIFICATIONS · ${myCerts.length}`} color="#5a80d9" glyph="◆" />
                {myCerts.length === 0 ? (
                  <EmptyState>NO CERTIFICATIONS YET</EmptyState>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
                    {myCerts.map(mc => {
                      const cm = CERT_CAT_META[mc.cert?.category] || CERT_CAT_META.GENERAL
                      return (
                        <div key={mc.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 14px',
                          background: 'var(--bg-raised)',
                          border: '1px solid var(--border)',
                          borderLeft: `3px solid ${cm.color}`,
                          borderRadius: 3,
                        }}>
                          <span style={{ color: cm.color, fontSize: 14 }}>{cm.glyph}</span>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{mc.cert?.name}</span>
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.18em',
                            color: cm.color, border: `1px solid ${cm.color}55`,
                            padding: '1px 6px', borderRadius: 3,
                          }}>{mc.cert?.category}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                <SectionHeader label={`MY ACHIEVEMENTS · ${myAchievements.length} · ${myAchievementPoints} PTS`} color={UEE_AMBER} glyph="◆" />
                {myAchievements.length === 0 ? (
                  <EmptyState>NO ACHIEVEMENTS YET — VISIT THE ACHIEVEMENTS TAB</EmptyState>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 8,
                  }}>
                    {myAchievements.map(ma => {
                      const a = ma.achievement
                      if (!a) return null
                      const rarity = ACH_RARITY_META[a.rarity] || ACH_RARITY_META.COMMON
                      return (
                        <div key={ma.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px',
                          background: 'var(--bg-raised)',
                          border: '1px solid var(--border)',
                          borderLeft: `3px solid ${a.color}`,
                          borderRadius: 3,
                        }}>
                          <span style={{ color: a.color, fontSize: 16, width: 18, textAlign: 'center' }}>{a.glyph}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-1)' }}>{a.name}</div>
                            <div style={{
                              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.15em',
                              color: rarity.color, marginTop: 1,
                            }}>
                              {rarity.label} · +{a.points}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* AWARD MEDAL */}
      {modal === 'award' && (
        <UeeModal
          accent={UEE_AMBER}
          kicker="◆ AWARD COMMENDATION"
          title="AWARD MEDAL"
          onClose={() => setModal(null)}
          maxWidth={580}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
              <button className="btn btn-primary" onClick={awardMedal} disabled={saving}>
                {saving ? 'AWARDING...' : 'AWARD MEDAL'}
              </button>
            </>
          )}
        >
          <div className="form-group">
            <label className="form-label">OPERATIVE</label>
            <select className="form-select" value={form.member_id || ''}
              onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))}>
              <option value="">— Select Member —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.handle}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">MEDAL</label>
            <select className="form-select" value={form.medal_id || ''}
              onChange={e => setForm(f => ({ ...f, medal_id: e.target.value }))}>
              <option value="">— Select Medal —</option>
              {medals.map(m => <option key={m.id} value={m.id}>[{m.rarity}] {m.name}</option>)}
            </select>
          </div>
          {form.medal_id && (() => {
            const m = medals.find(x => x.id === form.medal_id)
            const rm = RARITY_META[m?.rarity] || RARITY_META.COMMON
            return (
              <div style={{
                textAlign: 'center', padding: 16,
                background: `${rm.color}0a`, border: `1px solid ${rm.color}33`,
                borderRadius: 3, marginBottom: 12,
              }}>
                <MedalPatch name={m?.name} rarity={m?.rarity} size={100} />
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>{m?.name}</div>
                <div style={{ marginTop: 4 }}>
                  <StatusBadge color={rm.color} glyph={rm.glyph} label={rm.label} />
                </div>
                {m?.description && (
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.6 }}>
                    {m.description}
                  </div>
                )}
              </div>
            )
          })()}
          <div className="form-group">
            <label className="form-label">CITATION (max {MAX_REASON_LEN} chars)</label>
            <input className="form-input" maxLength={MAX_REASON_LEN}
              value={form.reason || ''}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value.slice(0, MAX_REASON_LEN) }))}
              placeholder="For conspicuous bravery during..." />
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
        </UeeModal>
      )}

      {/* GRANT CERT */}
      {modal === 'cert' && (
        <UeeModal
          accent="#5a80d9"
          kicker="◆ GRANT CERTIFICATION"
          title="GRANT CERTIFICATION"
          onClose={() => setModal(null)}
          maxWidth={520}
          footer={(
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
              <button className="btn btn-primary" onClick={grantCert} disabled={saving}>
                {saving ? 'GRANTING...' : 'GRANT CERT'}
              </button>
            </>
          )}
        >
          <div className="form-group">
            <label className="form-label">OPERATIVE</label>
            <select className="form-select" value={form.member_id || ''}
              onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))}>
              <option value="">— Select Member —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.handle}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">CERTIFICATION</label>
            <select className="form-select" value={form.cert_id || ''}
              onChange={e => setForm(f => ({ ...f, cert_id: e.target.value }))}>
              <option value="">— Select —</option>
              {certs.map(c => <option key={c.id} value={c.id}>[{c.category}] {c.name}</option>)}
            </select>
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
        </UeeModal>
      )}
    </>
  )
}
