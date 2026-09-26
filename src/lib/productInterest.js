import { supabase } from './supabase'
import { logTechnicalError } from './userErrors'

export function recordProductView(productOrId, userId) {
  const productId = typeof productOrId === 'string' ? productOrId : productOrId?.id
  if (!userId || !productId) return

  const key = `om-product-view:${productId}`
  try {
    if (window.sessionStorage.getItem(key)) return
    window.sessionStorage.setItem(key, '1')
  } catch {}

  supabase
    .from('product_view_events')
    .insert({ product_id: productId, user_id: userId })
    .then(({ error }) => {
      if (!error) return
      logTechnicalError('product-interest.view', error)
      try { window.sessionStorage.removeItem(key) } catch {}
    })
    .catch(error => {
      logTechnicalError('product-interest.view', error)
      try { window.sessionStorage.removeItem(key) } catch {}
    })
}
