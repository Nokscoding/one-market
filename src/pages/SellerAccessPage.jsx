import { BarChart3, ClipboardList, ShoppingBag } from 'lucide-react'
import Loader from '../components/Loader'
import SellerApplicationForm from '../components/SellerApplicationForm'
import { useAuth } from '../context/AuthContext'
import SellerPage from './SellerPage'

const SELLER_ROLES = new Set(['seller', 'admin', 'global_admin'])

export default function SellerAccessPage() {
  const { profile, profileLoading } = useAuth()
  const isSeller = SELLER_ROLES.has(profile?.role)

  if (profileLoading) return <Loader fullscreen />
  if (isSeller) return <SellerPage />

  return (
    <main className="section-shell seller-join-page">
      <section className="seller-join-hero">
        <div>
          <span className="eyebrow">Vendre sur One Market</span>
          <h1>Ouvre ta boutique sur One Market.</h1>
          <p>Publie tes produits, gère ton stock et reçois les commandes depuis un seul espace vendeur.</p>
        </div>
        <div className="seller-join-points">
          <div><ShoppingBag size={21}/><span><strong>Catalogue vendeur</strong><small>Produits, prix et stock.</small></span></div>
          <div><ClipboardList size={21}/><span><strong>Commandes</strong><small>Suivi de chaque commande reçue.</small></span></div>
          <div><BarChart3 size={21}/><span><strong>Statistiques</strong><small>Activité et ventes de la boutique.</small></span></div>
        </div>
      </section>

      <SellerApplicationForm />
    </main>
  )
}
