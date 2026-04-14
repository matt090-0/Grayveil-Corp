import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }) {
  const [session, setSession]     = useState(undefined) // undefined = not yet checked
  const [profile, setProfile]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const profileFetchId = useRef(0) // prevents stale fetches from overwriting fresh ones

  // ── 1. SESSION: synchronous listener + explicit getSession fallback ──
  useEffect(() => {
    let ignore = false

    // Synchronous callback — no async, no race conditions, StrictMode safe
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        if (!ignore) setSession(s)
      }
    )

    // Explicit fallback — guarantees we get the initial session
    // even if INITIAL_SESSION event was missed (StrictMode double-mount)
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!ignore) setSession(s)
    })

    return () => {
      ignore = true
      subscription.unsubscribe()
    }
  }, [])

  // ── 2. PROFILE: reactive fetch whenever session changes ──
  useEffect(() => {
    // session is still undefined — haven't checked yet, stay loading
    if (session === undefined) return

    // No session — clear profile, done loading
    if (!session) {
      setProfile(null)
      setLoading(false)
      return
    }

    // Session exists — fetch profile
    let ignore = false
    const fetchId = ++profileFetchId.current

    async function loadProfile() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()

        // Only apply if this is still the latest fetch
        if (ignore || fetchId !== profileFetchId.current) return

        if (error) {
          console.error('[Auth] profile fetch error:', error.message)
          setProfile(null)
        } else {
          setProfile(data) // null if no profile row yet (new user)
        }
      } catch (err) {
        console.error('[Auth] profile fetch exception:', err)
        if (!ignore) setProfile(null)
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    loadProfile()
    return () => { ignore = true }
  }, [session])

  // ── 3. SAFETY TIMEOUT — never stay loading forever ──
  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => setLoading(false), 5000)
    return () => clearTimeout(t)
  }, [loading])

  // ── 4. ACTIONS ──
  const refreshProfile = useCallback(async () => {
    const { data: { session: s } } = await supabase.auth.getSession()
    if (!s?.user?.id) return null
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', s.user.id)
        .maybeSingle()
      setProfile(data)
      return data
    } catch {
      return null
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
