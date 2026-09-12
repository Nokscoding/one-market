import { ArrowRight, Store, Truck, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { money } from '../lib/format'
import { supabase } from '../lib/supabase'
import SmartImage from './SmartImage'

export default function ProductQuickView({ product, onClose }) {
  const fallbackImage = product?.image || product?.product_images?.[0]?.secure_url || ''
  const store = product?.store || product?.stores
  const [images, setImages] = useState(fallbackImage ? [fallbackImage] : [])
  const [selectedImage, setSelectedImage] = useState(0)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
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
        const urls = [...new Set([...(initial || []), ...((data || []).map(item => item.secure_url).filter(Boolean))])]
        setImages(urls)
      })
      .catch(() => {})

    return () => { active = false }
  }, [product?.id, fallbackImage])

  const currentImage = useMemo(() => images[selectedImage] || fallbackImage, [images, selectedImage, fallbackImage])

  if (!product || typeof document === 'undefined') return null

  return createPortal(
    <div className="quick-view-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="quick-view-modal" role="dialog" aria-modal="true" aria-label={`Aperçu de ${product.name}`} onMouseDown={(event) => event.stopPropagation()}>
        <button className="quick-view-close" onClick={onClose} aria-label="Fermer l'aperçu"><X size={21} /></button>
        <div className="quick-view-visual">
          <div className="quick-view-image">
            <SmartImage src={currentImage} alt={product.name} fallback="OM" loading="eager" fit="contain" />
          </div>
          {images.length > 1 && (
            <div className="quick-view-thumbs" aria-label="Images du produit">
              {images.slice(0, 6).map((src, index) => (
                <button key={`${src}-${index}`} className={selectedImage === index ? 'active' : ''} onClick={() => setSelectedImage(index)} aria-label={`Image ${index + 1}`}>
                  <SmartImage src={src} alt="" fallback="OM" fit="cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="quick-view-content">
          <span className="quick-view-kicker">APERÇU RAPIDE</span>
          <h2>{product.name}</h2>
          {store && <Link className="quick-view-store" to={`/store/${store.slug}`} onClick={onClose}><Store size={16} /> {store.name}</Link>}
          <strong className="quick-view-price">{money(product.price, product.currency)}</strong>
          <p>{product.description || 'Découvrez ce produit et toutes ses informations sur sa fiche One Market.'}</p>
          <div className="quick-view-delivery"><Truck size={17} /><span><b>Paiement à la livraison</b><small>Disponible pour la V1 One Market en RDC.</small></span></div>
          <Link className="quick-view-link" to={`/product/${product.id}`} onClick={onClose}>Voir la fiche produit <ArrowRight size={18} /></Link>
        </div>
      </section>
    </div>,
    document.body,
  )
}
