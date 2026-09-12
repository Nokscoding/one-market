import { Banknote, MessageCircle, Truck, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import ReportProblem from '../components/ReportProblem'
import SmartImage from '../components/SmartImage'
import StoreTrustBadge from '../components/StoreTrustBadge'
import { cdf, deliveryOption } from '../lib/delivery'
import { dateTime, money, orderStatus, sellerOrderStatus } from '../lib/format'
import { supabase } from '../lib/supabase'

function whatsappDigits(value) {
  let digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('0')) digits = `243${digits.slice(1)}`
  return digits
}

export default function OrderPage() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [subs, setSubs] = useState([])
  const [items, setItems] = useState({})
  const [stores, setStores] = useState({})
  const [conversations, setConversations] = useState({})
  const [paymentSettings, setPaymentSettings] = useState({ mobile_money_whatsapp: '243995585991', mobile_money_display: '0995585991' })
  const [loading, setLoading] = useState(true)

  async function load() {
    const [{ data: o }, { data: paymentConfig }] = await Promise.all([
      supabase.from('orders').select('*').eq('id', id).maybeSingle(),
      supabase.from('marketplace_settings').select('value').eq('key', 'payments').maybeSingle(),
    ])
    setOrder(o || null)
    if (paymentConfig?.value) setPaymentSettings(current => ({ ...current, ...paymentConfig.value }))
    if (o) {
      const { data: s } = await supabase.from('seller_orders').select('*').eq('order_id', o.id).order('created_at')
      const list = s || []
      setSubs(list)
      if (list.length) {
        const ids = list.map(x => x.id)
        const storeIds = [...new Set(list.map(x => x.store_id))]
        const [{ data: oi }, { data: st }, { data: conv }] = await Promise.all([
          supabase.from('order_items').select('*').in('seller_order_id', ids),
          supabase.from('stores').select('id,name,slug,country_code,logo_url,is_verified,is_partner').in('id', storeIds),
          supabase.from('conversations').select('*').in('seller_order_id', ids),
        ])
        const im = {}
        ;(oi || []).forEach(x => { (im[x.seller_order_id] ||= []).push(x) })
        setItems(im)
        setStores(Object.fromEntries((st || []).map(x => [x.id, x])))
        setConversations(Object.fromEntries((conv || []).map(x => [x.seller_order_id, x])))
      }
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])
  useEffect(() => {
    const channel = supabase.channel(`customer-order-${id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'seller_orders' }, payload => {
      if (subs.some(s => s.id === payload.new.id)) load()
    }).subscribe()
    return () => supabase.removeChannel(channel)
  }, [id, subs.length])

  if (loading) return <Loader fullscreen />
  if (!order) return <main className="section-shell page-space"><EmptyState title="Commande introuvable"/></main>

  const delivery = deliveryOption(order.delivery_method)
  const mobileMoney = order.payment_method === 'mobile_money'
  const paymentLabel = mobileMoney
    ? ({ awaiting_mobile_money: 'Paiement à finaliser', payment_submitted: 'Paiement envoyé, vérification en cours', paid: 'Paiement confirmé', cancelled: 'Paiement annulé' }[order.payment_status] || order.payment_status)
    : order.payment_status === 'cash_received' ? 'Paiement reçu' : order.payment_status === 'cancelled' ? 'Paiement annulé' : 'À payer au livreur'
  const reportSellerOrders = subs.map(sub => ({ ...sub, store: stores[sub.store_id] })).filter(sub => sub.store)
  const reportItems = Object.values(items).flat()
  const mobileMoneyNumber = paymentSettings.mobile_money_display || paymentSettings.mobile_money_whatsapp || '0995585991'
  const mobileMoneyLink = `https://wa.me/${whatsappDigits(paymentSettings.mobile_money_whatsapp || mobileMoneyNumber)}?text=${encodeURIComponent(`Bonjour One Market, je souhaite finaliser le paiement Mobile Money de ma commande ${order.order_number}.`)}`

  return (
    <main className="section-shell page-space order-detail-final">
      <div className="order-header">
        <div><span className="eyebrow">{order.order_number}</span><h1>{orderStatus[order.status] || order.status}</h1><p>Passée le {dateTime(order.created_at)}</p></div>
        <div className="order-header-totals"><strong>{money(order.items_total, order.currency)}</strong><span>+ {cdf(order.delivery_fee_cdf ?? delivery.feeCdf)} livraison</span></div>
      </div>

      <div className={`order-delivery-summary ${delivery.code === 'express' ? 'is-express' : ''}`}><span>{delivery.code === 'express' ? <Zap size={20}/> : <Truck size={20}/>}</span><div><strong>{delivery.label}</strong><small>{delivery.description} · {cdf(order.delivery_fee_cdf ?? delivery.feeCdf)}</small></div><em>{order.logistics_status === 'delivered' ? 'Livrée' : order.logistics_status === 'out_for_delivery' ? 'En route' : 'En cours'}</em></div>
      {mobileMoney ? <div className="order-payment-summary"><MessageCircle size={19}/><div><strong>Mobile Money</strong><span>{paymentLabel}. One Market finalise le paiement via WhatsApp au {mobileMoneyNumber}.</span>{!['paid','cancelled'].includes(order.payment_status) && <a className="button secondary" href={mobileMoneyLink} target="_blank" rel="noreferrer">Ouvrir WhatsApp</a>}</div></div> : <div className="order-payment-summary"><Banknote size={19}/><div><strong>Paiement à la livraison</strong><span>{paymentLabel}. Le règlement se fait directement auprès du livreur à la réception.</span></div></div>}
      <div className="order-report-row"><ReportProblem source="order_detail" orderId={order.id} orderNumber={order.order_number} sellerOrders={reportSellerOrders} orderItems={reportItems}/></div>

      <div className="seller-order-list">{subs.map(sub => {
        const store = stores[sub.store_id]
        const conv = conversations[sub.id]
        return <section className="seller-order-card" key={sub.id}>
          <div className="seller-order-head"><div><SmartImage src={store?.logo_url} fallback={store?.name?.slice(0,2).toUpperCase() || 'OM'} fit="contain" width={100}/><div><span>RDC</span><div className="order-store-name"><h2>{store?.name || 'Boutique'}</h2><StoreTrustBadge store={store} compact/></div></div></div><span className={`status-pill ${sub.status}`}>{sellerOrderStatus[sub.status] || sub.status}</span></div>
          <div className="ordered-items">{(items[sub.id] || []).map(item => <div className="ordered-item" key={item.id}><SmartImage src={item.product_image_url} fallback="OM" fit="contain" width={150}/><div><strong>{item.product_name}</strong>{Object.keys(item.variant_snapshot || {}).length > 0 && <span>{Object.values(item.variant_snapshot).join(' · ')}</span>}<span>{item.quantity} × {money(item.unit_price, sub.currency)}</span></div><strong>{money(item.line_total, sub.currency)}</strong></div>)}</div>
          {sub.status === 'refused' && <div className="refusal-box"><strong>Commande refusée</strong><p>{sub.refusal_reason}</p></div>}
          <div className="seller-order-footer"><div><span>Sous-total produits</span><strong>{money(sub.subtotal, sub.currency)}</strong><span>Livraison choisie</span><strong>{cdf(sub.delivery_fee_cdf ?? order.delivery_fee_cdf ?? delivery.feeCdf)}</strong></div>{conv && sub.status !== 'refused' && <Link className="button secondary" to={`/chat/${conv.id}`}><MessageCircle size={18}/> Discuter avec le vendeur</Link>}</div>
        </section>
      })}</div>
    </main>
  )
}
