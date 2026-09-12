import { ArrowRight, ChevronRight, Globe2, MessageCircle, Store as StoreIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import Loader from '../components/Loader'
import { supabase } from '../lib/supabase'

/**
 * ROUTE: /
 * PUBLIC: oui
 * RÔLE: tous les visiteurs
 * BUT: page d'accueil, sélections RDC/USA, catégories, boutiques et nouveautés.
 * SUPABASE: products, stores, categories, product_images.
 */

function MiniProduct({ product }) {
  return <Link to={`/product/${product.id}`} className="mini-product"><div className="mini-product-image">{product.image ? <img src={product.image} alt="" /> : <span>OM</span>}</div><span>{product.name}</span></Link>
}

export default function Home() {
  const [products, setProducts] = useState([])
  const [stores, setStores] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('products').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(20),
      supabase.from('stores').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(8),
      supabase.from('categories').select('*').eq('is_active', true).order('sort_order').limit(8),
    ]).then(async ([pRes, sRes, cRes]) => {
      const baseProducts = pRes.data || []
      const ids = baseProducts.map(p => p.id)
      const storeIds = [...new Set(baseProducts.map(p => p.store_id))]
      const [{ data: images }, { data: productStores }] = await Promise.all([
        ids.length ? supabase.from('product_images').select('*').in('product_id', ids).order('sort_order') : Promise.resolve({ data: [] }),
        storeIds.length ? supabase.from('stores').select('id,name,slug,country_code').in('id', storeIds) : Promise.resolve({ data: [] }),
      ])
      const firstImage = {}; (images || []).forEach(img => { if (!firstImage[img.product_id]) firstImage[img.product_id] = img.secure_url })
      const storeMap = Object.fromEntries((productStores || []).map(s => [s.id, s]))
      setProducts(baseProducts.map(p => ({ ...p, image: firstImage[p.id], store: storeMap[p.store_id] })))
      setStores(sRes.data || []); setCategories(cRes.data || []); setLoading(false)
    })
  }, [])

  const featured = products.slice(0, 4)
  const rdcProducts = useMemo(() => products.filter(p => p.store?.country_code === 'CD').slice(0, 4), [products])
  const usaProducts = useMemo(() => products.filter(p => p.store?.country_code === 'US').slice(0, 4), [products])

  if (loading) return <Loader fullscreen />

  return <main className="market-home"><section className="market-hero-wrap"><div className="market-hero section-shell"><div className="market-hero-copy"><span>OneMarket</span><h1>Tout votre shopping, au même endroit.</h1><p>Achetez auprès de boutiques sélectionnées en RDC et aux États-Unis. Chaque vendeur organise directement avec vous le paiement et la livraison.</p><Link to="/catalog">Voir les produits <ArrowRight size={18} /></Link></div><div className="market-hero-products" aria-label="Nouveautés">{featured.length ? featured.map(product => <MiniProduct key={product.id} product={product} />) : <div className="market-hero-empty"><strong>Les premiers produits arrivent.</strong><span>Les boutiques publieront bientôt leurs articles.</span></div>}</div></div></section><section className="section-shell marketplace-panels"><article className="market-panel"><div className="market-panel-title"><h2>Explorer les catégories</h2><ChevronRight size={24} /></div><div className="market-mini-grid category-mini-grid">{categories.slice(0, 4).map(category => <Link key={category.id} to={`/catalog?category=${category.id}`} className="panel-category"><div>{category.image_url ? <img src={category.image_url} alt="" /> : <span>{category.name.slice(0, 1)}</span>}</div><strong>{category.name}</strong></Link>)}{!categories.length && <div className="panel-empty">Les catégories apparaîtront ici.</div>}</div><Link className="panel-link" to="/catalog?view=categories">Toutes les catégories</Link></article><article className="market-panel"><div className="market-panel-title"><h2>Nouveautés</h2><ChevronRight size={24} /></div><div className="market-mini-grid">{featured.map(product => <MiniProduct key={product.id} product={product} />)}{!featured.length && <div className="panel-empty">Nouveaux produits à venir.</div>}</div><Link className="panel-link" to="/catalog">Voir les nouveautés</Link></article><article className="market-panel"><div className="market-panel-title"><h2>Shopping en RDC</h2><ChevronRight size={24} /></div><div className="market-mini-grid">{rdcProducts.map(product => <MiniProduct key={product.id} product={product} />)}{!rdcProducts.length && <div className="panel-empty">Les produits des boutiques RDC apparaîtront ici.</div>}</div><Link className="panel-link" to="/catalog?country=CD">Voir la sélection RDC</Link></article><article className="market-panel"><div className="market-panel-title"><h2>Shopping aux USA</h2><ChevronRight size={24} /></div><div className="market-mini-grid">{usaProducts.map(product => <MiniProduct key={product.id} product={product} />)}{!usaProducts.length && <div className="panel-empty">Les produits des boutiques USA apparaîtront ici.</div>}</div><Link className="panel-link" to="/catalog?country=US">Voir la sélection USA</Link></article></section><section className="section-shell marketplace-strip"><div><StoreIcon size={21}/><strong>Boutiques privées</strong><span>Vendeurs invités par OneMarket.</span></div><div><Globe2 size={21}/><strong>RDC ↔ USA</strong><span>Les commandes internationales sont possibles.</span></div><div><MessageCircle size={21}/><strong>Contact direct</strong><span>Discutez paiement et livraison après commande.</span></div></section><section className="section-shell market-product-section"><div className="market-section-heading"><h2>Derniers produits</h2><Link to="/catalog">Voir tout <ArrowRight size={17}/></Link></div>{products.length ? <div className="product-grid">{products.slice(0, 12).map(p => <ProductCard key={p.id} product={p} />)}</div> : <div className="market-empty-products"><h3>Le catalogue se prépare.</h3><p>Ajoutez les premières boutiques et leurs produits depuis l'espace vendeur.</p></div>}</section>{stores.length > 0 && <section className="section-shell market-store-section"><div className="market-section-heading"><h2>Boutiques à découvrir</h2><Link to="/stores">Toutes les boutiques <ArrowRight size={17}/></Link></div><div className="store-grid">{stores.slice(0, 6).map(store => <Link to={`/store/${store.slug}`} className="store-card" key={store.id}>{store.logo_url ? <img src={store.logo_url} alt={store.name} /> : <div className="store-avatar">{store.name.slice(0,2).toUpperCase()}</div>}<div><strong>{store.name}</strong><span>{store.country_code === 'US' ? 'États-Unis' : 'RDC'}</span></div><ChevronRight size={20}/></Link>)}</div></section>}</main>
}
