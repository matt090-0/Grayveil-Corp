import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { grantCertification } from '../lib/certifications'

const TRAINING_PATHS = [
  { role: 'Bengal Bridge Crew', certs: ['Capital Ship Crew', 'Fleet Navigation', 'Electronic Warfare'], minTier: 5, repReq: 200 },
  { role: 'Bengal Weapons Officer', certs: ['Capital Ship Crew', 'Torpedo Systems', 'Turret Gunnery'], minTier: 5, repReq: 150 },
  { role: 'Bengal Engineering', certs: ['Capital Ship Crew', 'Damage Control Systems'], minTier: 6, repReq: 100 },
  { role: 'Fighter Pilot', certs: ['Turret Gunnery', 'Fleet Navigation'], minTier: 7, repReq: 80 },
  { role: 'Mining Foreman', certs: ['Mining Foreman'], minTier: 6, repReq: 100 },
  { role: 'Combat Medic', certs: ['Combat Medic'], minTier: 7, repReq: 50 },
  { role: 'Recon Operative', certs: ['Electronic Warfare', 'Fleet Navigation'], minTier: 6, repReq: 120 },
  { role: 'Trade Director', certs: ['Fleet Navigation'], minTier: 5, repReq: 150 },
]

function fmt(ts) {
  if (!ts) return 'NO DATE'
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
}

