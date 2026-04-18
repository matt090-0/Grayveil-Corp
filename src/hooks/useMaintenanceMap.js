import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

let cache = null
let listeners = new Set()
let loadPromise = null
let channel = null

function emit() {
  listeners.forEach(fn => fn(cache))
}

async function loadOnce() {
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    const { data } = await supabase.from('org_settings').select('value').eq('key', 'page_maintenance').maybeSingle()
    cache = data?.value || {}
    emit()
  })()
  return loadPromise
}

function ensureChannel() {
  if (channel) return
  channel = supabase
    .channel('org-settings-maintenance')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'org_settings', filter: 'key=eq.page_maintenance' },
      payload => {
        cache = payload.new?.value || {}
        emit()
      },
    )
    .subscribe()
}

export function notifyMaintenanceChange(next) {
  cache = next || {}
  emit()
}

export function useMaintenanceMap() {
  const [map, setMap] = useState(cache)
  useEffect(() => {
    listeners.add(setMap)
    ensureChannel()
    if (cache === null) loadOnce()
    else setMap(cache)
    return () => { listeners.delete(setMap) }
  }, [])
  return map || {}
}
