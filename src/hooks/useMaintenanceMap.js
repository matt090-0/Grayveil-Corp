import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

let cache = null
let listeners = new Set()
let loading = false

async function loadOnce() {
  if (loading) return
  loading = true
  const { data } = await supabase.from('org_settings').select('value').eq('key', 'page_maintenance').maybeSingle()
  cache = data?.value || {}
  listeners.forEach(fn => fn(cache))
  loading = false
}

export function notifyMaintenanceChange(next) {
  cache = next || {}
  listeners.forEach(fn => fn(cache))
}

export function useMaintenanceMap() {
  const [map, setMap] = useState(cache)
  useEffect(() => {
    listeners.add(setMap)
    if (cache === null) loadOnce()
    else setMap(cache)

    const channel = supabase
      .channel('org-settings-maintenance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'org_settings', filter: 'key=eq.page_maintenance' }, payload => {
        const v = payload.new?.value || {}
        notifyMaintenanceChange(v)
      })
      .subscribe()

    return () => {
      listeners.delete(setMap)
      supabase.removeChannel(channel)
    }
  }, [])
  return map || {}
}
