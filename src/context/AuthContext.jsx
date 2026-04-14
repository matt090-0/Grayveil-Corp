import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [ready, setReady]     = useState(false)

  async function loadProfile(userId) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      setProfile(data || null)
    } catch {
      setProfile(null)
    }
  }

  useEffect(() => {
    // Single source of truth — onAuthStateChange fires INITIAL_SESSION
    // immediately on mount, covering the "existing session" case too
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if (session) {
            setSession(session)
            await loadProfile(session.user.id)
          } else {
            setSession(null)
            setProfile(null)
          }
        } catch {
          setSession(null)
          setProfile(null)
        } finally {
          setReady(true) // always fires — no more stuck states
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function refreshProfile() {
    if (session) await loadProfile(session.user.id)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, profile, ready, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
