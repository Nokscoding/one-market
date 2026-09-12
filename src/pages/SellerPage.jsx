import {
  AlertCircle,
  BarChart3,
  Boxes,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Eye,
  ImagePlus,
  LayoutDashboard,
  Package,
  Plus,
  Save,
  Settings,
  Shop,
  ShoppingBag,
  Store,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Loader from '../components/Loader'
import SmartImage from '../components/SmartImage'
import { useAuth } from '../context/AuthContext'
import { money } from '../lib/format'
import { supabase } from '../lib/supabase'

const SELLER_ROLES = new Set(['seller', 'admin', 'global_admin'])
const ADMIN_ROLES = new Set(['admin', 'global_admin'])

const emptyApplication = { business_name: '', phone: '', city: 'Lubumbashi', description: '' }
const emptyStore = { name: '', city: 'Lubumbashi', description: '', logo_url: '', banner_url: '' }
const emptyProduct = {
  name: '', category_id: '', description: '', price: '', old_price: '', stock_qty: '1', image_url: '', is_active: true,
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function orderStatusLabel(status) {
  return {
    pending: 'À confirmer', confirmed: 'Confirmée', preparing: 'En préparation', ready: 'Prête',
    out_for_delivery: 'En livraison', delivered: 'Livrée', cancelled: 'Annulée', refused: 'Refusée', failed: 'Échouée',
  }[status] || status
}

function nextStatus(status) {
  return {
    pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'out_for_delivery', out_for_delivery: 'delivered',
  }[status] || null
}

function formatDate(value) {
  if (!value) return ''
  try { return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) }
  catch { return '' }
}

export default function SellerPage() {
  const { user, profile, profileLoading } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'overview'
  const isSeller = SELLER_ROLES.has(profile?.role)
  const isAdmin = ADMIN_ROLES.has(profile?.role)

  const [application, setApplication] = useState(null)
  const [applicationForm, setApplicationForm] = useState(emptyApplication)
  const [applicationMessage, setApplicationMessage] = useState('')
  const [applicationSaving, setApplicationSaving] = useState(false)

  const [stores, setStores] = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [storeForm, setStoreForm] = useState(emptyStore)
  const [storeSaving, setStoreSaving] = useState(false)
  const [storeMessage, setStoreMessage] = useState('')

  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [productImages, setProductImages] = useState({})
  const [orders, setOrders] = useState([])
  const [orderItems, setOrderItems] = useState([])
  const [parentOrders, setParentOrders] = useState({})
  const [loading, setLoading] = useState(true)
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [feedback, setFeedback] = useState('')

  const [showProductForm, setShowProductForm] = useState(false)
  const [productForm, setProductForm] = useState(emptyProduct)
  const [productSaving, setProductSaving] = useState(false)
  const [productSearch, setProductSearch] = useState('')

  useEffect(() => {
    if (!user?.id || profileLoading) return undefined
    let active = true
    setLoading(true)

    ;(async () => {
      const { data: categoryData } = await supabase.from('categories').select('id,name').eq('is_active', true).order('sort_order')
      if (active) setCategories(categoryData || [])

      if (!isSeller) {
        const { data } = await supabase.from('seller_applications').select('*').eq('user_id', user.id).maybeSingle()
        if (active) {
          setApplication(data || null)
          setApplicationForm(form => ({ ...form, phone: profile?.phone || form.phone }))
        }
        return
      }

      let query = supabase.from('stores').select('*').order('created_at', { ascending: true })
      if (!isAdmin) query = query.eq('owner_id', user.id)
      const { data: storeData, error } = await query
      if (error) throw error
      if (!active) return
      const list = storeData || []
      setStores(list)
      setSelectedStoreId(current => current || list[0]?.id || '')
    })()
      .catch(error => { if (active) setFeedback(error?.message || 'Impossible de charger l’espace vendeur.') })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [user?.id, profileLoading, profile?.phone, isSeller, isAdmin])

  const selectedStore = useMemo(() => stores.find(store => store.id === selectedStoreId) || null, [stores, selectedStoreId])

  useEffect(() => {
    if (!selectedStore) {
      setStoreForm(emptyStore)
      return
    }
    setStoreForm({
      name: selectedStore.name || '', city: selectedStore.city || 'Lubumbashi', description: selectedStore.description || '',
      logo_url: selectedStore.logo_url || '', banner_url: selectedStore.banner_url || '',
    })
  }, [selectedStore])

  useEffect(() => {
    if (!selectedStoreId || !isSeller) return undefined
    let active = true
    setWorkspaceLoading(true)
    setFeedback('')

    ;(async () => {
      const [{ data: productData, error: productError }, { data: orderData, error: orderError }] = await Promise.all([
        supabase.from('products').select('*').eq('store_id', selectedStoreId).order('created_at', { ascending: false }),
        supabase.from('seller_orders').select('*').eq('store_id', selectedStoreId).order('created_at', { ascending: false }).limit(100),
      ])
      if (productError) throw productError
      if (orderError) throw orderError
      if (!active) return

      const productList = productData || []
      const orderList = orderData || []
      setProducts(productList)
      setOrders(orderList)

      const productIds = productList.map(item => item.id)
      const orderIds = orderList.map(item => item.order_id)
      const sellerOrderIds = orderList.map(item => item.id)

      const [imagesResult, itemsResult, parentsResult] = await Promise.all([
        productIds.length ? supabase.from('product_images').select('*').in('product_id', productIds).order('sort_order') : Promise.resolve({ data: [] }),
        sellerOrderIds.length ? supabase.from('order_items').select('*').in('seller_order_id', sellerOrderIds).order('created_at') : Promise.resolve({ data: [] }),
        orderIds.length ? supabase.from('orders').select('id,order_number,shipping_snapshot,customer_note,payment_method,payment_status,created_at').in('id', orderIds) : Promise.resolve({ data: [] }),
      ])
      if (!active) return

      const imageMap = {}
      ;(imagesResult.data || []).forEach(image => {
        if (!imageMap[image.product_id] && image.secure_url) imageMap[image.product_id] = image.secure_url
      })
      setProductImages(imageMap)
      setOrderItems(itemsResult.data || [])
      setParentOrders(Object.fromEntries((parentsResult.data || []).map(order => [order.id, order])))
    })()
      .catch(error => { if (active) setFeedback(error?.message || 'Impossible de charger les données vendeur.') })
      .finally(() => { if (active) setWorkspaceLoading(false) })

    return () => { active = false }
  }, [selectedStoreId, isSeller])

  function changeTab(next) {
    const nextParams = new URLSearchParams(params)
    if (next === 'overview') nextParams.delete('tab')
    else nextParams.set('tab', next)
    setParams(nextParams)
  }

  async function submitApplication(event) {
    event.preventDefault()
    if (!user?.id || applicationSaving) return
    setApplicationSaving(true)
    setApplicationMessage('')
    const payload = {
      user_id: user.id,
      business_name: applicationForm.business_name.trim(),
      phone: applicationForm.phone.trim() || null,
      city: applicationForm.city.trim() || 'Lubumbashi',
      description: applicationForm.description.trim() || null,
    }
    if (!payload.business_name) {
      setApplicationMessage('Indique le nom de ta boutique ou activité.')
      setApplicationSaving(false)
      return
    }
    const { data, error } = await supabase.from('seller_applications').insert(payload).select('*').single()
    if (error) setApplicationMessage(error.message)
    else {
      setApplication(data)
      setApplicationMessage('Demande envoyée. Elle doit maintenant être approuvée par One Market.')
    }
    setApplicationSaving(false)
  }

  async function createStore(event) {
    event.preventDefault()
    if (!user?.id || storeSaving) return
    setStoreSaving(true)
    setStoreMessage('')
    const name = storeForm.name.trim()
    if (!name) {
      setStoreMessage('Donne un nom à ta boutique.')
      setStoreSaving(false)
      return
    }
    const payload = {
      owner_id: user.id,
      name,
      slug: `${slugify(name)}-${Date.now().toString(36)}`,
      description: storeForm.description.trim() || null,
      logo_url: storeForm.logo_url.trim() || null,
      banner_url: storeForm.banner_url.trim() || null,
      country_code: 'CD',
      city: storeForm.city.trim() || 'Lubumbashi',
      currency: 'USD',
      status: 'active',
      is_demo: false,
    }
    const { data, error } = await supabase.from('stores').insert(payload).select('*').single()
    if (error) setStoreMessage(error.message)
    else {
      setStores(current => [...current, data])
      setSelectedStoreId(data.id)
      setStoreMessage('Boutique créée.')
    }
    setStoreSaving(false)
  }

  async function saveStore(event) {
    event.preventDefault()
    if (!selectedStore || storeSaving) return
    setStoreSaving(true)
    setStoreMessage('')
    const payload = {
      name: storeForm.name.trim(),
      description: storeForm.description.trim() || null,
      city: storeForm.city.trim() || 'Lubumbashi',
      logo_url: storeForm.logo_url.trim() || null,
      banner_url: storeForm.banner_url.trim() || null,
    }
    const { data, error } = await supabase.from('stores').update(payload).eq('id', selectedStore.id).select('*').single()
    if (error) setStoreMessage(error.message)
    else {
      setStores(current => current.map(store => store.id === data.id ? data : store))
      setStoreMessage('Boutique mise à jour.')
    }
    setStoreSaving(false)
  }

  async function createProduct(event) {
    event.preventDefault()
    if (!selectedStore || productSaving) return
    setProductSaving(true)
    setFeedback('')
    const name = productForm.name.trim()
    const price = Number(productForm.price)
    const stock = Number(productForm.stock_qty)
    if (!name || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
      setFeedback('Vérifie le nom, le prix et le stock du produit.')
      setProductSaving(false)
      return
    }

    const payload = {
      store_id: selectedStore.id,
      category_id: productForm.category_id || null,
      name,
      slug: `${slugify(name)}-${Date.now().toString(36)}`,
      description: productForm.description.trim() || null,
      price,
      old_price: productForm.old_price ? Number(productForm.old_price) : null,
      currency: 'USD',
      stock_qty: stock,
      has_variants: false,
      is_active: Boolean(productForm.is_active),
      is_demo: false,
    }

    const { data, error } = await supabase.from('products').insert(payload).select('*').single()
    if (error) {
      setFeedback(error.message)
      setProductSaving(false)
      return
    }

    let imageUrl = ''
    if (productForm.image_url.trim()) {
      const { data: imageData, error: imageError } = await supabase.from('product_images').insert({
        product_id: data.id,
        secure_url: productForm.image_url.trim(),
        alt_text: name,
        sort_order: 0,
      }).select('*').single()
      if (!imageError) imageUrl = imageData?.secure_url || ''
    }

    setProducts(current => [data, ...current])
    if (imageUrl) setProductImages(current => ({ ...current, [data.id]: imageUrl }))
    setProductForm(emptyProduct)
    setShowProductForm(false)
    setFeedback('Produit ajouté à la boutique.')
    setProductSaving(false)
  }

  async function updateProduct(productId, patch) {
    setFeedback('')
    const { data, error } = await supabase.from('products').update(patch).eq('id', productId).select('*').single()
    if (error) return setFeedback(error.message)
    setProducts(current => current.map(product => product.id === productId ? data : product))
  }

  async function removeProduct(product) {
    if (!window.confirm(`Retirer « ${product.name} » du catalogue ?`)) return
    await updateProduct(product.id, { is_active: false })
  }

  async function advanceOrder(order) {
    const next = nextStatus(order.status)
    if (!next) return
    const { data, error } = await supabase.from('seller_orders').update({ status: next, updated_at: new Date().toISOString() }).eq('id', order.id).select('*').single()
    if (error) return setFeedback(error.message)
    setOrders(current => current.map(item => item.id === data.id ? data : item))
  }

  async function refuseOrder(order) {
    const reason = window.prompt('Pourquoi refuses-tu cette commande ?')
    if (!reason?.trim()) return
    const { data, error } = await supabase.from('seller_orders').update({ status: 'refused', refusal_reason: reason.trim(), updated_at: new Date().toISOString() }).eq('id', order.id).select('*').single()
    if (error) return setFeedback(error.message)
    setOrders(current => current.map(item => item.id === data.id ? data : item))
  }

  const stats = useMemo(() => {
    const activeProducts = products.filter(product => product.is_active).length
    const lowStock = products.filter(product => product.is_active && Number(product.stock_qty) <= 5).length
    const pendingOrders = orders.filter(order => ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status)).length
    const deliveredRevenue = orders.filter(order => order.status === 'delivered').reduce((sum, order) => sum + Number(order.total || order.subtotal || 0), 0)
    return { activeProducts, lowStock, pendingOrders, deliveredRevenue }
  }, [products, orders])

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase()
    if (!query) return products
    return products.filter(product => product.name.toLowerCase().includes(query))
  }, [products, productSearch])

  if (profileLoading || loading) return <Loader fullscreen />

  if (!user) return null

  if (!isSeller) {
    return (
      <main className="section-shell seller-join-page">
        <section className="seller-join-hero">
          <div>
            <span className="eyebrow">Vendre sur One Market</span>
            <h1>Ouvre ta boutique sur One Market.</h1>
            <p>Publie tes produits, gère ton stock et reçois les commandes depuis un seul espace vendeur.</p>
          </div>
          <div className="seller-join-points">
            <div><ShoppingBag size={21}/><span><strong>Catalogue vendeur</strong><small>Produits, prix et stock.</small></span></div>
            <div><ClipboardList size={21}/><span><strong>Commandes</strong><small>Suivi de chaque commande reçue.</small></span></div>
            <div><BarChart3 size={21}/><span><strong>Statistiques</strong><small>Activité et ventes de la boutique.</small></span></div>
          </div>
        </section>

        <section className="seller-join-card">
          {application ? (
            <div className={`seller-application-status status-${application.status}`}>
              {application.status === 'pending' ? <AlertCircle size={26}/> : <CheckCircle2 size={26}/>} 
              <div>
                <span>Demande vendeur</span>
                <h2>{application.business_name}</h2>
                <p>{application.status === 'pending' ? 'Ta demande est en attente de validation par One Market.' : application.status === 'approved' ? 'Ta demande a été approuvée. Ton accès vendeur sera activé.' : 'Ta demande n’a pas été approuvée pour le moment.'}</p>
                {application.admin_note && <small>{application.admin_note}</small>}
              </div>
            </div>
          ) : (
            <form onSubmit={submitApplication} className="seller-join-form">
              <div><span className="eyebrow">Demande vendeur</span><h2>Parle-nous de ta boutique</h2></div>
              <label>Nom de la boutique ou activité<input required value={applicationForm.business_name} onChange={event => setApplicationForm({ ...applicationForm, business_name: event.target.value })} placeholder="Ex. Noks Fashion"/></label>
              <div className="seller-form-row"><label>Téléphone<input value={applicationForm.phone} onChange={event => setApplicationForm({ ...applicationForm, phone: event.target.value })} placeholder="+243…"/></label><label>Ville<input value={applicationForm.city} onChange={event => setApplicationForm({ ...applicationForm, city: event.target.value })}/></label></div>
              <label>Que veux-tu vendre ?<textarea rows={4} value={applicationForm.description} onChange={event => setApplicationForm({ ...applicationForm, description: event.target.value })} placeholder="Décris rapidement les produits que tu veux proposer."/></label>
              {applicationMessage && <div className="seller-feedback">{applicationMessage}</div>}
              <button className="button primary" disabled={applicationSaving}>{applicationSaving ? 'Envoi…' : 'Envoyer ma demande'}</button>
            </form>
          )}
        </section>
      </main>
    )
  }

  if (!stores.length && !isAdmin) {
    return (
      <main className="section-shell seller-setup-page">
        <section className="seller-setup-card">
          <Store size={34}/><span className="eyebrow">Première configuration</span><h1>Crée ta boutique</h1><p>Ton compte vendeur est actif. Configure maintenant la boutique visible par les clients.</p>
          <form onSubmit={createStore} className="seller-store-form">
            <label>Nom de la boutique<input required value={storeForm.name} onChange={event => setStoreForm({ ...storeForm, name: event.target.value })}/></label>
            <label>Ville<input value={storeForm.city} onChange={event => setStoreForm({ ...storeForm, city: event.target.value })}/></label>
            <label>Description<textarea rows={4} value={storeForm.description} onChange={event => setStoreForm({ ...storeForm, description: event.target.value })}/></label>
            <label>Logo — URL d’image<input value={storeForm.logo_url} onChange={event => setStoreForm({ ...storeForm, logo_url: event.target.value })} placeholder="https://…"/></label>
            <label>Bannière — URL d’image<input value={storeForm.banner_url} onChange={event => setStoreForm({ ...storeForm, banner_url: event.target.value })} placeholder="https://…"/></label>
            {storeMessage && <div className="seller-feedback">{storeMessage}</div>}
            <button className="button primary" disabled={storeSaving}>{storeSaving ? 'Création…' : 'Créer ma boutique'}</button>
          </form>
        </section>
      </main>
    )
  }

  if (isAdmin && !stores.length) {
    return <main className="section-shell seller-empty-admin"><h1>Aucune boutique disponible</h1><p>Les boutiques vendeurs apparaîtront ici lorsqu’elles seront créées.</p></main>
  }

  return (
    <main className="seller-workspace">
      <aside className="seller-sidebar">
        <div className="seller-sidebar-brand"><Shop size={24}/><div><span>One Market</span><strong>Espace vendeur</strong></div></div>
        {isAdmin && stores.length > 1 && <label className="seller-store-selector">Boutique<select value={selectedStoreId} onChange={event => setSelectedStoreId(event.target.value)}>{stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>}
        <div className="seller-current-store"><SmartImage src={selectedStore?.logo_url} fallback={(selectedStore?.name || 'OM').slice(0,2).toUpperCase()} fit="contain" widthHint={100}/><div><strong>{selectedStore?.name}</strong><span>{selectedStore?.city || 'RDC'}</span></div></div>
        <nav>
          <button className={tab === 'overview' ? 'active' : ''} onClick={() => changeTab('overview')}><LayoutDashboard size={19}/><span>Tableau de bord</span></button>
          <button className={tab === 'products' ? 'active' : ''} onClick={() => changeTab('products')}><Boxes size={19}/><span>Produits & stock</span><em>{products.length}</em></button>
          <button className={tab === 'orders' ? 'active' : ''} onClick={() => changeTab('orders')}><ClipboardList size={19}/><span>Commandes</span>{stats.pendingOrders > 0 && <em className="alert">{stats.pendingOrders}</em>}</button>
          <button className={tab === 'store' ? 'active' : ''} onClick={() => changeTab('store')}><Settings size={19}/><span>Ma boutique</span></button>
        </nav>
        <Link className="seller-back-market" to={`/store/${selectedStore?.slug || ''}`}><Eye size={17}/> Voir ma boutique</Link>
      </aside>

      <section className="seller-main">
        <header className="seller-topbar">
          <div><span>Espace vendeur</span><h1>{tab === 'overview' ? 'Tableau de bord' : tab === 'products' ? 'Produits & stock' : tab === 'orders' ? 'Commandes' : 'Ma boutique'}</h1></div>
          <div className="seller-status"><i className={selectedStore?.status === 'active' ? 'online' : ''}/><span>{selectedStore?.status === 'active' ? 'Boutique active' : selectedStore?.status}</span></div>
        </header>

        {feedback && <div className="seller-feedback workspace-feedback">{feedback}</div>}
        {workspaceLoading && <div className="seller-workspace-loader"><Loader/></div>}

        {!workspaceLoading && tab === 'overview' && <>
          <div className="seller-stat-grid">
            <article><span><Package size={21}/></span><div><small>Produits actifs</small><strong>{stats.activeProducts}</strong></div></article>
            <article><span><ClipboardList size={21}/></span><div><small>Commandes à traiter</small><strong>{stats.pendingOrders}</strong></div></article>
            <article className={stats.lowStock ? 'warning' : ''}><span><Boxes size={21}/></span><div><small>Stock faible</small><strong>{stats.lowStock}</strong></div></article>
            <article><span><TrendingUp size={21}/></span><div><small>Ventes livrées</small><strong>{money(stats.deliveredRevenue, 'USD')}</strong></div></article>
          </div>

          <div className="seller-dashboard-grid">
            <section className="seller-panel">
              <div className="seller-panel-head"><div><h2>Commandes récentes</h2><p>Les dernières commandes de cette boutique.</p></div><button onClick={() => changeTab('orders')}>Voir tout</button></div>
              <div className="seller-order-mini-list">
                {orders.slice(0,5).map(order => <button key={order.id} onClick={() => changeTab('orders')}><span className="seller-order-icon"><ShoppingBag size={18}/></span><div><strong>{order.seller_order_number}</strong><small>{formatDate(order.created_at)}</small></div><b className={`seller-order-pill status-${order.status}`}>{orderStatusLabel(order.status)}</b><span>{money(order.total || order.subtotal, order.currency)}</span><ChevronRight size={17}/></button>)}
                {!orders.length && <div className="seller-empty"><ClipboardList size={26}/><strong>Aucune commande pour le moment</strong><span>Les commandes clients apparaîtront ici.</span></div>}
              </div>
            </section>

            <section className="seller-panel">
              <div className="seller-panel-head"><div><h2>Stock à surveiller</h2><p>Produits avec 5 unités ou moins.</p></div><button onClick={() => changeTab('products')}>Gérer</button></div>
              <div className="seller-stock-watch">
                {products.filter(product => product.is_active && Number(product.stock_qty) <= 5).slice(0,6).map(product => <div key={product.id}><SmartImage src={productImages[product.id]} fallback="OM" fit="contain" widthHint={120}/><span><strong>{product.name}</strong><small>{product.stock_qty} en stock</small></span><button onClick={() => changeTab('products')}>Modifier</button></div>)}
                {!products.some(product => product.is_active && Number(product.stock_qty) <= 5) && <div className="seller-empty compact"><CheckCircle2 size={24}/><strong>Stock sous contrôle</strong><span>Aucun produit actif n’est en stock faible.</span></div>}
              </div>
            </section>
          </div>
        </>}

        {!workspaceLoading && tab === 'products' && <section className="seller-panel seller-products-panel">
          <div className="seller-panel-head seller-products-head"><div><h2>Catalogue de la boutique</h2><p>Ajoute des produits et garde les stocks à jour.</p></div><button className="button primary" onClick={() => setShowProductForm(value => !value)}><Plus size={17}/> Nouveau produit</button></div>

          {showProductForm && <form className="seller-product-form" onSubmit={createProduct}>
            <div className="seller-form-title"><ImagePlus size={21}/><div><strong>Ajouter un produit</strong><span>Les variantes et l’upload direct d’images seront ajoutés dans l’étape suivante.</span></div></div>
            <div className="seller-product-form-grid">
              <label>Nom du produit<input required value={productForm.name} onChange={event => setProductForm({ ...productForm, name: event.target.value })}/></label>
              <label>Catégorie<select value={productForm.category_id} onChange={event => setProductForm({ ...productForm, category_id: event.target.value })}><option value="">Sans catégorie</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label>Prix USD<input required type="number" min="0" step="0.01" value={productForm.price} onChange={event => setProductForm({ ...productForm, price: event.target.value })}/></label>
              <label>Ancien prix <small>(facultatif)</small><input type="number" min="0" step="0.01" value={productForm.old_price} onChange={event => setProductForm({ ...productForm, old_price: event.target.value })}/></label>
              <label>Stock<input required type="number" min="0" step="1" value={productForm.stock_qty} onChange={event => setProductForm({ ...productForm, stock_qty: event.target.value })}/></label>
              <label>Image — URL<input value={productForm.image_url} onChange={event => setProductForm({ ...productForm, image_url: event.target.value })} placeholder="https://…"/></label>
              <label className="wide">Description<textarea rows={4} value={productForm.description} onChange={event => setProductForm({ ...productForm, description: event.target.value })}/></label>
              <label className="seller-checkbox wide"><input type="checkbox" checked={productForm.is_active} onChange={event => setProductForm({ ...productForm, is_active: event.target.checked })}/><span>Publier immédiatement dans la boutique</span></label>
            </div>
            <div className="seller-form-actions"><button type="button" className="button secondary" onClick={() => setShowProductForm(false)}>Annuler</button><button className="button primary" disabled={productSaving}>{productSaving ? 'Ajout…' : 'Ajouter le produit'}</button></div>
          </form>}

          <div className="seller-product-toolbar"><input value={productSearch} onChange={event => setProductSearch(event.target.value)} placeholder="Rechercher dans mes produits…"/><span>{filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''}</span></div>
          <div className="seller-product-table">
            <div className="seller-product-table-head"><span>Produit</span><span>Prix</span><span>Stock</span><span>Statut</span><span>Actions</span></div>
            {filteredProducts.map(product => <article key={product.id} className={!product.is_active ? 'inactive' : ''}>
              <div className="seller-product-name"><SmartImage src={productImages[product.id]} fallback="OM" fit="contain" widthHint={150}/><span><strong>{product.name}</strong><small>{product.slug}</small></span></div>
              <strong>{money(product.price, product.currency)}</strong>
              <div className={`seller-stock-input ${Number(product.stock_qty) <= 5 ? 'low' : ''}`}><input type="number" min="0" value={product.stock_qty} onChange={event => setProducts(current => current.map(item => item.id === product.id ? { ...item, stock_qty: event.target.value } : item))} onBlur={() => updateProduct(product.id, { stock_qty: Math.max(0, Number(product.stock_qty) || 0) })}/><span>unités</span></div>
              <button className={`seller-product-status ${product.is_active ? 'active' : ''}`} onClick={() => updateProduct(product.id, { is_active: !product.is_active })}><i/>{product.is_active ? 'Publié' : 'Masqué'}</button>
              <div className="seller-product-actions"><Link to={`/product/${product.id}`} title="Voir"><Eye size={17}/></Link><button title="Retirer" onClick={() => removeProduct(product)}><Trash2 size={17}/></button></div>
            </article>)}
            {!filteredProducts.length && <div className="seller-empty"><Package size={27}/><strong>Aucun produit</strong><span>Ajoute ton premier produit à la boutique.</span></div>}
          </div>
        </section>}

        {!workspaceLoading && tab === 'orders' && <section className="seller-panel seller-orders-panel">
          <div className="seller-panel-head"><div><h2>Commandes reçues</h2><p>Confirme, prépare et remets les commandes au livreur.</p></div><span className="seller-order-counter">{orders.length} commande{orders.length > 1 ? 's' : ''}</span></div>
          <div className="seller-orders-list">
            {orders.map(order => {
              const parent = parentOrders[order.order_id]
              const lines = orderItems.filter(item => item.seller_order_id === order.id)
              const shipping = parent?.shipping_snapshot || {}
              const next = nextStatus(order.status)
              return <article className="seller-order-card" key={order.id}>
                <div className="seller-order-card-head"><div><span>{order.seller_order_number}</span><h3>{formatDate(order.created_at)}</h3></div><b className={`seller-order-pill status-${order.status}`}>{orderStatusLabel(order.status)}</b><strong>{money(order.total || order.subtotal, order.currency)}</strong></div>
                <div className="seller-order-customer"><div><small>Client</small><strong>{shipping.full_name || 'Client One Market'}</strong><span>{shipping.phone || 'Téléphone non disponible'}</span></div><div><small>Livraison</small><strong>{[shipping.address_line1, shipping.district, shipping.city].filter(Boolean).join(', ') || 'Adresse enregistrée'}</strong><span>Paiement à la livraison</span></div></div>
                <div className="seller-order-lines">{lines.map(line => <div key={line.id}><SmartImage src={line.product_image_url} fallback="OM" fit="contain" widthHint={120}/><span><strong>{line.product_name}</strong><small>Qté {line.quantity}{Object.keys(line.variant_snapshot || {}).length ? ` · ${Object.values(line.variant_snapshot).join(' · ')}` : ''}</small></span><b>{money(line.line_total, line.currency)}</b></div>)}</div>
                {parent?.customer_note && <div className="seller-customer-note"><strong>Note du client</strong><span>{parent.customer_note}</span></div>}
                <div className="seller-order-actions">{next && <button className="button primary" onClick={() => advanceOrder(order)}>{order.status === 'pending' ? 'Confirmer la commande' : order.status === 'confirmed' ? 'Commencer la préparation' : order.status === 'preparing' ? 'Marquer prête' : order.status === 'ready' ? 'Remise au livreur' : 'Marquer livrée'}</button>}{['pending','confirmed'].includes(order.status) && <button className="button secondary danger-outline" onClick={() => refuseOrder(order)}>Refuser</button>}</div>
              </article>
            })}
            {!orders.length && <div className="seller-empty"><ClipboardList size={28}/><strong>Aucune commande reçue</strong><span>Les nouvelles commandes apparaîtront automatiquement ici.</span></div>}
          </div>
        </section>}

        {!workspaceLoading && tab === 'store' && <section className="seller-panel seller-store-settings">
          <div className="seller-panel-head"><div><h2>Informations de la boutique</h2><p>Ces informations sont visibles par les clients.</p></div><Link to={`/store/${selectedStore?.slug}`}><Eye size={17}/> Aperçu public</Link></div>
          <div className="seller-store-preview"><SmartImage src={storeForm.banner_url} fallback="ONE MARKET" fit="cover" widthHint={1000}/><div><SmartImage src={storeForm.logo_url} fallback={(storeForm.name || 'OM').slice(0,2).toUpperCase()} fit="contain" widthHint={180}/><span><strong>{storeForm.name || 'Ma boutique'}</strong><small>{storeForm.city || 'RDC'}</small></span></div></div>
          <form onSubmit={saveStore} className="seller-store-form settings-form">
            <label>Nom de la boutique<input required value={storeForm.name} onChange={event => setStoreForm({ ...storeForm, name: event.target.value })}/></label>
            <label>Ville<input value={storeForm.city} onChange={event => setStoreForm({ ...storeForm, city: event.target.value })}/></label>
            <label className="wide">Description<textarea rows={4} value={storeForm.description} onChange={event => setStoreForm({ ...storeForm, description: event.target.value })}/></label>
            <label>URL du logo<input value={storeForm.logo_url} onChange={event => setStoreForm({ ...storeForm, logo_url: event.target.value })} placeholder="https://…"/></label>
            <label>URL de la bannière<input value={storeForm.banner_url} onChange={event => setStoreForm({ ...storeForm, banner_url: event.target.value })} placeholder="https://…"/></label>
            {storeMessage && <div className="seller-feedback wide">{storeMessage}</div>}
            <div className="seller-form-actions wide"><button className="button primary" disabled={storeSaving}><Save size={17}/>{storeSaving ? 'Enregistrement…' : 'Enregistrer les modifications'}</button></div>
          </form>
        </section>}
      </section>
    </main>
  )
}
