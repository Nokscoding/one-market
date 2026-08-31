import { Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import { supabase } from '../lib/supabase'

export default function Catalog() {
  const [params, setParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const q = params.get('q') || ''
  const category = params.get('category') || ''
  const country = params.get('country') || ''
  useEffect(() => { supabase.from('categories').select('*').eq('is_active', true).order('sort_order').then(({ data }) => setCategories(data || [])) }, [])
  useEffect(() => {
    setLoading(true)
    let query = supabase.from('products').select('*').eq('is_active', true).order('created_at', { ascending: false })
    if (q) query = query.ilike('name', `%${q}%`)
    if (category) query = query.eq('category_id', category)
    query.then(async ({ data }) => {
      let list = data || []
      const productIds = list.map(p => p.id); const storeIds = [...new Set(list.map(p => p.store_id))]
      const [{ data: images }, { data: stores }] = await Promise.all([productIds.length ? supabase.from('product_images').select('*').in('product_id', productIds).order('sort_order') : Promise.resolve({ data: [] }), storeIds.length ? supabase.from('stores').select('id,name,slug,country_code').in('id', storeIds) : Promise.resolve({ data: [] })])
      const storeMap = Object.fromEntries((stores || []).map(s => [s.id, s])); const imageMap = {}; (images || []).forEach(i => { if (!imageMap[i.product_id]) imageMap[i.product_id] = i.secure_url })
      list = list.map(p => ({ ...p, store: storeMap[p.store_id], image: imageMap[p.id] })).filter(p => !country || p.store?.country_code === country)
      setProducts(list); setLoading(false)
    })
  }, [q, category, country])
  const title = useMemo(() => q ? `Résultats pour « ${q} »` : 'Tous les produits', [q])
  function setFilter(key, value) { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next) }
  if (loading) return <Loader fullscreen />
  return <main className="section-shell page-space"><div className="page-title"><span className="eyebrow">OneMarket</span><h1>{title}</h1><p>{products.length} produit{products.length > 1 ? 's' : ''}</p></div><div className="catalog-toolbar"><div className="filter-title"><SlidersHorizontal size={18} /> Filtres</div><select value={category} onChange={e => setFilter('category', e.target.value)}><option value="">Toutes les catégories</option>{categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select><select value={country} onChange={e => setFilter('country', e.target.value)}><option value="">Tous les pays</option><option value="CD">RDC</option><option value="US">États-Unis</option></select>{q && <button className="text-button" onClick={() => setFilter('q', '')}><Search size={16} /> Effacer la recherche</button>}</div>{products.length ? <div className="product-grid">{products.map(p => <ProductCard key={p.id} product={p} />)}</div> : <EmptyState title="Aucun produit trouvé" text="Essaie une autre recherche ou retire certains filtres." />}</main>
}
