// Singleton hook + realtime subscription for the public landing page
// readiness board (the OPERATIONAL · GREEN · WAITLIST cells under the hero)
// AND the recruitment-open flag that gates /apply.
//
// One row in org_settings (key='landing_status_board') holds everything so
// admins flip a single toggle and Landing.jsx + Apply.jsx + the waitlist
// eyebrows all change in real time without a page refresh.
//
// Mirrors the pattern in useMaintenanceMap.js: shared cache, shared
// channel, push notifications via emit(). Updating the row from anywhere
// (admin panel, SQL, another tab) propagates to every mounted subscriber.

import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export const STATUS_BOARD_KEY = 'landing_status_board'

// Defaults match what shipped before the row existed, so a fresh DB or a
// failed fetch doesn't leave the panel blank.
export const DEFAULT_STATUS_BOARD = {
  command:     { status: 'OPERATIONAL', color: 'green' },
  alert:       { status: 'GREEN',       color: 'green' },
  recruitment: { status: 'WAITLIST',    color: 'amber' },
  recruitment_open: false,
}

// Allowed color tokens — kept tight so admins can't paint the panel pink.
// Map to the matching CSS variable in src/index.css.
export const STATUS_COLORS = {
  green:  'var(--green)',
  amber:  'var(--amber)',
  red:    'var(--red)',
  accent: 'var(--accent)',
  muted:  'var(--text-3)',
}

export function statusColor(token) {
  return STATUS_COLORS[token] || STATUS_COLORS.accent
}

let cache = null
let listeners = new Set()
let loadPromise = null
let channel = null

function emit() {
  listeners.forEach(fn => fn(cache))
}

function normalize(value) {
  // Merge with defaults so partial updates don't crash readers expecting
  // every cell. Cells must exist; recruitment_open coerces to boolean.
  const v = value && typeof value === 'object' ? value : {}
  return {
    command:     { ...DEFAULT_STATUS_BOARD.command,     ...(v.command     || {}) },
    alert:       { ...DEFAULT_STATUS_BOARD.alert,       ...(v.alert       || {}) },
    recruitment: { ...DEFAULT_STATUS_BOARD.recruitment, ...(v.recruitment || {}) },
    recruitment_open: !!v.recruitment_open,
  }
}

async function loadOnce() {
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    const { data } = await supabase
      .from('org_settings')
      .select('value')
      .eq('key', STATUS_BOARD_KEY)
      .maybeSingle()
    cache = normalize(data?.value)
    emit()
  })()
  return loadPromise
}

function ensureChannel() {
  if (channel) return
  channel = supabase
    .channel('org-settings-status-board')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'org_settings', filter: `key=eq.${STATUS_BOARD_KEY}` },
      payload => {
        cache = normalize(payload.new?.value)
        emit()
      },
    )
    .subscribe()
}

// Optimistic local push so the admin who just saved sees the new state
// immediately, without waiting for the Realtime round-trip.
export function notifyStatusBoardChange(next) {
  cache = normalize(next)
  emit()
}

export function useStatusBoard() {
  const [board, setBoard] = useState(cache || DEFAULT_STATUS_BOARD)
  useEffect(() => {
    listeners.add(setBoard)
    ensureChannel()
    if (cache === null) loadOnce()
    else setBoard(cache)
    return () => { listeners.delete(setBoard) }
  }, [])
  return board || DEFAULT_STATUS_BOARD
}
