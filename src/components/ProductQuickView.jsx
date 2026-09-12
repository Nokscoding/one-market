import { ArrowRight, Store, Truck, X } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { money } from '../lib/format'

export default function ProductQuickView({ product, onClose }) {
  const image = product?.image || product?.product_images?.[0]?.secure_url
  const store = product?.store || product?.stores

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

  if (!product) return null

  return (
    <div className="quick-view-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="quick-view-modal" role="dialog" aria-modal="true" aria-label={`Aperçu de ${product.name}`} onMouseDown={(event) => event.stopPropagation()}>
        <button className="quick-view-close" onClick={onClose} aria-label="Fermer l'aperçu"><X size={21} /></button>
        <div className="quick-view-image">
          {image ? <img src={image} alt={product.name} /> : <div className="product-placeholder large">OM</div>}
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
    </div>
  )
}
