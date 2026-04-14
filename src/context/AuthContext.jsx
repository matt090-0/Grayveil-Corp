import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(null)
  const [profile, setProfile]   = useState(null)
  const [loading, setLoading]   = useState(true)

  async function fetchProfile(userId) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      setProfile(data || null)
    } catch {
      setProfile(null)
    }
  }

  useEffect(() => {
    let mounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (session) {
          // Always keep loading=true while we fetch the profile
          // to prevent ProtectedRoute from briefly redirecting to /setup
          setLoading(true)
          setSession(session)
          await fetchProfile(session.user.id)
          if (mounted) setLoading(false)
        } else {
          setSession(null)
          setProfile(null)
          setLoading(false)
        }
      }
    )

    // Safety timeout in case Supabase never fires
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false)
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
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