export default function Certifications() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const canManage = me.tier <= 4

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [certs, setCerts] = useState([])
  const [members, setMembers] = useState([])
  const [memberCerts, setMemberCerts] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('ALL')
  const [selectedMember, setSelectedMember] = useState(me.id)

  async function load() {
    const [{ data: certData }, { data: memberData }, { data: mcData }] = await Promise.all([
      supabase.from('certifications').select('*').order('category').order('name'),
      supabase.from('profiles').select('id, handle, tier, division, rep_score, status').eq('status', 'ACTIVE').order('handle'),
      supabase.from('member_certifications')
        .select('id, member_id, cert_id, certified_at, cert:certifications(id, name, category), member:profiles(id, handle), certifier:profiles!member_certifications_certified_by_fkey(handle)')
        .order('certified_at', { ascending: false }),
    ])
    setCerts(certData || [])
    setMembers(memberData || [])
    setMemberCerts(mcData || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!members.length) return
    if (!members.some(m => m.id === selectedMember)) setSelectedMember(me.id)
  }, [members, selectedMember, me.id])

  const categories = useMemo(
    () => ['ALL', ...Array.from(new Set(certs.map(c => c.category).filter(Boolean)))],
    [certs],
  )

  const filteredCerts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return certs.filter(c => {
      const byCategory = category === 'ALL' || c.category === category
      const bySearch = !q || [c.name, c.description, c.category].some(v => (v || '').toLowerCase().includes(q))
      return byCategory && bySearch
    })
  }, [certs, category, search])

  const certIdsByMember = useMemo(() => {
    const map = new Map()
    for (const row of memberCerts) {
      if (!map.has(row.member_id)) map.set(row.member_id, new Set())
      map.get(row.member_id).add(row.cert_id)
    }
    return map
  }, [memberCerts])

  const selectedCertIds = certIdsByMember.get(selectedMember) || new Set()
  const selectedRows = useMemo(
    () => memberCerts.filter(mc => mc.member_id === selectedMember),
    [memberCerts, selectedMember],
  )
  const selectedMemberProfile = members.find(m => m.id === selectedMember) || null

  const completionRows = useMemo(() => {
    const total = certs.length || 1
    return members
      .map(m => {
        const have = certIdsByMember.get(m.id)?.size || 0
        return {
          ...m,
          certCount: have,
          pct: Math.round((have / total) * 100),
        }
      })
      .sort((a, b) => b.pct - a.pct || b.certCount - a.certCount || a.handle.localeCompare(b.handle))
  }, [members, certIdsByMember, certs.length])

  async function grantCert(certId) {
    if (!selectedMember || !certId) return
    setSaving(true)
    const { error, already } = await grantCertification(supabase, {
      memberId: selectedMember,
      certId,
      certifiedBy: me.id,
    })
    if (error) {
      if (error.code === '42501') {
        toast('RLS blocks certification grants. Add an INSERT policy for member_certifications.', 'error')
      } else {
        toast(error.message, 'error')
      }
      setSaving(false)
      return
    }
    if (already) {
      const cert = certs.find(c => c.id === certId)
      const selectedHandle = selectedMemberProfile?.handle || members.find(m => m.id === selectedMember)?.handle || 'MEMBER'
      // If the row already exists but isn't visible due environment-specific
      // read policies, still reflect it as certified in this tracker view.
      setMemberCerts(prev => {
        if (prev.some(r => r.member_id === selectedMember && r.cert_id === certId)) return prev
        return [{
          id: `known-existing-${Date.now()}-${certId}`,
          member_id: selectedMember,
          cert_id: certId,
          certified_at: new Date().toISOString(),
          cert: { id: certId, name: cert?.name || 'Certification', category: cert?.category || 'GENERAL' },
          member: { id: selectedMember, handle: selectedHandle },
          certifier: { handle: 'ON RECORD' },
        }, ...prev]
      })
      toast('Member already has this certification', 'info')
      setSaving(false)
      return
    }
    const cert = certs.find(c => c.id === certId)
    const selectedHandle = selectedMemberProfile?.handle || members.find(m => m.id === selectedMember)?.handle || 'MEMBER'

    // Optimistic state update so the UI flips immediately even if the
    // post-write read path is restricted by environment-specific RLS.
    setMemberCerts(prev => {
      if (prev.some(r => r.member_id === selectedMember && r.cert_id === certId)) return prev
      return [{
        id: `optimistic-${Date.now()}-${certId}`,
        member_id: selectedMember,
        cert_id: certId,
        certified_at: new Date().toISOString(),
        cert: { id: certId, name: cert?.name || 'Certification', category: cert?.category || 'GENERAL' },
        member: { id: selectedMember, handle: selectedHandle },
        certifier: { handle: me.handle },
      }, ...prev]
    })

    await supabase.from('notifications').insert({
      recipient_id: selectedMember,
      type: 'promotion',
      title: `Certified: ${cert?.name || 'Certification'}`,
      message: `Signed off by ${me.handle}`,
      link: '/certifications',
    })
    await supabase.from('activity_log').insert({
      actor_id: me.id,
      action: 'cert_granted',
      target_type: 'profile',
      target_id: selectedMember,
      details: { cert: cert?.name || certId },
    })
    toast(`Granted ${cert?.name || 'certification'}`, 'success')
    setSaving(false)
  }

  async function revokeCert(rowId) {
    if (!canManage || !rowId) return
    setSaving(true)
    const { error } = await supabase.from('member_certifications').delete().eq('id', rowId)
    if (error) {
      toast(error.message, 'error')
      setSaving(false)
      return
    }
    await supabase.from('activity_log').insert({
      actor_id: me.id,
      action: 'cert_revoked',
      target_type: 'profile',
      target_id: selectedMember,
      details: { cert_row_id: rowId },
    })
    // Optimistic remove so the card state/completion updates immediately.
    setMemberCerts(prev => prev.filter(r => r.id !== rowId))
    toast('Certification revoked', 'info')
    setSaving(false)
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 14, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="page-title">CERTIFICATION TRACKER</div>
            <div className="page-subtitle">Operational qualification matrix, training-path readiness, and sign-off controls.</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Stat label="CERTS" value={certs.length} color="var(--accent)" />
            <Stat label="CERTIFIED MEMBERS" value={completionRows.filter(r => r.certCount > 0).length} color="var(--green)" />
          </div>
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING CERTIFICATION GRID...</div> : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  placeholder="Search certification name, category, description..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <select className="form-select" value={category} onChange={e => setCategory(e.target.value)} style={{ maxWidth: 180 }}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <select className="form-select" value={selectedMember} onChange={e => setSelectedMember(e.target.value)}>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.handle} · T{m.tier} · {(certIdsByMember.get(m.id)?.size || 0)} certs
                  </option>
                ))}
              </select>
            </div>

            <div className="grid-2" style={{ gap: 16 }}>
              <div>
                <Section title={`CERTIFICATION CATALOG · ${filteredCerts.length}`}>
                  {filteredCerts.length === 0 ? <Empty>No certifications match this filter.</Empty> : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
                      {filteredCerts.map(cert => {
                        const has = selectedCertIds.has(cert.id)
                        return (
                          <div key={cert.id} style={{
                            background: 'var(--bg-raised)',
                            border: `1px solid ${has ? 'rgba(90,184,112,0.5)' : 'var(--border)'}`,
                            borderRadius: 8,
                            padding: 12,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                              <div style={{ fontWeight: 600 }}>{cert.name}</div>
                              <span className={`badge ${has ? 'badge-green' : 'badge-muted'}`}>{has ? 'CERTIFIED' : 'MISSING'}</span>
                            </div>
                            <div style={{ fontSize: 10, letterSpacing: '.14em', color: 'var(--text-3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                              {cert.category || 'GENERAL'}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8, minHeight: 34 }}>
                              {cert.description || 'No description on file.'}
                            </div>
                            {canManage && !has && (
                              <button
                                className="btn btn-ghost btn-sm"
                                style={{ marginTop: 10, width: '100%' }}
                                disabled={saving}
                                onClick={() => grantCert(cert.id)}
                              >
                                GRANT TO {selectedMemberProfile?.handle?.toUpperCase() || 'MEMBER'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </Section>

                <Section title={`TRAINING PATH READINESS · ${selectedMemberProfile?.handle?.toUpperCase() || 'MEMBER'}`}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                    {TRAINING_PATHS.map(path => {
                      const certsMet = path.certs.filter(cName => selectedRows.some(r => r.cert?.name === cName)).length
                      const tierMet = (selectedMemberProfile?.tier || 9) <= path.minTier
                      const repMet = (selectedMemberProfile?.rep_score || 0) >= path.repReq
                      const totalChecks = path.certs.length + 2
                      const done = certsMet + (tierMet ? 1 : 0) + (repMet ? 1 : 0)
                      const pct = Math.round((done / totalChecks) * 100)
                      const qualified = done === totalChecks
                      return (
                        <div key={path.role} className="card" style={{ borderColor: qualified ? 'var(--green)' : 'var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <strong style={{ fontSize: 13 }}>{path.role}</strong>
                            <span className={`badge ${qualified ? 'badge-green' : 'badge-muted'}`}>{qualified ? 'QUALIFIED' : `${pct}%`}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                            {path.certs.map(cn => {
                              const ok = selectedRows.some(r => r.cert?.name === cn)
                              return <Req key={cn} ok={ok} label={cn} />
                            })}
                            <Req ok={tierMet} label={`Min rank tier ${path.minTier}`} />
                            <Req ok={repMet} label={`${path.repReq} rep required`} />
                          </div>
                          <div style={{ height: 6, background: 'var(--bg-surface)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: qualified ? 'var(--green)' : 'var(--accent)' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Section>
              </div>

              <div>
                <Section title={`CURRENT CERTS · ${selectedRows.length}`}>
                  {selectedRows.length === 0 ? <Empty>No certifications on file.</Empty> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {selectedRows.map(row => (
                        <div key={row.id} style={{
                          background: 'var(--bg-raised)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          padding: '8px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)' }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500 }}>{row.cert?.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                              {row.cert?.category || 'GENERAL'} · BY {(row.certifier?.handle || 'SYSTEM').toUpperCase()} · {fmt(row.certified_at)}
                            </div>
                          </div>
                          {canManage && (
                            <button className="btn btn-danger btn-sm btn-icon" disabled={saving} onClick={() => revokeCert(row.id)}>✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                <Section title="ORG COMPLETION BOARD">
                  <div className="card" style={{ padding: 0 }}>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>MEMBER</th>
                            <th>TIER</th>
                            <th style={{ textAlign: 'right' }}>CERTS</th>
                            <th style={{ textAlign: 'right' }}>COMPLETE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {completionRows.map(row => (
                            <tr key={row.id} style={row.id === selectedMember ? { background: 'var(--accent-glow)' } : undefined}>
                              <td>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  style={{ padding: '2px 6px' }}
                                  onClick={() => setSelectedMember(row.id)}
                                >
                                  {row.handle}
                                </button>
                              </td>
                              <td className="mono">T{row.tier}</td>
                              <td className="mono" style={{ textAlign: 'right' }}>{row.certCount}/{certs.length}</td>
                              <td style={{ textAlign: 'right' }}>
                                <span className={`badge ${row.pct >= 75 ? 'badge-green' : row.pct >= 40 ? 'badge-amber' : 'badge-muted'}`}>{row.pct}%</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Section>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10,
        letterSpacing: '.16em',
        color: 'var(--accent)',
        fontFamily: 'var(--font-mono)',
        marginBottom: 10,
        paddingBottom: 6,
        borderBottom: '1px solid var(--accent-dim)',
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', minWidth: 130 }}>
      <div style={{ fontSize: 9, letterSpacing: '.12em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{label}</div>
      <div style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, color: color || 'var(--text-1)' }}>{value}</div>
    </div>
  )
}

function Empty({ children }) {
  return <div className="empty-state" style={{ padding: 22 }}>{children}</div>
}

function Req({ ok, label }) {
  return (
    <div style={{ fontSize: 11, color: ok ? 'var(--text-1)' : 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: ok ? 'var(--green)' : 'var(--red)', fontSize: 10 }}>{ok ? '✓' : '✕'}</span>
      <span>{label}</span>
    </div>
  )
}
