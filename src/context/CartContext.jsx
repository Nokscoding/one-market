import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const { user } = useAuth()
  const [cartId, setCartId] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refreshCart = useCallback(async () => {
    if (!supabase || !user) { setCartId(null); setItems([]); return }
    setLoading(true); setError('')
    try {
      let { data: cart } = await supabase.from('carts').select('id').eq('customer_id', user.id).maybeSingle()
      if (!cart) {
        const created = await supabase.from('carts').insert({ customer_id: user.id }).select('id').single()
        if (created.error) throw created.error
        cart = created.data
      }
      setCartId(cart.id)
      const { data: raw, error: itemError } = await supabase.from('cart_items').select('*').eq('cart_id', cart.id).order('created_at')
      if (itemError) throw itemError
      if (!raw?.length) { setItems([]); return }
      const productIds = [...new Set(raw.map(i => i.product_id))]
      const variantIds = [...new Set(raw.map(i => i.product_variant_id).filter(Boolean))]
      const [{ data: products }, { data: images }, variantRes] = await Promise.all([
        supabase.from('products').select('*, stores:store_id(id,name,slug,city,country_code,currency,status)').in('id', productIds),
        supabase.from('product_images').select('*').in('product_id', productIds).order('sort_order'),
        variantIds.length ? supabase.from('product_variants').select('*').in('id', variantIds) : Promise.resolve({ data: [] }),
      ])
      const pMap = Object.fromEntries((products || []).map(p => [p.id, p]))
      const vMap = Object.fromEntries((variantRes.data || []).map(v => [v.id, v]))
      const imgMap = {}; (images || []).forEach(img => { if (!imgMap[img.product_id]) imgMap[img.product_id] = img.secure_url })
      setItems(raw.map(i => {
        const product = pMap[i.product_id]; const variant = i.product_variant_id ? vMap[i.product_variant_id] : null
        return { ...i, product, variant, store: product?.stores || null, image: imgMap[i.product_id] || null, unitPrice: Number(variant?.price ?? product?.price ?? 0) }
      }).filter(i => i.product && i.store?.status === 'active'))
    } catch (e) { setError(e.message || 'Impossible de charger le panier.') }
    finally { setLoading(false) }
  }, [user])

  useEffect(() => { refreshCart() }, [refreshCart])

  async function addItem(productId, productVariantId = null, quantity = 1) {
    if (!user || !cartId) throw new Error('AUTH_REQUIRED')
    const existing = items.find(i => i.product_id === productId && (i.product_variant_id || null) === (productVariantId || null))
    if (existing) {
      const { error } = await supabase.from('cart_items').update({ quantity: Math.min(existing.quantity + quantity, 99) }).eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('cart_items').insert({ cart_id: cartId, product_id: productId, product_variant_id: productVariantId, quantity })
      if (error) throw error
    }
    await refreshCart()
  }

  async function updateQuantity(id, quantity) {
    if (quantity <= 0) return removeItem(id)
    const { error } = await supabase.from('cart_items').update({ quantity: Math.min(Number(quantity), 99) }).eq('id', id)
    if (error) throw error
    await refreshCart()
  }
  async function removeItem(id) { const { error } = await supabase.from('cart_items').delete().eq('id', id); if (error) throw error; await refreshCart() }
  const count = items.reduce((s,i) => s + i.quantity, 0)
  const total = items.reduce((s,i) => s + i.unitPrice * i.quantity, 0)
  const value = useMemo(() => ({ cartId, items, loading, error, count, total, addItem, updateQuantity, removeItem, refreshCart }), [cartId, items, loading, error, count, total, refreshCart])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
export function useCart() { return useContext(CartContext) }
