import { Link } from 'react-router-dom'
import { money } from '../lib/format'
export default function ProductCard({ product }) {
  const image = product.image || product.product_images?.[0]?.secure_url
  const store = product.store || product.stores
  return <article className="product-card market-product-card"><Link to={`/product/${product.id}`} className="product-media">{image ? <img src={image} alt={product.name} loading="lazy" /> : <div className="product-placeholder">OM</div>}</Link><div className="product-info"><Link to={`/product/${product.id}`} className="product-name">{product.name}</Link>{store && <div className="product-store-line"><Link to={`/store/${store.slug}`} className="product-store">{store.name}</Link>{store.country_code && <span>{store.country_code === 'US' ? 'USA' : 'RDC'}</span>}</div>}<strong className="product-price">{money(product.price, product.currency)}</strong></div></article>
}
