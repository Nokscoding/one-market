import { Banknote, Clock3, MapPin, MessageCircle, RefreshCw, Truck, Zap } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import ReportProblem from '../components/ReportProblem'
import SmartImage from '../components/SmartImage'
import StoreTrustBadge from '../components/StoreTrustBadge'
import { cdf, deliveryOption } from '../lib/delivery'
import { dateTime, logisticsStatus, money, orderStatus, paymentStatus, sellerOrderStatus } from '../lib/format'
import { supabase } from '../lib/supabase'
import { logTechnicalError, userError } from '../lib/userErrors'

function whatsappDigits(value) {
  let digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('0')) digits = `243${digits.slice(1)}`
  return digits
}

function snapshotAddress(snapshot = {}) {
  return [
    snapshot.address_line1,
    snapshot.building,
    snapshot.apartment,
    snapshot.district,
    snapshot.city,
    snapshot.state_region,
  ].filter(Boolean).join(', ')
}

export default function OrderPage() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [subs, setSubs] = useState([])
  const [items, setItems] = useState({})
  const [stores, setStores] = useState({})
  const [conversations, setConversations] = useState({})
  const [events, setEvents] = useState([])
  const [paymentSettings, setPaymentSettings] = useState({ mobile_money_whatsapp: '243995585991', mobile_money_display: '0995585991' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [orderResult, paymentResult] = await Promise.all([
        supabase.from('orders').select('*').eq('id', id).maybeSingle(),
        supabase.from('marketplace_settings').select('value').eq('key', 'payments').maybeSingle(),
      ])
      if (orderResult.error) throw orderResult.error
      const currentOrder = orderResult.data || null
      setOrder(currentOrder)
      if (paymentResult.data?.value) setPaymentSettings(current => ({ ...current, ...paymentResult.data.value }))
      if (!currentOrder) return

      const [subResult, eventResult] = await Promise.all([
        supabase.from('seller_orders').select('*').eq('order_id', currentOrder.id).order('created_at'),
        supabase.from('order_status_events').select('id,status,label,created_at').eq('order_id', currentOrder.id).order('created_at'),
      ])
      if (subResult.error) throw subResult.error
      if (eventResult.error) throw eventResult.error
      const list = subResult.data || []
      setSubs(list)
      setEvents(eventResult.data || [])

      if (!list.length) {
        setItems({}); setStores({}); setConversations({})
        return
      }

      const ids = list.map(x => x.id)
      const storeIds = [...new Set(list.map(x => x.store_id))]
      const [itemResult, storeResult, convResult] = await Promise.all([
        supabase.from('order_items').select('*').in('seller_order_id', ids).order('created_at'),
        supabase.from('stores').select('id,name,slug,country_code,logo_url,is_verified,is_partner').in('id', storeIds),
        supabase.from('conversations').select('id,seller_order_id').in('seller_order_id', ids),
      ])
      if (itemResult.error) throw itemResult.error
      if (storeResult.error) throw storeResult.error
      if (convResult.error) throw convResult.error

      const itemMap = {}
      ;(itemResult.data || []).forEach(x => { (itemMap[x.seller_order_id] ||= []).push(x) })
      setItems(itemMap)
      setStores(Object.fromEntries((storeResult.data || []).map(x => [x.id, x])))
      setConversations(Object.fromEntries((convResult.data || []).map(x => [x.seller_order_id, x])))
    } catch (loadError) {
      logTechnicalError('order-detail', loadError)
      setError(userError(loadError, 'orders'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const channel = supabase.channel(`customer-order-${id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'seller_orders' }, () => load()).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id, load])

  if (loading) return <Loader fullscreen />
  if (error) return <main className="section-shell page-space"><div className="order-page-error" role="alert"><span>{error}</span><button className="button secondary" type="button" onClick={load}><RefreshCw size={16}/> Réessayer</button></div></main>
  if (!order) return <main className="section-shell page-space"><EmptyState title="Commande introuvable" text="Cette commande n’est pas disponible dans votre compte."/></main>

  const delivery = deliveryOption(order.delivery_method)
  const mobileMoney = order.payment_method === 'mobile_money'
  const paymentLabel = paymentStatus[order.payment_status] || 'Paiement en attente'
  const reportSellerOrders = subs.map(sub => ({ ...sub, store: stores[sub.store_id] })).filter(sub => sub.store)
  const reportItems = Object.values(items).flat()
  const mobileMoneyNumber = paymentSettings.mobile_money_display || paymentSettings.mobile_money_whatsapp || '0995585991'
  const mobileMoneyLink = `https://wa.me/${whatsappDigits(paymentSettings.mobile_money_whatsapp || mobileMoneyNumber)}?text=${encodeURIComponent(`Bonjour One Market, je souhaite finaliser le paiement Mobile Money de ma commande ${order.order_number}.`)}`
  const shipping = order.shipping_snapshot || {}

  return (
    <main className="section-shell page-space order-detail-final">
      <div className="order-header">
        <div><span className="eyebrow">{order.order_number}</span><h1>{orderStatus[order.status] || 'Commande en cours'}</h1><p>Passée le {dateTime(order.created_at)}</p></div>
        <div className="order-header-totals"><strong>{money(order.items_total, order.currency)}</strong><span>+ {cdf(order.delivery_fee_cdf ?? delivery.feeCdf)} de livraison</span></div>
      </div>

      <div className="order-summary-grid">
        <div className={`order-delivery-summary ${delivery.code === 'express' ? 'is-express' : ''}`}><span>{delivery.code === 'express' ? <Zap size={20}/> : <Truck size={20}/>}</span><div><strong>{delivery.label}</strong><small>{delivery.description} · {cdf(order.delivery_fee_cdf ?? delivery.feeCdf)}</small></div><em>{logisticsStatus[order.logistics_status] || 'En cours'}</em></div>
        <div className="order-address-summary"><MapPin size={19}/><div><strong>Livraison à {shipping.full_name || 'votre adresse'}</strong><span>{snapshotAddress(shipping) || 'Adresse enregistrée dans la commande'}</span>{shipping.landmark && <small>Repère : {shipping.landmark}</small>}{shipping.phone && <small>{shipping.phone}</small>}</div></div>
      </div>

      {mobileMoney ? <div className="order-payment-summary"><MessageCircle size={19}/><div><strong>Mobile Money</strong><span>{paymentLabel}.</span>{!['paid','cancelled'].includes(order.payment_status) && <a className="button secondary" href={mobileMoneyLink} target="_blank" rel="noreferrer">Ouvrir WhatsApp</a>}</div></div> : <div className="order-payment-summary"><Banknote size={19}/><div><strong>Paiement à la livraison</strong><span>{paymentLabel}. Le règlement se fait auprès du livreur à la réception.</span></div></div>}

      <section className="order-timeline-panel">
        <div className="order-timeline-head"><div><span>Suivi</span><h2>Historique de la commande</h2></div><Clock3 size={20}/></div>
        {events.length ? <div className="order-timeline">{events.map((event, index) => <div className="order-timeline-item" key={event.id}><span className={index === events.length - 1 ? 'is-current' : ''}/><div><strong>{event.label || orderStatus[event.status] || 'Mise à jour de la commande'}</strong><small>{dateTime(event.created_at)}</small></div></div>)}</div> : <p className="muted">La commande a été enregistrée. Les prochaines étapes apparaîtront ici.</p>}
      </section>

      <div className="order-report-row"><ReportProblem source="order_detail" orderId={order.id} orderNumber={order.order_number} sellerOrders={reportSellerOrders} orderItems={reportItems}/></div>

      <div className="seller-order-list">{subs.map(sub => {
        const store = stores[sub.store_id]
        const conv = conversations[sub.id]
        return <section className="seller-order-card" key={sub.id}>
          <div className="seller-order-head"><div><SmartImage src={store?.logo_url} fallback={store?.name?.slice(0,2).toUpperCase() || 'OM'} fit="contain" width={100}/><div><span>Boutique</span><div className="order-store-name"><h2>{store?.name || 'Boutique One Market'}</h2><StoreTrustBadge store={store} compact/></div></div></div><span className={`status-pill ${sub.status}`}>{sellerOrderStatus[sub.status] || 'En cours'}</span></div>
          <div className="ordered-items">{(items[sub.id] || []).map(item => <div className="ordered-item" key={item.id}><SmartImage src={item.product_image_url} fallback="OM" fit="contain" width={150}/><div><strong>{item.product_name}</strong>{Object.keys(item.variant_snapshot || {}).length > 0 && <span>{Object.values(item.variant_snapshot).join(' · ')}</span>}<span>{item.quantity} × {money(item.unit_price, sub.currency)}</span></div><strong>{money(item.line_total, sub.currency)}</strong></div>)}</div>
          {sub.status === 'refused' && <div className="refusal-box"><strong>Commande refusée par la boutique</strong><p>{sub.refusal_reason || 'La boutique n’a pas pu accepter cette commande.'}</p></div>}
          <div className="seller-order-footer"><div><span>Sous-total produits</span><strong>{money(sub.subtotal, sub.currency)}</strong><span>Livraison choisie</span><strong>{cdf(sub.delivery_fee_cdf ?? order.delivery_fee_cdf ?? delivery.feeCdf)}</strong></div>{conv && sub.status !== 'refused' && <Link className="button secondary" to={`/chat/${conv.id}`}><MessageCircle size={18}/> Contacter la boutique</Link>}</div>
        </section>
      })}</div>
    </main>
  )
}