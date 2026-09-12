import { Package, ShoppingBag, Store, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import SmartImage from './SmartImage'

export default function AllMenuDrawer({ open, onClose, user, profile }) {
  const [categories, setCategories] = useState([])

  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open || categories.length) return undefined
    let active = true
    supabase
      .from('categories')
      .select('id,name,image_url,sort_order')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (active) setCategories(data || [])
      })
      .catch(() => {
        if (active) setCategories([])
      })
    return () => { active = false }
  }, [open, categories.length])

  if (!open || typeof document === 'undefined') return null

  const firstName = profile?.full_name?.trim()?.split(' ')?.[0]
  const close = () => onClose()

  return createPortal(
    <div className="all-menu-backdrop" onMouseDown={close} role="presentation">
      <aside id="one-market-all-menu" className="all-menu-drawer" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Tout One Market">
        <div className="all-menu-head">
          <div>
            <span>{user ? `Bonjour${firstName ? `, ${firstName}` : ''}` : 'Bienvenue sur'}</span>
            <strong>One Market</strong>
          </div>
          <button onClick={close} aria-label="Fermer le menu"><X size={22} /></button>
        </div>

        <nav className="all-menu-primary">
          <Link to="/catalog?view=new" onClick={close}><ShoppingBag size={19} /><span><b>Nouveautés</b><small>Les derniers produits ajoutés</small></span></Link>
          <Link to="/catalog" onClick={close}><ShoppingBag size={19} /><span><b>Tous les produits</b><small>Parcourir tout le catalogue</small></span></Link>
          <Link to="/stores" onClick={close}><Store size={19} /><span><b>Boutiques</b><small>Découvrir les vendeurs One Market</small></span></Link>
          <Link to={user ? '/orders' : '/auth'} onClick={close}><Package size={19} /><span><b>Mes commandes</b><small>Suivre mes achats</small></span></Link>
          <Link to={user ? '/account' : '/auth'} onClick={close}><UserRound size={19} /><span><b>{user ? 'Mon compte' : 'Se connecter'}</b><small>Profil et informations personnelles</small></span></Link>
        </nav>

        <section className="all-menu-categories">
          <div className="all-menu-section-title"><span>Explorer par catégorie</span><Link to="/catalog?view=categories" onClick={close}>Voir tout</Link></div>
          <div className="all-menu-category-list">
            {categories.map((category) => (
              <Link key={category.id} to={`/catalog?category=${category.id}`} onClick={close}>
                <SmartImage src={category.image_url} alt={category.name} fallback={category.name.slice(0, 1).toUpperCase()} className="all-menu-category-image" fit="cover" />
                <span>{category.name}</span>
              </Link>
            ))}
            {!categories.length && <div className="all-menu-category-empty">Aucune catégorie disponible pour le moment.</div>}
          </div>
        </section>
      </aside>
    </div>,
    document.body,
  )
}
