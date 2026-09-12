import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

const FavoritesContext = createContext(null)

export function FavoritesProvider({ children }) {
  const { user } = useAuth()
  const [favorites, setFavorites] = useState(() => new Set())
  const [loading, setLoading] = useState(false)
  const favoritesRef = useRef(favorites)

  useEffect(() => {
    favoritesRef.current = favorites
  }, [favorites])

  useEffect(() => {
    let active = true

    if (!user?.id) {
      setFavorites(new Set())
      setLoading(false)
      return () => { active = false }
    }

    setLoading(true)
    supabase
      .from('product_favorites')
      .select('product_id')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (!active) return
        if (error) throw error
        setFavorites(new Set((data || []).map(item => item.product_id)))
      })
      .catch(() => {
        if (active) setFavorites(new Set())
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [user?.id])

  const isFavorite = useCallback((productId) => favoritesRef.current.has(productId), [])

  const toggleFavorite = useCallback(async (productId) => {
    if (!user?.id) throw new Error('AUTH_REQUIRED')

    const wasFavorite = favoritesRef.current.has(productId)
    const optimistic = new Set(favoritesRef.current)
    if (wasFavorite) optimistic.delete(productId)
    else optimistic.add(productId)
    favoritesRef.current = optimistic
    setFavorites(new Set(optimistic))

    try {
      if (wasFavorite) {
        const { error } = await supabase
          .from('product_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('product_favorites')
          .insert({ user_id: user.id, product_id: productId })
        if (error) throw error
      }
      return !wasFavorite
    } catch (error) {
      const rollback = new Set(favoritesRef.current)
      if (wasFavorite) rollback.add(productId)
      else rollback.delete(productId)
      favoritesRef.current = rollback
      setFavorites(new Set(rollback))
      throw error
    }
  }, [user?.id])

  const value = useMemo(() => ({
    favorites,
    loading,
    isFavorite,
    toggleFavorite,
  }), [favorites, loading, isFavorite, toggleFavorite])

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const context = useContext(FavoritesContext)
  if (!context) throw new Error('useFavorites doit être utilisé dans FavoritesProvider')
  return context
}
