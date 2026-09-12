import { ArrowRight, Store, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AccountPage from '../pages/AccountPage'
import SellerApplicationForm from './SellerApplicationForm'

const SELLER_ROLES = new Set(['seller', 'admin', 'global_admin'])

export default function AccountSellerGateway() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const isSeller = SELLER_ROLES.has(profile?.role)
  const applicationOpen = !isSeller && params.get('seller') === 'apply'

  function openApplication() {
    const next = new URLSearchParams(params)
    next.set('seller', 'apply')
    setParams(next)
  }

  function closeApplication() {
    const next = new URLSearchParams(params)
    next.delete('seller')
    setParams(next)
  }

  return (
    <>
      <section className="section-shell account-seller-gateway">
        <div className="account-seller-gateway-icon"><Store size={24}/></div>
        <div className="account-seller-gateway-copy">
          <span>{isSeller ? 'Espace vendeur actif' : 'Vends sur One Market'}</span>
          <strong>{isSeller ? 'Gère ta boutique, tes produits et tes commandes.' : 'Crée ta boutique et commence à vendre sur la marketplace.'}</strong>
        </div>
        {isSeller ? (
          <Link className="account-seller-gateway-action" to="/seller">Accéder à ma boutique <ArrowRight size={18}/></Link>
        ) : (
          <button className="account-seller-gateway-action" type="button" onClick={openApplication}>Devenir vendeur <ArrowRight size={18}/></button>
        )}
      </section>

      {applicationOpen && (
        <section className="section-shell account-seller-application-wrap">
          <button className="account-seller-application-close" type="button" onClick={closeApplication} aria-label="Fermer le formulaire vendeur"><X size={19}/></button>
          <SellerApplicationForm embedded />
        </section>
      )}

      <AccountPage />
    </>
  )
}
