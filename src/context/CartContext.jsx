import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const CartContext = createContext(null)

function stockError(stock) {
  if (stock <= 0) return new Error('Ce produit est en rupture de stock.')
  return new Error(`Stock disponible : ${stock}.`)
}

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

  const refreshCart = useCallback(async ({ silent = false } = {}) => {
    if (!user?.id) {
      setCartId(null)
      setItems([])
      setLoading(false)
      return
    }

    if (!silent) setLoading(true)
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
        ? await supabase.from('stores').select('id,name,slug,country_code,currency,status').in('id', storeIds).eq('country_code', 'CD')
        : { data: [] }

      const productMap = Object.fromEntries((products || []).map(product => [product.id, product]))
      const variantMap = Object.fromEntries(variants.map(variant => [variant.id, variant]))
      const storeMap = Object.fromEntries((stores || []).map(store => [store.id, store]))
      const firstImage = {}
      ;(images || []).forEach(image => {
        if (!firstImage[image.product_id] && image.secure_url) firstImage[image.product_id] = image.secure_url
      })

      setItems(rawItems.map(item => {
        const product = productMap[item.product_id]
        const variant = item.product_variant_id ? variantMap[item.product_variant_id] : null
        const store = product ? storeMap[product.store_id] : null
        const availableStock = Number(variant?.stock_qty ?? product?.stock_qty ?? 0)
        const variantRequiredMissing = Boolean(product?.has_variants && !variant)
        const isAvailable = Boolean(
          product?.is_active &&
          store?.status === 'active' &&
          !variantRequiredMissing &&
          availableStock > 0
        )

        return {
          ...item,
          product,
          variant,
          store,
          image: firstImage[item.product_id] || null,
          unitPrice: Number(variant?.price ?? product?.price ?? 0),
          availableStock,
          isAvailable,
          quantityTooHigh: availableStock > 0 && Number(item.quantity) > availableStock,
        }
      }).filter(item => item.product && item.store))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [user?.id, ensureCart])

  useEffect(() => {
    refreshCart().catch(() => {
      setItems([])
      setLoading(false)
    })
  }, [refreshCart])

  const getAvailableStock = useCallback(async (productId, productVariantId = null) => {
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id,store_id,stock_qty,has_variants,is_active')
      .eq('id', productId)
      .maybeSingle()

    if (productError) throw productError
    if (!product?.is_active) throw new Error('Ce produit n’est plus disponible.')

    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('status,country_code')
      .eq('id', product.store_id)
      .maybeSingle()

    if (storeError) throw storeError
    if (!store || store.status !== 'active' || store.country_code !== 'CD') throw new Error('Cette boutique n’est pas disponible actuellement.')

    if (product.has_variants && !productVariantId) throw new Error('Choisis une variante avant d’ajouter ce produit.')

    if (productVariantId) {
      const { data: variant, error: variantError } = await supabase
        .from('product_variants')
        .select('stock_qty,is_active')
        .eq('id', productVariantId)
        .eq('product_id', productId)
        .maybeSingle()

      if (variantError) throw variantError
      if (!variant?.is_active) throw new Error('Cette variante n’est plus disponible.')
      return Number(variant.stock_qty) || 0
    }

    return Number(product.stock_qty) || 0
  }, [])

  const addItem = useCallback(async (productId, productVariantId = null, quantity = 1, snapshot = {}) => {
    if (!user?.id) throw new Error('AUTH_REQUIRED')
    const activeCartId = cartId || await ensureCart()
    const normalizedQuantity = Math.max(1, Math.min(99, Number(quantity) || 1))
    const knownStock = Number(snapshot?.availableStock)
    const availableStock = Number.isFinite(knownStock) && knownStock >= 0
      ? knownStock
      : await getAvailableStock(productId, productVariantId)
    const existing = items.find(item => item.product_id === productId && (item.product_variant_id || null) === (productVariantId || null))
    const desiredQuantity = (existing?.quantity || 0) + normalizedQuantity

    if (desiredQuantity > availableStock) throw stockError(availableStock)

    if (existing) {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity: desiredQuantity })
        .eq('id', existing.id)
      if (error) throw error

      setItems(current => current.map(item => item.id === existing.id
        ? { ...item, quantity: desiredQuantity, availableStock, quantityTooHigh: false }
        : item))
    } else {
      const { data: inserted, error } = await supabase
        .from('cart_items')
        .insert({
          cart_id: activeCartId,
          product_id: productId,
          product_variant_id: productVariantId,
          quantity: normalizedQuantity,
        })
        .select('id,created_at')
        .single()
      if (error) throw error

      if (snapshot?.product && snapshot?.store) {
        setItems(current => [...current, {
          id: inserted.id,
          created_at: inserted.created_at,
          cart_id: activeCartId,
          product_id: productId,
          product_variant_id: productVariantId,
          quantity: normalizedQuantity,
          product: snapshot.product,
          variant: snapshot.variant || null,
          store: snapshot.store,
          image: snapshot.image || null,
          unitPrice: Number(snapshot.unitPrice ?? snapshot.variant?.price ?? snapshot.product?.price ?? 0),
          availableStock,
          isAvailable: true,
          quantityTooHigh: false,
        }])
      }
    }

    // Ne bloque plus la navigation : le panier complet se resynchronise en arrière-plan.
    refreshCart({ silent: true }).catch(() => {})
  }, [user?.id, cartId, ensureCart, getAvailableStock, items, refreshCart])

  const updateQuantity = useCallback(async (id, quantity) => {
    const item = items.find(current => current.id === id)
    if (!item) return
    if (quantity <= 0) {
      const { error } = await supabase.from('cart_items').delete().eq('id', id)
      if (error) throw error
      await refreshCart()
      return
    }

    const normalized = Math.max(1, Math.min(99, Number(quantity) || 1))
    const availableStock = await getAvailableStock(item.product_id, item.product_variant_id || null)
    if (normalized > availableStock) throw stockError(availableStock)

    const { error } = await supabase.from('cart_items').update({ quantity: normalized }).eq('id', id)
    if (error) throw error
    await refreshCart()
  }, [items, getAvailableStock, refreshCart])

  const removeItem = useCallback(async (id) => {
    const { error } = await supabase.from('cart_items').delete().eq('id', id)
    if (error) throw error
    await refreshCart()
  }, [refreshCart])

  const clearCart = useCallback(async () => {
    if (!cartId) return
    const { error } = await supabase.from('cart_items').delete().eq('cart_id', cartId)
    if (error) throw error
    setItems([])
  }, [cartId])

  const count = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const hasIssues = items.some(item => !item.isAvailable || item.quantityTooHigh)

  const value = useMemo(() => ({
    cartId,
    items,
    loading,
    count,
    total,
    hasIssues,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    refreshCart,
  }), [cartId, items, loading, count, total, hasIssues, addItem, updateQuantity, removeItem, clearCart, refreshCart])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  return useContext(CartContext)
}
