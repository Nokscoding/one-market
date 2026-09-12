import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const { user } = useAuth()
  const [cartId, setCartId] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const ensureCart = useCallback(async () => {
    if (!user?.id) throw new Error('AUTH_REQUIRED')

    const { data: existing, error: selectError } = await supabase
      .from('carts')
      .select('id')
      .eq('customer_id', user.id)
      .maybeSingle()

    if (selectError) throw selectError
    if (existing?.id) {
      setCartId(existing.id)
      return existing.id
    }

    const { data: created, error: insertError } = await supabase
      .from('carts')
      .insert({ customer_id: user.id })
      .select('id')
      .single()

    if (insertError) {
      // Si deux onglets créent le panier au même moment, relire le panier existant.
      const { data: retry, error: retryError } = await supabase
        .from('carts')
        .select('id')
        .eq('customer_id', user.id)
        .maybeSingle()
      if (retryError || !retry?.id) throw insertError
      setCartId(retry.id)
      return retry.id
    }

    setCartId(created.id)
    return created.id
  }, [user?.id])

  const refreshCart = useCallback(async () => {
    if (!user?.id) {
      setCartId(null)
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const activeCartId = await ensureCart()

      const { data: rawItems, error: itemError } = await supabase
        .from('cart_items')
        .select('*')
        .eq('cart_id', activeCartId)
        .order('created_at')
      if (itemError) throw itemError

      if (!rawItems?.length) {
        setItems([])
        return
      }

      const productIds = [...new Set(rawItems.map(item => item.product_id))]
      const variantIds = [...new Set(rawItems.map(item => item.product_variant_id).filter(Boolean))]

      const [{ data: products }, { data: images }, variantResult] = await Promise.all([
        supabase.from('products').select('*').in('id', productIds),
        supabase.from('product_images').select('*').in('product_id', productIds).order('sort_order'),
        variantIds.length ? supabase.from('product_variants').select('*').in('id', variantIds) : Promise.resolve({ data: [] }),
      ])

      const variants = variantResult.data || []
      const storeIds = [...new Set((products || []).map(product => product.store_id))]
      const { data: stores } = storeIds.length
        ? await supabase.from('stores').select('id,name,slug,country_code,currency').in('id', storeIds).eq('country_code', 'CD')
        : { data: [] }

      const productMap = Object.fromEntries((products || []).map(product => [product.id, product]))
      const variantMap = Object.fromEntries(variants.map(variant => [variant.id, variant]))
      const storeMap = Object.fromEntries((stores || []).map(store => [store.id, store]))
      const firstImage = {}
      ;(images || []).forEach(image => {
        if (!firstImage[image.product_id] && image.secure_url) firstImage[image.product_id] = image.secure_url
      })

      setItems(rawItems
        .map(item => {
          const product = productMap[item.product_id]
          const variant = item.product_variant_id ? variantMap[item.product_variant_id] : null
          return {
            ...item,
            product,
            variant,
            store: product ? storeMap[product.store_id] : null,
            image: firstImage[item.product_id] || null,
            unitPrice: Number(variant?.price ?? product?.price ?? 0),
          }
        })
        .filter(item => item.product && item.store))
    } finally {
      setLoading(false)
    }
  }, [user?.id, ensureCart])

  useEffect(() => {
    refreshCart().catch(() => {
      setItems([])
      setLoading(false)
    })
  }, [refreshCart])

  const addItem = useCallback(async (productId, productVariantId = null, quantity = 1) => {
    if (!user?.id) throw new Error('AUTH_REQUIRED')
    const activeCartId = cartId || await ensureCart()
    const normalizedQuantity = Math.max(1, Math.min(99, Number(quantity) || 1))
    const existing = items.find(item => item.product_id === productId && (item.product_variant_id || null) === (productVariantId || null))

    if (existing) {
      const nextQuantity = Math.min(99, existing.quantity + normalizedQuantity)
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity: nextQuantity })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('cart_items')
        .insert({
          cart_id: activeCartId,
          product_id: productId,
          product_variant_id: productVariantId,
          quantity: normalizedQuantity,
        })
      if (error) throw error
    }

    await refreshCart()
  }, [user?.id, cartId, ensureCart, items, refreshCart])

  const updateQuantity = useCallback(async (id, quantity) => {
    if (quantity <= 0) return removeItem(id)
    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: Math.min(99, quantity) })
      .eq('id', id)
    if (error) throw error
    await refreshCart()
  }, [refreshCart])

  const removeItem = useCallback(async (id) => {
    const { error } = await supabase.from('cart_items').delete().eq('id', id)
    if (error) throw error
    await refreshCart()
  }, [refreshCart])

  const count = items.reduce((sum, item) => sum + item.quantity, 0)
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

  const value = useMemo(() => ({
    cartId,
    items,
    loading,
    count,
    total,
    addItem,
    updateQuantity,
    removeItem,
    refreshCart,
  }), [cartId, items, loading, count, total, addItem, updateQuantity, removeItem, refreshCart])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  return useContext(CartContext)
}
