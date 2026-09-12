import {
  AlertCircle,
  BarChart3,
  Boxes,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Edit3,
  Eye,
  LayoutDashboard,
  Package,
  Plus,
  Save,
  Settings,
  ShoppingBag,
  Store,
  TrendingUp,
  Truck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import CloudinaryImageField from '../components/CloudinaryImageField'
import Loader from '../components/Loader'
import SellerProductEditor from '../components/SellerProductEditor'
import SmartImage from '../components/SmartImage'
import { useAuth } from '../context/AuthContext'
import { cdf, deliveryOption } from '../lib/delivery'
import { money } from '../lib/format'
import { normalizeOptionalUrl } from '../lib/seller'
import { supabase } from '../lib/supabase'

const ADMIN_ROLES = new Set(['admin', 'global_admin'])
const EMPTY_STORE = {
  name: '',
  city: 'Lubumbashi',
  description: '',
  primary_category_id: '',
  phone: '',
  logo_url: '',
  banner_url: '',
  website_url: '',
  instagram_url: '',
  tiktok_url: '',
  facebook_url: '',
  linkedin_url: '',
  whatsapp_business: '',
}

function slugify(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function formatDate(value) {
  if (!value) return ''
  try { return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) }
  catch { return '' }
}

function statusLabel(status) {
  return {
    pending: 'À confirmer',
    confirmed: 'Confirmée',
    preparing: 'En préparation',
    ready: 'Prête',
    out_for_delivery: 'En livraison',
    delivered: 'Livrée',
    cancelled: 'Annulée',
    refused: 'Refusée',
    failed: 'Échouée',
  }[status] || status
}

function nextStatus(status) {
  return { pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'out_for_delivery', out_for_delivery: 'delivered' }[status] || null
}

function nextStatusAction(status) {
  return {
    pending: 'Confirmer la commande',
    confirmed: 'Commencer la préparation',
    preparing: 'Marquer prête',
    ready: 'Remise au livreur',
    out_for_delivery: 'Marquer livrée',
  }[status] || ''
}

function storeToForm(store) {
  if (!store) return { ...EMPTY_STORE }
  return {
    name: store.name || '',
    city: store.city || 'Lubumbashi',
    description: store.description || '',
    primary_category_id: store.primary_category_id || '',
    phone: store.phone || '',
    logo_url: store.logo_url || '',
    banner_url: store.banner_url || '',
    website_url: store.website_url || '',
    instagram_url: store.instagram_url || '',
    tiktok_url: store.tiktok_url || '',
    facebook_url: store.facebook_url || '',
    linkedin_url: store.linkedin_url || '',
    whatsapp_business: store.whatsapp_business || '',
  }
}

export default function SellerWorkspacePage() {
  const { user, profile, profileLoading } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'overview'
  const isAdmin = ADMIN_ROLES.has(profile?.role)

  const [categories, setCategories] = useState([])
  const [stores, setStores] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [storeForm, setStoreForm] = useState(EMPTY_STORE)
  const [products, setProducts] = useState([])
  const [productImages, setProductImages] = useState({})
  const [productVariants, setProductVariants] = useState({})
  const [orders, setOrders] = useState([])
  const [orderItems, setOrderItems] = useState([])
  const [parentOrders, setParentOrders] = useState({})
  const [loading, setLoading] = useState(true)
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [storeSaving, setStoreSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [editorProductId, setEditorProductId] = useState('')

  useEffect(() => {
    if (!user?.id || profileLoading) return undefined
    let active = true
    setLoading(true)
    setFeedback('')

    ;(async () => {
      const categoryResult = await supabase.from('categories').select('id,name').eq('is_active', true).order('sort_order')
      if (categoryResult.error) throw categoryResult.error

      let storeQuery = supabase.from('stores').select('*').order('created_at', { ascending: true })
      if (!isAdmin) storeQuery = storeQuery.eq('owner_id', user.id)
      const storeResult = await storeQuery
      if (storeResult.error) throw storeResult.error
      if (!active) return

      setCategories(categoryResult.data || [])
      const list = storeResult.data || []
      setStores(list)
      setSelectedStoreId(current => current || list[0]?.id || '')
    })()
      .catch(error => { if (active) setFeedback(error?.message || 'Impossible de charger l’espace vendeur.') })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [user?.id, profileLoading, isAdmin])

  const selectedStore = useMemo(() => stores.find(store => store.id === selectedStoreId) || null, [stores, selectedStoreId])

  useEffect(() => {
    setStoreForm(storeToForm(selectedStore))
  }, [selectedStore])

  async function loadWorkspace(storeId = selectedStoreId) {
    if (!storeId) return
    setWorkspaceLoading(true)
    setFeedback('')
    try {
      const [productResult, orderResult] = await Promise.all([
        supabase.from('products').select('*').eq('store_id', storeId).order('created_at', { ascending: false }),
        supabase.from('seller_orders').select('*').eq('store_id', storeId).order('created_at', { ascending: false }).limit(150),
      ])
      if (productResult.error) throw productResult.error
      if (orderResult.error) throw orderResult.error

      const productList = productResult.data || []
      const orderList = orderResult.data || []
      setProducts(productList)
      setOrders(orderList)

      const productIds = productList.map(item => item.id)
      const sellerOrderIds = orderList.map(item => item.id)
      const parentIds = [...new Set(orderList.map(item => item.order_id))]

      const [imagesResult, variantsResult, itemsResult, parentsResult] = await Promise.all([
        productIds.length ? supabase.from('product_images').select('*').in('product_id', productIds).order('sort_order') : Promise.resolve({ data: [] }),
        productIds.length ? supabase.from('product_variants').select('*').in('product_id', productIds).order('created_at') : Promise.resolve({ data: [] }),
        sellerOrderIds.length ? supabase.from('order_items').select('*').in('seller_order_id', sellerOrderIds).order('created_at') : Promise.resolve({ data: [] }),
        parentIds.length ? supabase.from('orders').select('id,order_number,shipping_snapshot,customer_note,payment_method,payment_status,delivery_method,delivery_fee_cdf,delivery_currency,logistics_status,created_at').in('id', parentIds) : Promise.resolve({ data: [] }),
      ])

      const imageMap = {}
      ;(imagesResult.data || []).forEach(image => { (imageMap[image.product_id] ||= []).push(image) })
      const variantMap = {}
      ;(variantsResult.data || []).forEach(variant => { (variantMap[variant.product_id] ||= []).push(variant) })
      setProductImages(imageMap)
      setProductVariants(variantMap)
      setOrderItems(itemsResult.data || [])
      setParentOrders(Object.fromEntries((parentsResult.data || []).map(order => [order.id, order])))
    } catch (error) {
      setFeedback(error?.message || 'Impossible de charger les données de la boutique.')
    } finally {
      setWorkspaceLoading(false)
    }
  }

  useEffect(() => {
    if (!selectedStoreId) return
    loadWorkspace(selectedStoreId)
  }, [selectedStoreId])

  function changeTab(nextTab) {
    const next = new URLSearchParams(params)
    if (nextTab === 'overview') next.delete('tab')
    else next.set('tab', nextTab)
    setParams(next)
    setEditorProductId('')
  }

  async function createStore(event) {
    event.preventDefault()
    if (!user?.id || storeSaving) return
    const name = storeForm.name.trim()
    if (!name) return setFeedback('Donne un nom à la boutique.')
    setStoreSaving(true)
    setFeedback('')
    try {
      const payload = {
        owner_id: user.id,
        name,
        slug: `${slugify(name)}-${Date.now().toString(36)}`,
        description: storeForm.description.trim() || null,
        logo_url: storeForm.logo_url || null,
        banner_url: storeForm.banner_url || null,
        country_code: 'CD',
        city: storeForm.city.trim() || 'Lubumbashi',
        currency: 'USD',
        status: 'active',
        is_demo: false,
        primary_category_id: storeForm.primary_category_id || null,
        phone: storeForm.phone.trim() || null,
        website_url: normalizeOptionalUrl(storeForm.website_url),
        instagram_url: normalizeOptionalUrl(storeForm.instagram_url),
        tiktok_url: normalizeOptionalUrl(storeForm.tiktok_url),
        facebook_url: normalizeOptionalUrl(storeForm.facebook_url),
        linkedin_url: normalizeOptionalUrl(storeForm.linkedin_url),
        whatsapp_business: storeForm.whatsapp_business.trim() || null,
      }
      const result = await supabase.from('stores').insert(payload).select('*').single()
      if (result.error) throw result.error
      setStores(current => [...current, result.data])
      setSelectedStoreId(result.data.id)
      setFeedback('Boutique créée. Tu peux maintenant ajouter tes produits.')
    } catch (error) {
      setFeedback(error?.message || 'Impossible de créer la boutique.')
    } finally {
      setStoreSaving(false)
    }
  }

  async function saveStore(event) {
    event.preventDefault()
    if (!selectedStore || storeSaving) return
    setStoreSaving(true)
    setFeedback('')
    try {
      const payload = {
        name: storeForm.name.trim(),
        description: storeForm.description.trim() || null,
        city: storeForm.city.trim() || 'Lubumbashi',
        primary_category_id: storeForm.primary_category_id || null,
        phone: storeForm.phone.trim() || null,
        logo_url: storeForm.logo_url || null,
        banner_url: storeForm.banner_url || null,
        website_url: normalizeOptionalUrl(storeForm.website_url),
        instagram_url: normalizeOptionalUrl(storeForm.instagram_url),
        tiktok_url: normalizeOptionalUrl(storeForm.tiktok_url),
        facebook_url: normalizeOptionalUrl(storeForm.facebook_url),
        linkedin_url: normalizeOptionalUrl(storeForm.linkedin_url),
        whatsapp_business: storeForm.whatsapp_business.trim() || null,
      }
      const result = await supabase.from('stores').update(payload).eq('id', selectedStore.id).select('*').single()
      if (result.error) throw result.error
      setStores(current => current.map(store => store.id === result.data.id ? result.data : store))
      setFeedback('Boutique mise à jour.')
    } catch (error) {
      setFeedback(error?.message || 'Impossible de mettre à jour la boutique.')
    } finally {
      setStoreSaving(false)
    }
  }

  async function toggleProduct(product) {
    const result = await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id).select('*').single()
    if (result.error) return setFeedback(result.error.message)
    setProducts(current => current.map(item => item.id === product.id ? result.data : item))
  }

  async function updateBaseStock(product, value) {
    if (product.has_variants) return
    const stock = Math.max(0, Math.trunc(Number(value) || 0))
    const result = await supabase.from('products').update({ stock_qty: stock }).eq('id', product.id).select('*').single()
    if (result.error) return setFeedback(result.error.message)
    setProducts(current => current.map(item => item.id === product.id ? result.data : item))
  }

  async function advanceOrder(order) {
    const next = nextStatus(order.status)
    if (!next) return
    setFeedback('')
    const result = await supabase.from('seller_orders').update({ status: next }).eq('id', order.id).select('*').single()
    if (result.error) return setFeedback(result.error.message)
    setOrders(current => current.map(item => item.id === order.id ? result.data : item))
  }

  async function refuseOrder(order) {
    const reason = window.prompt('Pourquoi refuses-tu cette commande ?')
    if (!reason?.trim()) return
    const result = await supabase.from('seller_orders').update({ status: 'refused', refusal_reason: reason.trim() }).eq('id', order.id).select('*').single()
    if (result.error) return setFeedback(result.error.message)
    setOrders(current => current.map(item => item.id === order.id ? result.data : item))
  }

  const stats = useMemo(() => {
    const activeProducts = products.filter(product => product.is_active).length
    const lowStock = products.filter(product => product.is_active && Number(product.stock_qty) <= 5).length
    const pendingOrders = orders.filter(order => ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status)).length
    const deliveredRevenue = orders.filter(order => order.status === 'delivered').reduce((sum, order) => sum + Number(order.subtotal || order.total || 0), 0)
    const deliveredOrders = orders.filter(order => order.status === 'delivered').length
    return { activeProducts, lowStock, pendingOrders, deliveredRevenue, deliveredOrders }
  }, [products, orders])

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase()
    if (!query) return products
    return products.filter(product => product.name.toLowerCase().includes(query) || product.slug?.toLowerCase().includes(query))
  }, [products, productSearch])

  const editorProduct = editorProductId && editorProductId !== 'new' ? products.find(product => product.id === editorProductId) || null : null

  if (profileLoading || loading) return <Loader fullscreen />

  if (!stores.length && !isAdmin) {
    return (
      <main className="section-shell seller-setup-page">
        <section className="seller-setup-card seller-setup-card--final">
          <div className="seller-setup-heading"><Store size={34}/><div><span className="eyebrow">Première configuration</span><h1>Crée ta boutique</h1><p>Ton compte vendeur est actif. Configure les informations visibles par les clients.</p></div></div>
          {feedback && <div className="seller-feedback">{feedback}</div>}
          <form onSubmit={createStore} className="seller-store-form seller-store-form--final">
            <label>Nom de la boutique<input required value={storeForm.name} onChange={event => setStoreForm({ ...storeForm, name: event.target.value })}/></label>
            <label>Ville<input value={storeForm.city} onChange={event => setStoreForm({ ...storeForm, city: event.target.value })}/></label>
            <label>Catégorie principale<select value={storeForm.primary_category_id} onChange={event => setStoreForm({ ...storeForm, primary_category_id: event.target.value })}><option value="">Non précisée</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label>Téléphone commercial<input value={storeForm.phone} onChange={event => setStoreForm({ ...storeForm, phone: event.target.value })} placeholder="+243…"/></label>
            <label className="wide">Description<textarea rows={4} value={storeForm.description} onChange={event => setStoreForm({ ...storeForm, description: event.target.value })}/></label>
            <CloudinaryImageField className="wide" label="Logo de la boutique" value={storeForm.logo_url} folder={`one-market/stores/${user.id}`} onChange={url => setStoreForm(current => ({ ...current, logo_url: url }))} fit="contain"/>
            <CloudinaryImageField className="wide" label="Bannière de la boutique" value={storeForm.banner_url} folder={`one-market/stores/${user.id}`} onChange={url => setStoreForm(current => ({ ...current, banner_url: url }))}/>
            <div className="seller-form-actions wide"><button className="button primary" disabled={storeSaving}>{storeSaving ? 'Création…' : 'Créer ma boutique'}</button></div>
          </form>
        </section>
      </main>
    )
  }

  if (isAdmin && !stores.length) return <main className="section-shell seller-empty-admin"><h1>Aucune boutique disponible</h1></main>

  return (
    <main className="seller-workspace seller-workspace--final">
      <aside className="seller-sidebar">
        <div className="seller-sidebar-brand"><Store size={24}/><div><span>One Market</span><strong>Espace vendeur</strong></div></div>
        {isAdmin && stores.length > 1 && <label className="seller-store-selector">Boutique<select value={selectedStoreId} onChange={event => setSelectedStoreId(event.target.value)}>{stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>}
        <div className="seller-current-store"><SmartImage src={selectedStore?.logo_url} fallback={(selectedStore?.name || 'OM').slice(0, 2).toUpperCase()} fit="contain" width={120}/><div><strong>{selectedStore?.name}</strong><span>{selectedStore?.city || 'RDC'}</span></div></div>
        <nav>
          <button className={tab === 'overview' ? 'active' : ''} onClick={() => changeTab('overview')}><LayoutDashboard size={19}/><span>Tableau de bord</span></button>
          <button className={tab === 'products' ? 'active' : ''} onClick={() => changeTab('products')}><Boxes size={19}/><span>Produits & stock</span><em>{products.length}</em></button>
          <button className={tab === 'orders' ? 'active' : ''} onClick={() => changeTab('orders')}><ClipboardList size={19}/><span>Commandes</span>{stats.pendingOrders > 0 && <em className="alert">{stats.pendingOrders}</em>}</button>
          <button className={tab === 'store' ? 'active' : ''} onClick={() => changeTab('store')}><Settings size={19}/><span>Ma boutique</span></button>
        </nav>
        <Link className="seller-back-market" to={`/store/${selectedStore?.slug || ''}`}><Eye size={17}/> Voir ma boutique</Link>
      </aside>

      <section className="seller-main">
        <header className="seller-topbar"><div><span>Espace vendeur</span><h1>{tab === 'overview' ? 'Tableau de bord' : tab === 'products' ? 'Produits & stock' : tab === 'orders' ? 'Commandes' : 'Ma boutique'}</h1></div><div className="seller-status"><i className={selectedStore?.status === 'active' ? 'online' : ''}/><span>{selectedStore?.status === 'active' ? 'Boutique active' : selectedStore?.status}</span></div></header>

        {feedback && <div className="seller-feedback workspace-feedback">{feedback}</div>}
        {workspaceLoading && <div className="seller-workspace-loader"><Loader/></div>}

        {!workspaceLoading && tab === 'overview' && <>
          <div className="seller-stat-grid">
            <article><span><Package size={21}/></span><div><small>Produits actifs</small><strong>{stats.activeProducts}</strong></div></article>
            <article><span><ClipboardList size={21}/></span><div><small>Commandes à traiter</small><strong>{stats.pendingOrders}</strong></div></article>
            <article className={stats.lowStock ? 'warning' : ''}><span><Boxes size={21}/></span><div><small>Stock faible</small><strong>{stats.lowStock}</strong></div></article>
            <article><span><TrendingUp size={21}/></span><div><small>Ventes livrées</small><strong>{money(stats.deliveredRevenue, 'USD')}</strong><em>{stats.deliveredOrders} commande{stats.deliveredOrders > 1 ? 's' : ''}</em></div></article>
          </div>

          <div className="seller-dashboard-grid">
            <section className="seller-panel"><div className="seller-panel-head"><div><h2>Commandes récentes</h2><p>Activité réelle de la boutique.</p></div><button onClick={() => changeTab('orders')}>Voir tout</button></div><div className="seller-order-mini-list">{orders.slice(0, 5).map(order => <button key={order.id} onClick={() => changeTab('orders')}><span className="seller-order-icon"><ShoppingBag size={18}/></span><div><strong>{order.seller_order_number}</strong><small>{formatDate(order.created_at)}</small></div><b className={`seller-order-pill status-${order.status}`}>{statusLabel(order.status)}</b><span>{money(order.subtotal, order.currency)}</span><ChevronRight size={17}/></button>)}{!orders.length && <div className="seller-empty"><ClipboardList size={26}/><strong>Aucune commande</strong><span>Les commandes clients apparaîtront ici.</span></div>}</div></section>
            <section className="seller-panel"><div className="seller-panel-head"><div><h2>Stock à surveiller</h2><p>Produits actifs à 5 unités ou moins.</p></div><button onClick={() => changeTab('products')}>Gérer</button></div><div className="seller-stock-watch">{products.filter(product => product.is_active && Number(product.stock_qty) <= 5).slice(0, 6).map(product => <div key={product.id}><SmartImage src={productImages[product.id]?.[0]?.secure_url} fallback="OM" fit="contain" width={120}/><span><strong>{product.name}</strong><small>{product.stock_qty} en stock</small></span><button onClick={() => { changeTab('products'); setEditorProductId(product.id) }}>Modifier</button></div>)}{!products.some(product => product.is_active && Number(product.stock_qty) <= 5) && <div className="seller-empty compact"><CheckCircle2 size={24}/><strong>Stock sous contrôle</strong><span>Aucun stock faible.</span></div>}</div></section>
          </div>
        </>}

        {!workspaceLoading && tab === 'products' && <section className="seller-panel seller-products-panel">
          {editorProductId ? <SellerProductEditor store={selectedStore} categories={categories} product={editorProduct} images={editorProduct ? productImages[editorProduct.id] || [] : []} variants={editorProduct ? productVariants[editorProduct.id] || [] : []} onCancel={() => setEditorProductId('')} onSaved={async () => { setEditorProductId(''); setFeedback('Produit enregistré.'); await loadWorkspace() }}/>
          : <>
            <div className="seller-panel-head seller-products-head"><div><h2>Catalogue de la boutique</h2><p>Produits, images, variantes et stock.</p></div><button className="button primary" onClick={() => setEditorProductId('new')}><Plus size={17}/> Nouveau produit</button></div>
            <div className="seller-product-toolbar"><input value={productSearch} onChange={event => setProductSearch(event.target.value)} placeholder="Rechercher dans mes produits…"/><span>{filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''}</span></div>
            <div className="seller-product-table"><div className="seller-product-table-head"><span>Produit</span><span>Prix</span><span>Stock</span><span>Statut</span><span>Actions</span></div>{filteredProducts.map(product => <article key={product.id} className={!product.is_active ? 'inactive' : ''}><div className="seller-product-name"><SmartImage src={productImages[product.id]?.[0]?.secure_url} fallback="OM" fit="contain" width={160}/><span><strong>{product.name}</strong><small>{product.has_variants ? `${(productVariants[product.id] || []).filter(v => v.is_active).length} variante(s)` : product.slug}</small></span></div><strong>{money(product.price, product.currency)}</strong><div className={`seller-stock-input ${Number(product.stock_qty) <= 5 ? 'low' : ''}`}>{product.has_variants ? <><strong>{product.stock_qty}</strong><span>via variantes</span></> : <><input type="number" min="0" defaultValue={product.stock_qty} onBlur={event => updateBaseStock(product, event.target.value)}/><span>unités</span></>}</div><button className={`seller-product-status ${product.is_active ? 'active' : ''}`} onClick={() => toggleProduct(product)}><i/>{product.is_active ? 'Publié' : 'Masqué'}</button><div className="seller-product-actions"><Link to={`/product/${product.id}`} title="Voir"><Eye size={17}/></Link><button title="Modifier" onClick={() => setEditorProductId(product.id)}><Edit3 size={17}/></button></div></article>)}{!filteredProducts.length && <div className="seller-empty"><Package size={27}/><strong>Aucun produit</strong><span>Ajoute ton premier produit à la boutique.</span></div>}</div>
          </>}
        </section>}

        {!workspaceLoading && tab === 'orders' && <section className="seller-panel seller-orders-panel"><div className="seller-panel-head"><div><h2>Commandes reçues</h2><p>Confirme, prépare et remets les commandes au livreur.</p></div><span className="seller-order-counter">{orders.length} commande{orders.length > 1 ? 's' : ''}</span></div><div className="seller-orders-list">{orders.map(order => { const parent = parentOrders[order.order_id]; const lines = orderItems.filter(item => item.seller_order_id === order.id); const shipping = parent?.shipping_snapshot || {}; const delivery = deliveryOption(order.delivery_method || parent?.delivery_method); const next = nextStatus(order.status); return <article className={`seller-order-card ${delivery.code === 'express' ? 'is-express' : ''}`} key={order.id}><div className="seller-order-card-head"><div><span>{order.seller_order_number}</span><h3>{formatDate(order.created_at)}</h3></div><b className={`seller-order-pill status-${order.status}`}>{statusLabel(order.status)}</b><strong>{money(order.subtotal, order.currency)}</strong></div><div className="seller-order-delivery"><Truck size={19}/><div><strong>{delivery.label}</strong><span>{cdf(order.delivery_fee_cdf ?? parent?.delivery_fee_cdf ?? delivery.feeCdf)} · {delivery.description}</span></div>{delivery.code === 'express' && <em>Prioritaire</em>}</div><div className="seller-order-customer"><div><small>Client</small><strong>{shipping.full_name || 'Client One Market'}</strong><span>{shipping.phone || 'Téléphone non disponible'}</span></div><div><small>Livraison</small><strong>{[shipping.address_line1, shipping.district, shipping.city].filter(Boolean).join(', ') || 'Adresse enregistrée'}</strong><span>Paiement à la livraison</span></div></div><div className="seller-order-lines">{lines.map(line => <div key={line.id}><SmartImage src={line.product_image_url} fallback="OM" fit="contain" width={120}/><span><strong>{line.product_name}</strong><small>Qté {line.quantity}{Object.keys(line.variant_snapshot || {}).length ? ` · ${Object.values(line.variant_snapshot).join(' · ')}` : ''}</small></span><b>{money(line.line_total, line.currency)}</b></div>)}</div>{parent?.customer_note && <div className="seller-customer-note"><strong>Note du client</strong><span>{parent.customer_note}</span></div>}{order.status === 'refused' && <div className="seller-refusal"><AlertCircle size={18}/><span>{order.refusal_reason}</span></div>}<div className="seller-order-actions">{next && <button className="button primary" onClick={() => advanceOrder(order)}>{nextStatusAction(order.status)}</button>}{['pending','confirmed'].includes(order.status) && <button className="button secondary danger-outline" onClick={() => refuseOrder(order)}>Refuser</button>}</div></article>})}{!orders.length && <div className="seller-empty"><ClipboardList size={28}/><strong>Aucune commande reçue</strong><span>Les nouvelles commandes apparaîtront ici.</span></div>}</div></section>}

        {!workspaceLoading && tab === 'store' && <section className="seller-panel seller-store-settings"><div className="seller-panel-head"><div><h2>Informations de la boutique</h2><p>Ces données sont visibles publiquement.</p></div><Link to={`/store/${selectedStore?.slug}`}><Eye size={17}/> Aperçu public</Link></div><div className="seller-store-preview"><SmartImage src={storeForm.banner_url} fallback="ONE MARKET" fit="cover" width={1200}/><div><SmartImage src={storeForm.logo_url} fallback={(storeForm.name || 'OM').slice(0,2).toUpperCase()} fit="contain" width={180}/><span><strong>{storeForm.name || 'Ma boutique'}</strong><small>{storeForm.city || 'RDC'}</small></span></div></div><form onSubmit={saveStore} className="seller-store-form settings-form seller-store-form--final"><label>Nom de la boutique<input required value={storeForm.name} onChange={event => setStoreForm({ ...storeForm, name: event.target.value })}/></label><label>Ville<input value={storeForm.city} onChange={event => setStoreForm({ ...storeForm, city: event.target.value })}/></label><label>Catégorie principale<select value={storeForm.primary_category_id} onChange={event => setStoreForm({ ...storeForm, primary_category_id: event.target.value })}><option value="">Non précisée</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Téléphone commercial<input value={storeForm.phone} onChange={event => setStoreForm({ ...storeForm, phone: event.target.value })}/></label><label className="wide">Description<textarea rows={4} value={storeForm.description} onChange={event => setStoreForm({ ...storeForm, description: event.target.value })}/></label><CloudinaryImageField className="wide" label="Logo de la boutique" value={storeForm.logo_url} folder={`one-market/stores/${selectedStore?.id || user.id}`} onChange={url => setStoreForm(current => ({ ...current, logo_url: url }))} fit="contain"/><CloudinaryImageField className="wide" label="Bannière de la boutique" value={storeForm.banner_url} folder={`one-market/stores/${selectedStore?.id || user.id}`} onChange={url => setStoreForm(current => ({ ...current, banner_url: url }))}/><label>Site web<input value={storeForm.website_url} onChange={event => setStoreForm({ ...storeForm, website_url: event.target.value })} placeholder="monsite.com"/></label><label>Instagram<input value={storeForm.instagram_url} onChange={event => setStoreForm({ ...storeForm, instagram_url: event.target.value })}/></label><label>TikTok<input value={storeForm.tiktok_url} onChange={event => setStoreForm({ ...storeForm, tiktok_url: event.target.value })}/></label><label>Facebook<input value={storeForm.facebook_url} onChange={event => setStoreForm({ ...storeForm, facebook_url: event.target.value })}/></label><label>LinkedIn<input value={storeForm.linkedin_url} onChange={event => setStoreForm({ ...storeForm, linkedin_url: event.target.value })}/></label><label>WhatsApp Business<input value={storeForm.whatsapp_business} onChange={event => setStoreForm({ ...storeForm, whatsapp_business: event.target.value })}/></label><div className="seller-form-actions wide"><button className="button primary" disabled={storeSaving}><Save size={17}/>{storeSaving ? 'Enregistrement…' : 'Enregistrer les modifications'}</button></div></form></section>}
      </section>
    </main>
  )
}
