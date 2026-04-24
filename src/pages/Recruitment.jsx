import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { confirmAction } from '../lib/dialogs'
import { useToast } from '../components/Toast'

// ─────────────────────────────────────────────────────────────
// UEE STYLE CONSTANTS
// ─────────────────────────────────────────────────────────────
const UEE_AMBER      = '#c8a55a'
const CLIP_CHAMFER   = 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))'
const CLIP_CHAMFER_SM = 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))'

// ─────────────────────────────────────────────────────────────
// TAXONOMY
// ─────────────────────────────────────────────────────────────
const STAGES = ['PENDING', 'VETTING', 'APPROVED', 'REJECTED']
const STAGE_META = {
  PENDING:  { color: '#9099a8', glyph: '○', desc: 'Awaiting initial contact' },
  VETTING:  { color: UEE_AMBER, glyph: '◎', desc: 'Active assessment' },
  APPROVED: { color: '#5ce0a1', glyph: '◉', desc: 'Ready for intake' },
  REJECTED: { color: '#e05c5c', glyph: '✕', desc: 'Not proceeding' },
}
const APP_STATUSES = ['PENDING', 'REVIEWING', 'APPROVED', 'REJECTED']
const APP_META = {
  PENDING:   { color: '#9099a8', glyph: '○' },
  REVIEWING: { color: UEE_AMBER, glyph: '◎' },
  APPROVED:  { color: '#5ce0a1', glyph: '◉' },
  REJECTED:  { color: '#e05c5c', glyph: '✕' },
}
const TABS = {
  prospects:    { key: 'prospects',    label: 'PROSPECTS',    short: 'PIPELINE',   color: UEE_AMBER, glyph: '◆', subtitle: 'Candidate pipeline · vetting status · referral tracking' },
  applications: { key: 'applications', label: 'APPLICATIONS', short: 'INTAKE',     color: '#5a80d9', glyph: '◈', subtitle: 'Submitted applications · review queue · approval decisions' },
  invites:      { key: 'invites',      label: 'INVITE LINKS', short: 'REFERRALS',  color: '#5ce0a1', glyph: '◊', subtitle: 'Single-use or multi-use referral codes · campaign attribution' },
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function fmt(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase()
}
function genCode() { return Math.random().toString(36).substring(2, 10).toUpperCase() }

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
export default function Recruitment() {
  const { profile: me } = useAuth()
  const toast = useToast()

  const [tab, setTab]             = useState('prospects')
  const [prospects, setProspects] = useState([])
  const [members, setMembers]     = useState([])
  const [applications, setApps]   = useState([])
  const [invites, setInvites]     = useState([])
  const [loading, setLoading]     = useState(true)

  const [stage, setStage]         = useState('ALL')
  const [appFilter, setAppFilter] = useState('ALL')
  const [search, setSearch]       = useState('')

  const [modal, setModal]         = useState(null)
  const [form, setForm]           = useState({})
  const [editTarget, setEditTarget] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const canManage = me.tier <= 4
  const canDelete = me.tier <= 3

  async function load() {
    const [{ data: p }, { data: m }, { data: a }, { data: inv }] = await Promise.all([
      supabase.from('recruitment').select('*, referred_by:profiles!recruitment_referred_by_fkey(handle), updated_by:profiles!recruitment_updated_by_fkey(handle)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, handle').eq('status', 'ACTIVE').order('handle'),
      supabase.from('applications').select('*').order('created_at', { ascending: false }),
      supabase.from('invite_links').select('*, creator:profiles(handle)').order('created_at', { ascending: false }),
    ])
    setProspects(p || []); setMembers(m || []); setApps(a || []); setInvites(inv || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Derived
  const counts = useMemo(() => {
    const c = { ALL: prospects.length }
    STAGES.forEach(s => { c[s] = prospects.filter(p => p.status === s).length })
    return c
  }, [prospects])

  const appCounts = useMemo(() => {
    const c = { ALL: applications.length }
    APP_STATUSES.forEach(s => { c[s] = applications.filter(a => a.status === s).length })
    return c
  }, [applications])

  const activeInvites = useMemo(() => invites.filter(i => !i.expires_at || new Date(i.expires_at) > new Date()).length, [invites])
  const totalRedemptions = useMemo(() => invites.reduce((acc, i) => acc + (i.uses || 0), 0), [invites])

  const prospectsFiltered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return prospects
      .filter(p => stage === 'ALL' || p.status === stage)
      .filter(p => !q
        || (p.handle || '').toLowerCase().includes(q)
        || (p.discord || '').toLowerCase().includes(q)
        || (p.referred_by?.handle || '').toLowerCase().includes(q)
        || (p.notes || '').toLowerCase().includes(q))
  }, [prospects, stage, search])

  const applicationsFiltered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return applications
      .filter(a => appFilter === 'ALL' || a.status === appFilter)
      .filter(a => !q
        || (a.handle || '').toLowerCase().includes(q)
        || (a.discord || '').toLowerCase().includes(q)
        || (a.email || '').toLowerCase().includes(q)
        || (a.referral_code || '').toLowerCase().includes(q))
  }, [applications, appFilter, search])

  const invitesFiltered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return invites.filter(i => !q
      || (i.code || '').toLowerCase().includes(q)
      || (i.label || '').toLowerCase().includes(q)
      || (i.creator?.handle || '').toLowerCase().includes(q))
  }, [invites, search])

  // ── Prospect CRUD ──────────────────────────────────────────
  function openAdd() { setForm({ handle: '', discord: '', referred_by: '', notes: '' }); setError(''); setModal('add') }
  function openEdit(p) { setEditTarget(p); setForm({ status: p.status, notes: p.notes || '' }); setError(''); setModal('edit') }

  async function saveAdd() {
    if (!form.handle) { setError('Handle is required.'); return }
    setSaving(true)
    const { error } = await supabase.from('recruitment').insert({
      handle:      form.handle.trim(),
      discord:     form.discord || null,
      referred_by: form.referred_by || null,
      notes:       form.notes || null,
    })
    if (error) { setError(error.message); setSaving(false); return }
    setModal(null); setSaving(false); toast('Prospect added to pipeline', 'success'); load()
  }

  async function saveEdit() {
    setSaving(true)
    const { error } = await supabase.from('recruitment').update({
      status: form.status, notes: form.notes || null, updated_by: me.id,
    }).eq('id', editTarget.id)
    if (error) { setError(error.message); setSaving(false); return }
    setModal(null); setSaving(false); toast('Prospect updated', 'success'); load()
  }

  async function deleteProspect(p) {
    if (!(await confirmAction(`Remove "${p.handle}" from the pipeline? This cannot be undone.`))) return
    const { error } = await supabase.from('recruitment').delete().eq('id', p.id)
    if (error) { toast(error.message, 'error'); return }
    toast('Prospect removed'); load()
  }

  // ── Invite CRUD ────────────────────────────────────────────
  async function createInvite() {
    const code = genCode()
    setSaving(true)
    const { error } = await supabase.from('invite_links').insert({
      code,
      created_by: me.id,
      label:      form.inviteLabel || null,
      max_uses:   form.inviteMax ? parseInt(form.inviteMax) : null,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    setModal(null); toast(`Invite ${code} created`, 'success'); load()
  }

  async function deleteInvite(inv) {
    if (!(await confirmAction(`Delete invite ${inv.code}? Any unused copies will stop working.`))) return
    const { error } = await supabase.from('invite_links').delete().eq('id', inv.id)
    if (error) { toast(error.message, 'error'); return }
    toast('Invite deleted'); load()
  }

  function copyInvite(inv) {
    const url = `${window.location.origin}/apply?ref=${inv.code}`
    navigator.clipboard.writeText(url)
    toast('Invite link copied', 'success')
  }

  // ── Application review ─────────────────────────────────────
  async function reviewApp(app, status) {
    const { error } = await supabase.from('applications').update({
      status, reviewed_by: me.id,
    }).eq('id', app.id)
    if (error) { toast(error.message, 'error'); return }
    toast(`Application ${status.toLowerCase()}`, status === 'REJECTED' ? 'info' : 'success')
    load()
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  const activeTab = TABS[tab]
  const headerRightCount =
    tab === 'prospects' ? counts.ALL
    : tab === 'applications' ? appCounts.ALL
    : invites.length

  return (
    <>
      {/* ── CLASSIFICATION BAR ── */}
      <div style={{
        flexShrink: 0,
        background: 'linear-gradient(180deg, #0e0f14 0%, #0a0b0f 100%)',
        borderBottom: `1px solid ${UEE_AMBER}33`,
        padding: '6px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em',
        color: UEE_AMBER,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: UEE_AMBER,
            boxShadow: `0 0 8px ${UEE_AMBER}`, animation: 'pulse 2s ease-in-out infinite',
          }} />
          GRAYVEIL TALENT ACQUISITION · {activeTab.short}
        </div>
        <div style={{ display: 'flex', gap: 20, color: 'var(--text-3)' }}>
          <span>{activeTab.label} · {headerRightCount}</span>
          <span style={{ color: UEE_AMBER }}>RECRUITMENT OFFICE · ACTIVE</span>
        </div>
      </div>

      {/* ── HEADER ── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>RECRUITMENT</h1>
            <div style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 640 }}>
              {activeTab.subtitle}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {tab === 'prospects' && canManage && (
              <button className="btn btn-primary" onClick={openAdd}>+ ADD PROSPECT</button>
            )}
            {tab === 'invites' && canManage && (
              <button className="btn btn-primary" onClick={() => { setForm({ inviteLabel: '', inviteMax: '' }); setModal('invite') }}>
                + CREATE LINK
              </button>
            )}
          </div>
        </div>

        {/* Tab strip */}
        <div style={{ marginTop: 16, display: 'flex', gap: 2, borderBottom: '1px solid var(--border)' }}>
          {Object.values(TABS).map(t => {
            const active = tab === t.key
            const count =
              t.key === 'prospects' ? counts.ALL
              : t.key === 'applications' ? appCounts.ALL
              : invites.length
            const pending =
              t.key === 'applications' ? appCounts.PENDING || 0 : 0
            return (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setSearch('') }}
                style={{
                  background: active ? `${t.color}10` : 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${active ? t.color : 'transparent'}`,
                  color: active ? t.color : 'var(--text-2)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11, letterSpacing: '.2em', fontWeight: 600,
                  padding: '10px 16px', cursor: 'pointer',
                  marginBottom: -1,
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  transition: 'color .15s ease, background .15s ease',
                }}
              >
                <span style={{ color: t.color, fontSize: 13 }}>{t.glyph}</span>
                {t.label}
                <span style={{
                  background: active ? `${t.color}33` : 'rgba(255,255,255,0.05)',
                  color: active ? t.color : 'var(--text-3)',
                  padding: '1px 7px', borderRadius: 10, fontSize: 9, minWidth: 22, textAlign: 'center',
                }}>{count}</span>
                {pending > 0 && (
                  <span title="Pending review" style={{
                    background: `${UEE_AMBER}33`,
                    color: UEE_AMBER,
                    padding: '1px 7px', borderRadius: 10, fontSize: 9, minWidth: 18, textAlign: 'center',
                    boxShadow: `0 0 6px ${UEE_AMBER}66`,
                  }}>!{pending}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="page-body">
        {loading ? <div className="loading">LOADING RECORDS...</div> : (
          tab === 'prospects' ? (
            <ProspectsView
              me={me} canManage={canManage} canDelete={canDelete}
              items={prospectsFiltered} allItems={prospects} counts={counts}
              stage={stage} setStage={setStage}
              search={search} setSearch={setSearch}
              openEdit={openEdit} deleteProspect={deleteProspect}
            />
          ) : tab === 'applications' ? (
            <ApplicationsView
              me={me} canManage={canManage}
              items={applicationsFiltered} counts={appCounts}
              appFilter={appFilter} setAppFilter={setAppFilter}
              search={search} setSearch={setSearch}
              reviewApp={reviewApp}
            />
          ) : (
            <InvitesView
              me={me} canDelete={canDelete}
              items={invitesFiltered} allCount={invites.length} activeInvites={activeInvites} totalRedemptions={totalRedemptions}
              search={search} setSearch={setSearch}
              copyInvite={copyInvite} deleteInvite={deleteInvite}
            />
          )
        )}
      </div>

      {/* ── MODALS ── */}
      {modal === 'add' && (
        <ProspectAddModal
          form={form} setForm={setForm} members={members}
          error={error} saving={saving}
          onClose={() => setModal(null)} onSubmit={saveAdd}
        />
      )}
      {modal === 'edit' && editTarget && (
        <ProspectEditModal
          target={editTarget} form={form} setForm={setForm}
          error={error} saving={saving}
          onClose={() => setModal(null)} onSubmit={saveEdit}
        />
      )}
      {modal === 'invite' && (
        <InviteCreateModal
          form={form} setForm={setForm}
          saving={saving}
          onClose={() => setModal(null)} onSubmit={createInvite}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// PROSPECTS VIEW
// ─────────────────────────────────────────────────────────────
function ProspectsView({ me, canManage, canDelete, items, allItems, counts, stage, setStage, search, setSearch, openEdit, deleteProspect }) {
  return (
    <>
      {/* Stage stat grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 10, marginBottom: 18,
      }}>
        {STAGES.map(s => {
          const meta = STAGE_META[s]
          const active = stage === s
          return (
            <button
              key={s}
              onClick={() => setStage(active ? 'ALL' : s)}
              style={{
                textAlign: 'left', cursor: 'pointer',
                background: active ? `${meta.color}12` : 'var(--bg-raised)',
                border: `1px solid ${active ? meta.color : 'var(--border)'}`,
                borderLeft: `3px solid ${meta.color}`,
                borderRadius: 4,
                padding: '12px 14px',
                clipPath: CLIP_CHAMFER_SM,
                transition: 'all .15s ease',
              }}
            >
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em',
                color: meta.color, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span>{meta.glyph}</span> {s}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>
                {counts[s] || 0}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 5 }}>
                {meta.desc}
              </div>
            </button>
          )
        })}
      </div>

      {/* Filter row */}
      <FilterRow
        search={search} setSearch={setSearch}
        placeholder="Search handle, discord, referrer, notes..."
        pills={[
          { key: 'ALL', label: 'ALL', color: '#d4d8e0', count: counts.ALL || 0 },
          ...STAGES.map(s => ({ key: s, label: s, color: STAGE_META[s].color, count: counts[s] || 0, glyph: STAGE_META[s].glyph })),
        ]}
        active={stage} setActive={setStage}
      />

      {/* Cards */}
      {items.length === 0 ? (
        <EmptyState>
          {allItems.length === 0
            ? 'No prospects in the pipeline yet.'
            : 'No prospects match the current filter.'}
        </EmptyState>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 12,
        }}>
          {items.map(p => (
            <ProspectCard
              key={p.id} prospect={p}
              canManage={canManage} canDelete={canDelete}
              onEdit={() => openEdit(p)}
              onDelete={() => deleteProspect(p)}
            />
          ))}
        </div>
      )}
    </>
  )
}

function ProspectCard({ prospect, canManage, canDelete, onEdit, onDelete }) {
  const meta = STAGE_META[prospect.status] || STAGE_META.PENDING
  return (
    <div style={{
      position: 'relative',
      background: 'var(--bg-raised)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${meta.color}`,
      borderRadius: 4,
      padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 10, minHeight: 170,
      clipPath: CLIP_CHAMFER_SM,
    }}>
      {/* Top: handle + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.2 }}>
            {prospect.handle}
          </div>
          {prospect.discord && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', color: 'var(--text-3)', marginTop: 3 }}>
              {prospect.discord}
            </div>
          )}
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em', fontWeight: 600,
          color: meta.color,
          background: `${meta.color}14`, border: `1px solid ${meta.color}55`,
          padding: '3px 8px', borderRadius: 3, whiteSpace: 'nowrap',
        }}>
          <span>{meta.glyph}</span> {prospect.status}
        </span>
      </div>

      {/* Referred by */}
      {prospect.referred_by?.handle && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.2em', color: 'var(--text-3)' }}>REF ·</span>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{prospect.referred_by.handle}</span>
        </div>
      )}

      {/* Notes */}
      <div style={{ flex: 1 }}>
        {prospect.notes ? (
          <div style={{
            fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {prospect.notes}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>
            No notes recorded.
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 6, paddingTop: 8, borderTop: '1px dashed var(--border)',
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.15em', color: 'var(--text-3)' }}>
          ADDED · {fmt(prospect.created_at)}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {canManage && (
            <button onClick={onEdit} style={btnMicro(UEE_AMBER)}>EDIT</button>
          )}
          {canDelete && (
            <button onClick={onDelete} style={btnMicro('#e05c5c')}>✕</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// APPLICATIONS VIEW
// ─────────────────────────────────────────────────────────────
function ApplicationsView({ me, canManage, items, counts, appFilter, setAppFilter, search, setSearch, reviewApp }) {
  return (
    <>
      {/* Status stat grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 10, marginBottom: 18,
      }}>
        {APP_STATUSES.map(s => {
          const meta = APP_META[s]
          const active = appFilter === s
          return (
            <button
              key={s}
              onClick={() => setAppFilter(active ? 'ALL' : s)}
              style={{
                textAlign: 'left', cursor: 'pointer',
                background: active ? `${meta.color}12` : 'var(--bg-raised)',
                border: `1px solid ${active ? meta.color : 'var(--border)'}`,
                borderLeft: `3px solid ${meta.color}`,
                borderRadius: 4,
                padding: '12px 14px',
                clipPath: CLIP_CHAMFER_SM,
                transition: 'all .15s ease',
              }}
            >
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em',
                color: meta.color, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span>{meta.glyph}</span> {s}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>
                {counts[s] || 0}
              </div>
            </button>
          )
        })}
      </div>

      <FilterRow
        search={search} setSearch={setSearch}
        placeholder="Search handle, discord, email, referral..."
        pills={[
          { key: 'ALL', label: 'ALL', color: '#d4d8e0', count: counts.ALL || 0 },
          ...APP_STATUSES.map(s => ({ key: s, label: s, color: APP_META[s].color, count: counts[s] || 0, glyph: APP_META[s].glyph })),
        ]}
        active={appFilter} setActive={setAppFilter}
      />

      {items.length === 0 ? (
        <EmptyState>No applications match the current filter.</EmptyState>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 12,
        }}>
          {items.map(a => (
            <ApplicationCard
              key={a.id} app={a}
              canManage={canManage}
              onApprove={() => reviewApp(a, 'APPROVED')}
              onReject={() => reviewApp(a, 'REJECTED')}
              onReview={() => reviewApp(a, 'REVIEWING')}
            />
          ))}
        </div>
      )}
    </>
  )
}

function ApplicationCard({ app, canManage, onApprove, onReject, onReview }) {
  const meta = APP_META[app.status] || APP_META.PENDING
  return (
    <div style={{
      position: 'relative',
      background: 'var(--bg-raised)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${meta.color}`,
      borderRadius: 4,
      padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
      clipPath: CLIP_CHAMFER_SM,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.2 }}>
            {app.handle}
          </div>
          {app.discord && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', color: 'var(--text-3)', marginTop: 3 }}>
              {app.discord}
            </div>
          )}
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em', fontWeight: 600,
          color: meta.color,
          background: `${meta.color}14`, border: `1px solid ${meta.color}55`,
          padding: '3px 8px', borderRadius: 3, whiteSpace: 'nowrap',
        }}>
          <span>{meta.glyph}</span> {app.status}
        </span>
      </div>

      {/* Contact grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
        padding: '8px 10px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border)',
        borderRadius: 3,
      }}>
        <Field label="EMAIL" value={app.email || '—'} mono />
        <Field label="TIMEZONE" value={app.timezone || '—'} mono />
        <Field label="REFERRAL"
          value={app.referral_code || '—'}
          mono color={app.referral_code ? '#5ce0a1' : undefined} />
        <Field label="SUBMITTED" value={fmt(app.created_at)} mono />
      </div>

      {/* Actions */}
      {canManage && app.status !== 'APPROVED' && app.status !== 'REJECTED' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>
          {app.status === 'PENDING' && (
            <button onClick={onReview} style={btnMicro(UEE_AMBER, true)}>MARK REVIEWING</button>
          )}
          <button onClick={onApprove} style={btnMicro('#5ce0a1', true)}>✓ APPROVE</button>
          <button onClick={onReject} style={btnMicro('#e05c5c', true)}>✕ REJECT</button>
        </div>
      )}
      {(app.status === 'APPROVED' || app.status === 'REJECTED') && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.15em', color: 'var(--text-3)',
          paddingTop: 6, borderTop: '1px dashed var(--border)',
        }}>
          DECISION FINAL · {app.status}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// INVITES VIEW
// ─────────────────────────────────────────────────────────────
function InvitesView({ me, canDelete, items, allCount, activeInvites, totalRedemptions, search, setSearch, copyInvite, deleteInvite }) {
  const applyUrl = `${window.location.origin}/apply`
  return (
    <>
      {/* Top banner: base URL + quick stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 10, marginBottom: 18,
      }}>
        <div style={{
          background: `${UEE_AMBER}0c`,
          border: `1px solid ${UEE_AMBER}44`,
          borderLeft: `3px solid ${UEE_AMBER}`,
          borderRadius: 4, padding: '12px 14px',
          clipPath: CLIP_CHAMFER_SM,
          gridColumn: '1 / -1',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em', color: UEE_AMBER, marginBottom: 6 }}>
            ◆ PUBLIC APPLICATION URL
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-1)', wordBreak: 'break-all' }}>
              {applyUrl}
            </span>
            <button
              onClick={() => { navigator.clipboard.writeText(applyUrl) }}
              style={btnMicro(UEE_AMBER)}
            >COPY</button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
            Share this link or a coded variant (<span style={{ color: UEE_AMBER }}>?ref=CODE</span>) to track who referred each applicant.
          </div>
        </div>

        <StatCell label="TOTAL LINKS"  value={allCount}         color="#d4d8e0" glyph="◊" />
        <StatCell label="ACTIVE"       value={activeInvites}    color="#5ce0a1" glyph="◉" />
        <StatCell label="REDEMPTIONS"  value={totalRedemptions} color={UEE_AMBER} glyph="◆" />
      </div>

      <FilterRow
        search={search} setSearch={setSearch}
        placeholder="Search code, label, creator..."
        pills={[]}
      />

      {items.length === 0 ? (
        <EmptyState>No invite links match.</EmptyState>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
        }}>
          {items.map(inv => (
            <InviteCard
              key={inv.id} invite={inv} me={me} canDelete={canDelete}
              onCopy={() => copyInvite(inv)}
              onDelete={() => deleteInvite(inv)}
            />
          ))}
        </div>
      )}
    </>
  )
}

function InviteCard({ invite, me, canDelete, onCopy, onDelete }) {
  const isExpired = invite.expires_at && new Date(invite.expires_at) <= new Date()
  const isUsedUp  = invite.max_uses && invite.uses >= invite.max_uses
  const inactive  = isExpired || isUsedUp
  const color     = inactive ? '#9099a8' : '#5ce0a1'
  const state     = isExpired ? 'EXPIRED' : isUsedUp ? 'EXHAUSTED' : 'ACTIVE'
  const canDel    = canDelete || invite.created_by === me.id

  return (
    <div style={{
      background: 'var(--bg-raised)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${color}`,
      borderRadius: 4,
      padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
      clipPath: CLIP_CHAMFER_SM,
      opacity: inactive ? 0.75 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            onClick={onCopy}
            title="Click to copy invite link"
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700,
              letterSpacing: '.12em', color: UEE_AMBER, cursor: 'pointer',
              lineHeight: 1, userSelect: 'all',
            }}
          >
            {invite.code}
          </div>
          {invite.label && (
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 5 }}>
              {invite.label}
            </div>
          )}
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em', fontWeight: 600,
          color, background: `${color}14`, border: `1px solid ${color}55`,
          padding: '3px 8px', borderRadius: 3, whiteSpace: 'nowrap',
        }}>
          {state}
        </span>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
        padding: '8px 10px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border)',
        borderRadius: 3,
      }}>
        <Field label="CREATOR" value={invite.creator?.handle || '—'} />
        <Field label="USES" value={`${invite.uses}${invite.max_uses ? ` / ${invite.max_uses}` : ' / ∞'}`} mono />
        <Field label="CREATED"  value={fmt(invite.created_at)} mono />
        <Field label="EXPIRES"  value={invite.expires_at ? fmt(invite.expires_at) : 'NEVER'} mono color={isExpired ? '#e05c5c' : undefined} />
      </div>

      <div style={{
        display: 'flex', gap: 6,
        paddingTop: 8, borderTop: '1px dashed var(--border)',
      }}>
        <button onClick={onCopy} style={btnMicro(UEE_AMBER, true)}>⎘ COPY LINK</button>
        {canDel && (
          <button onClick={onDelete} style={btnMicro('#e05c5c')}>✕</button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SHARED BITS
// ─────────────────────────────────────────────────────────────
function FilterRow({ search, setSearch, placeholder, pills, active, setActive }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <input
        className="form-input"
        placeholder={placeholder}
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: pills?.length ? 10 : 0 }}
      />
      {pills?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {pills.map(p => {
            const sel = active === p.key
            return (
              <button
                key={p.key}
                onClick={() => setActive(p.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  background: sel ? `${p.color}22` : 'var(--bg-raised)',
                  border: `1px solid ${sel ? p.color : 'var(--border)'}`,
                  borderRadius: 4,
                  padding: '5px 11px',
                  color: sel ? p.color : 'var(--text-2)',
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.15em',
                  fontWeight: 600, cursor: 'pointer',
                  transition: 'all .15s ease',
                }}
              >
                {p.glyph && <span style={{ color: p.color, fontSize: 12 }}>{p.glyph}</span>}
                {p.label}
                <span style={{
                  background: sel ? `${p.color}44` : 'rgba(255,255,255,0.05)',
                  color: sel ? p.color : 'var(--text-3)',
                  padding: '1px 6px', borderRadius: 10, fontSize: 9, minWidth: 18, textAlign: 'center',
                }}>{p.count}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCell({ label, value, color, glyph }) {
  return (
    <div style={{
      background: 'var(--bg-raised)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${color}`,
      borderRadius: 4, padding: '12px 14px',
      clipPath: CLIP_CHAMFER_SM,
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em',
        color, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {glyph && <span>{glyph}</span>} {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>
        {value}
      </div>
    </div>
  )
}

function Field({ label, value, mono, color }) {
  return (
    <div>
      <div style={{
        fontSize: 8.5, letterSpacing: '.2em', color: 'var(--text-3)',
        fontFamily: 'var(--font-mono)', marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 11.5, fontWeight: 500, color: color || 'var(--text-2)',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {value}
      </div>
    </div>
  )
}

function EmptyState({ children }) {
  return (
    <div style={{
      padding: '40px 24px', textAlign: 'center',
      background: 'var(--bg-raised)', border: '1px dashed var(--border)',
      borderRadius: 8, color: 'var(--text-3)', fontSize: 13,
    }}>
      {children}
    </div>
  )
}

function btnMicro(color, grow) {
  return {
    flex: grow ? 1 : undefined,
    background: `${color}10`,
    border: `1px solid ${color}55`,
    color,
    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.18em', fontWeight: 600,
    padding: '5px 10px', borderRadius: 3, cursor: 'pointer',
    transition: 'all .12s ease',
  }
}

// ─────────────────────────────────────────────────────────────
// MODALS
// ─────────────────────────────────────────────────────────────
function UeeModal({ accent, title, kicker, onClose, children, footer }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 580, padding: 0, overflow: 'hidden', clipPath: CLIP_CHAMFER }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          background: `linear-gradient(135deg, ${accent}22, ${accent}08)`,
          borderBottom: `1px solid ${accent}44`,
          padding: '14px 22px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.25em', color: accent, marginBottom: 3 }}>
              {kicker}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.2 }}>
              {title}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '18px 22px' }}>
          {children}
        </div>
        {footer && (
          <div style={{
            borderTop: '1px solid var(--border)',
            background: 'rgba(0,0,0,0.15)',
            padding: '12px 22px',
            display: 'flex', justifyContent: 'flex-end', gap: 8,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

function ProspectAddModal({ form, setForm, members, error, saving, onClose, onSubmit }) {
  return (
    <UeeModal
      accent={UEE_AMBER}
      kicker="◆ NEW PROSPECT · PIPELINE INTAKE"
      title="ADD CANDIDATE TO PIPELINE"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>CANCEL</button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={saving}>
            {saving ? 'ADDING...' : 'ADD TO PIPELINE'}
          </button>
        </>
      }
    >
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">SC HANDLE *</label>
          <input className="form-input" value={form.handle || ''}
            onChange={e => setForm(f => ({ ...f, handle: e.target.value }))}
            placeholder="StarCitizen handle" autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">DISCORD</label>
          <input className="form-input" value={form.discord || ''}
            onChange={e => setForm(f => ({ ...f, discord: e.target.value }))}
            placeholder="username" />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">REFERRED BY</label>
        <select className="form-select" value={form.referred_by || ''}
          onChange={e => setForm(f => ({ ...f, referred_by: e.target.value }))}>
          <option value="">— None —</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.handle}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">INITIAL NOTES</label>
        <textarea className="form-textarea" value={form.notes || ''}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Source, first impression, discovery context..."
          style={{ minHeight: 80 }} />
      </div>
      {error && <div className="form-error mb-8">{error}</div>}
    </UeeModal>
  )
}

function ProspectEditModal({ target, form, setForm, error, saving, onClose, onSubmit }) {
  return (
    <UeeModal
      accent={UEE_AMBER}
      kicker={`◆ PROSPECT FILE · ${target.handle.toUpperCase()}`}
      title="UPDATE VETTING STATUS"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>CANCEL</button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={saving}>
            {saving ? 'SAVING...' : 'UPDATE STATUS'}
          </button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">STAGE</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
          {STAGES.map(s => {
            const meta = STAGE_META[s]
            const sel = form.status === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => setForm(f => ({ ...f, status: s }))}
                style={{
                  textAlign: 'left', cursor: 'pointer',
                  background: sel ? `${meta.color}18` : 'var(--bg-raised)',
                  border: `1px solid ${sel ? meta.color : 'var(--border)'}`,
                  borderLeft: `3px solid ${meta.color}`,
                  borderRadius: 3, padding: '8px 10px',
                }}
              >
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.22em', fontWeight: 600,
                  color: meta.color, display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <span>{meta.glyph}</span> {s}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>
                  {meta.desc}
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">VETTING NOTES</label>
        <textarea className="form-textarea" value={form.notes || ''}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Assessment details, references, concerns..."
          style={{ minHeight: 100 }} />
      </div>
      {error && <div className="form-error mb-8">{error}</div>}
    </UeeModal>
  )
}

function InviteCreateModal({ form, setForm, saving, onClose, onSubmit }) {
  return (
    <UeeModal
      accent="#5ce0a1"
      kicker="◊ NEW REFERRAL · INVITE LINK"
      title="GENERATE INVITE CODE"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>CANCEL</button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={saving}>
            {saving ? 'GENERATING...' : 'GENERATE CODE'}
          </button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">LABEL · CAMPAIGN OR CONTEXT</label>
        <input className="form-input" value={form.inviteLabel || ''}
          onChange={e => setForm(f => ({ ...f, inviteLabel: e.target.value }))}
          placeholder="e.g. Reddit campaign, Discord server, personal referral"
          autoFocus />
        <div className="form-hint">Helps you see which outreach channels are landing applicants.</div>
      </div>
      <div className="form-group">
        <label className="form-label">MAX USES · BLANK FOR UNLIMITED</label>
        <input type="number" className="form-input" value={form.inviteMax || ''}
          onChange={e => setForm(f => ({ ...f, inviteMax: e.target.value }))}
          placeholder="∞" min={1} />
      </div>
      <div style={{
        padding: '10px 14px', background: 'rgba(92,224,161,0.08)',
        border: '1px solid rgba(92,224,161,0.35)', borderRadius: 4,
        fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.55,
      }}>
        An 8-character code will be generated on save. Share the URL{' '}
        <span style={{ fontFamily: 'var(--font-mono)', color: '#5ce0a1' }}>
          {window.location.origin}/apply?ref=CODE
        </span>{' '}
        to attribute new applications to this invite.
      </div>
    </UeeModal>
  )
}
