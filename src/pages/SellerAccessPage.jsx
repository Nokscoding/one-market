import { BarChart3, ClipboardList, ShoppingBag } from 'lucide-react'
import Loader from '../components/Loader'
import SellerApplicationForm from '../components/SellerApplicationForm'
import { useAuth } from '../context/AuthContext'
import SellerWorkspacePage from './SellerWorkspacePage'

const SELLER_ROLES = new Set(['seller', 'admin', 'global_admin'])

export default function SellerAccessPage() {
  const { profile, profileLoading } = useAuth()
  const isSeller = SELLER_ROLES.has(profile?.role)

  if (profileLoading) return <Loader fullscreen />
  if (isSeller) return <SellerWorkspacePage />

  return (
    <main className="section-shell seller-join-page">
      <section className="seller-join-hero">
        <div>
          <span className="eyebrow">Vendre sur One Market</span>
          <h1>Ouvre ta boutique sur One Market.</h1>
          <p>Choisis ton type de vendeur, fais vérifier ton activité puis gère produits, stock et commandes depuis un seul espace.</p>
        </div>
        <div className="seller-join-points">
          <div><ShoppingBag size={21}/><span><strong>Catalogue vendeur</strong><small>Produits, images, variantes, prix et stock.</small></span></div>
          <div><ClipboardList size={21}/><span><strong>Commandes</strong><small>Suivi de chaque commande et de la livraison.</small></span></div>
          <div><BarChart3 size={21}/><span><strong>Statistiques</strong><small>Uniquement des données réelles de la boutique.</small></span></div>
        </div>
      </section>

      <SellerApplicationForm />
    </main>
  )
}
