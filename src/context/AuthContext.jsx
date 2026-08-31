import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * AuthContext centralise la session Supabase et le profil One Market.
 * Ne pas mettre de logique de privilège uniquement ici : les permissions doivent être
 * imposées côté base avec RLS.
 */

const AuthContext = createContext(null)
const AUTH_BOOT_FAILSAFE_MS = 6000

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      setProfileError('')
      setProfileLoading(false)
      return null
    }

    setProfileLoading(true)
    setProfileError('')

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) throw error
      setProfile(data || null)
      return data || null
    } catch (error) {
      setProfile(null)
      setProfileError(error?.message || 'Impossible de charger le profil.')
      return null
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true

    const failsafe = window.setTimeout(() => {
      if (active) setLoading(false)
    }, AUTH_BOOT_FAILSAFE_MS)

    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!active) return
        setSession(data?.session || null)
      } finally {
        if (active) setLoading(false)
        window.clearTimeout(failsafe)
      }
    })()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession || null)
      setLoading(false)
    })

    return () => {
      active = false
      window.clearTimeout(failsafe)
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true
    const userId = session?.user?.id

    if (!userId) {
      setProfile(null)
      setProfileError('')
      setProfileLoading(false)
      return () => { active = false }
    }

    ;(async () => {
      const data = await loadProfile(userId)
      if (!active || data) return
      await new Promise(resolve => window.setTimeout(resolve, 350))
      if (active) await loadProfile(userId)
    })()

    return () => { active = false }
  }, [session?.user?.id, loadProfile])

  const refreshProfile = useCallback(async () => {
    return loadProfile(session?.user?.id)
  }, [loadProfile, session?.user?.id])

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    profile,
    loading,
    profileLoading,
    profileError,
    refreshProfile,
  }), [session, profile, loading, profileLoading, profileError, refreshProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
