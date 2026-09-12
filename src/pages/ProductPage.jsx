import { ChevronLeft, ChevronRight, Minus, Plus, ShoppingBag, Store } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import SmartImage from '../components/SmartImage'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { money } from '../lib/format'
import { supabase } from '../lib/supabase'

/**
 * ROUTE: /product/:id
 * PUBLIC: lecture; connexion requise pour ajouter au panier.
 * BUT: fiche produit, galerie, variantes, stock et ajout panier.
 * SUPABASE: products, stores, product_images, product_variants.
 */

export default function ProductPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addItem } = useCart()
  const [product, setProduct] = useState(null)
  const [store, setStore] = useState(null)
  const [images, setImages] = useState([])
  const [variants, setVariants] = useState([])
  const [selectedImage, setSelectedImage] = useState(0)
  const [variantId, setVariantId] = useState('')
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setSelectedImage(0)
      const { data: p } = await supabase.from('products').select('*').eq('id', id).eq('is_active', true).maybeSingle()
      if (!active) return
      setProduct(p || null)
      if (p) {
        const [{ data: s }, { data: imgs }, { data: vars }] = await Promise.all([
          supabase.from('stores').select('*').eq('id', p.store_id).maybeSingle(),
          supabase.from('product_images').select('*').eq('product_id', p.id).order('sort_order'),
          supabase.from('product_variants').select('*').eq('product_id', p.id).eq('is_active', true).order('created_at'),
        ])
        if (!active) return
        setStore(s || null)
        setImages((imgs || []).filter(img => img.secure_url))
        setVariants(vars || [])
        if (p.has_variants && vars?.length) setVariantId(vars[0].id)
      }
      setLoading(false)
    }
    load().catch(() => active && setLoading(false))
    return () => { active = false }
  }, [id])

  const selectedVariant = useMemo(() => variants.find(v => v.id === variantId), [variants, variantId])
  const price = selectedVariant?.price ?? product?.price
  const stock = product?.has_variants ? selectedVariant?.stock_qty ?? 0 : product?.stock_qty ?? 0
  const imageUrls = useMemo(() => images.map(img => img.secure_url).filter(Boolean), [images])
  const currentImage = imageUrls[selectedImage] || ''

  function changeImage(direction) {
    if (imageUrls.length < 2) return
    setSelectedImage(index => (index + direction + imageUrls.length) % imageUrls.length)
  }

  async function add() {
    setError('')
    if (!user) return navigate('/auth', { state: { from: `/product/${id}` } })
    if (product.has_variants && !variantId) return setError('Choisis une variante.')
    setAdding(true)
    try { await addItem(product.id, variantId || null, qty); navigate('/cart') }
    catch (e) { setError(e.message || 'Impossible d’ajouter au panier.') }
    finally { setAdding(false) }
  }

  if (loading) return <Loader fullscreen />
  if (!product) return <main className="section-shell page-space"><EmptyState title="Produit introuvable" /></main>

  return (
    <main className="section-shell product-page">
      <section className="product-gallery">
        <div className="gallery-main">
          <SmartImage src={currentImage} alt={product.name} fallback="OM" className="product-main-smart-image" loading="eager" fit="contain" />
          {imageUrls.length > 1 && <>
            <button className="gallery-nav gallery-nav-prev" onClick={() => changeImage(-1)} aria-label="Image précédente"><ChevronLeft size={22} /></button>
            <button className="gallery-nav gallery-nav-next" onClick={() => changeImage(1)} aria-label="Image suivante"><ChevronRight size={22} /></button>
            <span className="gallery-image-count">{selectedImage + 1} / {imageUrls.length}</span>
          </>}
        </div>
        {imageUrls.length > 1 && <div className="thumbs product-thumbs">{imageUrls.map((src, index) => <button key={`${src}-${index}`} className={selectedImage === index ? 'active' : ''} onClick={() => setSelectedImage(index)} aria-label={`Afficher l'image ${index + 1}`}><SmartImage src={src} alt="" fallback="OM" fit="cover" /></button>)}</div>}
      </section>

      <section className="product-detail">
        <span className="eyebrow">Boutique RDC</span>
        <h1>{product.name}</h1>
        {store && <Link to={`/store/${store.slug}`} className="seller-link"><Store size={17} /> {store.name}</Link>}
        <div className="detail-price">{money(price, product.currency)}</div>
        <p className="detail-description">{product.description || 'Aucune description supplémentaire pour ce produit.'}</p>
        {product.has_variants && <div className="field-block"><label>Variante</label><div className="variant-list">{variants.map(v => <button key={v.id} className={variantId === v.id ? 'active' : ''} onClick={() => setVariantId(v.id)}>{Object.values(v.attributes || {}).join(' · ') || 'Option'}</button>)}</div></div>}
        <div className="purchase-row"><div className="qty-control"><button onClick={() => setQty(q => Math.max(1, q - 1))}><Minus size={16} /></button><span>{qty}</span><button onClick={() => setQty(q => Math.min(Math.max(stock, 1), q + 1))}><Plus size={16} /></button></div><button className="button primary grow" disabled={adding || stock <= 0} onClick={add}><ShoppingBag size={18} /> {stock <= 0 ? 'Rupture de stock' : adding ? 'Ajout…' : 'Ajouter au panier'}</button></div>
        {error && <p className="form-error">{error}</p>}
        <div className="purchase-note"><strong>Paiement à la livraison</strong><span>Pour la V1 One Market en RDC, le paiement est effectué au moment de la livraison.</span></div>
      </section>
    </main>
  )
}
