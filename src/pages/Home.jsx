import { ArrowRight, ChevronRight, MessageCircle, Store as StoreIcon, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Loader from '../components/Loader'
import ProductCard from '../components/ProductCard'
import SmartImage from '../components/SmartImage'
import StoreTrustBadge from '../components/StoreTrustBadge'
import { supabase } from '../lib/supabase'

function MiniProduct({ product }) {
  return <Link to={`/product/${product.id}`} className="mini-product"><div className="mini-product-image"><SmartImage src={product.image} alt={product.name} fallback="OM" fit="contain" width={320}/></div><span>{product.name}</span></Link>
}

export default function Home() {
  const [products, setProducts] = useState([])
  const [stores, setStores] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.all([
      supabase.from('products').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(30),
      supabase.from('stores').select('*').eq('status', 'active').eq('country_code', 'CD').order('created_at', { ascending: false }).limit(8),
      supabase.from('categories').select('*').eq('is_active', true).order('sort_order').limit(8),
    ]).then(async ([pRes, sRes, cRes]) => {
      if (!active) return
      const baseProducts = pRes.data || []
      const ids = baseProducts.map(p => p.id)
      const storeIds = [...new Set(baseProducts.map(p => p.store_id))]
      const [{ data: images }, { data: productStores }] = await Promise.all([
        ids.length ? supabase.from('product_images').select('*').in('product_id', ids).order('sort_order') : Promise.resolve({ data: [] }),
        storeIds.length ? supabase.from('stores').select('id,name,slug,country_code,status,is_verified,is_partner').in('id', storeIds) : Promise.resolve({ data: [] }),
      ])
      if (!active) return
      const firstImage = {}
      ;(images || []).forEach(img => { if (!firstImage[img.product_id] && img.secure_url) firstImage[img.product_id] = img.secure_url })
      const storeMap = Object.fromEntries((productStores || []).map(s => [s.id, s]))
      const rdcProducts = baseProducts.map(p => ({ ...p, image: firstImage[p.id], store: storeMap[p.store_id] })).filter(p => p.store?.country_code === 'CD' && p.store?.status === 'active')
      setProducts(rdcProducts)
      setStores(sRes.data || [])
      setCategories(cRes.data || [])
      setLoading(false)
    }).catch(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const featured = products.slice(0, 4)
  const localSelection = products.slice(4, 8)

  if (loading) return <Loader fullscreen />

  return <main className="market-home">
    <section className="market-hero-wrap"><div className="market-hero section-shell"><div className="market-hero-copy"><span>One Market</span><h1>Tout votre shopping, au même endroit.</h1><p>Découvrez plusieurs boutiques en RDC, trouvez vos produits et commandez simplement. Le paiement se fait directement auprès du livreur à la réception.</p><Link to="/catalog">Voir les produits <ArrowRight size={18}/></Link></div><div className="market-hero-products" aria-label="Nouveautés">{featured.length ? featured.map(product => <MiniProduct key={product.id} product={product}/>) : <div className="market-hero-empty"><strong>Découvrez One Market.</strong><span>Parcourez les boutiques et leurs produits.</span></div>}</div></div></section>

    <section className="section-shell marketplace-panels">
      <article className="market-panel"><div className="market-panel-title"><h2>Explorer les catégories</h2><ChevronRight size={24}/></div><div className="market-mini-grid category-mini-grid">{categories.slice(0, 4).map(category => <Link key={category.id} to={`/catalog?category=${category.id}`} className="panel-category"><div><SmartImage src={category.image_url} alt={category.name} fallback={category.name.slice(0,1).toUpperCase()} fit="cover" width={240}/></div><strong>{category.name}</strong></Link>)}</div><Link className="panel-link" to="/catalog?view=categories">Toutes les catégories</Link></article>
      <article className="market-panel"><div className="market-panel-title"><h2>Nouveautés</h2><ChevronRight size={24}/></div><div className="market-mini-grid">{featured.map(product => <MiniProduct key={product.id} product={product}/>)}</div><Link className="panel-link" to="/catalog?view=new">Voir les nouveautés</Link></article>
      <article className="market-panel"><div className="market-panel-title"><h2>Shopping en RDC</h2><ChevronRight size={24}/></div><div className="market-mini-grid">{localSelection.map(product => <MiniProduct key={product.id} product={product}/>)}</div><Link className="panel-link" to="/catalog">Voir la sélection</Link></article>
      <article className="market-panel"><div className="market-panel-title"><h2>Paiement à la livraison</h2><ChevronRight size={24}/></div><div className="panel-empty">Commandez en ligne et payez directement le livreur lorsque vous recevez votre commande.</div><Link className="panel-link" to="/catalog">Commencer mes achats</Link></article>
    </section>

    <section className="section-shell marketplace-strip"><div><StoreIcon size={21}/><strong>Plusieurs boutiques</strong><span>Un seul marché pour vos achats.</span></div><div><Truck size={21}/><strong>Livraison en RDC</strong><span>Livraison normale ou express selon votre choix.</span></div><div><MessageCircle size={21}/><strong>Suivi simple</strong><span>Retrouvez vos commandes et messages depuis votre compte.</span></div></section>

    <section className="section-shell market-product-section"><div className="market-section-heading"><h2>Derniers produits</h2><Link to="/catalog">Voir tout <ArrowRight size={17}/></Link></div>{products.length ? <div className="product-grid">{products.slice(0, 12).map(p => <ProductCard key={p.id} product={p}/>)}</div> : <div className="market-empty-products"><h3>Aucun produit disponible</h3><p>Revenez bientôt pour découvrir les produits des boutiques One Market.</p></div>}</section>

    {stores.length > 0 && <section className="section-shell market-store-section"><div className="market-section-heading"><h2>Boutiques à découvrir</h2><Link to="/stores">Toutes les boutiques <ArrowRight size={17}/></Link></div><div className="store-grid">{stores.slice(0, 6).map(store => <Link to={`/store/${store.slug}`} className="store-card" key={store.id}><SmartImage src={store.logo_url} alt={store.name} fallback={store.name.slice(0,2).toUpperCase()} className="home-store-logo" fit="contain" width={180}/><div><span className="home-store-name"><strong>{store.name}</strong><StoreTrustBadge store={store} compact/></span><span>RDC{store.city ? ` · ${store.city}` : ''}</span></div><ChevronRight size={20}/></Link>)}</div></section>}
  </main>
}
