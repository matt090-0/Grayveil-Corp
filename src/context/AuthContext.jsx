import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]         = useState(null)
  const [profile, setProfile]         = useState(null)
  const [loading, setLoading]         = useState(true)
  const [profileLoaded, setProfileLoaded] = useState(false)

  async function fetchProfile(userId) {
    setProfileLoaded(false)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    setProfile(data || null)
    setProfileLoaded(true)
  }

  useEffect(() => {
    let mounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        if (session) {
          setSession(session)
          await fetchProfile(session.user.id)
        } else {
          setSession(null)
          setProfile(null)
          setProfileLoaded(true)
        }
        if (mounted) setLoading(false)
      }
    )

    const timeout = setTimeout(() => {
      if (mounted) { setLoading(false); setProfileLoaded(true) }
    }, 8000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function refreshProfile() {
    if (session) await fetchProfile(session.user.id)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
    setProfileLoaded(true)
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, profileLoaded, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
