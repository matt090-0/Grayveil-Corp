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
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const canAward = me.tier <= 4

  async function load() {
    const [{ data: med }, { data: mm }, { data: cer }, { data: mc }, { data: mem }] = await Promise.all([
      supabase.from('medals').select('*').order('rarity').order('name'),
      supabase.from('member_medals')
        .select('*, medal:medals(*), member:profiles(handle), awarder:profiles!member_medals_awarded_by_fkey(handle)')
        .order('awarded_at', { ascending: false }),
      supabase.from('certifications').select('*').order('category').order('name'),
      supabase.from('member_certifications')
        .select('*, cert:certifications(*), member:profiles(handle), certifier:profiles!member_certifications_certified_by_fkey(handle)')
        .order('certified_at', { ascending: false }),
      supabase.from('profiles').select('id, handle').eq('status', 'ACTIVE').order('handle'),
    ])
    setMedals(med || []); setMM(mm || []); setCerts(cer || []); setMC(mc || []); setMembers(mem || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const myMedals = memberMedals.filter(m => m.member_id === me.id)
  const myCerts = memberCerts.filter(c => c.member_id === me.id)

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
        label={tab === 'medals' ? 'COMMENDATIONS' : tab === 'certs' ? 'CERTIFICATIONS' : 'PERSONAL RECORD'}
        right={(
          <>
            <span>MEDALS · {medals.length}</span>
            <span>CERTS · {certs.length}</span>
            <span style={{ color: UEE_AMBER }}>YOUR RECORD · {myMedals.length}M / {myCerts.length}C</span>
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
            { key: 'medals', label: 'MEDALS',         color: UEE_AMBER, glyph: '✦', count: medals.length },
            { key: 'certs',  label: 'CERTIFICATIONS', color: '#5a80d9', glyph: '◆', count: certs.length },
            { key: 'mine',   label: 'MY RECORD',      color: '#5ce0a1', glyph: '◉', count: myMedals.length + myCerts.length },
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
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
