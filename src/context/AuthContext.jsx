import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(null)
  const [profile, setProfile]   = useState(null)
  const [loading, setLoading]   = useState(true)

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle() // returns null (not error) when no row found

    if (error) {
      // Fetch failed — sign out so user lands on /auth not /setup
      console.error('Profile fetch failed:', error.message)
      await supabase.auth.signOut()
      setSession(null)
      setProfile(null)
    } else {
      setProfile(data || null)
    }
  }

  useEffect(() => {
    let mounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (session) {
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
