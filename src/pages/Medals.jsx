import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'

const RARITY_BADGE = { COMMON: 'badge-muted', UNCOMMON: 'badge-green', RARE: 'badge-blue', LEGENDARY: 'badge-accent' }
const CERT_CAT_BADGE = { GENERAL: 'badge-muted', COMBAT: 'badge-red', MINING: 'badge-amber', MEDICAL: 'badge-green', CAPITAL: 'badge-purple', RECON: 'badge-blue', TRADE: 'badge-accent' }

function fmt(ts) { return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }

export default function Medals() {
  const { profile: me } = useAuth()
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
    await supabase.from('notifications').insert({ recipient_id: form.member_id, type: 'promotion', title: 'Medal Awarded', message: `You received a medal from ${me.handle}.`, link: '/medals' })
    setModal(null); setSaving(false); load()
  }

  async function grantCert() {
    if (!form.member_id || !form.cert_id) { setError('Select member and certification.'); return }
    setSaving(true)
    await supabase.from('member_certifications').upsert({ member_id: form.member_id, cert_id: form.cert_id, certified_by: me.id }, { onConflict: 'member_id,cert_id' })
    await supabase.from('notifications').insert({ recipient_id: form.member_id, type: 'promotion', title: 'Certification Granted', message: `You were certified by ${me.handle}.`, link: '/medals' })
    setModal(null); setSaving(false); load()
  }

  async function revokeCert(id) {
    if (!confirm('Revoke this certification?')) return
    await supabase.from('member_certifications').delete().eq('id', id); load()
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title">COMMENDATIONS</div>
            <div className="page-subtitle">Medals, awards, and certifications</div>
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
            {tab === 'medals' && (
              <>
                <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>◆ ALL MEDALS ({medals.length})</div>
                <div className="grid-auto" style={{ marginBottom: 24 }}>
                  {medals.map(m => (
                    <div key={m.id} className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>{m.icon}</div>
                      <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>{m.name}</div>
                      <span className={`badge ${RARITY_BADGE[m.rarity]}`} style={{ fontSize: 9 }}>{m.rarity}</span>
                      {m.description && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>{m.description}</div>}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>◆ RECENT AWARDS</div>
                {memberMedals.length === 0 ? <div className="empty-state">NO AWARDS YET</div> : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {memberMedals.slice(0, 20).map(mm => (
                      <div key={mm.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 18 }}>{mm.medal?.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12 }}><strong>{mm.member?.handle}</strong> received <strong>{mm.medal?.name}</strong></div>
                          {mm.reason && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{mm.reason}</div>}
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{fmt(mm.awarded_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === 'certs' && (
              <>
                <div className="grid-auto" style={{ marginBottom: 24 }}>
                  {certs.map(c => {
                    const holders = memberCerts.filter(mc => mc.cert_id === c.id).length
                    return (
                      <div key={c.id} className="card">
                        <div className="flex items-center justify-between mb-4">
                          <span style={{ fontWeight: 500, fontSize: 13 }}>{c.name}</span>
                          <span className={`badge ${CERT_CAT_BADGE[c.category]}`} style={{ fontSize: 9 }}>{c.category}</span>
                        </div>
                        {c.description && <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 6 }}>{c.description}</div>}
                        <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{holders} certified</div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>◆ ALL CERTIFICATIONS GRANTED</div>
                {memberCerts.length === 0 ? <div className="empty-state">NO CERTIFICATIONS</div> : (
                  <div className="card" style={{ padding: 0 }}><div className="table-wrap"><table className="data-table">
                    <thead><tr><th>MEMBER</th><th>CERTIFICATION</th><th>CATEGORY</th><th>CERTIFIED BY</th><th>DATE</th><th></th></tr></thead>
                    <tbody>
                      {memberCerts.map(mc => (
                        <tr key={mc.id}>
                          <td style={{ fontWeight: 500 }}>{mc.member?.handle}</td>
                          <td>{mc.cert?.name}</td>
                          <td><span className={`badge ${CERT_CAT_BADGE[mc.cert?.category]}`} style={{ fontSize: 9 }}>{mc.cert?.category}</span></td>
                          <td className="text-muted">{mc.certifier?.handle || '—'}</td>
                          <td className="mono text-muted" style={{ fontSize: 11 }}>{fmt(mc.certified_at)}</td>
                          <td>{canAward && <button className="btn btn-danger btn-sm btn-icon" onClick={() => revokeCert(mc.id)}>✕</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div></div>
                )}
              </>
            )}

            {tab === 'mine' && (
              <>
                <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>◆ MY MEDALS ({myMedals.length})</div>
                {myMedals.length === 0 ? <div className="empty-state" style={{ padding: '16px 0' }}>NO MEDALS YET</div> : (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                    {myMedals.map(mm => (
                      <div key={mm.id} className="card" style={{ textAlign: 'center', padding: '16px 20px', minWidth: 120 }}>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>{mm.medal?.icon}</div>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{mm.medal?.name}</div>
                        <span className={`badge ${RARITY_BADGE[mm.medal?.rarity]}`} style={{ fontSize: 8 }}>{mm.medal?.rarity}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>◆ MY CERTIFICATIONS ({myCerts.length})</div>
                {myCerts.length === 0 ? <div className="empty-state" style={{ padding: '16px 0' }}>NO CERTIFICATIONS YET</div> : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {myCerts.map(mc => (
                      <div key={mc.id} className="card" style={{ padding: '10px 16px' }}>
                        <span className={`badge ${CERT_CAT_BADGE[mc.cert?.category]}`} style={{ fontSize: 9, marginRight: 8 }}>{mc.cert?.category}</span>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{mc.cert?.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {modal === 'award' && (
        <Modal title="AWARD MEDAL" onClose={() => setModal(null)}>
          <div className="form-group"><label className="form-label">MEMBER</label><select className="form-select" value={form.member_id || ''} onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))}><option value="">— Select —</option>{members.map(m => <option key={m.id} value={m.id}>{m.handle}</option>)}</select></div>
          <div className="form-group"><label className="form-label">MEDAL</label><select className="form-select" value={form.medal_id || ''} onChange={e => setForm(f => ({ ...f, medal_id: e.target.value }))}><option value="">— Select —</option>{medals.map(m => <option key={m.id} value={m.id}>{m.icon} {m.name} ({m.rarity})</option>)}</select></div>
          <div className="form-group"><label className="form-label">REASON</label><input className="form-input" value={form.reason || ''} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Why this award?" /></div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button><button className="btn btn-primary" onClick={awardMedal} disabled={saving}>{saving ? 'AWARDING...' : 'AWARD MEDAL'}</button></div>
        </Modal>
      )}

      {modal === 'cert' && (
        <Modal title="GRANT CERTIFICATION" onClose={() => setModal(null)}>
          <div className="form-group"><label className="form-label">MEMBER</label><select className="form-select" value={form.member_id || ''} onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))}><option value="">— Select —</option>{members.map(m => <option key={m.id} value={m.id}>{m.handle}</option>)}</select></div>
          <div className="form-group"><label className="form-label">CERTIFICATION</label><select className="form-select" value={form.cert_id || ''} onChange={e => setForm(f => ({ ...f, cert_id: e.target.value }))}><option value="">— Select —</option>{certs.map(c => <option key={c.id} value={c.id}>[{c.category}] {c.name}</option>)}</select></div>
          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setModal(null)}>CANCEL</button><button className="btn btn-primary" onClick={grantCert} disabled={saving}>{saving ? 'GRANTING...' : 'GRANT CERT'}</button></div>
        </Modal>
      )}
    </>
  )
}
