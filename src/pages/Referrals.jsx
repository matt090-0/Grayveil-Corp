import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatCredits } from '../lib/ranks'
import { useToast } from '../components/Toast'

function fmt(ts) { return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }

const TYPE_COLORS = {
  AUEC: { bg: 'rgba(90,184,112,0.08)', border: 'rgba(90,184,112,0.25)', accent: 'var(--green)' },
  AUEC_BONUS: { bg: 'rgba(90,184,112,0.08)', border: 'rgba(90,184,112,0.25)', accent: 'var(--green)' },
  INGAME: { bg: 'rgba(74,122,217,0.08)', border: 'rgba(74,122,217,0.25)', accent: '#4a7ad9' },
  WEBSITE: { bg: 'rgba(200,165,90,0.08)', border: 'rgba(200,165,90,0.25)', accent: 'var(--accent)' },
  MEDAL: { bg: 'rgba(144,96,200,0.08)', border: 'rgba(144,96,200,0.25)', accent: '#9060c8' },
}

const TYPE_LABEL = { AUEC: 'aUEC', AUEC_BONUS: 'aUEC', INGAME: 'IN-GAME', WEBSITE: 'SITE PERK', MEDAL: 'MEDAL' }

export default function Referrals() {
  const { profile: me, refreshProfile } = useAuth()
  const toast = useToast()
  const [rewards, setRewards] = useState([])
  const [referrals, setReferrals] = useState([])
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(null)
  const [tab, setTab] = useState('rewards')
  const [copied, setCopied] = useState(false)

  const code = me.referral_code || me.handle?.slice(0, 4).toUpperCase() + '-' + me.id?.slice(0, 4)
  const confirmed = referrals.filter(r => r.status === 'CONFIRMED').length
  const pending = referrals.filter(r => r.status === 'PENDING').length
  const currentLevel = rewards.filter(r => confirmed >= r.referrals_required).length
  const nextReward = rewards.find(r => confirmed < r.referrals_required)
  const totalEarned = claims.reduce((s, c) => {
    const rw = rewards.find(r => r.level === c.level)
    return s + (rw?.reward_value || 0)
  }, 0)

  useEffect(() => {
    async function load() {
      const [{ data: rw }, { data: ref }, { data: cl }] = await Promise.all([
        supabase.from('referral_rewards').select('*').order('level'),
        supabase.from('referrals').select('*, referred:profiles!referrals_referred_id_fkey(handle, tier, status, joined_at)').eq('referrer_id', me.id).order('created_at', { ascending: false }),
        supabase.from('referral_claims').select('*').eq('member_id', me.id),
      ])
      setRewards(rw || []); setReferrals(ref || []); setClaims(cl || []); setLoading(false)
    }
    load()
  }, [me.id])

  // Generate code if missing
  useEffect(() => {
    if (!me.referral_code && me.handle) {
      const newCode = me.handle.slice(0, 4).toUpperCase() + '-' + me.id.slice(0, 4)
      supabase.from('profiles').update({ referral_code: newCode }).eq('id', me.id)
    }
  }, [me])

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
      toast('Referral code copied', 'success')
    } catch { toast('Copy failed — select and copy manually', 'error') }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`https://grayveil.net/apply?ref=${code}`)
      toast('Referral link copied', 'success')
    } catch { toast('Copy failed', 'error') }
  }

  async function claimReward(level) {
    setClaiming(level)
    const { error } = await supabase.rpc('claim_referral_reward', { p_level: level })
    if (error) { toast(error.message, 'error'); setClaiming(null); return }
    const rw = rewards.find(r => r.level === level)
    toast(`Claimed: ${rw?.reward_name}`, 'success')
    await refreshProfile()
    const { data: cl } = await supabase.from('referral_claims').select('*').eq('member_id', me.id)
    setClaims(cl || []); setClaiming(null)
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title">REFERRAL PROGRAM</div>
            <div className="page-subtitle">Recruit operatives. Earn rewards. Build the org.</div>
          </div>
        </div>
        <div className="flex gap-8">
          {['rewards', 'referrals'].map(t => (
            <button key={t} className="btn btn-ghost btn-sm" style={tab === t ? { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}} onClick={() => setTab(t)}>{t === 'rewards' ? 'REWARD TRACK' : `MY REFERRALS (${referrals.length})`}</button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING...</div> : (
          <>
            {/* ═══ HERO STATS ═══ */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20,
            }}>
              <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 0', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: 'var(--accent)' }}>{confirmed}</div>
                <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>CONFIRMED</div>
              </div>
              <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 0', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: 'var(--amber)' }}>{pending}</div>
                <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>PENDING</div>
              </div>
              <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 0', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: 'var(--text-1)' }}>{currentLevel}<span style={{ fontSize: 16, color: 'var(--text-3)' }}>/30</span></div>
                <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>LEVEL</div>
              </div>
              <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 0', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: 'var(--green)' }}>{formatCredits(totalEarned)}</div>
                <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>EARNED</div>
              </div>
            </div>

            {/* ═══ REFERRAL CODE CARD ═══ */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(200,165,90,0.06), rgba(200,165,90,0.12))',
              border: '1px solid rgba(200,165,90,0.3)', borderRadius: 10,
              padding: '20px 24px', marginBottom: 24,
              display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, letterSpacing: '.2em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>YOUR REFERRAL CODE</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--accent)', letterSpacing: '.1em' }}>{code}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>Share this code with potential recruits. When they join and get confirmed, you earn rewards.</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={copyCode}>{copied ? 'COPIED' : 'COPY CODE'}</button>
                <button className="btn btn-ghost btn-sm" onClick={copyLink}>COPY LINK</button>
              </div>
            </div>

            {/* ═══ REWARD TRACK ═══ */}
            {tab === 'rewards' && (
              <>
                {nextReward && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>NEXT REWARD: LEVEL {nextReward.level}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                      <div style={{ flex: 1, height: 8, background: 'var(--bg-surface)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width .3s', width: `${Math.min(100, (confirmed / nextReward.referrals_required) * 100)}%` }} />
                      </div>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-2)' }}>{confirmed}/{nextReward.referrals_required}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{nextReward.reward_name} — <span style={{ color: 'var(--accent)' }}>{nextReward.title}</span></div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rewards.map(rw => {
                    const unlocked = confirmed >= rw.referrals_required
                    const claimed = claims.some(c => c.level === rw.level)
                    const tc = TYPE_COLORS[rw.reward_type] || TYPE_COLORS.AUEC
                    const isNext = nextReward?.level === rw.level

                    return (
                      <div key={rw.level} style={{
                        display: 'flex', alignItems: 'center', gap: 16,
                        padding: '14px 18px', borderRadius: 10,
                        background: claimed ? 'rgba(90,184,112,0.04)' : unlocked ? tc.bg : 'var(--bg-raised)',
                        border: `1px solid ${claimed ? 'rgba(90,184,112,0.3)' : isNext ? 'var(--accent)' : unlocked ? tc.border : 'var(--border)'}`,
                        opacity: !unlocked && !isNext ? 0.5 : 1,
                        transition: 'all .15s',
                      }}>
                        {/* Level badge */}
                        <div style={{
                          width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
                          background: claimed ? 'rgba(90,184,112,0.15)' : unlocked ? `${tc.accent}15` : 'var(--bg-surface)',
                          color: claimed ? 'var(--green)' : unlocked ? tc.accent : 'var(--text-3)',
                          border: `1.5px solid ${claimed ? 'var(--green)' : unlocked ? tc.accent : 'var(--border)'}`,
                        }}>
                          {claimed ? '✓' : rw.level}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                            <span style={{ fontWeight: 600, fontSize: 15 }}>{rw.reward_name}</span>
                            <span style={{
                              fontSize: 9, letterSpacing: '.1em', fontFamily: 'var(--font-mono)',
                              padding: '2px 6px', borderRadius: 3,
                              background: `${tc.accent}15`, color: tc.accent,
                              border: `1px solid ${tc.accent}30`,
                            }}>{TYPE_LABEL[rw.reward_type]}</span>
                            {rw.reward_value > 0 && <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--green)', fontWeight: 600 }}>+{formatCredits(rw.reward_value)}</span>}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{rw.reward_description}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                            {rw.referrals_required} referral{rw.referrals_required !== 1 ? 's' : ''} required · <span style={{ color: tc.accent }}>{rw.title}</span>
                          </div>
                        </div>

                        {/* Action */}
                        <div style={{ flexShrink: 0 }}>
                          {claimed ? (
                            <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>CLAIMED</span>
                          ) : unlocked ? (
                            <button className="btn btn-primary btn-sm" onClick={() => claimReward(rw.level)} disabled={claiming === rw.level}>
                              {claiming === rw.level ? '...' : 'CLAIM'}
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{confirmed}/{rw.referrals_required}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* ═══ MY REFERRALS ═══ */}
            {tab === 'referrals' && (
              <>
                {referrals.length === 0 ? (
                  <div className="empty-state" style={{ padding: '40px 0' }}>
                    <div style={{ fontSize: 15, marginBottom: 8 }}>No referrals yet</div>
                    <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Share your code with potential recruits. When they join using your code and get promoted past Grey Contract, they count as confirmed.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {referrals.map(r => (
                      <div key={r.id} style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '12px 16px', background: 'var(--bg-raised)',
                        border: '1px solid var(--border)', borderRadius: 8,
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: r.status === 'CONFIRMED' ? 'rgba(90,184,112,0.15)' : 'var(--bg-surface)',
                          border: `1.5px solid ${r.status === 'CONFIRMED' ? 'var(--green)' : 'var(--border)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: r.status === 'CONFIRMED' ? 'var(--green)' : 'var(--text-3)',
                        }}>
                          {r.status === 'CONFIRMED' ? '✓' : '?'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{r.referred?.handle || 'Unknown'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                            Joined {r.referred?.joined_at ? fmt(r.referred.joined_at) : '—'}
                          </div>
                        </div>
                        <span style={{
                          fontSize: 10, letterSpacing: '.1em', fontFamily: 'var(--font-mono)',
                          padding: '3px 8px', borderRadius: 4,
                          background: r.status === 'CONFIRMED' ? 'rgba(90,184,112,0.1)' : 'rgba(200,165,90,0.1)',
                          color: r.status === 'CONFIRMED' ? 'var(--green)' : 'var(--amber)',
                          border: `1px solid ${r.status === 'CONFIRMED' ? 'rgba(90,184,112,0.2)' : 'rgba(200,165,90,0.2)'}`,
                        }}>{r.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}
