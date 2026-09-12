import { ArrowRight, Store, Truck, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { money } from '../lib/format'
import { supabase } from '../lib/supabase'
import FavoriteButton from './FavoriteButton'
import RatingStars from './RatingStars'
import SmartImage from './SmartImage'
import StoreTrustBadge from './StoreTrustBadge'

export default function ProductQuickView({ product, onClose }) {
  const fallbackImage = product?.image || product?.product_images?.[0]?.secure_url || ''
  const store = product?.store || product?.stores
  const [images, setImages] = useState(fallbackImage ? [fallbackImage] : [])
  const [selectedImage, setSelectedImage] = useState(0)
  const rating = Number(product?.rating_avg) || 0
  const reviewCount = Number(product?.rating_count) || 0
  const stock = Number(product?.stock_qty) || 0

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = event => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  useEffect(() => {
    let active = true
    const initial = fallbackImage ? [fallbackImage] : []
    setImages(initial)
    setSelectedImage(0)
    if (!product?.id) return () => { active = false }

    supabase
      .from('product_images')
      .select('secure_url,sort_order')
      .eq('product_id', product.id)
      .order('sort_order')
      .then(({ data }) => {
        if (!active) return
        const urls = [...new Set([...initial, ...((data || []).map(item => item.secure_url).filter(Boolean))])]
        setImages(urls)
      })
      .catch(() => {})

    return () => { active = false }
  }, [product?.id, fallbackImage])

  const currentImage = useMemo(() => images[selectedImage] || fallbackImage, [images, selectedImage, fallbackImage])
  if (!product || typeof document === 'undefined') return null

  const stockLabel = product.has_variants ? 'Options disponibles' : stock <= 0 ? 'Rupture de stock' : stock <= 5 ? `Plus que ${stock} en stock` : 'En stock'

  return createPortal(
    <div className="quick-view-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="quick-view-modal" role="dialog" aria-modal="true" aria-label={`Aperçu de ${product.name}`} onMouseDown={event => event.stopPropagation()}>
        <button className="quick-view-close" onClick={onClose} aria-label="Fermer l'aperçu"><X size={21}/></button>
        <div className="quick-view-visual">
          <div className="quick-view-image"><SmartImage src={currentImage} alt={product.name} fallback="OM" loading="eager" fit="contain"/></div>
          {images.length > 1 && <div className="quick-view-thumbs" aria-label="Images du produit">{images.slice(0, 6).map((src, index) => <button key={`${src}-${index}`} className={selectedImage === index ? 'active' : ''} onClick={() => setSelectedImage(index)} aria-label={`Image ${index + 1}`}><SmartImage src={src} alt="" fallback="OM" fit="cover"/></button>)}</div>}
        </div>
        <div className="quick-view-content">
          <span className="quick-view-kicker">APERÇU RAPIDE</span>
          <h2>{product.name}</h2>
          {store && <div className="quick-view-store-row"><Link className="quick-view-store" to={`/store/${store.slug}`} onClick={onClose}><Store size={16}/> {store.name}</Link><StoreTrustBadge store={store} compact/></div>}
          <div className="quick-view-rating"><RatingStars value={rating} count={reviewCount}/></div>
          <strong className="quick-view-price">{money(product.price, product.currency)}</strong>
          <span className={`quick-view-stock ${!product.has_variants && stock <= 0 ? 'is-out' : !product.has_variants && stock <= 5 ? 'is-low' : ''}`}>{stockLabel}</span>
          <p>{product.description || 'Découvrez toutes les informations de ce produit sur sa fiche One Market.'}</p>
          <div className="quick-view-delivery"><Truck size={17}/><span><b>Paiement à la livraison</b><small>Le paiement se fait directement auprès du livreur à la réception.</small></span></div>
          <div className="quick-view-actions"><Link className="quick-view-link" to={`/product/${product.id}`} onClick={onClose}>Voir la fiche produit <ArrowRight size={18}/></Link><FavoriteButton productId={product.id}/></div>
        </div>
      </section>
    </div>,
    document.body,
  )
}
