import { Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import SmartImage from '../components/SmartImage'
import { supabase } from '../lib/supabase'

export default function Catalog() {
  const [params, setParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  const q = params.get('q') || ''
  const category = params.get('category') || ''
  const view = params.get('view') || ''
  const sort = params.get('sort') || 'newest'

  useEffect(() => {
    let active = true
    supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => { if (active) setCategories(data || []) })
      .catch(() => { if (active) setCategories([]) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)

    let query = supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (q) query = query.ilike('name', `%${q}%`)
    if (category) query = query.eq('category_id', category)

    query.then(async ({ data }) => {
      if (!active) return
      let list = data || []
      const productIds = list.map(p => p.id)
      const storeIds = [...new Set(list.map(p => p.store_id))]

      const [{ data: images }, { data: stores }] = await Promise.all([
        productIds.length
          ? supabase.from('product_images').select('*').in('product_id', productIds).order('sort_order')
          : Promise.resolve({ data: [] }),
        storeIds.length
          ? supabase.from('stores').select('id,name,slug,country_code,status').in('id', storeIds).eq('country_code', 'CD').eq('status', 'active')
          : Promise.resolve({ data: [] }),
      ])

      if (!active) return
      const storeMap = Object.fromEntries((stores || []).map(s => [s.id, s]))
      const imageMap = {}
      ;(images || []).forEach(i => { if (!imageMap[i.product_id] && i.secure_url) imageMap[i.product_id] = i.secure_url })

      list = list
        .map(p => ({ ...p, store: storeMap[p.store_id], image: imageMap[p.id] }))
        .filter(p => p.store)

      if (view === 'new') list = list.slice(0, 12)

      if (sort === 'rating') {
        list.sort((a, b) => (Number(b.rating_avg) || 0) - (Number(a.rating_avg) || 0) || (Number(b.rating_count) || 0) - (Number(a.rating_count) || 0))
      } else if (sort === 'price_asc') {
        list.sort((a, b) => Number(a.price) - Number(b.price))
      } else if (sort === 'price_desc') {
        list.sort((a, b) => Number(b.price) - Number(a.price))
      } else {
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      }

      setProducts(list)
      setLoading(false)
    }).catch(() => {
      if (active) {
        setProducts([])
        setLoading(false)
      }
    })

    return () => { active = false }
  }, [q, category, view, sort])

  const selectedCategory = categories.find(c => c.id === category)
  const title = useMemo(() => {
    if (q) return `Résultats pour « ${q} »`
    if (view === 'new') return 'Nouveautés'
    if (category && selectedCategory) return selectedCategory.name
    return 'Tous les produits'
  }, [q, view, category, selectedCategory])

  function setFilter(key, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  if (loading) return <Loader fullscreen />

  if (view === 'categories') {
    return (
      <main className="section-shell page-space">
        <div className="page-title">
          <span className="eyebrow">Explorer</span>
          <h1>Catégories</h1>
          <p>Choisis un univers pour découvrir les produits disponibles sur One Market.</p>
        </div>
        {categories.length ? (
          <div className="category-row">
            {categories.map(c => (
              <Link key={c.id} to={`/catalog?category=${c.id}`} className="category-card">
                <SmartImage src={c.image_url} alt={c.name} fallback={c.name.slice(0, 1).toUpperCase()} className="category-card-image" fit="cover" />
                <span>{c.name}</span>
              </Link>
            ))}
          </div>
        ) : <EmptyState title="Aucune catégorie disponible" />}
      </main>
    )
  }

  return (
    <main className="section-shell page-space">
      <div className="page-title">
        <span className="eyebrow">OneMarket</span>
        <h1>{title}</h1>
        <p>{products.length} produit{products.length > 1 ? 's' : ''}</p>
      </div>

      <div className="catalog-toolbar">
        <div className="filter-title"><SlidersHorizontal size={18} /> Filtres</div>
        <select value={category} onChange={e => setFilter('category', e.target.value)}>
          <option value="">Toutes les catégories</option>
          {categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}
        </select>
        {view === 'new' && <button className="text-button" onClick={() => setFilter('view', '')}>Voir tous les produits</button>}
        {q && <button className="text-button" onClick={() => setFilter('q', '')}><Search size={16} /> Effacer la recherche</button>}
        <div className="catalog-sort">
          <label htmlFor="catalog-sort">Trier par</label>
          <select id="catalog-sort" value={sort} onChange={e => setFilter('sort', e.target.value)}>
            <option value="newest">Plus récents</option>
            <option value="rating">Mieux notés</option>
            <option value="price_asc">Prix croissant</option>
            <option value="price_desc">Prix décroissant</option>
          </select>
        </div>
      </div>

      {products.length
        ? <div className="product-grid">{products.map(p => <ProductCard key={p.id} product={p} />)}</div>
        : <EmptyState title="Aucun produit trouvé" text="Essaie une autre recherche ou retire certains filtres." />}
    </main>
  )
}
