import { Eye } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { money } from '../lib/format'
import ProductQuickView from './ProductQuickView'

export default function ProductCard({ product }) {
  const [quickView, setQuickView] = useState(false)
  const image = product.image || product.product_images?.[0]?.secure_url
  const store = product.store || product.stores

  return (
    <>
      <article className="product-card market-product-card">
        <div className="product-media-wrap">
          <Link to={`/product/${product.id}`} className="product-media">
            {image ? <img src={image} alt={product.name} loading="lazy" /> : <div className="product-placeholder">OM</div>}
          </Link>
          <button className="product-quick-button" onClick={() => setQuickView(true)} aria-label={`Aperçu rapide de ${product.name}`}>
            <Eye size={17} />
            <span>Aperçu</span>
          </button>
        </div>
        <div className="product-info">
          {store && <div className="product-store-line"><Link to={`/store/${store.slug}`} className="product-store">{store.name}</Link><span>RDC</span></div>}
          <Link to={`/product/${product.id}`} className="product-name">{product.name}</Link>
          <strong className="product-price">{money(product.price, product.currency)}</strong>
        </div>
      </article>
      {quickView && <ProductQuickView product={product} onClose={() => setQuickView(false)} />}
    </>
  )
}
