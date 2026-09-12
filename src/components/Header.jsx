import { ChevronDown, Home, MapPin, Menu, Package, Search, ShoppingCart, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { fetchCategories } from '../lib/catalog'
import Logo from './Logo'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false), [q,setQ] = useState(''), [categories,setCategories] = useState([]), [scrolled,setScrolled] = useState(false)
  const navigate=useNavigate(); const {user,profile}=useAuth(); const {count}=useCart(); const first=profile?.full_name?.split(' ')?.[0]
  useEffect(() => { fetchCategories().then(setCategories).catch(()=>{}) }, [])
  useEffect(() => { const fn=()=>setScrolled(window.scrollY>18); window.addEventListener('scroll',fn,{passive:true}); return()=>window.removeEventListener('scroll',fn) }, [])
  function search(e){e.preventDefault(); const v=q.trim(); navigate(v?`/catalog?q=${encodeURIComponent(v)}`:'/catalog'); setMenuOpen(false)}
  return <header className={`site-header ${scrolled?'is-scrolled':''}`}>
    <div className="header-main section-shell">
      <Logo/>
      <Link to="/catalog" className="delivery-chip"><MapPin size={19}/><span><small>Livraison</small><strong>RDC</strong></span></Link>
      <form className="main-search" onSubmit={search}><button type="button" className="search-category" onClick={()=>navigate('/catalog')}><span>Tout</span><ChevronDown size={15}/></button><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un produit, une boutique…"/><button aria-label="Rechercher"><Search size={22}/></button></form>
      <div className="header-actions"><Link to={user?'/account':'/auth'} className="header-action"><UserRound size={20}/><span><small>{user?`Bonjour${first?`, ${first}`:''}`:'Bonjour'}</small><strong>{user?'Mon compte':'Se connecter'}</strong></span></Link><Link to={user?'/orders':'/auth'} className="header-action desktop-only"><Package size={20}/><span><small>Retours &</small><strong>Commandes</strong></span></Link><Link to={user?'/cart':'/auth'} className="header-cart"><span><ShoppingCart size={30}/>{count>0&&<b>{count>99?'99+':count}</b>}</span><strong>Panier</strong></Link></div>
    </div>
    <div className="mobile-search section-shell"><form onSubmit={search}><Search size={20}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher sur One Market"/><button>Go</button></form></div>
    <nav className="subnav"><div className="section-shell subnav-inner"><button className="all-menu" onClick={()=>setMenuOpen(v=>!v)}><Menu size={18}/> Tout</button><NavLink to="/catalog">Nouveautés</NavLink>{categories.slice(0,5).map(c=><NavLink key={c.id} to={`/catalog?category=${c.id}`}>{c.name}</NavLink>)}<NavLink to="/stores">Boutiques</NavLink><span className="subnav-tagline">Plusieurs boutiques. Un seul marché.</span></div></nav>
    {menuOpen&&<div className="drawer-backdrop" onClick={()=>setMenuOpen(false)}><aside className="nav-drawer" onClick={e=>e.stopPropagation()}><div className="drawer-head"><div><small>Bienvenue sur</small><strong>One Market</strong></div><button onClick={()=>setMenuOpen(false)}><X/></button></div><div className="drawer-section"><h3>Explorer</h3><Link onClick={()=>setMenuOpen(false)} to="/catalog">Tous les produits</Link><Link onClick={()=>setMenuOpen(false)} to="/stores">Toutes les boutiques</Link>{categories.map(c=><Link onClick={()=>setMenuOpen(false)} key={c.id} to={`/catalog?category=${c.id}`}>{c.name}</Link>)}</div><div className="drawer-section"><h3>Votre compte</h3><Link onClick={()=>setMenuOpen(false)} to={user?'/orders':'/auth'}>Vos commandes</Link><Link onClick={()=>setMenuOpen(false)} to={user?'/account':'/auth'}>Votre compte</Link><Link onClick={()=>setMenuOpen(false)} to="/help">Aide & FAQ</Link></div></aside></div>}
    <nav className="mobile-bottom"><NavLink to="/" end><Home/><span>Accueil</span></NavLink><NavLink to="/catalog"><Search/><span>Explorer</span></NavLink><NavLink to={user?'/cart':'/auth'} className="mobile-cart"><span><ShoppingCart/>{count>0&&<b>{count}</b>}</span><em>Panier</em></NavLink><NavLink to={user?'/orders':'/auth'}><Package/><span>Commandes</span></NavLink><NavLink to={user?'/account':'/auth'}><UserRound/><span>Compte</span></NavLink></nav>
  </header>
}
