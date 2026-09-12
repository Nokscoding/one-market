import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div><strong>OneMarket</strong><p>Plusieurs boutiques. Un seul marché.</p></div>
        <div className="footer-links"><Link to="/catalog">Produits</Link><Link to="/stores">Boutiques</Link><Link to="/account">Mon compte</Link></div>
        <div className="powered">Powered by <strong>NKS Services</strong></div>
      </div>
    </footer>
  )
}
