import { ShoppingCart, Store } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { money } from '../lib/format'
export default function ProductCard({product}){
  const {user}=useAuth(); const {addItem}=useCart(); const navigate=useNavigate(); const sale=product.old_price&&Number(product.old_price)>Number(product.price); const pct=sale?Math.round((1-Number(product.price)/Number(product.old_price))*100):0
  async function quickAdd(e){e.preventDefault();e.stopPropagation(); if(!user)return navigate('/auth',{state:{from:`/product/${product.id}`}}); if(product.has_variants)return navigate(`/product/${product.id}`); try{await addItem(product.id,null,1)}catch{navigate(`/product/${product.id}`)}}
  return <article className="product-card"><Link to={`/product/${product.id}`} className="product-card-link"><div className="product-card-image">{sale&&<span className="discount-badge">-{pct}%</span>}{product.image?<img src={product.image} alt={product.name} loading="lazy"/>:<div className="product-placeholder">OM</div>}</div><div className="product-card-body"><span className="product-store"><Store size={13}/>{product.store?.name||'One Market'}</span><h3>{product.name}</h3><div className="price-row"><strong>{money(product.price,product.currency)}</strong>{sale&&<del>{money(product.old_price,product.currency)}</del>}</div><span className={product.stock_qty>0?'stock-ok':'stock-out'}>{product.stock_qty>0?'En stock':'Rupture de stock'}</span></div></Link><button className="quick-add" disabled={product.stock_qty<=0} onClick={quickAdd} aria-label="Ajouter au panier"><ShoppingCart size={18}/></button></article>
}
