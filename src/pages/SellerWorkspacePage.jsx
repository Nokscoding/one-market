import {
  BarChart3,
  Boxes,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Edit3,
  Eye,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Package,
  Plus,
  Save,
  Settings,
  ShoppingBag,
  Store,
  TrendingUp,
  Truck,
  WalletCards,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import CloudinaryImageField from '../components/CloudinaryImageField'
import Loader from '../components/Loader'
import SellerProductEditor from '../components/SellerProductEditor'
import SellerAdsPanel from '../components/SellerAdsPanel'
import SmartImage from '../components/SmartImage'
import { useAuth } from '../context/AuthContext'
import { money, paymentStatus, sellerOrderStatus } from '../lib/format'
import { normalizeOptionalUrl } from '../lib/seller'
import { supabase } from '../lib/supabase'
import { logTechnicalError, userError } from '../lib/userErrors'

const ADMIN_ROLES = new Set(['admin', 'global_admin'])
const ACTIVE_ORDER_STATUSES = new Set(['pending', 'confirmed', 'preparing', 'ready'])

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

function actionForOrder(status) {
  return {
    pending: { action: 'confirm', label: 'Confirmer la commande' },
    confirmed: { action: 'prepare', label: 'Commencer la préparation' },
    preparing: { action: 'ready', label: 'Marquer prête' },
  }[status] || null
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
  const [orderItems, setOrderItems] = useState({})
  const [parentOrders, setParentOrders] = useState({})
  const [conversations, setConversations] = useState([])
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [storeSaving, setStoreSaving] = useState(false)
  const [actionSaving, setActionSaving] = useState('')
  const [feedback, setFeedback] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [editorProductId, setEditorProductId] = useState('')
  const [refusal, setRefusal] = useState({ order: null, reason: '' })

  useEffect(() => {
    if (!user?.id || profileLoading) return undefined
    let active = true
    setLoading(true)
    setFeedback('')

    ;(async () => {
      const categoryResult = await supabase.from('categories').select('id,name').eq('is_active', true).order('sort_order')
      if (categoryResult.error) throw categoryResult.error

      let storeQuery = supabase.from('stores').select('id,owner_id,name,slug,description,logo_url,banner_url,country_code,city,currency,status,primary_category_id,phone,website_url,instagram_url,tiktok_url,facebook_url,linkedin_url,whatsapp_business,is_verified,is_partner,created_at').order('created_at', { ascending: true })
      if (!isAdmin) storeQuery = storeQuery.eq('owner_id', user.id)
      const storeResult = await storeQuery
      if (storeResult.error) throw storeResult.error
      if (!active) return

      setCategories(categoryResult.data || [])
      const list = storeResult.data || []
      setStores(list)
      setSelectedStoreId(current => current || list[0]?.id || '')
    })().catch(loadError => {
      if (!active) return
      logTechnicalError('seller-workspace-initial', loadError)
      setFeedback(userError(loadError, 'seller'))
    }).finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [user?.id, profileLoading, isAdmin])

  const selectedStore = useMemo(() => stores.find(store => store.id === selectedStoreId) || null, [stores, selectedStoreId])

  useEffect(() => { setStoreForm(storeToForm(selectedStore)) }, [selectedStore])

  async function loadWorkspace(storeId = selectedStoreId) {
    if (!storeId) return
    setWorkspaceLoading(true)
    setFeedback('')
    try {
      const [productResult, orderResult, conversationResult, payoutResult] = await Promise.all([
        supabase.from('products').select('id,store_id,category_id,name,slug,description,price,old_price,currency,stock_qty,has_variants,is_active,is_demo,created_at,updated_at').eq('store_id', storeId).order('created_at', { ascending: false }),
        supabase.from('seller_orders').select('id,order_id,store_id,seller_order_number,status,subtotal,currency,refusal_reason,created_at,updated_at,delivery_method,delivery_fee_cdf,delivery_currency,logistics_status,commission_percent,commission_amount,seller_net_amount,settlement_status').eq('store_id', storeId).order('created_at', { ascending: false }).limit(150),
        supabase.from('conversations').select('id,seller_order_id,store_id,customer_id,created_at,updated_at').eq('store_id', storeId).order('updated_at', { ascending: false }).limit(100),
        supabase.from('seller_payouts').select('id,payout_number,store_id,period_start,period_end,gross_amount,commission_amount,net_amount,currency,payment_method,payment_reference,status,scheduled_at,paid_at,created_at').eq('store_id', storeId).order('created_at', { ascending: false }).limit(100),
      ])
      if (productResult.error) throw productResult.error
      if (orderResult.error) throw orderResult.error
      if (conversationResult.error) throw conversationResult.error
      if (payoutResult.error) throw payoutResult.error

      const productList = productResult.data || []
      const orderList = orderResult.data || []
      setProducts(productList)
      setOrders(orderList)
      setConversations(conversationResult.data || [])
      setPayouts(payoutResult.data || [])

      const productIds = productList.map(item => item.id)
      const sellerOrderIds = orderList.map(item => item.id)
      const parentIds = [...new Set(orderList.map(item => item.order_id))]

      const [imagesResult, variantsResult, itemsResult, parentsResult] = await Promise.all([
        productIds.length ? supabase.from('product_images').select('id,product_id,secure_url,alt_text,sort_order,created_at').in('product_id', productIds).order('sort_order') : Promise.resolve({ data: [], error: null }),
        productIds.length ? supabase.from('product_variants').select('id,product_id,attributes,price,stock_qty,is_active,created_at').in('product_id', productIds).order('created_at') : Promise.resolve({ data: [], error: null }),
        sellerOrderIds.length ? supabase.from('order_items').select('id,order_id,seller_order_id,product_name,product_image_url,variant_snapshot,unit_price,quantity,line_total,currency').in('seller_order_id', sellerOrderIds).order('created_at') : Promise.resolve({ data: [], error: null }),
        parentIds.length ? supabase.from('orders').select('id,order_number,shipping_snapshot,customer_note,payment_method,payment_status,delivery_method,delivery_fee_cdf,delivery_currency,logistics_status,status,created_at').in('id', parentIds) : Promise.resolve({ data: [], error: null }),
      ])
      if (imagesResult.error) throw imagesResult.error
      if (variantsResult.error) throw variantsResult.error
      if (itemsResult.error) throw itemsResult.error
      if (parentsResult.error) throw parentsResult.error

      const imageMap = {}
      ;(imagesResult.data || []).forEach(image => { (imageMap[image.product_id] ||= []).push(image) })
      const variantMap = {}
      ;(variantsResult.data || []).forEach(variant => { (variantMap[variant.product_id] ||= []).push(variant) })
      const itemMap = {}
      ;(itemsResult.data || []).forEach(item => { (itemMap[item.seller_order_id] ||= []).push(item) })
      setProductImages(imageMap)
      setProductVariants(variantMap)
      setOrderItems(itemMap)
      setParentOrders(Object.fromEntries((parentsResult.data || []).map(order => [order.id, order])))
    } catch (loadError) {
      logTechnicalError('seller-workspace-load', loadError)
      setFeedback(userError(loadError, 'seller'))
    } finally {
      setWorkspaceLoading(false)
    }
  }

  useEffect(() => { if (selectedStoreId) loadWorkspace(selectedStoreId) }, [selectedStoreId])

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
    if (!name) return setFeedback('Donnez un nom à votre boutique.')
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
      const result = await supabase.from('stores').insert(payload).select('id,owner_id,name,slug,description,logo_url,banner_url,country_code,city,currency,status,primary_category_id,phone,website_url,instagram_url,tiktok_url,facebook_url,linkedin_url,whatsapp_business,is_verified,is_partner,created_at,updated_at').single()
      if (result.error) throw result.error
      setStores(current => [...current, result.data])
      setSelectedStoreId(result.data.id)
      setFeedback('Votre boutique a été créée. Vous pouvez maintenant ajouter vos produits.')
    } catch (createError) {
      logTechnicalError('seller-store-create', createError)
      setFeedback(userError(createError, 'store'))
    } finally { setStoreSaving(false) }
  }

  async function saveStore(event) {
    event.preventDefault()
    if (!selectedStore || storeSaving) return
    if (!storeForm.name.trim()) return setFeedback('Le nom de la boutique est obligatoire.')
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
      const result = await supabase.from('stores').update(payload).eq('id', selectedStore.id).select('id,owner_id,name,slug,description,logo_url,banner_url,country_code,city,currency,status,primary_category_id,phone,website_url,instagram_url,tiktok_url,facebook_url,linkedin_url,whatsapp_business,is_verified,is_partner,created_at,updated_at').single()
      if (result.error) throw result.error
      setStores(current => current.map(store => store.id === result.data.id ? result.data : store))
      setFeedback('Les informations de votre boutique ont été enregistrées.')
    } catch (saveError) {
      logTechnicalError('seller-store-save', saveError)
      setFeedback(userError(saveError, 'store'))
    } finally { setStoreSaving(false) }
  }

  async function toggleProduct(product) {
    setFeedback('')
    try {
      const result = await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id).select('id,store_id,category_id,name,slug,description,price,old_price,currency,stock_qty,has_variants,is_active,is_demo,created_at,updated_at,rating_avg,rating_count').single()
      if (result.error) throw result.error
      setProducts(current => current.map(item => item.id === product.id ? result.data : item))
      setFeedback(result.data.is_active ? 'Le produit est maintenant visible dans la boutique.' : 'Le produit a été masqué de la boutique.')
    } catch (toggleError) {
      logTechnicalError('seller-product-toggle', toggleError)
      setFeedback(userError(toggleError, 'product'))
    }
  }

  async function updateBaseStock(product, value) {
    if (product.has_variants) return
    const stock = Math.max(0, Math.trunc(Number(value) || 0))
    try {
      const result = await supabase.from('products').update({ stock_qty: stock }).eq('id', product.id).select('id,store_id,category_id,name,slug,description,price,old_price,currency,stock_qty,has_variants,is_active,is_demo,created_at,updated_at,rating_avg,rating_count').single()
      if (result.error) throw result.error
      setProducts(current => current.map(item => item.id === product.id ? result.data : item))
    } catch (stockError) {
      logTechnicalError('seller-stock', stockError)
      setFeedback(userError(stockError, 'product'))
    }
  }

  async function runOrderAction(order, action, reason = null) {
    if (!order?.id || actionSaving) return
    setActionSaving(order.id)
    setFeedback('')
    try {
      const result = await supabase.rpc('seller_order_action', { p_seller_order_id: order.id, p_action: action, p_reason: reason })
      if (result.error) throw result.error
      setOrders(current => current.map(item => item.id === order.id ? result.data : item))
      if (action === 'ready') setFeedback('Commande prête. One Market peut maintenant organiser sa prise en charge par le livreur.')
      if (action === 'refuse') setFeedback('La commande a été refusée. Le client sera informé.')
    } catch (actionError) {
      logTechnicalError('seller-order-action', actionError)
      setFeedback(userError(actionError, 'seller'))
    } finally { setActionSaving('') }
  }

  async function confirmRefusal(event) {
    event.preventDefault()
    if (!refusal.order) return
    const reason = refusal.reason.trim()
    if (!reason) return setFeedback('Indiquez la raison du refus.')
    const order = refusal.order
    setRefusal({ order: null, reason: '' })
    await runOrderAction(order, 'refuse', reason)
  }

  const stats = useMemo(() => {
    const activeProducts = products.filter(product => product.is_active).length
    const lowStock = products.filter(product => product.is_active && Number(product.stock_qty) <= 5).length
    const pendingOrders = orders.filter(order => ACTIVE_ORDER_STATUSES.has(order.status)).length
    const delivered = orders.filter(order => order.status === 'delivered')
    const deliveredRevenue = delivered.reduce((sum, order) => sum + Number(order.subtotal || 0), 0)
    const deliveredCommission = delivered.reduce((sum, order) => sum + Number(order.commission_amount || 0), 0)
    const sellerEarnings = delivered.reduce((sum, order) => sum + Number(order.seller_net_amount || 0), 0)
    const paid = payouts.filter(payout => payout.status === 'paid').reduce((sum, payout) => sum + Number(payout.net_amount || 0), 0)
    const due = Math.max(0, sellerEarnings - paid)
    return { activeProducts, lowStock, pendingOrders, deliveredRevenue, deliveredCommission, sellerEarnings, paid, due, deliveredOrders: delivered.length }
  }, [products, orders, payouts])

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase()
    if (!query) return products
    return products.filter(product => product.name.toLowerCase().includes(query) || product.slug?.toLowerCase().includes(query))
  }, [products, productSearch])

  const editorProduct = editorProductId && editorProductId !== 'new' ? products.find(product => product.id === editorProductId) || null : null
  const orderById = useMemo(() => Object.fromEntries(orders.map(order => [order.id, order])), [orders])

  if (profileLoading || loading) return <Loader fullscreen />

  if (!stores.length && !isAdmin) {
    return (
      <main className="section-shell seller-setup-page">
        <section className="seller-setup-card seller-setup-card--final">
          <div className="seller-setup-heading"><Store size={34}/><div><span className="eyebrow">Première configuration</span><h1>Créez votre boutique</h1><p>Votre dossier vendeur a été approuvé. Configurez maintenant les informations visibles par les clients.</p></div></div>
          {feedback && <div className="seller-feedback" role="alert">{feedback}</div>}
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

  const tabTitle = { overview: 'Tableau de bord', products: 'Produits', orders: 'Commandes', finances: 'Finances', ads: 'One Market Ads', messages: 'Messages', store: 'Boutique et paramètres' }[tab] || 'Tableau de bord'

  return (
    <main className="seller-workspace seller-workspace--final">
      <aside className="seller-sidebar">
        <div className="seller-sidebar-brand"><Store size={24}/><div><span>One Market</span><strong>Espace vendeur</strong></div></div>
        {isAdmin && stores.length > 1 && <label className="seller-store-selector">Boutique<select value={selectedStoreId} onChange={event => setSelectedStoreId(event.target.value)}>{stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>}
        <div className="seller-current-store"><SmartImage src={selectedStore?.logo_url} fallback={(selectedStore?.name || 'OM').slice(0, 2).toUpperCase()} fit="contain" width={120}/><div><strong>{selectedStore?.name}</strong><span>{selectedStore?.city || 'RDC'}</span></div></div>
        <nav>
          <button className={tab === 'overview' ? 'active' : ''} onClick={() => changeTab('overview')}><LayoutDashboard size={19}/><span>Tableau de bord</span></button>
          <button className={tab === 'products' ? 'active' : ''} onClick={() => changeTab('products')}><Boxes size={19}/><span>Produits</span><em>{products.length}</em></button>
          <button className={tab === 'orders' ? 'active' : ''} onClick={() => changeTab('orders')}><ClipboardList size={19}/><span>Commandes</span>{stats.pendingOrders > 0 && <em className="alert">{stats.pendingOrders}</em>}</button>
          <button className={tab === 'finances' ? 'active' : ''} onClick={() => changeTab('finances')}><WalletCards size={19}/><span>Finances</span></button>
          <button className={tab === 'ads' ? 'active' : ''} onClick={() => changeTab('ads')}><Megaphone size={19}/><span>One Market Ads</span></button>
          <button className={tab === 'messages' ? 'active' : ''} onClick={() => changeTab('messages')}><MessageCircle size={19}/><span>Messages</span><em>{conversations.length}</em></button>
          <button className={tab === 'store' ? 'active' : ''} onClick={() => changeTab('store')}><Settings size={19}/><span>Boutique</span></button>
        </nav>
        <Link className="seller-back-market" to={`/store/${selectedStore?.slug || ''}`}><Eye size={17}/> Voir ma boutique</Link>
      </aside>

      <section className="seller-main">
        <header className="seller-topbar"><div><span>Espace vendeur</span><h1>{tabTitle}</h1></div><div className="seller-status"><i className={selectedStore?.status === 'active' ? 'online' : ''}/><span>{selectedStore?.status === 'active' ? 'Boutique active' : 'Boutique non active'}</span></div></header>

        {feedback && <div className="seller-feedback workspace-feedback" role="status">{feedback}</div>}
        {workspaceLoading && <div className="seller-workspace-loader"><Loader/></div>}

        {!workspaceLoading && tab === 'overview' && <>
          <div className="seller-stat-grid">
            <article><span><Package size={21}/></span><div><small>Produits actifs</small><strong>{stats.activeProducts}</strong></div></article>
            <article><span><ClipboardList size={21}/></span><div><small>Commandes à traiter</small><strong>{stats.pendingOrders}</strong></div></article>
            <article className={stats.lowStock ? 'warning' : ''}><span><Boxes size={21}/></span><div><small>Stock faible</small><strong>{stats.lowStock}</strong></div></article>
            <article><span><TrendingUp size={21}/></span><div><small>Ventes livrées</small><strong>{money(stats.deliveredRevenue, 'USD')}</strong><em>{stats.deliveredOrders} commande{stats.deliveredOrders > 1 ? 's' : ''}</em></div></article>
          </div>

          <div className="seller-dashboard-grid">
            <section className="seller-panel"><div className="seller-panel-head"><div><h2>Commandes récentes</h2><p>Les nouvelles commandes apparaissent dès leur création.</p></div><button onClick={() => changeTab('orders')}>Voir tout</button></div><div className="seller-order-mini-list">{orders.slice(0, 5).map(order => <button key={order.id} onClick={() => changeTab('orders')}><span className="seller-order-icon"><ShoppingBag size={18}/></span><div><strong>{order.seller_order_number}</strong><small>{formatDate(order.created_at)}</small></div><b className={`seller-order-pill status-${order.status}`}>{sellerOrderStatus[order.status] || 'En cours'}</b><span>{money(order.subtotal, order.currency)}</span><ChevronRight size={17}/></button>)}{!orders.length && <div className="seller-empty"><ClipboardList size={26}/><strong>Aucune commande</strong><span>Les commandes clients apparaîtront ici.</span></div>}</div></section>
            <section className="seller-panel"><div className="seller-panel-head"><div><h2>Stock à surveiller</h2><p>Produits actifs à 5 unités ou moins.</p></div><button onClick={() => changeTab('products')}>Gérer</button></div><div className="seller-stock-watch">{products.filter(product => product.is_active && Number(product.stock_qty) <= 5).slice(0, 6).map(product => <div key={product.id}><SmartImage src={productImages[product.id]?.[0]?.secure_url} fallback="OM" fit="cover" width={120}/><span><strong>{product.name}</strong><small>{product.stock_qty} en stock</small></span><button onClick={() => { changeTab('products'); setEditorProductId(product.id) }}>Modifier</button></div>)}{!products.some(product => product.is_active && Number(product.stock_qty) <= 5) && <div className="seller-empty compact"><CheckCircle2 size={24}/><strong>Stock sous contrôle</strong><span>Aucun stock faible.</span></div>}</div></section>
          </div>
        </>}

        {!workspaceLoading && tab === 'products' && <section className="seller-panel seller-products-panel">
          {editorProductId ? <SellerProductEditor store={selectedStore} categories={categories} product={editorProduct} images={editorProduct ? productImages[editorProduct.id] || [] : []} variants={editorProduct ? productVariants[editorProduct.id] || [] : []} onCancel={() => setEditorProductId('')} onSaved={async () => { setEditorProductId(''); setFeedback('Produit enregistré.'); await loadWorkspace() }}/>
          : <>
            <div className="seller-panel-head seller-products-head"><div><h2>Catalogue de la boutique</h2><p>Produits, images, variantes et stock.</p></div><button className="button primary" onClick={() => setEditorProductId('new')}><Plus size={17}/> Nouveau produit</button></div>
            <div className="seller-product-toolbar"><input value={productSearch} onChange={event => setProductSearch(event.target.value)} placeholder="Rechercher dans mes produits…"/><span>{filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''}</span></div>
            <div className="seller-product-table"><div className="seller-product-table-head"><span>Produit</span><span>Prix</span><span>Stock</span><span>Statut</span><span>Actions</span></div>{filteredProducts.map(product => <article key={product.id} className={!product.is_active ? 'inactive' : ''}><div className="seller-product-name"><SmartImage src={productImages[product.id]?.[0]?.secure_url} fallback="OM" fit="cover" width={160}/><span><strong>{product.name}</strong><small>{product.has_variants ? `${(productVariants[product.id] || []).filter(v => v.is_active).length} variante(s)` : 'Stock simple'}</small></span></div><strong>{money(product.price, product.currency)}</strong><div className={`seller-stock-input ${Number(product.stock_qty) <= 5 ? 'low' : ''}`}>{product.has_variants ? <><strong>{product.stock_qty}</strong><span>via variantes</span></> : <><input type="number" min="0" defaultValue={product.stock_qty} onBlur={event => updateBaseStock(product, event.target.value)}/><span>unités</span></>}</div><button className={`seller-product-status ${product.is_active ? 'active' : ''}`} onClick={() => toggleProduct(product)}><i/>{product.is_active ? 'Publié' : 'Masqué'}</button><div className="seller-product-actions"><button type="button" onClick={() => setEditorProductId(product.id)}><Edit3 size={16}/> Modifier</button></div></article>)}{!filteredProducts.length && <div className="seller-empty"><Boxes size={26}/><strong>Aucun produit</strong><span>Ajoutez votre premier produit pour commencer à vendre.</span></div>}</div>
          </>}
        </section>}

        {!workspaceLoading && tab === 'orders' && <section className="seller-panel seller-orders-panel">
          <div className="seller-panel-head"><div><h2>Commandes de la boutique</h2><p>Préparez uniquement les articles. La récupération et la livraison sont gratuites pour votre boutique et entièrement gérées par One Market.</p></div></div>
          <div className="seller-orders-list">{orders.map(order => {
            const parent = parentOrders[order.order_id] || {}
            const lines = orderItems[order.id] || []
            const action = actionForOrder(order.status)
            const paymentBlocked = parent.payment_method === 'mobile_money' && parent.payment_status !== 'paid'
            return <article className="seller-order-detail-card" key={order.id}>
              <header><div><span>{order.seller_order_number}</span><strong>{sellerOrderStatus[order.status] || 'En cours'}</strong><small>{formatDate(order.created_at)}</small></div><div><strong>{money(order.subtotal, order.currency)}</strong><small>Net vendeur : {money(order.seller_net_amount, order.currency)}</small></div></header>
              <div className="seller-order-customer"><span><strong>{parent.shipping_snapshot?.full_name || 'Client One Market'}</strong><small>{parent.shipping_snapshot?.phone || 'Téléphone enregistré dans la commande'}</small><small>{[parent.shipping_snapshot?.address_line1, parent.shipping_snapshot?.district, parent.shipping_snapshot?.city].filter(Boolean).join(', ')}</small></span><span><strong>{parent.payment_method === 'mobile_money' ? 'Mobile Money' : 'Paiement à la livraison'}</strong><small>{paymentStatus[parent.payment_status] || 'Paiement en attente'}</small></span></div>
              <div className="seller-order-lines">{lines.map(line => <div key={line.id}><SmartImage src={line.product_image_url} alt={line.product_name} fit="contain" width={90}/><span><strong>{line.product_name}</strong>{Object.keys(line.variant_snapshot || {}).length > 0 && <small>{Object.values(line.variant_snapshot).join(' · ')}</small>}<small>{line.quantity} × {money(line.unit_price, line.currency)}</small></span><strong>{money(line.line_total, line.currency)}</strong></div>)}</div>
              <div className="seller-order-financial-row"><span>Vente brute <strong>{money(order.subtotal, order.currency)}</strong></span><span>Commission One Market ({Number(order.commission_percent || 0).toFixed(2)} %) <strong>{money(order.commission_amount, order.currency)}</strong></span><span>Votre montant <strong>{money(order.seller_net_amount, order.currency)}</strong></span></div>
              {paymentBlocked && <div className="seller-order-handoff"><WalletCards size={18}/><span><strong>Paiement Mobile Money en attente</strong><small>One Market doit confirmer le paiement avant le début de la préparation. Vous pouvez toujours refuser la commande si nécessaire.</small></span></div>}
              {order.status === 'ready' && <div className="seller-order-handoff"><Truck size={18}/><span><strong>Commande prête</strong><small>Le vendeur n’a plus à modifier la livraison. One Market prend en charge les étapes de récupération et de livraison.</small></span></div>}
              {order.status === 'refused' && <div className="refusal-box"><strong>Commande refusée</strong><p>{order.refusal_reason}</p></div>}
              <footer>{action && <button className="button primary" disabled={actionSaving === order.id || paymentBlocked} onClick={() => runOrderAction(order, action.action)}>{paymentBlocked ? 'En attente du paiement' : actionSaving === order.id ? 'Mise à jour…' : action.label}</button>}{['pending','confirmed'].includes(order.status) && <button className="button secondary danger" disabled={actionSaving === order.id} onClick={() => setRefusal({ order, reason: '' })}>Refuser</button>}</footer>
            </article>
          })}{!orders.length && <div className="seller-empty"><ClipboardList size={28}/><strong>Aucune commande</strong><span>Lorsqu’un client commande un de vos produits, la commande apparaît ici immédiatement.</span></div>}</div>
        </section>}

        {!workspaceLoading && tab === 'finances' && <section className="seller-finance-space">
          <div className="seller-finance-metrics">
            <article><span>Ventes livrées</span><strong>{money(stats.deliveredRevenue, 'USD')}</strong><small>{stats.deliveredOrders} commande{stats.deliveredOrders > 1 ? 's' : ''}</small></article>
            <article><span>Commission One Market</span><strong>{money(stats.deliveredCommission, 'USD')}</strong><small>Calculée selon le taux appliqué à chaque commande</small></article>
            <article><span>Vos revenus nets</span><strong>{money(stats.sellerEarnings, 'USD')}</strong><small>Après commission</small></article>
            <article><span>À recevoir</span><strong>{money(stats.due, 'USD')}</strong><small>Selon les versements enregistrés</small></article>
          </div>
          <section className="seller-panel"><div className="seller-panel-head"><div><h2>Historique des versements</h2><p>Ces informations sont en lecture seule. Les paiements sont validés par One Market.</p></div></div><div className="seller-payout-table"><div className="seller-payout-head"><span>Référence</span><span>Période</span><span>Montant net</span><span>Statut</span></div>{payouts.map(payout => <div key={payout.id}><span><strong>{payout.payout_number}</strong><small>{payout.payment_method || 'Mode à confirmer'}</small></span><span>{formatDate(payout.period_start)} – {formatDate(payout.period_end)}</span><strong>{money(payout.net_amount, payout.currency)}</strong><span className={`status-pill ${payout.status}`}>{payout.status === 'paid' ? 'Payé' : payout.status === 'approved' ? 'Approuvé' : payout.status === 'failed' ? 'Échec' : payout.status === 'cancelled' ? 'Annulé' : 'En attente'}</span></div>)}{!payouts.length && <div className="seller-empty"><WalletCards size={26}/><strong>Aucun versement enregistré</strong><span>Les versements apparaîtront ici lorsqu’ils seront préparés par One Market.</span></div>}</div></section>
        </section>}

        {!workspaceLoading && tab === 'ads' && <SellerAdsPanel store={selectedStore} products={products} categories={categories}/>}

        {!workspaceLoading && tab === 'messages' && <section className="seller-panel"><div className="seller-panel-head"><div><h2>Messages clients</h2><p>Conversations liées aux commandes de votre boutique.</p></div></div><div className="seller-conversation-list">{conversations.map(conversation => { const sellerOrder = orderById[conversation.seller_order_id]; const parent = sellerOrder ? parentOrders[sellerOrder.order_id] : null; return <Link to={`/chat/${conversation.id}`} key={conversation.id}><MessageCircle size={20}/><span><strong>{parent?.shipping_snapshot?.full_name || 'Client One Market'}</strong><small>{sellerOrder?.seller_order_number || 'Conversation boutique'} · {formatDate(conversation.updated_at)}</small></span><ChevronRight size={18}/></Link> })}{!conversations.length && <div className="seller-empty"><MessageCircle size={27}/><strong>Aucune conversation</strong><span>Les discussions liées aux commandes apparaîtront ici.</span></div>}</div></section>}

        {!workspaceLoading && tab === 'store' && <section className="seller-panel seller-store-settings"><div className="seller-panel-head"><div><h2>Boutique et paramètres</h2><p>Informations publiques, identité visuelle et contacts.</p></div></div><form onSubmit={saveStore} className="seller-store-form seller-store-form--final"><label>Nom de la boutique<input required value={storeForm.name} onChange={event => setStoreForm({ ...storeForm, name: event.target.value })}/></label><label>Ville<input value={storeForm.city} onChange={event => setStoreForm({ ...storeForm, city: event.target.value })}/></label><label>Catégorie principale<select value={storeForm.primary_category_id} onChange={event => setStoreForm({ ...storeForm, primary_category_id: event.target.value })}><option value="">Non précisée</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Téléphone<input value={storeForm.phone} onChange={event => setStoreForm({ ...storeForm, phone: event.target.value })}/></label><label className="wide">Description<textarea rows={5} value={storeForm.description} onChange={event => setStoreForm({ ...storeForm, description: event.target.value })}/></label><CloudinaryImageField className="wide" label="Logo" value={storeForm.logo_url} folder={`one-market/stores/${selectedStoreId}`} onChange={url => setStoreForm(current => ({ ...current, logo_url: url }))} fit="contain"/><CloudinaryImageField className="wide" label="Bannière" value={storeForm.banner_url} folder={`one-market/stores/${selectedStoreId}`} onChange={url => setStoreForm(current => ({ ...current, banner_url: url }))}/><label>Site web<input value={storeForm.website_url} onChange={event => setStoreForm({ ...storeForm, website_url: event.target.value })} placeholder="https://…"/></label><label>WhatsApp Business<input value={storeForm.whatsapp_business} onChange={event => setStoreForm({ ...storeForm, whatsapp_business: event.target.value })}/></label><label>Instagram<input value={storeForm.instagram_url} onChange={event => setStoreForm({ ...storeForm, instagram_url: event.target.value })}/></label><label>TikTok<input value={storeForm.tiktok_url} onChange={event => setStoreForm({ ...storeForm, tiktok_url: event.target.value })}/></label><label>Facebook<input value={storeForm.facebook_url} onChange={event => setStoreForm({ ...storeForm, facebook_url: event.target.value })}/></label><label>LinkedIn<input value={storeForm.linkedin_url} onChange={event => setStoreForm({ ...storeForm, linkedin_url: event.target.value })}/></label><div className="seller-form-actions wide"><button className="button primary" disabled={storeSaving}><Save size={17}/>{storeSaving ? 'Enregistrement…' : 'Enregistrer'}</button></div></form></section>}
      </section>

      {refusal.order && <div className="seller-modal-backdrop" role="presentation" onMouseDown={() => setRefusal({ order: null, reason: '' })}><form className="seller-confirm-modal" onSubmit={confirmRefusal} onMouseDown={event => event.stopPropagation()}><header><div><span>Commande</span><h2>Refuser la commande</h2></div><button type="button" onClick={() => setRefusal({ order: null, reason: '' })} aria-label="Fermer"><X size={20}/></button></header><p>Expliquez brièvement la raison. Cette information peut être utilisée par One Market pour informer le client et traiter le problème.</p><label>Raison du refus<textarea required rows={4} value={refusal.reason} onChange={event => setRefusal(current => ({ ...current, reason: event.target.value }))} placeholder="Ex. Produit momentanément indisponible…"/></label><footer><button type="button" className="button secondary" onClick={() => setRefusal({ order: null, reason: '' })}>Annuler</button><button className="button primary danger">Confirmer le refus</button></footer></form></div>}
    </main>
  )
}