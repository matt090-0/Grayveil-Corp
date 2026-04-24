import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { timeAgo } from '../lib/dates'
import { confirmAction } from '../lib/dialogs'

const CATEGORY_COLORS = {
  GENERAL: { fg: 'var(--text-2)', bg: 'var(--bg-surface)' },
  COMBAT: { fg: 'var(--red)', bg: 'var(--red-dim)' },
  BEHAVIOR: { fg: 'var(--amber)', bg: 'var(--amber-dim)' },
  COMMENDATION: { fg: 'var(--green)', bg: 'var(--green-dim)' },
  WARNING: { fg: 'var(--red)', bg: 'var(--red-dim)' },
  DEVELOPMENT: { fg: 'var(--blue)', bg: 'var(--blue-dim)' },
}

export default function MemberNotes({ memberId, canManage }) {
  const { profile: me } = useAuth()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState('GENERAL')

  async function load() {
    const { data } = await supabase.from('member_notes')
      .select('*, author:profiles!member_notes_author_id_fkey(handle, avatar_color)')
      .eq('subject_id', memberId)
      .order('created_at', { ascending: false })
    setNotes(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [memberId])

  async function addNote() {
    if (!newContent.trim()) return
    await supabase.from('member_notes').insert({
      subject_id: memberId, author_id: me.id,
      content: newContent.trim(), category: newCategory,
    })
    setNewContent(''); setNewCategory('GENERAL'); setAdding(false); load()
  }

  async function deleteNote(id) {
    if (!(await confirmAction('Delete this note?'))) return
    await supabase.from('member_notes').delete().eq('id', id); load()
  }

  if (!canManage) return null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 9, letterSpacing: '.2em', color: 'var(--accent)', fontFamily: 'var(--font-mono)', paddingBottom: 4, borderBottom: '1px solid rgba(212,216,224,0.15)', flex: 1 }}>
          OFFICER NOTES ({notes.length}) · PRIVATE
        </div>
        <button onClick={() => setAdding(!adding)} style={{ marginLeft: 10, background: 'none', border: '1px solid var(--border)', color: 'var(--accent)', fontSize: 10, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>+ NOTE</button>
      </div>

      {adding && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginBottom: 10 }}>
          <select className="form-select" style={{ marginBottom: 6, fontSize: 11 }} value={newCategory} onChange={e => setNewCategory(e.target.value)}>
            {Object.keys(CATEGORY_COLORS).map(c => <option key={c}>{c}</option>)}
          </select>
          <textarea className="form-textarea" style={{ minHeight: 60, fontSize: 12, marginBottom: 6 }} value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Private note visible only to officers (tier ≤ 4)..." />
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={addNote}>SAVE NOTE</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setNewContent('') }}>CANCEL</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ padding: '8px 0', fontSize: 11, color: 'var(--text-3)' }}>Loading...</div> :
      notes.length === 0 ? <div style={{ padding: '8px 0', fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>No officer notes on this member.</div> :
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {notes.map(n => {
          const cc = CATEGORY_COLORS[n.category] || CATEGORY_COLORS.GENERAL
          return (
            <div key={n.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 9, letterSpacing: '.1em', fontFamily: 'var(--font-mono)', padding: '1px 6px', borderRadius: 3, background: cc.bg, color: cc.fg, border: `1px solid ${cc.fg}30` }}>{n.category}</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)' }}>{n.author?.handle || '—'}</span>
                <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>{timeAgo(n.created_at)}</span>
                {(n.author_id === me.id || me.tier <= 2) && (
                  <button onClick={() => deleteNote(n.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 11, cursor: 'pointer', padding: '0 2px' }}>✕</button>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-1)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{n.content}</div>
            </div>
          )
        })}
      </div>}
    </div>
  )
}
