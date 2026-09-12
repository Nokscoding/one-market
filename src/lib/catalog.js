import { supabase } from './supabase'

const PRODUCT_SELECT = `
  *,
  stores:store_id(id,name,slug,city,country_code,currency,logo_url,status),
  categories:category_id(id,name,slug),
  product_images(id,secure_url,alt_text,sort_order),
  product_variants(id,attributes,price,stock_qty,is_active)
`

export function normalizeProduct(product) {
  if (!product) return product
  const images = [...(product.product_images || [])].sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0))
  return { ...product, images, image: images[0]?.secure_url || null, store: product.stores || null, category: product.categories || null }
}

export async function fetchProducts({ q = '', category = '', store = '', limit = 80 } = {}) {
  let query = supabase.from('products').select(PRODUCT_SELECT).eq('is_active', true).order('created_at', { ascending: false }).limit(limit)
  if (q) query = query.ilike('name', `%${q}%`)
  if (category) query = query.eq('category_id', category)
  if (store) query = query.eq('store_id', store)
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(normalizeProduct).filter(p => p.store?.status === 'active' && p.store?.country_code === 'CD')
}

export async function fetchProduct(id) {
  const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).eq('id', id).eq('is_active', true).maybeSingle()
  if (error) throw error
  const product = normalizeProduct(data)
  return product?.store?.country_code === 'CD' ? product : null
}

export async function fetchCategories() {
  const { data, error } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order')
  if (error) throw error
  return data || []
}

export async function fetchStores() {
  const { data, error } = await supabase.from('stores').select('*').eq('status', 'active').eq('country_code', 'CD').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function fetchStore(slug) {
  const { data, error } = await supabase.from('stores').select('*').eq('slug', slug).eq('status', 'active').eq('country_code', 'CD').maybeSingle()
  if (error) throw error
  return data
}
