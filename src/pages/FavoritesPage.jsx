import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import ProductCard from '../components/ProductCard'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import { supabase } from '../lib/supabase'
import { logTechnicalError, userError } from '../lib/userErrors'

export default function FavoritesPage() {
  const { user } = useAuth()
  const { favorites } = useFavorites()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let active = true
    const ids = [...favorites]

    if (!user?.id || !ids.length) {
      setProducts([])
      setError('')
      setLoading(false)
      return () => { active = false }
    }

    setLoading(true)
    setError('')
    ;(async () => {
      const productResult = await supabase
        .from('products')
        .select('id,store_id,category_id,name,slug,description,price,old_price,currency,stock_qty,has_variants,rating_avg,rating_count,is_active,created_at')
        .in('id', ids)
        .eq('is_active', true)

      if (productResult.error) throw productResult.error
      const list = productResult.data || []
      const productIds = list.map(item => item.id)
      const storeIds = [...new Set(list.map(item => item.store_id))]

      const [imageResult, storeResult] = await Promise.all([
        productIds.length ? supabase.from('product_images').select('product_id,secure_url,sort_order').in('product_id', productIds).order('sort_order') : Promise.resolve({ data: [], error: null }),
        storeIds.length ? supabase.from('stores').select('id,name,slug,country_code,status,is_verified,is_partner').in('id', storeIds).eq('country_code', 'CD').eq('status', 'active') : Promise.resolve({ data: [], error: null }),
      ])
      if (imageResult.error) throw imageResult.error
      if (storeResult.error) throw storeResult.error
      if (!active) return

      const imageMap = {}
      ;(imageResult.data || []).forEach(image => { if (!imageMap[image.product_id] && image.secure_url) imageMap[image.product_id] = image.secure_url })
      const storeMap = Object.fromEntries((storeResult.data || []).map(store => [store.id, store]))

      setProducts(list
        .map(product => ({ ...product, image: imageMap[product.id], store: storeMap[product.store_id] }))
        .filter(product => product.store))
    })()
      .catch(loadError => {
        if (!active) return
        logTechnicalError('favorites-page-load', loadError)
        setProducts([])
        setError(userError(loadError, 'favorites'))
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [favorites, user?.id, retryKey])

  if (loading) return <Loader fullscreen />

  return (
    <main className="section-shell page-space favorites-page">
      <div className="page-title">
        <span className="eyebrow">Votre sélection</span>
        <h1>Mes favoris</h1>
        <p>{products.length} produit{products.length > 1 ? 's' : ''} enregistré{products.length > 1 ? 's' : ''}</p>
      </div>

      {error ? (
        <EmptyState title="Impossible de charger vos favoris" text={error} action={<button className="button primary" type="button" onClick={() => setRetryKey(value => value + 1)}>Réessayer</button>}/>
      ) : products.length ? (
        <div className="product-grid">{products.map(product => <ProductCard key={product.id} product={product}/>)}</div>
      ) : (
        <EmptyState title="Aucun favori pour le moment" text="Touchez le cœur sur un produit pour le retrouver ici." action={<Link className="button primary" to="/catalog">Découvrir les produits</Link>}/>
      )}
    </main>
  )
}
