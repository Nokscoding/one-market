import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import ProductCard from '../components/ProductCard'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import { supabase } from '../lib/supabase'

export default function FavoritesPage() {
  const { user } = useAuth()
  const { favorites } = useFavorites()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const ids = [...favorites]

    if (!user?.id || !ids.length) {
      setProducts([])
      setLoading(false)
      return () => { active = false }
    }

    setLoading(true)
    ;(async () => {
      const { data: baseProducts, error } = await supabase
        .from('products')
        .select('*')
        .in('id', ids)
        .eq('is_active', true)

      if (error) throw error
      const list = baseProducts || []
      const productIds = list.map(item => item.id)
      const storeIds = [...new Set(list.map(item => item.store_id))]

      const [{ data: images }, { data: stores }] = await Promise.all([
        productIds.length ? supabase.from('product_images').select('*').in('product_id', productIds).order('sort_order') : Promise.resolve({ data: [] }),
        storeIds.length ? supabase.from('stores').select('id,name,slug,country_code,status').in('id', storeIds).eq('country_code', 'CD').eq('status', 'active') : Promise.resolve({ data: [] }),
      ])

      if (!active) return
      const imageMap = {}
      ;(images || []).forEach(image => { if (!imageMap[image.product_id] && image.secure_url) imageMap[image.product_id] = image.secure_url })
      const storeMap = Object.fromEntries((stores || []).map(store => [store.id, store]))

      setProducts(list
        .map(product => ({ ...product, image: imageMap[product.id], store: storeMap[product.store_id] }))
        .filter(product => product.store))
    })()
      .catch(() => { if (active) setProducts([]) })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [favorites, user?.id])

  if (loading) return <Loader fullscreen />

  return (
    <main className="section-shell page-space favorites-page">
      <div className="page-title">
        <span className="eyebrow">Votre sélection</span>
        <h1>Mes favoris</h1>
        <p>{products.length} produit{products.length > 1 ? 's' : ''} enregistré{products.length > 1 ? 's' : ''}</p>
      </div>

      {products.length ? (
        <div className="product-grid">{products.map(product => <ProductCard key={product.id} product={product} />)}</div>
      ) : (
        <EmptyState
          title="Aucun favori pour le moment"
          text="Touchez le cœur sur un produit pour le retrouver ici."
          action={<Link className="button primary" to="/catalog">Découvrir les produits</Link>}
        />
      )}
    </main>
  )
}
