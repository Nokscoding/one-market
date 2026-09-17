import { Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import ProductCard from '../components/ProductCard'
import SmartImage from '../components/SmartImage'
import { supabase } from '../lib/supabase'
import { logTechnicalError, userError } from '../lib/userErrors'

export default function Catalog() {
  const [params, setParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  const q = params.get('q') || ''
  const category = params.get('category') || ''
  const view = params.get('view') || ''
  const sort = params.get('sort') || 'newest'

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data, error: categoryError } = await supabase
        .from('categories')
        .select('id,name,image_url,sort_order')
        .eq('is_active', true)
        .order('sort_order')
      if (categoryError) throw categoryError
      if (active) setCategories(data || [])
    })().catch(categoryError => {
      logTechnicalError('catalog-categories', categoryError)
      if (active) setCategories([])
    })
    return () => { active = false }
  }, [retryKey])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    ;(async () => {
      const result = await supabase.rpc('market_catalog_products', {
        p_query: q.trim() || null,
        p_category: category || null,
        p_limit: 120,
        p_offset: 0,
      })
      if (result.error) throw result.error
      if (!active) return

      let list = result.data || []
      if (view === 'new') list = list.slice(0, 12)

      if (sort === 'rating') list.sort((a, b) => (Number(b.rating_avg) || 0) - (Number(a.rating_avg) || 0) || (Number(b.rating_count) || 0) - (Number(a.rating_count) || 0))
      else if (sort === 'price_asc') list.sort((a, b) => Number(a.price) - Number(b.price))
      else if (sort === 'price_desc') list.sort((a, b) => Number(b.price) - Number(a.price))
      else list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setProducts(list)
    })().catch(loadError => {
      logTechnicalError('catalog-load', loadError)
      if (active) {
        setProducts([])
        setError(userError(loadError, 'generic'))
      }
    }).finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [q, category, view, sort, retryKey])

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

  if (error) {
    return <main className="section-shell page-space"><EmptyState title="Impossible de charger le catalogue" text={error} action={<button className="button primary" type="button" onClick={() => setRetryKey(value => value + 1)}>Réessayer</button>}/></main>
  }

  if (view === 'categories') {
    return (
      <main className="section-shell page-space">
        <div className="page-title"><span className="eyebrow">Explorer</span><h1>Catégories</h1><p>Choisissez un univers pour découvrir les produits disponibles sur One Market.</p></div>
        {categories.length ? <div className="category-row">{categories.map(c => <Link key={c.id} to={`/catalog?category=${c.id}`} className="category-card"><SmartImage src={c.image_url} alt={c.name} className="category-card-image" fit="cover" width={400} sizes="(max-width: 650px) 46vw, (max-width: 1000px) 31vw, 260px"/><span>{c.name}</span></Link>)}</div> : <EmptyState title="Aucune catégorie disponible"/>}
      </main>
    )
  }

  return (
    <main className="section-shell page-space">
      <div className="page-title"><span className="eyebrow">One Market</span><h1>{title}</h1><p>{products.length} produit{products.length > 1 ? 's' : ''}</p></div>
      <div className="catalog-toolbar">
        <div className="filter-title"><SlidersHorizontal size={18}/> Filtres</div>
        <select value={category} onChange={e => setFilter('category', e.target.value)}><option value="">Toutes les catégories</option>{categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select>
        {view === 'new' && <button className="text-button" onClick={() => setFilter('view', '')}>Voir tous les produits</button>}
        {q && <button className="text-button" onClick={() => setFilter('q', '')}><Search size={16}/> Effacer la recherche</button>}
        <div className="catalog-sort"><label htmlFor="catalog-sort">Trier par</label><select id="catalog-sort" value={sort} onChange={e => setFilter('sort', e.target.value)}><option value="newest">Plus récents</option><option value="rating">Mieux notés</option><option value="price_asc">Prix croissant</option><option value="price_desc">Prix décroissant</option></select></div>
      </div>
      {products.length ? <div className="product-grid">{products.map((p, productIndex) => <ProductCard key={p.id} product={p} priority={productIndex < 4}/>)}</div> : <EmptyState title="Aucun produit trouvé" text={q ? 'Essayez un autre nom de produit, une boutique ou une catégorie.' : 'Essayez une autre catégorie ou retirez certains filtres.'}/>} 
    </main>
  )
}
