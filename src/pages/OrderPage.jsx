import { Banknote, CheckCircle2, Clock3, MapPin, MessageCircle, PackageCheck, RefreshCw, Truck, Zap } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
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


const STATUS_RANK = {
  pending_confirmation: 0,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  picked_up: 4,
  out_for_delivery: 5,
  delivered: 6,
  partially_completed: 6,
}

function trackingSteps(order) {
  const intercity = Boolean(order?.is_intercity)
  const current = STATUS_RANK[order?.status] ?? 0
  const intercityTransit = order?.logistics_status === 'intercity_transit'
  const arrived = order?.logistics_status === 'arrived_destination'
  return [
    { key:'confirmed', label:'Confirmée', detail:'La commande a été enregistrée et confirmée.', done: current >= 1, current: current === 1, icon:CheckCircle2 },
    { key:'preparing', label:'En préparation', detail:'Les boutiques préparent vos articles.', done: current >= 3, current: current === 2, icon:PackageCheck },
    ...(intercity ? [{ key:'intercity', label:'Transport inter-ville', detail: arrived ? 'Les colis sont arrivés dans votre ville.' : 'Les colis sont acheminés vers votre ville.', done: arrived || current >= 5, current: intercityTransit || arrived, icon:Truck }] : []),
    { key:'delivery', label:'En livraison', detail:'Le livreur One Market se dirige vers vous.', done: current >= 6, current: current === 4 || current === 5, icon:Truck },
    { key:'delivered', label:'Livrée', detail:'La commande a été remise au client.', done: current >= 6, current: current >= 6, icon:MapPin },
  ]
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
  const [query] = useSearchParams()
  const [order, setOrder] = useState(null)
  const [subs, setSubs] = useState([])
  const [items, setItems] = useState({})
  const [stores, setStores] = useState({})
  const [conversations, setConversations] = useState({})
  const [events, setEvents] = useState([])
  const [paymentSettings, setPaymentSettings] = useState({})
  const [paymentClaim, setPaymentClaim] = useState(null)
  const [provider, setProvider] = useState(() => query.get('provider') === 'airtel_money' ? 'airtel_money' : 'orange_money')
  const [reference, setReference] = useState('')
  const [senderPhone, setSenderPhone] = useState('')
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [orderResult, paymentResult] = await Promise.all([
        supabase.from('orders').select('id,order_number,customer_id,address_id,status,payment_method,payment_status,items_total,delivery_total,grand_total,currency,shipping_snapshot,customer_note,created_at,updated_at,delivery_method,delivery_fee_cdf,delivery_currency,logistics_status,is_intercity,origin_cities,destination_city,intercity_surcharge_cdf,estimated_delivery_min_days,estimated_delivery_max_days,intercity_arrived_at').eq('id', id).maybeSingle(),
        supabase.from('marketplace_settings').select('value').eq('key', 'payments').maybeSingle(),
      ])
      if (orderResult.error) throw orderResult.error
      const currentOrder = orderResult.data || null
      setOrder(currentOrder)
      if (paymentResult.data?.value) setPaymentSettings(current => ({ ...current, ...paymentResult.data.value }))
      if (!currentOrder) return
      if (currentOrder.payment_method === 'mobile_money') {
        const claimResult = await supabase.from('manual_mobile_money_payments')
          .select('id,provider,recipient_number,expected_amount_cdf,exchange_rate_cdf_per_usd,transaction_reference,sender_phone,status,review_note,submitted_at,verified_at')
          .eq('order_id', currentOrder.id).maybeSingle()
        if (claimResult.error) throw claimResult.error
        setPaymentClaim(claimResult.data || null)
        if (claimResult.data?.provider) setProvider(claimResult.data.provider)
      } else setPaymentClaim(null)

      const [subResult, eventResult] = await Promise.all([
        supabase.from('seller_orders').select('id,order_id,store_id,seller_order_number,status,subtotal,delivery_fee,total,currency,refusal_reason,created_at,updated_at,delivery_method,delivery_fee_cdf,delivery_currency,logistics_status,commission_percent,commission_amount,seller_net_amount,settlement_status').eq('order_id', currentOrder.id).order('created_at'),
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
        supabase.from('order_items').select('id,order_id,seller_order_id,store_id,product_id,product_variant_id,product_name,product_image_url,variant_snapshot,unit_price,quantity,line_total,currency,created_at').in('seller_order_id', ids).order('created_at'),
        supabase.from('stores').select('id,name,slug,country_code,city,logo_url,is_verified,is_partner').in('id', storeIds),
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
    const channel = supabase
      .channel(`customer-order-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'seller_orders' }, payload => {
        if (payload.new?.order_id === id || payload.old?.order_id === id) load()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_status_events', filter: `order_id=eq.${id}` }, () => load())
      .subscribe()
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
  const providers = [
    { code: 'orange_money', label: 'Orange Money', number: paymentSettings.orange_money_number },
    { code: 'airtel_money', label: 'Airtel Money', number: paymentSettings.airtel_money_number },
  ]
  const availableProviders = providers.filter(p => /^\\+?[0-9]{9,15}$/.test(String(p.number || '').trim()))
  const selectedProvider = availableProviders.some(p => p.code === provider) ? provider : availableProviders[0]?.code
  const mobileConfigured = paymentSettings.mobile_money_enabled === true && paymentSettings.mobile_money_backend_ready === true &&
    paymentSettings.mobile_money_coming_soon !== true &&
    Number(paymentSettings.mobile_money_rate_cdf_per_usd) > 0 &&
    availableProviders.length > 0

  async function prepareManualPayment() {
    setPaymentError('')
    setPaymentBusy(true)
    try {
      const { data, error } = await supabase.rpc('manual_mobile_money_prepare', { p_order_id: id, p_provider: selectedProvider })
      if (error) throw error
      setPaymentClaim(data)
    } catch (err) {
      logTechnicalError('manual-mobile-invoice', err)
      setPaymentError(userError(err, 'payment'))
    } finally { setPaymentBusy(false) }
  }

  async function submitManualPayment(event) {
    event.preventDefault()
    setPaymentError('')
    setPaymentBusy(true)
    try {
      const { error } = await supabase.rpc('manual_mobile_money_submit', {
        p_order_id: id, p_reference: reference.trim(), p_sender_phone: senderPhone.trim(),
      })
      if (error) throw error
      setReference('')
      await load()
    } catch (err) {
      logTechnicalError('manual-mobile-submit', err)
      setPaymentError(userError(err, 'payment'))
    } finally { setPaymentBusy(false) }
  }
  const shipping = order.shipping_snapshot || {}
  const tracker = trackingSteps(order)

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

      {mobileMoney ? <section className="order-payment-summary" style={{display:'block',padding:'1.25rem'}}>
        <div style={{display:'flex',gap:12,alignItems:'center'}}><MessageCircle size={19}/><div><strong>Orange Money / Airtel Money</strong><span>{paymentLabel}. Validation manuelle par OneMarket.</span></div></div>
        {paymentError && <p className="order-page-error" role="alert">{paymentError}</p>}
        {!['paid','cancelled'].includes(order.payment_status) && <>
          {!paymentClaim && <div style={{marginTop:16,display:'grid',gap:12}}>
            {mobileConfigured ? <>
              <label>Choisissez l’opérateur
                <select value={selectedProvider || ''} onChange={event=>setProvider(event.target.value)}>
                  {availableProviders.map(p=><option key={p.code} value={p.code}>{p.label}</option>)}
                </select>
              </label>
              <p>Créez d'abord votre facture Mobile Money. Le montant exact en francs et le numéro officiel s'afficheront avant votre transfert.</p>
              <button className="button primary" type="button" disabled={paymentBusy} onClick={prepareManualPayment}>{paymentBusy?'Préparation…':'Afficher le montant et le numéro'}</button>
            </> : <p>Les numéros de paiement seront communiqués avant l’ouverture de la bêta. Aucun transfert ne doit être effectué pour cette commande tant que les instructions officielles ne sont pas affichées.</p>}
          </div>}
          {paymentClaim && <div style={{marginTop:16,display:'grid',gap:12}}>
            <div><strong>Facture Mobile Money</strong><p>Opérateur : {providers.find(p=>p.code===paymentClaim.provider)?.label || paymentClaim.provider}</p><p>Montant exact : <strong>{cdf(paymentClaim.expected_amount_cdf)}</strong></p><p>Envoyer au numéro : <strong>{paymentClaim.recipient_number}</strong></p><small>Le taux de facturation est fixé pour cette facture. Ne payez pas un autre montant.</small></div>
            {paymentClaim.status==='submitted' && <p>Référence envoyée : <strong>{paymentClaim.transaction_reference}</strong>. Notre agent vérifie la réception des fonds. Ne renvoyez pas l'argent.</p>}
            {paymentClaim.status==='rejected' && <p>Vérification non aboutie : {paymentClaim.review_note || 'contactez le service client'}. Vous pouvez soumettre une nouvelle référence après contrôle.</p>}
            {['awaiting_payment','rejected'].includes(paymentClaim.status) && <form onSubmit={submitManualPayment} style={{display:'grid',gap:10}}>
              <label>Identifiant de transaction<input required minLength="6" maxLength="100" autoComplete="off" value={reference} onChange={event=>setReference(event.target.value)} placeholder="Référence reçue par SMS"/></label>
              <label>Numéro ayant effectué le transfert<input required inputMode="tel" autoComplete="tel" value={senderPhone} onChange={event=>setSenderPhone(event.target.value)} placeholder="+243…"/></label>
              <button className="button primary" disabled={paymentBusy} type="submit">{paymentBusy?'Transmission…':'J’ai payé — soumettre la référence'}</button>
              <small>Le paiement ne sera considéré comme reçu qu'après vérification du compte Mobile Money par le responsable.</small>
            </form>}
          </div>}
        </>}
        {order.payment_status==='paid' && <p>Paiement validé par OneMarket. La commande peut être préparée.</p>}
      </section> : <div className="order-payment-summary"><Banknote size={19}/><div><strong>Paiement à la livraison</strong><span>{paymentLabel}. Le règlement se fait auprès du livreur à la réception.</span></div></div>}

      <section className="order-progress-panel">
        <div className="order-progress-head"><div><span>Suivi en direct</span><h2>Où en est votre commande ?</h2></div><Truck size={20}/></div>
        <div className="order-progress-steps">
          {tracker.map((step,index) => {
            const Icon = step.icon
            return <div className={`order-progress-step ${step.done ? 'done' : ''} ${step.current ? 'current' : ''}`} key={step.key}>
              <div className="order-progress-marker"><Icon size={18}/></div>
              {index < tracker.length - 1 && <span className="order-progress-line"/>}
              <div><strong>{step.label}</strong><small>{step.detail}</small></div>
            </div>
          })}
        </div>
        {order.is_intercity && <div className="order-intercity-summary"><MapPin size={17}/><div><strong>Livraison inter-ville</strong><span>{(order.origin_cities || []).join(', ') || 'Ville de départ'} → {order.destination_city || shipping.city || 'ville de livraison'}</span><small>Estimation : {order.estimated_delivery_min_days || 3} à {order.estimated_delivery_max_days || 7} jours · transport supplémentaire {cdf(order.intercity_surcharge_cdf || 0)}</small></div></div>}
      </section>

      <section className="order-timeline-panel">
        <div className="order-timeline-head"><div><span>Détails</span><h2>Historique de la commande</h2></div><Clock3 size={20}/></div>
        {events.length ? <div className="order-timeline">{events.map((event, index) => <div className="order-timeline-item" key={event.id}><span className={index === events.length - 1 ? 'is-current' : ''}/><div><strong>{event.label || orderStatus[event.status] || 'Mise à jour de la commande'}</strong><small>{dateTime(event.created_at)}</small></div></div>)}</div> : <p className="muted">La commande a été enregistrée. Les prochaines étapes apparaîtront ici.</p>}
      </section>

      <div className="order-report-row"><ReportProblem source="order_detail" orderId={order.id} orderNumber={order.order_number} sellerOrders={reportSellerOrders} orderItems={reportItems}/></div>

      <div className="seller-order-list">{subs.map(sub => {
        const store = stores[sub.store_id]
        const conv = conversations[sub.id]
        return <section className="seller-order-card" key={sub.id}>
          <div className="seller-order-head"><div><SmartImage src={store?.logo_url} fallback={store?.name?.slice(0,2).toUpperCase() || 'OM'} fit="contain" width={100}/><div><span>Boutique</span><div className="order-store-name"><h2>{store?.name || 'Boutique One Market'}</h2><StoreTrustBadge store={store} compact/></div>{store?.city && <small>Expédié depuis {store.city}</small>}</div></div><span className={`status-pill ${sub.status}`}>{sellerOrderStatus[sub.status] || 'En cours'}</span></div>
          <div className="ordered-items">{(items[sub.id] || []).map(item => <div className="ordered-item" key={item.id}><SmartImage src={item.product_image_url} fallback="OM" fit="contain" width={150}/><div><strong>{item.product_name}</strong>{Object.keys(item.variant_snapshot || {}).length > 0 && <span>{Object.values(item.variant_snapshot).join(' · ')}</span>}<span>{item.quantity} × {money(item.unit_price, sub.currency)}</span></div><strong>{money(item.line_total, sub.currency)}</strong></div>)}</div>
          {sub.status === 'refused' && <div className="refusal-box"><strong>Commande refusée par la boutique</strong><p>{sub.refusal_reason || 'La boutique n’a pas pu accepter cette commande.'}</p></div>}
          <div className="seller-order-footer"><div><span>Sous-total produits</span><strong>{money(sub.subtotal, sub.currency)}</strong><span>Livraison</span><strong>Gérée par One Market</strong></div>{conv && sub.status !== 'refused' && <Link className="button secondary" to={`/chat/${conv.id}`}><MessageCircle size={18}/> Contacter la boutique</Link>}</div>
        </section>
      })}</div>
    </main>
  )
}