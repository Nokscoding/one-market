import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(supabaseConfigured)
  const [profileLoading, setProfileLoading] = useState(false)

  const loadProfile = useCallback(async (userId) => {
    if (!supabase || !userId) { setProfile(null); return null }
    setProfileLoading(true)
    try {
      const { data, error } = await supabase.from('profiles').select('id,role,account_status,full_name,phone,avatar_url,created_at,updated_at').eq('id', userId).maybeSingle()
      if (error) throw error
      setProfile(data || null)
      return data || null
    } catch { setProfile(null); return null }
    finally { setProfileLoading(false) }
  }, [])

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data?.session || null); setLoading(false)
    }).catch(() => active && setLoading(false))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) { setSession(next || null); setLoading(false) }
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => { loadProfile(session?.user?.id) }, [session?.user?.id, loadProfile])
  const refreshProfile = useCallback(() => loadProfile(session?.user?.id), [loadProfile, session?.user?.id])
  const value = useMemo(() => ({ session, user: session?.user || null, profile, loading, profileLoading, refreshProfile }), [session, profile, loading, profileLoading, refreshProfile])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() { return useContext(AuthContext) }
