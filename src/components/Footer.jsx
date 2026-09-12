import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer om-footer">
      <div className="footer-inner om-footer-grid">
        <div className="om-footer-brand">
          <strong>OneMarket</strong>
          <p>Plusieurs boutiques. Un seul marché.</p>
          <span>Marketplace RDC · Paiement à la livraison</span>
        </div>

        <div className="om-footer-column">
          <strong>Marketplace</strong>
          <Link to="/catalog">Produits</Link>
          <Link to="/catalog?view=new">Nouveautés</Link>
          <Link to="/catalog?view=categories">Catégories</Link>
          <Link to="/stores">Boutiques</Link>
          <Link to="/seller">Vendre sur One Market</Link>
        </div>

        <div className="om-footer-column">
          <strong>Espace client</strong>
          <Link to="/account">Mon compte</Link>
          <Link to="/orders">Mes commandes</Link>
          <Link to="/favorites">Favoris</Link>
          <Link to="/account?tab=notifications">Notifications</Link>
          <Link to="/account?tab=support">Assistance</Link>
        </div>

        <div className="om-footer-column">
          <strong>Informations</strong>
          <Link to="/legal/conditions">Conditions d’utilisation</Link>
          <Link to="/legal/confidentialite">Confidentialité</Link>
          <Link to="/legal/cookies">Cookies</Link>
          <Link to="/legal/vendeurs">Conditions vendeur</Link>
          <Link to="/account?tab=security">Sécurité</Link>
        </div>
      </div>
      <div className="om-footer-bottom">
        <span>© {new Date().getFullYear()} One Market</span>
        <span>Powered by <strong>NKS Services</strong></span>
      </div>
    </footer>
  )
}
