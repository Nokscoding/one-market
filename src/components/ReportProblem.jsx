import { AlertTriangle, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const LABELS = {
  general: 'Problème général', order: 'Problème avec ma commande', delivery: 'Problème de livraison',
  payment: 'Problème de paiement', seller: 'Problème avec un vendeur', store: 'Problème avec une boutique',
  product: 'Problème avec un produit', account: 'Problème de compte', technical: 'Problème technique',
}

export default function ReportProblem({ source = 'page', orderId = null, orderNumber = '', product = null, store = null, sellerOrders = [], orderItems = [], className = '' }) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState(orderId ? 'order' : product ? 'product' : store ? 'store' : 'general')
  const [message, setMessage] = useState('')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [selectedProduct, setSelectedProduct] = useState(product?.id || '')
  const [selectedStore, setSelectedStore] = useState(store?.id || '')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    if (!phone && profile?.phone) setPhone(profile.phone)
  }, [profile?.phone, phone])

  const stores = useMemo(() => {
    const map = new Map()
    if (store?.id) map.set(store.id, store)
    ;(sellerOrders || []).forEach(row => { if (row.store?.id) map.set(row.store.id, row.store) })
    return [...map.values()]
  }, [store, sellerOrders])

  const products = useMemo(() => {
    const map = new Map()
    if (product?.id) map.set(product.id, product)
    ;(orderItems || []).forEach(item => { if (item.product_id) map.set(item.product_id, { id: item.product_id, name: item.product_name, store_id: item.store_id, seller_order_id: item.seller_order_id }) })
    return [...map.values()]
  }, [product, orderItems])

  function start() {
    if (!user) {
      navigate('/auth', { state: { from: `${location.pathname}${location.search}` } })
      return
    }
    setOpen(true)
    setFeedback('')
  }

  async function submit(event) {
    event.preventDefault()
    const cleanPhone = phone.trim()
    if (message.trim().length < 10 || cleanPhone.length < 7 || saving) return
    setSaving(true)
    setFeedback('')

    const targetProduct = products.find(item => item.id === selectedProduct) || null
    const targetStore = stores.find(item => item.id === selectedStore) || (targetProduct?.store_id ? stores.find(item => item.id === targetProduct.store_id) : null)
    const sellerOrder = (sellerOrders || []).find(row => row.store_id === targetStore?.id || row.id === targetProduct?.seller_order_id) || null
    const subjectContext = orderNumber ? ` · ${orderNumber}` : product?.name ? ` · ${product.name}` : store?.name ? ` · ${store.name}` : ''

    const payload = {
      user_id: user.id,
      reporter_phone: cleanPhone,
      category,
      subject: `${LABELS[category] || 'Signalement'}${subjectContext}`.slice(0, 140),
      message: message.trim(),
      order_id: orderId || null,
      seller_order_id: sellerOrder?.id || null,
      store_id: targetStore?.id || store?.id || null,
      product_id: targetProduct?.id || product?.id || null,
      target_type: category === 'seller' || category === 'store' ? 'store' : category === 'product' ? 'product' : orderId ? 'order' : category,
      source,
      priority: 'normal',
    }

    const { error } = await supabase.from('support_tickets').insert(payload)
    if (error) setFeedback(error.message === 'REPORTER_PHONE_REQUIRED' ? 'Ajoutez un numéro de téléphone valide.' : error.message || 'Impossible d’envoyer le signalement.')
    else {
      setFeedback('Signalement envoyé à l’équipe One Market.')
      setMessage('')
      window.setTimeout(() => setOpen(false), 900)
    }
    setSaving(false)
  }

  const categories = orderId
    ? ['order','delivery','payment','seller','product']
    : product ? ['product','seller','general']
    : store ? ['store','seller','product','general']
    : ['general','account','technical']

  return <>
    <button type="button" className={`report-problem-trigger ${className}`.trim()} onClick={start}><AlertTriangle size={16}/> Signaler un problème</button>
    {open && <div className="report-modal-backdrop"><form className="report-modal" onSubmit={submit}>
      <div className="report-modal-head"><div><span>Assistance One Market</span><h3>Signaler un problème</h3><p>Votre signalement sera transmis directement à notre équipe.</p></div><button type="button" onClick={() => setOpen(false)}><X size={18}/></button></div>
      <label>Type de problème<select value={category} onChange={event => setCategory(event.target.value)}>{categories.map(value => <option key={value} value={value}>{LABELS[value]}</option>)}</select></label>
      <label>Numéro de téléphone<input required minLength={7} maxLength={30} value={phone} onChange={event => setPhone(event.target.value)} placeholder="+243…"/></label>
      {category === 'product' && products.length > 0 && <label>Produit concerné<select required value={selectedProduct} onChange={event => setSelectedProduct(event.target.value)}><option value="">Choisir un produit</option>{products.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {(category === 'seller' || category === 'store') && stores.length > 0 && <label>Boutique concernée<select required value={selectedStore} onChange={event => setSelectedStore(event.target.value)}><option value="">Choisir une boutique</option>{stores.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <label>Décrivez le problème<textarea required minLength={10} maxLength={3000} rows={5} value={message} onChange={event => setMessage(event.target.value)} placeholder="Expliquez ce qui s’est passé…"/></label>
      {feedback && <div className="report-feedback">{feedback}</div>}
      <div className="report-modal-actions"><button type="button" className="button secondary" onClick={() => setOpen(false)}>Annuler</button><button className="button primary" disabled={saving || message.trim().length < 10 || phone.trim().length < 7}>{saving ? 'Envoi…' : 'Envoyer le signalement'}</button></div>
    </form></div>}
  </>
}
