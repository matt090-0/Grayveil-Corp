import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { RANKS } from '../lib/ranks'
import Modal from '../components/Modal'
import { confirmAction } from '../lib/dialogs'

function timeLeft(ts) {
  if (!ts) return null
  const diff = new Date(ts) - Date.now()
  if (diff <= 0) return 'CLOSED'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  if (d > 0) return `${d}d ${h}h remaining`
  return `${h}h remaining`
}

function fmt(ts) {
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Polls() {
  const { profile: me } = useAuth()
  const [polls, setPolls]   = useState([])
  const [votes, setVotes]   = useState([])
  const [tallies, setTallies] = useState({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState(false)
  const [form, setForm]     = useState({ question: '', options: ['', ''], min_tier: 9, ends_at: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [voting, setVoting] = useState({})

  const canCreate = me.tier <= 3

  async function load() {
    const [{ data: p }, { data: v }, { data: allVotes }] = await Promise.all([
      supabase.from('polls')
        .select('*, created_by:profiles(handle)')
        .order('created_at', { ascending: false }),
      supabase.from('poll_votes')
        .select('poll_id, option_index')
        .eq('member_id', me.id),
      supabase.from('poll_votes').select('poll_id, option_index'),
    ])

    setPolls(p || [])
    setVotes(v || [])

    // Build tallies: { pollId: { optIdx: count } }
    const t = {}
    for (const vote of (allVotes || [])) {
      if (!t[vote.poll_id]) t[vote.poll_id] = {}
      t[vote.poll_id][vote.option_index] = (t[vote.poll_id][vote.option_index] || 0) + 1
    }
    setTallies(t)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const myVoteMap = Object.fromEntries(votes.map(v => [v.poll_id, v.option_index]))

  function isPollOpen(p) {
    if (!p.ends_at) return true
    return new Date(p.ends_at) > Date.now()
  }

  async function castVote(pollId, optIndex) {
    setVoting(v => ({ ...v, [pollId]: true }))
    await supabase.from('poll_votes').insert({ poll_id: pollId, member_id: me.id, option_index: optIndex })
    await load()
    setVoting(v => ({ ...v, [pollId]: false }))
  }

  function addOption() {
    if (form.options.length >= 8) return
    setForm(f => ({ ...f, options: [...f.options, ''] }))
  }

  function removeOption(i) {
    if (form.options.length <= 2) return
    setForm(f => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }))
  }

  function setOption(i, val) {
    setForm(f => ({ ...f, options: f.options.map((o, idx) => idx === i ? val : o) }))
  }

  async function save() {
    if (!form.question.trim()) { setError('Question is required.'); return }
    const opts = form.options.map(o => o.trim()).filter(Boolean)
    if (opts.length < 2) { setError('At least 2 options required.'); return }
    setSaving(true)
    const { data, error } = await supabase.from('polls').insert({
      question: form.question.trim(),
      options: opts,
      min_tier: parseInt(form.min_tier),
      created_by: me.id,
      ends_at: form.ends_at || null,
    }).select().single()
    if (error) { setError(error.message); setSaving(false); return }
    await supabase.from('activity_log').insert({ actor_id: me.id, action: 'poll_created', target_type: 'poll', target_id: data.id, details: { title: form.question.trim() } })
    setModal(false)
    setForm({ question: '', options: ['', ''], min_tier: 9, ends_at: '' })
    setSaving(false)
    load()
  }

  async function deletePoll(id) {
    if (!(await confirmAction('Delete this poll and all votes?'))) return
    await supabase.from('polls').delete().eq('id', id)
    load()
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
          <div>
            <div className="page-title">POLLS</div>
            <div className="page-subtitle">Corporate votes and internal referendums</div>
          </div>
          {canCreate && <button className="btn btn-primary" onClick={() => setModal(true)}>+ CREATE POLL</button>}
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING POLLS...</div> : polls.length === 0 ? (
          <div className="empty-state">NO POLLS POSTED</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {polls.map(p => {
              const open    = isPollOpen(p)
              const myVote  = myVoteMap[p.id]
              const hasVoted = myVote !== undefined
              const pTallies = tallies[p.id] || {}
              const totalVotes = Object.values(pTallies).reduce((s, n) => s + n, 0)
              const options = Array.isArray(p.options) ? p.options : []
              const tl = timeLeft(p.ends_at)

              return (
                <div key={p.id} className="card">
                  <div className="flex items-center justify-between mb-16">
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 4 }}>{p.question}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        Posted by {p.created_by?.handle || '—'} · {fmt(p.created_at)}
                        {tl && <span style={{ marginLeft: 10, color: open ? 'var(--amber)' : 'var(--text-3)' }}>· {tl}</span>}
                        <span style={{ marginLeft: 10 }}>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <span className={`badge ${open ? 'badge-green' : 'badge-muted'}`}>{open ? 'OPEN' : 'CLOSED'}</span>
                      {canCreate && (
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => deletePoll(p.id)}>✕</button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {options.map((opt, i) => {
                      const count = pTallies[i] || 0
                      const pct   = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
                      const isMyVote = hasVoted && myVote === i

                      return (
                        <div
                          key={i}
                          className={`poll-option${isMyVote ? ' selected' : ''}`}
                          onClick={() => !hasVoted && open && !voting[p.id] && castVote(p.id, i)}
                          style={{ cursor: !hasVoted && open ? 'pointer' : 'default' }}
                        >
                          <div className="flex items-center justify-between">
                            <span style={{ fontSize: 13 }}>{opt}</span>
                            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                              {hasVoted || !open ? `${count} · ${pct}%` : ''}
                              {isMyVote && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>YOUR VOTE</span>}
                            </span>
                          </div>
                          {(hasVoted || !open) && (
                            <div className="poll-result-bar">
                              <div className="poll-result-fill" style={{ width: `${pct}%` }} />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {!hasVoted && open && (
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10, fontFamily: 'var(--font-mono)' }}>
                      SELECT AN OPTION TO CAST YOUR VOTE
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal && (
        <Modal title="CREATE POLL" onClose={() => setModal(false)} size="modal-lg">
          <div className="form-group">
            <label className="form-label">QUESTION *</label>
            <input className="form-input" value={form.question}
              onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
              placeholder="What are we deciding?" />
          </div>

          <div className="form-group">
            <label className="form-label">OPTIONS * (min 2, max 8)</label>
            {form.options.map((opt, i) => (
              <div key={i} className="flex gap-8 mb-8">
                <input className="form-input" value={opt}
                  onChange={e => setOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`} />
                {form.options.length > 2 && (
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeOption(i)}>✕</button>
                )}
              </div>
            ))}
            {form.options.length < 8 && (
              <button className="btn btn-ghost btn-sm" onClick={addOption}>+ ADD OPTION</button>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">MINIMUM RANK</label>
              <select className="form-select" value={form.min_tier}
                onChange={e => setForm(f => ({ ...f, min_tier: parseInt(e.target.value) }))}>
                {RANKS.map(r => <option key={r.tier} value={r.tier}>{r.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">CLOSES ON (optional)</label>
              <input className="form-input" type="datetime-local" value={form.ends_at}
                onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} />
            </div>
          </div>

          {error && <div className="form-error mb-8">{error}</div>}
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setModal(false)}>CANCEL</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'POSTING...' : 'CREATE POLL'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
