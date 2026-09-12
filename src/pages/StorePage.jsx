import { MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import SmartImage from '../components/SmartImage'
import { supabase } from '../lib/supabase'

export default function StorePage() {
  const { slug } = useParams()
  const [store, setStore] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function run() {
      setLoading(true)
      const { data: s } = await supabase
        .from('stores')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'active')
        .eq('country_code', 'CD')
        .maybeSingle()

      if (!active) return
      setStore(s || null)
      setProducts([])

      if (s) {
        const { data: ps } = await supabase
          .from('products')
          .select('*')
          .eq('store_id', s.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        const ids = (ps || []).map(p => p.id)
        const { data: images } = ids.length
          ? await supabase.from('product_images').select('*').in('product_id', ids).order('sort_order')
          : { data: [] }

        if (!active) return
        const imageMap = {}
        ;(images || []).forEach(i => { if (!imageMap[i.product_id] && i.secure_url) imageMap[i.product_id] = i.secure_url })
        setProducts((ps || []).map(p => ({ ...p, image: imageMap[p.id], store: s })))
      }

      setLoading(false)
    }

    run().catch(() => {
      if (active) {
        setStore(null)
        setProducts([])
        setLoading(false)
      }
    })

    return () => { active = false }
  }, [slug])

  if (loading) return <Loader fullscreen />
  if (!store) return <main className="section-shell page-space"><EmptyState title="Boutique introuvable" /></main>

  return (
    <main>
      <section className="store-hero">
        <div className="store-banner"><SmartImage src={store.banner_url} alt={store.name} fallback="OM" className="store-page-banner-image" fit="cover" /></div>
        <div className="section-shell store-profile">
          <SmartImage src={store.logo_url} alt={store.name} fallback={store.name.slice(0,2).toUpperCase()} className="store-profile-smart" fit="contain" />
          <div>
            <span className="eyebrow">Boutique OneMarket</span>
            <h1>{store.name}</h1>
            <p>{store.description || 'Boutique sélectionnée sur OneMarket.'}</p>
            <span className="store-location"><MapPin size={15} /> {store.city ? `${store.city}, ` : ''}RDC</span>
          </div>
        </div>
      </section>
      <section className="section-shell section-block">
        <div className="section-heading"><div><h2>Produits</h2><p>{products.length} article{products.length > 1 ? 's' : ''}</p></div></div>
        {products.length ? <div className="product-grid">{products.map(p => <ProductCard product={p} key={p.id} />)}</div> : <EmptyState title="Aucun produit pour le moment" />}
      </section>
    </main>
  )
}
