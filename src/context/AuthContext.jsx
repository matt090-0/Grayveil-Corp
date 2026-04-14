import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Listen for auth state changes — sync only
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Fetch profile whenever session user changes
  useEffect(() => {
    if (session === undefined) return // not initialised yet

    if (!session) {
      setProfile(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    // Use getSession() to guarantee a fresh, valid token before querying
    supabase.auth.getSession()
      .then(({ data: { session: current } }) => {
        if (cancelled || !current) {
          if (!cancelled) { setProfile(null); setLoading(false) }
          return
        }
        return supabase
          .from('profiles')
          .select('*')
          .eq('id', current.user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (!cancelled) { setProfile(data || null); setLoading(false) }
          })
      })
      .catch(() => {
        if (!cancelled) { setProfile(null); setLoading(false) }
      })

    return () => { cancelled = true }
  }, [session?.user?.id])

  async function refreshProfile() {
    if (!session) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
    setProfile(data || null)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
