import { ArrowRight, CheckCircle2, Minus, Plus, ShoppingBag, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import Loader from '../components/Loader'
import SmartImage from '../components/SmartImage'
import { useCart } from '../context/CartContext'
import { money } from '../lib/format'
import { supabase } from '../lib/supabase'

export default function AddedToCartPage() {
  const [params] = useSearchParams()
  const location = useLocation()
  const productId = params.get('product') || ''
  const variantId = params.get('variant') || ''
  const addedQty = Math.max(1, Number(params.get('qty')) || 1)
  const navigationSnapshot = location.state?.addedProduct || null
  const snapshotMatches = Boolean(
    navigationSnapshot?.product?.id === productId &&
    (navigationSnapshot?.variant?.id || '') === variantId
  )

  const { items, count, total: cartTotal, updateQuantity } = useCart()
  const [product, setProduct] = useState(() => snapshotMatches ? navigationSnapshot.product : null)
  const [variant, setVariant] = useState(() => snapshotMatches ? navigationSnapshot.variant || null : null)
  const [store, setStore] = useState(() => snapshotMatches ? navigationSnapshot.store || null : null)
  const [image, setImage] = useState(() => snapshotMatches ? navigationSnapshot.image || '' : '')
  const [loading, setLoading] = useState(() => !snapshotMatches)
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (snapshotMatches) {
      setLoading(false)
      return undefined
    }

    let active = true
    if (!productId) {
      setLoading(false)
      return () => { active = false }
    }

    ;(async () => {
      const { data: p } = await supabase.from('products').select('*').eq('id', productId).maybeSingle()
      if (!p || !active) return
      setProduct(p)

      const [{ data: s }, { data: images }, variantResult] = await Promise.all([
        supabase.from('stores').select('id,name,slug,country_code').eq('id', p.store_id).maybeSingle(),
        supabase.from('product_images').select('secure_url,sort_order').eq('product_id', p.id).order('sort_order').limit(1),
        variantId ? supabase.from('product_variants').select('*').eq('id', variantId).eq('product_id', p.id).maybeSingle() : Promise.resolve({ data: null }),
      ])

      if (!active) return
      setStore(s || null)
      setImage(images?.[0]?.secure_url || '')
      setVariant(variantResult.data || null)
    })().catch(() => {}).finally(() => active && setLoading(false))

    return () => { active = false }
  }, [productId, variantId, snapshotMatches])

  const cartItem = useMemo(() => items.find(item => item.product_id === productId && (item.product_variant_id || '') === variantId), [items, productId, variantId])
  const unitPrice = Number(variant?.price ?? product?.price ?? navigationSnapshot?.unitPrice ?? cartItem?.unitPrice ?? 0)
  const quantity = cartItem?.quantity || navigationSnapshot?.quantity || addedQty
  const productTotal = unitPrice * quantity
  const maxStock = Number(variant?.stock_qty ?? product?.stock_qty ?? navigationSnapshot?.availableStock ?? cartItem?.availableStock ?? 0)

  async function changeQuantity(next) {
    if (!cartItem || updating || next < 1 || (maxStock > 0 && next > maxStock)) return
    setMessage('')
    setUpdating(true)
    try {
      await updateQuantity(cartItem.id, next)
    } catch (error) {
      setMessage(error?.message || 'Impossible de modifier la quantité.')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <Loader fullscreen />

  if (!product) {
    return <main className="section-shell page-space"><div className="purchase-confirm-card"><h1>Produit introuvable</h1><Link className="button primary" to="/catalog">Retour au catalogue</Link></div></main>
  }

  const buyNowParams = new URLSearchParams({ mode: 'buy-now', product: product.id, qty: String(quantity) })
  if (variantId) buyNowParams.set('variant', variantId)

  return (
    <main className="section-shell purchase-confirm-page">
      <div className="purchase-success-title"><CheckCircle2 size={28}/><div><span>Ajouté au panier</span><h1>Votre produit est bien dans le panier</h1></div></div>

      {message && <div className="cart-feedback">{message}</div>}

      <div className="purchase-confirm-layout">
        <section className="purchase-confirm-card purchase-confirm-product">
          <SmartImage src={image} alt={product.name} fallback="OM" fit="contain" className="purchase-confirm-image" widthHint={360}/>
          <div className="purchase-confirm-info">
            <span className="eyebrow">{store?.name || 'One Market'}</span>
            <h2>{product.name}</h2>
            {variant && <p>{Object.values(variant.attributes || {}).join(' · ')}</p>}
            <div className="purchase-confirm-unit"><span>Prix unitaire</span><strong>{money(unitPrice, product.currency)}</strong></div>
            <div className="purchase-confirm-qty">
              <span>Quantité dans le panier</span>
              <div className="qty-control small">
                <button disabled={updating || quantity <= 1 || !cartItem} onClick={() => changeQuantity(quantity - 1)}><Minus size={14}/></button>
                <span>{quantity}</span>
                <button disabled={updating || !cartItem || quantity >= maxStock} onClick={() => changeQuantity(quantity + 1)}><Plus size={14}/></button>
              </div>
            </div>
            <small className="purchase-stock-note">{maxStock > 0 ? `${maxStock} unité${maxStock > 1 ? 's' : ''} disponible${maxStock > 1 ? 's' : ''}` : 'Stock indisponible'}</small>
          </div>
        </section>

        <aside className="purchase-confirm-card purchase-confirm-summary">
          <span>Résumé</span>
          <div><span>Quantité ajoutée</span><b>{addedQty}</b></div>
          <div><span>Total de ce produit</span><b>{money(productTotal, product.currency)}</b></div>
          <div><span>Articles dans le panier</span><b>{count}</b></div>
          <div className="purchase-confirm-total"><span>Total du panier</span><strong>{money(cartTotal, 'USD')}</strong></div>

          <div className="purchase-confirm-actions">
            <Link className="button buy-now-button full" to={`/checkout?${buyNowParams.toString()}`}><Zap size={17}/> Acheter ce produit maintenant</Link>
            <Link className="button primary full" to="/checkout">Commander tout le panier <ArrowRight size={17}/></Link>
            <Link className="button secondary full" to="/cart"><ShoppingBag size={17}/> Voir le panier</Link>
            <Link className="purchase-continue-link" to="/catalog">Continuer mes achats</Link>
          </div>
        </aside>
      </div>
    </main>
  )
}
