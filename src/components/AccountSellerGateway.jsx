import { ArrowRight, CheckCircle2, Clock3, Store, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { SELLER_STATUS } from '../lib/seller'
import { supabase } from '../lib/supabase'
import AccountPage from '../pages/AccountPage'
import SellerApplicationForm from './SellerApplicationForm'

const SELLER_ROLES = new Set(['seller', 'admin', 'global_admin'])

export default function AccountSellerGateway() {
  const { user, profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const [application, setApplication] = useState(null)
  const isSeller = SELLER_ROLES.has(profile?.role)
  const applicationOpen = !isSeller && params.get('seller') === 'apply'

  useEffect(() => {
    if (!user?.id || isSeller) {
      setApplication(null)
      return
    }
    let active = true
    supabase.from('seller_applications').select('id,status,business_name,submitted_at,updated_at').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (active) setApplication(data || null) })
      .catch(() => {})
    return () => { active = false }
  }, [user?.id, isSeller, applicationOpen])

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

  const status = application ? SELLER_STATUS[application.status] || SELLER_STATUS.pending : null
  const inReview = application && ['pending', 'under_review'].includes(application.status)

  return (
    <>
      <section className="section-shell account-seller-gateway">
        <div className="account-seller-gateway-icon"><Store size={24}/></div>
        <div className="account-seller-gateway-copy">
          <span>{isSeller ? 'Espace vendeur actif' : inReview ? 'Demande vendeur en cours de vérification' : application ? `Dossier vendeur · ${status?.label || application.status}` : 'Vends sur One Market'}</span>
          <strong>{isSeller ? 'Gère ta boutique, tes produits et tes commandes.' : inReview ? `${application.business_name || 'Ta boutique'} est en cours d’examen par One Market.` : application ? 'Consulte ou complète ton dossier vendeur.' : 'Crée ta boutique et commence à vendre sur la marketplace.'}</strong>
        </div>
        {isSeller ? (
          <Link className="account-seller-gateway-action" to="/seller">Accéder à ma boutique <ArrowRight size={18}/></Link>
        ) : (
          <button className="account-seller-gateway-action" type="button" onClick={openApplication}>{application ? 'Voir mon dossier' : 'Devenir vendeur'} <ArrowRight size={18}/></button>
        )}
        {!isSeller && application && <div className={`account-seller-status-chip ${status?.tone || 'pending'}`}>{application.status === 'approved' ? <CheckCircle2 size={15}/> : <Clock3 size={15}/>} {status?.label}</div>}
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
