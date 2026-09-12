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
        </div>

        <div className="om-footer-column">
          <strong>Espace client</strong>
          <Link to="/account">Mon compte</Link>
          <Link to="/account?tab=profile">Infos personnelles</Link>
          <Link to="/account?tab=addresses">Adresses</Link>
          <Link to="/orders">Mes commandes</Link>
          <Link to="/favorites">Favoris</Link>
        </div>

        <div className="om-footer-column">
          <strong>Aide & paiement</strong>
          <Link to="/account?tab=client">Espace client</Link>
          <Link to="/account?tab=payments">Modes de paiement</Link>
          <Link to="/account?tab=support">Signaler un problème</Link>
          <Link to="/account?tab=notifications">Notifications</Link>
          <Link to="/account?tab=security">Sécurité</Link>
        </div>
      </div>
      <div className="om-footer-bottom">
        <span>© One Market</span>
        <span>Powered by <strong>NKS Services</strong></span>
      </div>
    </footer>
  )
}
