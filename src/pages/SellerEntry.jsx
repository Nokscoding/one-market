import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import SellerPage from './SellerPage'

const SELLER_ROLES = new Set(['seller', 'admin', 'global_admin'])

export default function SellerEntry() {
  const { user, profile, refreshProfile } = useAuth()
  const sellerReady = SELLER_ROLES.has(profile?.role)

  useEffect(() => {
    if (!user?.id || sellerReady) return undefined

    // Temporaire pendant la phase de test : après une demande vendeur,
    // Supabase promeut automatiquement le compte. On récupère le nouveau
    // rôle sans demander au testeur de se déconnecter/reconnecter.
    let active = true
    const sync = () => {
      if (active) refreshProfile().catch(() => {})
    }

    const timer = window.setInterval(sync, 1200)
    const onFocus = () => sync()
    window.addEventListener('focus', onFocus)

    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [user?.id, sellerReady, refreshProfile])

  return <SellerPage />
}
