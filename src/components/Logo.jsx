import { ShoppingCart } from 'lucide-react'
import { Link } from 'react-router-dom'
export default function Logo({ className = '' }) {
  return <Link to="/" className={`om-logo ${className}`} aria-label="One Market accueil"><span className="om-logo-mark"><ShoppingCart size={21}/><i/></span><span className="om-logo-name">ONE <b>MARKET</b></span></Link>
}
