import { Eye } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { money } from '../lib/format'
import FavoriteButton from './FavoriteButton'
import ProductQuickView from './ProductQuickView'
import RatingStars from './RatingStars'
import SmartImage from './SmartImage'

export default function ProductCard({ product }) {
  const [quickView, setQuickView] = useState(false)
  const image = product.image || product.product_images?.[0]?.secure_url
  const store = product.store || product.stores
  const rating = Number(product.rating_avg) || 0
  const reviewCount = Number(product.rating_count) || 0
  const price = Number(product.price) || 0
  const oldPrice = Number(product.old_price) || 0
  const discount = oldPrice > price && oldPrice > 0 ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0
  const createdAt = product.created_at ? new Date(product.created_at).getTime() : 0
  const isNew = createdAt > 0 && Date.now() - createdAt < 1000 * 60 * 60 * 24 * 30
  const isPopular = reviewCount >= 3 && rating >= 4.2
  const stock = Number(product.stock_qty) || 0
  const showStock = !product.has_variants

  return (
    <>
      <article className="product-card market-product-card">
        <div className="product-media-wrap">
          <Link to={`/product/${product.id}`} className="product-media" aria-label={`Voir ${product.name}`}>
            <SmartImage src={image} alt={product.name} fallback="OM" className="product-card-smart-image" fit="contain" width={480} />
          </Link>

          <div className="product-badges">
            {discount > 0 && <span className="product-badge product-badge--promo">-{discount}%</span>}
            {isNew && <span className="product-badge product-badge--new">Nouveau</span>}
            {isPopular && <span className="product-badge product-badge--popular">Populaire</span>}
          </div>

          <FavoriteButton productId={product.id} className="favorite-button--card" />

          <button className="product-quick-button" onClick={() => setQuickView(true)} aria-label={`Aperçu rapide de ${product.name}`}>
            <Eye size={17} />
            <span>Aperçu</span>
          </button>
        </div>

        <div className="product-info">
          {store && <div className="product-store-line"><Link to={`/store/${store.slug}`} className="product-store">{store.name}</Link><span>RDC</span></div>}
          <Link to={`/product/${product.id}`} className="product-name">{product.name}</Link>

          <div className="product-rating-row">
            <RatingStars value={rating} count={reviewCount} compact />
            <Link className="product-review-link" to={`/product/${product.id}#reviews`}>{reviewCount ? 'Voir les avis' : 'Laisser un avis'}</Link>
          </div>

          <div className="product-price-line">
            <strong className="product-price">{money(product.price, product.currency)}</strong>
            {discount > 0 && <span className="product-old-price">{money(product.old_price, product.currency)}</span>}
          </div>

          <div className="product-stock-line">
            {showStock ? (
              <span className={`product-stock ${stock <= 0 ? 'is-out' : stock <= 5 ? 'is-low' : ''}`}>
                {stock <= 0 ? 'Rupture de stock' : stock <= 5 ? `Plus que ${stock}` : 'En stock'}
              </span>
            ) : <span className="product-stock">Options disponibles</span>}
            <span className="product-delivery-chip">Paiement à la livraison</span>
          </div>
        </div>
      </article>

      {quickView && <ProductQuickView product={product} onClose={() => setQuickView(false)} />}
    </>
  )
}
