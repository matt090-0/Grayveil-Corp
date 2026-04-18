import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import MedalPatch from '../components/MedalPatch'
import { useToast } from '../components/Toast'
import { goldBurst } from '../lib/confetti'
import { discordMedal } from '../lib/discord'

const RARITY_BADGE = { COMMON: 'badge-muted', UNCOMMON: 'badge-green', RARE: 'badge-blue', LEGENDARY: 'badge-accent' }
const CERT_CAT_BADGE = { GENERAL: 'badge-muted', COMBAT: 'badge-red', MINING: 'badge-amber', MEDICAL: 'badge-green', CAPITAL: 'badge-purple', RECON: 'badge-blue', TRADE: 'badge-accent' }

function fmt(ts) { return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }

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

  const canAward = me.tier <= 4
  const canCreate = me.tier <= 3

  async function load() {
    const [{ data: med }, { data: mm }, { data: cer }, { data: mc }, { data: mem }] = await Promise.all([
      supabase.from('medals').select('*').order('rarity').order('name'),
      supabase.from('member_medals').select('*, medal:medals(*), member:profiles(handle), awarder:profiles!member_medals_awarded_by_fkey(handle)').order('awarded_at', { ascending: false }),
      supabase.from('certifications').select('*').order('category').order('name'),
      supabase.from('member_certifications').select('*, cert:certifications(*), member:profiles(handle), certifier:profiles!member_certifications_certified_by_fkey(handle)').order('certified_at', { ascending: false }),
      supabase.from('profiles').select('id, handle').eq('status', 'ACTIVE').order('handle'),
    ])
    setMedals(med || []); setMM(mm || []); setCerts(cer || []); setMC(mc || []); setMembers(mem || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const myMedals = memberMedals.filter(m => m.member_id === me.id)
  const myCerts = memberCerts.filter(c => c.member_id === me.id)

  async function awardMedal() {
    if (!form.member_id || !form.medal_id) { setError('Select member and medal.'); return }
    setSaving(true)
    await supabase.from('member_medals').insert({ member_id: form.member_id, medal_id: form.medal_id, awarded_by: me.id, reason: form.reason || null })
    const medal = medals.find(m => m.id === form.medal_id)
    const member = members.find(m => m.id === form.member_id)
    await supabase.from('notifications').insert({ recipient_id: form.member_id, type: 'promotion', title: `Medal: ${medal?.name || 'Award'}`, message: `Awarded by ${me.handle}${form.reason ? ' — ' + form.reason : ''}`, link: '/medals' })
    goldBurst()
    discordMedal(member?.handle || 'Unknown', medal?.name, medal?.rarity, me.handle)
    toast(`${medal?.name} awarded`, 'success')
    setModal(null); setSaving(false); load()
  }

  async function grantCert() {
    if (!form.member_id || !form.cert_id) { setError('Select member and certification.'); return }
    setSaving(true)
    await supabase.from('member_certifications').upsert({ member_id: form.member_id, cert_id: form.cert_id, certified_by: me.id }, { onConflict: 'member_id,cert_id' })
    const cert = certs.find(c => c.id === form.cert_id)
    await supabase.from('notifications').insert({ recipient_id: form.member_id, type: 'promotion', title: `Certified: ${cert?.name || ''}`, message: `Signed off by ${me.handle}`, link: '/medals' })
    toast(`${cert?.name} granted`, 'success')
    setModal(null); setSaving(false); load()
  }

  async function revokeCert(id) {
    if (!confirm('Revoke this certification?')) return
    await supabase.from('member_certifications').delete().eq('id', id)
    toast('Certification revoked', 'info'); load()
  }

  // Group medals by rarity for display
  const byRarity = ['LEGENDARY', 'RARE', 'UNCOMMON', 'COMMON'].map(r => ({
    rarity: r, items: medals.filter(m => m.rarity === r),
  })).filter(g => g.items.length > 0)

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title">COMMENDATIONS</div>
            <div className="page-subtitle">{medals.length} medals · {certs.length} certifications</div>
          </div>
          {canAward && (
            <div className="flex gap-8">
              <button className="btn btn-primary" onClick={() => { setForm({}); setError(''); setModal('award') }}>AWARD MEDAL</button>
              <button className="btn btn-ghost" onClick={() => { setForm({}); setError(''); setModal('cert') }}>GRANT CERT</button>
            </div>
          )}
        </div>
        <div className="flex gap-8">
          <button className="btn btn-ghost btn-sm" style={tab === 'medals' ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}} onClick={() => setTab('medals')}>MEDALS</button>
          <button className="btn btn-ghost btn-sm" style={tab === 'certs' ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}} onClick={() => setTab('certs')}>CERTIFICATIONS</button>
          <button className="btn btn-ghost btn-sm" style={tab === 'mine' ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}} onClick={() => setTab('mine')}>MY RECORD</button>
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING...</div> : (
          <>
            {/* ══════════ ALL MEDALS ══════════ */}
            {tab === 'medals' && (
              <>
                {byRarity.map(group => (
                  <div key={group.rarity} style={{ marginBottom: 28 }}>
                    <div style={{
                      fontSize: 11, letterSpacing: '.2em', fontFamily: 'var(--font-mono)', marginBottom: 12,
                      color: group.rarity === 'LEGENDARY' ? 'var(--accent)' : group.rarity === 'RARE' ? '#4a7ad9' : group.rarity === 'UNCOMMON' ? '#5ab870' : 'var(--text-3)',
                      paddingBottom: 6, borderBottom: '1px solid var(--border)',
                    }}>
                      {group.rarity} — {group.items.length} medals
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
                      {group.items.map(m => (
                        <div key={m.id} className="card" style={{
                          display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px',
                        }}>
                          {/* Patch */}
                          <div style={{ flexShrink: 0, paddingTop: 2 }}>
                            <MedalPatch name={m.name} rarity={m.rarity} size={64} />
                          </div>

                          {/* Text */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, lineHeight: 1.3 }}>{m.name}</div>
                            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                              <span className={`badge ${RARITY_BADGE[m.rarity]}`} style={{ fontSize: 10 }}>{m.rarity}</span>
                              <span className="badge badge-muted" style={{ fontSize: 10 }}>{m.category}</span>
                            </div>
                            {m.description && (
                              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{m.description}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Recent Awards */}
                <div style={{ fontSize: 11, letterSpacing: '.2em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>RECENT AWARDS</div>
                {memberMedals.length === 0 ? <div className="empty-state">NO AWARDS YET</div> : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {memberMedals.slice(0, 20).map(mm => (
                      <div key={mm.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <MedalPatch name={mm.medal?.name} rarity={mm.medal?.rarity} size={48} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong>{mm.member?.handle}</strong>
                            <span style={{ color: 'var(--text-2)' }}>received</span>
                            <strong style={{ color: RARITY_BADGE[mm.medal?.rarity] === 'badge-accent' ? 'var(--accent)' : 'var(--text-1)' }}>{mm.medal?.name}</strong>
                            {!mm.awarded_by && (
                              <span style={{
                                fontSize: 9, letterSpacing: '.2em',
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--accent)',
                                border: '1px solid var(--accent-dim)',
                                borderRadius: 4, padding: '1px 6px',
                              }}>AUTO</span>
                            )}
                          </div>
                          {mm.reason && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{mm.reason}</div>}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{fmt(mm.awarded_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ══════════ CERTIFICATIONS ══════════ */}
            {tab === 'certs' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, marginBottom: 28 }}>
                  {certs.map(c => {
                    const holders = memberCerts.filter(mc => mc.cert_id === c.id).length
                    return (
                      <div key={c.id} className="card" style={{ padding: '16px 18px' }}>
                        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</span>
                          <span className={`badge ${CERT_CAT_BADGE[c.category]}`} style={{ fontSize: 10 }}>{c.category}</span>
                        </div>
                        {c.description && <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8, lineHeight: 1.6 }}>{c.description}</div>}
                        <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{holders} certified member{holders !== 1 ? 's' : ''}</div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ fontSize: 11, letterSpacing: '.2em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>ALL CERTIFICATIONS GRANTED</div>
                {memberCerts.length === 0 ? <div className="empty-state">NO CERTIFICATIONS</div> : (
                  <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table className="data-table">
                    <thead><tr><th>MEMBER</th><th>CERTIFICATION</th><th>CATEGORY</th><th>CERTIFIED BY</th><th>DATE</th><th></th></tr></thead>
                    <tbody>
                      {memberCerts.map(mc => (
                        <tr key={mc.id}>
                          <td style={{ fontWeight: 500, fontSize: 13 }}>{mc.member?.handle}</td>
                          <td style={{ fontSize: 13 }}>{mc.cert?.name}</td>
                          <td><span className={`badge ${CERT_CAT_BADGE[mc.cert?.category]}`} style={{ fontSize: 10 }}>{mc.cert?.category}</span></td>
                          <td className="text-muted" style={{ fontSize: 13 }}>{mc.certifier?.handle || '—'}</td>
                          <td className="mono text-muted" style={{ fontSize: 12 }}>{fmt(mc.certified_at)}</td>
                          <td>{canAward && <button className="btn btn-danger btn-sm btn-icon" onClick={() => revokeCert(mc.id)}>✕</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div></div>
                )}
              </>
            )}

            {/* ══════════ MY RECORD ══════════ */}
            {tab === 'mine' && (
              <>
                <div style={{ fontSize: 11, letterSpacing: '.2em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 14, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>MY MEDALS ({myMedals.length})</div>
                {myMedals.length === 0 ? <div className="empty-state" style={{ padding: '20px 0' }}>NO MEDALS EARNED YET</div> : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, marginBottom: 32 }}>
                    {myMedals.map(mm => (
                      <div key={mm.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
                        <MedalPatch name={mm.medal?.name} rarity={mm.medal?.rarity} size={56} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{mm.medal?.name}</div>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                            <span className={`badge ${RARITY_BADGE[mm.medal?.rarity]}`} style={{ fontSize: 10 }}>{mm.medal?.rarity}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{fmt(mm.awarded_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: 11, letterSpacing: '.2em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 14, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>MY CERTIFICATIONS ({myCerts.length})</div>
                {myCerts.length === 0 ? <div className="empty-state" style={{ padding: '20px 0' }}>NO CERTIFICATIONS YET</div> : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {myCerts.map(mc => (
                      <div key={mc.id} className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{mc.cert?.name}</span>
                        <span className={`badge ${CERT_CAT_BADGE[mc.cert?.category]}`} style={{ fontSize: 10 }}>{mc.cert?.category}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ══════════ MODALS ══════════ */}
      {modal === 'award' && (
        <Modal title="AWARD COMMENDATION" onClose={() => setModal(null)}>
          <div className="form-group">
            <label className="form-label">OPERATIVE</label>
            <select className="form-select" value={form.member_id || ''} onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))}>
              <option value="">— Select Member —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.handle}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">MEDAL</label>
            <select className="form-select" value={form.medal_id || ''} onChange={e => setForm(f => ({ ...f, medal_id: e.target.value }))}>
              <option value="">— Select Medal —</option>
              {medals.map(m => <option key={m.id} value={m.id}>[{m.rarity}] {m.name}</option>)}
            </select>
          </div>
          {form.medal_id && (
            <div style={{ textAlign: 'center', padding: 12 }}>
              <MedalPatch name={medals.find(m => m.id === form.medal_id)?.name} rarity={medals.find(m => m.id === form.medal_id)?.rarity} size={100} />
              <div style={{ fontSize: 13, fontWeight: 500, marginTop: 6 }}>{medals.find(m => m.id === form.medal_id)?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{medals.find(m => m.id === form.medal_id)?.description}</div>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">CITATION (optional)</label>
            <input className="form-input" value={form.reason || ''} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="For conspicuous bravery during..." />
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
            <button className="btn btn-primary" onClick={awardMedal} disabled={saving}>{saving ? 'AWARDING...' : 'AWARD MEDAL'}</button>
          </div>
        </Modal>
      )}

      {modal === 'cert' && (
        <Modal title="GRANT CERTIFICATION" onClose={() => setModal(null)}>
          <div className="form-group">
            <label className="form-label">OPERATIVE</label>
            <select className="form-select" value={form.member_id || ''} onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))}>
              <option value="">— Select Member —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.handle}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">CERTIFICATION</label>
            <select className="form-select" value={form.cert_id || ''} onChange={e => setForm(f => ({ ...f, cert_id: e.target.value }))}>
              <option value="">— Select —</option>
              {certs.map(c => <option key={c.id} value={c.id}>[{c.category}] {c.name}</option>)}
            </select>
          </div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button>
            <button className="btn btn-primary" onClick={grantCert} disabled={saving}>{saving ? 'GRANTING...' : 'GRANT CERT'}</button>
          </div>
        </Modal>
      )}
    </>
  )
}
