import { ArrowRight, CheckCircle2, Minus, Plus, ShoppingBag } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Loader from '../components/Loader'
import SmartImage from '../components/SmartImage'
import { useCart } from '../context/CartContext'
import { money } from '../lib/format'
import { supabase } from '../lib/supabase'

export default function AddedToCartPage() {
  const [params] = useSearchParams()
  const productId = params.get('product') || ''
  const variantId = params.get('variant') || ''
  const addedQty = Math.max(1, Number(params.get('qty')) || 1)
  const { items, loading: cartLoading, updateQuantity } = useCart()
  const [product, setProduct] = useState(null)
  const [variant, setVariant] = useState(null)
  const [store, setStore] = useState(null)
  const [image, setImage] = useState('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
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
    })().finally(() => active && setLoading(false))

    return () => { active = false }
  }, [productId, variantId])

  const cartItem = useMemo(() => items.find(item => item.product_id === productId && (item.product_variant_id || '') === variantId), [items, productId, variantId])
  const unitPrice = Number(variant?.price ?? product?.price ?? cartItem?.unitPrice ?? 0)
  const quantity = cartItem?.quantity || addedQty
  const total = unitPrice * quantity

  async function changeQuantity(next) {
    if (!cartItem || updating) return
    setUpdating(true)
    try { await updateQuantity(cartItem.id, Math.max(1, next)) }
    finally { setUpdating(false) }
  }

  if (loading || cartLoading) return <Loader fullscreen />

  if (!product) {
    return <main className="section-shell page-space"><div className="purchase-confirm-card"><h1>Produit introuvable</h1><Link className="button primary" to="/catalog">Retour au catalogue</Link></div></main>
  }

  return (
    <main className="section-shell purchase-confirm-page">
      <div className="purchase-success-title"><CheckCircle2 size={28}/><div><span>Ajouté au panier</span><h1>Votre produit est bien dans le panier</h1></div></div>

      <div className="purchase-confirm-layout">
        <section className="purchase-confirm-card purchase-confirm-product">
          <SmartImage src={image} alt={product.name} fallback="OM" fit="contain" className="purchase-confirm-image" widthHint={360} />
          <div className="purchase-confirm-info">
            <span className="eyebrow">{store?.name || 'One Market'}</span>
            <h2>{product.name}</h2>
            {variant && <p>{Object.values(variant.attributes || {}).join(' · ')}</p>}
            <div className="purchase-confirm-unit"><span>Prix unitaire</span><strong>{money(unitPrice, product.currency)}</strong></div>
            <div className="purchase-confirm-qty">
              <span>Quantité dans le panier</span>
              <div className="qty-control small">
                <button disabled={updating || quantity <= 1} onClick={() => changeQuantity(quantity - 1)}><Minus size={14}/></button>
                <span>{quantity}</span>
                <button disabled={updating} onClick={() => changeQuantity(quantity + 1)}><Plus size={14}/></button>
              </div>
            </div>
          </div>
        </section>

        <aside className="purchase-confirm-card purchase-confirm-summary">
          <span>Résumé</span>
          <div><span>Quantité ajoutée</span><b>{addedQty}</b></div>
          <div><span>Quantité totale</span><b>{quantity}</b></div>
          <div className="purchase-confirm-total"><span>Total produit</span><strong>{money(total, product.currency)}</strong></div>
          <div className="purchase-confirm-actions">
            <Link className="button primary full" to="/checkout">Commander le panier <ArrowRight size={17}/></Link>
            <Link className="button secondary full" to="/cart"><ShoppingBag size={17}/> Voir le panier</Link>
            <Link className="purchase-continue-link" to="/catalog">Continuer mes achats</Link>
          </div>
        </aside>
      </div>
    </main>
  )
}
