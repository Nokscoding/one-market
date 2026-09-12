import { Home, MapPin, Menu, Package, Search, ShoppingCart, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import AllMenuDrawer from './AllMenuDrawer'
import Logo from './Logo'

export default function Header() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { count } = useCart()

  function search(e) {
    e.preventDefault()
    const value = q.trim()
    navigate(value ? `/catalog?q=${encodeURIComponent(value)}` : '/catalog')
    setOpen(false)
  }

  const firstName = profile?.full_name?.trim()?.split(' ')?.[0]

  return (
    <header className="site-header market-header">
      <div className="market-topbar"><div className="market-topbar-inner">
        <Logo />
        <Link className="market-location desktop-location" to="/catalog"><MapPin size={19} /><span><small>Marketplace</small><strong>RDC</strong></span></Link>
        <form className="nav-search market-search" onSubmit={search}><select aria-label="Catégorie" defaultValue="all" onChange={e => { if (e.target.value === 'stores') navigate('/stores'); if (e.target.value === 'all') navigate('/catalog') }}><option value="all">Tous</option><option value="stores">Boutiques</option></select><input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher sur OneMarket" /><button type="submit" aria-label="Rechercher"><Search size={22} /></button></form>
        <div className="nav-actions market-actions"><Link className="market-account" to={user ? '/account' : '/auth'}><UserRound className="mobile-account-icon" size={21} /><span><small>{user ? `Bonjour${firstName ? `, ${firstName}` : ''}` : 'Bonjour'}</small><strong>{user ? 'Mon compte' : 'Se connecter'}</strong></span></Link><Link className="market-orders desktop-orders" to={user ? '/orders' : '/auth'}><Package size={20} /><span><small>Suivi</small><strong>Commandes</strong></span></Link><Link className="market-cart" to="/cart" aria-label="Panier"><span className="market-cart-icon"><ShoppingCart size={29} />{count > 0 && <b>{count > 99 ? '99+' : count}</b>}</span><strong>Panier</strong></Link></div>
      </div><div className="mobile-search-row"><form className="mobile-market-search" onSubmit={search}><Search className="mobile-search-leading" size={21} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un produit ou une boutique" /><button type="submit" aria-label="Rechercher"><Search size={20} /></button></form><Link className="mobile-location-button" to="/catalog" aria-label="Explorer One Market RDC"><MapPin size={23} /></Link></div></div>
      <div className="market-subnav"><div className="market-subnav-inner"><button className="all-link" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="one-market-all-menu"><Menu size={18} /> Tout</button><NavLink to="/catalog?view=new">Nouveautés</NavLink><NavLink to="/catalog">Produits</NavLink><NavLink to="/stores">Boutiques</NavLink><NavLink to="/catalog?view=categories">Catégories</NavLink><span className="subnav-message">Plusieurs boutiques. Un seul marché.</span></div></div>
      <AllMenuDrawer open={open} onClose={() => setOpen(false)} user={user} profile={profile} />
      <nav className="mobile-bottom-nav" aria-label="Navigation mobile"><NavLink to="/" end><Home size={23}/><span>Accueil</span></NavLink><NavLink to={user ? '/account' : '/auth'}><UserRound size={23}/><span>Compte</span></NavLink><NavLink className="mobile-bottom-cart" to={user ? '/cart' : '/auth'}><span><ShoppingCart size={25}/>{count > 0 && <b>{count > 99 ? '99+' : count}</b>}</span><em>Panier</em></NavLink><NavLink to={user ? '/orders' : '/auth'}><Package size={23}/><span>Commandes</span></NavLink><button className={open ? 'active' : ''} onClick={() => setOpen(v => !v)} aria-label="Menu">{open ? <X size={23}/> : <Menu size={23}/>}<span>Menu</span></button></nav>
    </header>
  )
}
