import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AccountLegalConsentGate from './AccountLegalConsentGate'
import Loader from './Loader'

export default function ProtectedRoute({ children }) {
  const { user, profile, loading, profileLoading } = useAuth()
  const location = useLocation()

  if (loading || (user && profileLoading)) return <Loader />
  if (!user) return <Navigate to="/auth" replace state={{ from: `${location.pathname}${location.search}` }} />
  if (!profile) return <div className="section-shell"><div className="alert error">Impossible de charger ton profil One Market. Actualise la page ou reconnecte-toi.</div></div>
  if (!profile.terms_accepted_at || !profile.privacy_accepted_at) return <AccountLegalConsentGate />

  return children
}
