import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

/**
 * CartContext gère le panier persistant du client connecté.
 * Il enrichit cart_items avec produits, variantes, images et boutiques afin que les pages
 * n'aient pas à refaire toute cette logique.
 */

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const { user } = useAuth()
  const [cartId, setCartId] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const refreshCart = useCallback(async () => {
    if (!user) {
      setCartId(null)
      setItems([])
      return
    }

    setLoading(true)
    try {
      const { data: cart, error: cartError } = await supabase
        .from('carts')
        .select('id')
        .eq('customer_id', user.id)
        .single()
      if (cartError) throw cartError
      setCartId(cart.id)

      const { data: rawItems, error: itemError } = await supabase
        .from('cart_items')
        .select('*')
        .eq('cart_id', cart.id)
        .order('created_at')
      if (itemError) throw itemError
      if (!rawItems?.length) {
        setItems([])
        return
      }

      const productIds = [...new Set(rawItems.map(i => i.product_id))]
      const variantIds = [...new Set(rawItems.map(i => i.product_variant_id).filter(Boolean))]

      const { data: products } = await supabase.from('products').select('*').in('id', productIds)
      const { data: images } = await supabase.from('product_images').select('*').in('product_id', productIds).order('sort_order')
      const { data: variants } = variantIds.length ? await supabase.from('product_variants').select('*').in('id', variantIds) : { data: [] }
      const storeIds = [...new Set((products || []).map(p => p.store_id))]
      const { data: stores } = storeIds.length ? await supabase.from('stores').select('id,name,slug,country_code,currency').in('id', storeIds) : { data: [] }

      const productMap = Object.fromEntries((products || []).map(p => [p.id, p]))
      const variantMap = Object.fromEntries((variants || []).map(v => [v.id, v]))
      const storeMap = Object.fromEntries((stores || []).map(s => [s.id, s]))
      const firstImage = {}
      ;(images || []).forEach(img => { if (!firstImage[img.product_id]) firstImage[img.product_id] = img.secure_url })

      setItems(rawItems.map(item => {
        const product = productMap[item.product_id]
        const variant = item.product_variant_id ? variantMap[item.product_variant_id] : null
        return { ...item, product, variant, store: product ? storeMap[product.store_id] : null, image: firstImage[item.product_id] || null, unitPrice: Number(variant?.price ?? product?.price ?? 0) }
      }).filter(i => i.product))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { refreshCart() }, [refreshCart])

  async function addItem(productId, productVariantId = null, quantity = 1) {
    if (!user || !cartId) throw new Error('AUTH_REQUIRED')
    const existing = items.find(i => i.product_id === productId && (i.product_variant_id || null) === (productVariantId || null))
    if (existing) {
      const { error } = await supabase.from('cart_items').update({ quantity: existing.quantity + quantity }).eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('cart_items').insert({ cart_id: cartId, product_id: productId, product_variant_id: productVariantId, quantity })
      if (error) throw error
    }
    await refreshCart()
  }

  async function updateQuantity(id, quantity) {
    if (quantity <= 0) return removeItem(id)
    const { error } = await supabase.from('cart_items').update({ quantity }).eq('id', id)
    if (error) throw error
    await refreshCart()
  }

  async function removeItem(id) {
    const { error } = await supabase.from('cart_items').delete().eq('id', id)
    if (error) throw error
    await refreshCart()
  }

  const count = items.reduce((sum, item) => sum + item.quantity, 0)
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const value = useMemo(() => ({ cartId, items, loading, count, total, addItem, updateQuantity, removeItem, refreshCart }), [cartId, items, loading, count, total])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() { return useContext(CartContext) }
