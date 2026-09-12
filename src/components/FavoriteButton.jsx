import { Heart } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'

export default function FavoriteButton({ productId, className = '', showLabel = false }) {
  const { user } = useAuth()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const active = isFavorite(productId)

  async function toggle(event) {
    event?.preventDefault?.()
    event?.stopPropagation?.()

    if (!user) {
      navigate('/auth', { state: { from: `${location.pathname}${location.search}${location.hash}` } })
      return
    }

    if (busy) return
    setBusy(true)
    try {
      await toggleFavorite(productId)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={`favorite-button ${active ? 'is-active' : ''} ${className}`.trim()}
      onClick={toggle}
      disabled={busy}
      aria-pressed={active}
      aria-label={active ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      title={active ? 'Retirer des favoris' : 'Ajouter aux favoris'}
    >
      <Heart size={18} fill={active ? 'currentColor' : 'none'} />
      {showLabel && <span>{active ? 'Dans mes favoris' : 'Ajouter aux favoris'}</span>}
    </button>
  )
}
