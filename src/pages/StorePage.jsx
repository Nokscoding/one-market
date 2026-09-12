import { ExternalLink, MapPin, Phone, Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import ProductCard from '../components/ProductCard'
import ReportProblem from '../components/ReportProblem'
import SmartImage from '../components/SmartImage'
import StoreTrustBadge from '../components/StoreTrustBadge'
import { publicSocialLinks } from '../lib/seller'
import { supabase } from '../lib/supabase'

function publicHref(label, value) {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (label === 'WhatsApp Business') {
    const digits = String(value).replace(/\D/g, '')
    return digits ? `https://wa.me/${digits}` : ''
  }
  return ''
}

export default function StorePage() {
  const { slug } = useParams()
  const [store, setStore] = useState(null)
  const [products, setProducts] = useState([])
  const [categoryName, setCategoryName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function run() {
      setLoading(true)
      const { data: s } = await supabase.from('stores').select('*').eq('slug', slug).eq('status', 'active').eq('country_code', 'CD').maybeSingle()
      if (!active) return
      setStore(s || null)
      setProducts([])
      setCategoryName('')

      if (s) {
        const categoryPromise = s.primary_category_id ? supabase.from('categories').select('name').eq('id', s.primary_category_id).maybeSingle() : Promise.resolve({ data: null })
        const [{ data: ps }, categoryResult] = await Promise.all([
          supabase.from('products').select('*').eq('store_id', s.id).eq('is_active', true).order('created_at', { ascending: false }),
          categoryPromise,
        ])
        const ids = (ps || []).map(p => p.id)
        const { data: images } = ids.length ? await supabase.from('product_images').select('*').in('product_id', ids).order('sort_order') : { data: [] }
        if (!active) return
        const imageMap = {}
        ;(images || []).forEach(i => { if (!imageMap[i.product_id] && i.secure_url) imageMap[i.product_id] = i.secure_url })
        setProducts((ps || []).map(p => ({ ...p, image: imageMap[p.id], store: s })))
        setCategoryName(categoryResult.data?.name || '')
      }
      setLoading(false)
    }
    run().catch(() => { if (active) { setStore(null); setProducts([]); setLoading(false) } })
    return () => { active = false }
  }, [slug])

  const rating = useMemo(() => {
    const rated = products.filter(product => Number(product.rating_count) > 0)
    const count = rated.reduce((sum, product) => sum + Number(product.rating_count || 0), 0)
    if (!count) return { value: 0, count: 0 }
    const total = rated.reduce((sum, product) => sum + Number(product.rating_avg || 0) * Number(product.rating_count || 0), 0)
    return { value: total / count, count }
  }, [products])

  if (loading) return <Loader fullscreen />
  if (!store) return <main className="section-shell page-space"><EmptyState title="Boutique introuvable"/></main>

  const socials = publicSocialLinks(store).map(([label, value]) => ({ label, value, href: publicHref(label, value) })).filter(item => item.href)

  return (
    <main className="store-public-final">
      <section className="store-hero">
        <div className="store-banner"><SmartImage src={store.banner_url} alt={store.name} fallback="ONE MARKET" className="store-page-banner-image" fit="cover" width={1600}/></div>
        <div className="section-shell store-profile store-profile--final">
          <SmartImage src={store.logo_url} alt={store.name} fallback={store.name.slice(0,2).toUpperCase()} className="store-profile-smart" fit="contain" width={260}/>
          <div className="store-profile-copy">
            <div className="store-profile-title"><h1>{store.name}</h1><StoreTrustBadge store={store}/></div>
            <p>{store.description || 'Découvrez les produits proposés par cette boutique sur One Market.'}</p>
            <div className="store-public-meta"><span><MapPin size={15}/>{store.city ? `${store.city}, ` : ''}RDC</span>{categoryName && <span>{categoryName}</span>}{rating.count > 0 && <span><Star size={15}/>{rating.value.toFixed(1)} · {rating.count} avis produit{rating.count > 1 ? 's' : ''}</span>}{store.phone && <span><Phone size={15}/>{store.phone}</span>}</div>
            {socials.length > 0 && <div className="store-social-links">{socials.map(item => <a key={item.label} href={item.href} target="_blank" rel="noreferrer">{item.label}<ExternalLink size={13}/></a>)}</div>}
            <div className="store-report-row"><ReportProblem source="store_page" store={store} orderItems={products.map(product => ({ product_id: product.id, product_name: product.name, store_id: store.id }))}/></div>
          </div>
        </div>
      </section>
      <section className="section-shell section-block">
        <div className="section-heading"><div><h2>Produits</h2><p>{products.length} article{products.length > 1 ? 's' : ''} disponible{products.length > 1 ? 's' : ''}</p></div></div>
        {products.length ? <div className="product-grid">{products.map(p => <ProductCard product={p} key={p.id}/>)}</div> : <EmptyState title="Aucun produit pour le moment"/>}
      </section>
    </main>
  )
}
