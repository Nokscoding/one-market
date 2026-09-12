import { MessageCircle, Truck, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import SmartImage from '../components/SmartImage'
import { cdf, deliveryOption } from '../lib/delivery'
import { dateTime, money, orderStatus, sellerOrderStatus } from '../lib/format'
import { supabase } from '../lib/supabase'

export default function OrderPage() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [subs, setSubs] = useState([])
  const [items, setItems] = useState({})
  const [stores, setStores] = useState({})
  const [conversations, setConversations] = useState({})
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data: o } = await supabase.from('orders').select('*').eq('id', id).maybeSingle()
    setOrder(o || null)
    if (o) {
      const { data: s } = await supabase.from('seller_orders').select('*').eq('order_id', o.id).order('created_at')
      const list = s || []
      setSubs(list)
      if (list.length) {
        const ids = list.map(x => x.id)
        const storeIds = [...new Set(list.map(x => x.store_id))]
        const [{ data: oi }, { data: st }, { data: conv }] = await Promise.all([
          supabase.from('order_items').select('*').in('seller_order_id', ids),
          supabase.from('stores').select('id,name,slug,country_code,logo_url').in('id', storeIds),
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
  if (!order) return <main className="section-shell page-space"><EmptyState title="Commande introuvable" /></main>

  const delivery = deliveryOption(order.delivery_method)

  return (
    <main className="section-shell page-space order-detail-final">
      <div className="order-header">
        <div><span className="eyebrow">{order.order_number}</span><h1>{orderStatus[order.status] || order.status}</h1><p>Passée le {dateTime(order.created_at)}</p></div>
        <div className="order-header-totals"><strong>{money(order.items_total, order.currency)}</strong><span>+ {cdf(order.delivery_fee_cdf ?? delivery.feeCdf)} livraison</span></div>
      </div>

      <div className={`order-delivery-summary ${delivery.code === 'express' ? 'is-express' : ''}`}>
        <span>{delivery.code === 'express' ? <Zap size={20}/> : <Truck size={20}/>}</span>
        <div><strong>{delivery.label}</strong><small>{delivery.description} · {cdf(order.delivery_fee_cdf ?? delivery.feeCdf)}</small></div>
        <em>{order.logistics_status === 'delivered' ? 'Livrée' : order.logistics_status === 'out_for_delivery' ? 'En route' : 'En cours'}</em>
      </div>

      <div className="seller-order-list">{subs.map(sub => {
        const store = stores[sub.store_id]
        const conv = conversations[sub.id]
        return <section className="seller-order-card" key={sub.id}>
          <div className="seller-order-head"><div><SmartImage src={store?.logo_url} fallback={store?.name?.slice(0,2).toUpperCase() || 'OM'} fit="contain" width={100}/><div><span>RDC</span><h2>{store?.name || 'Boutique'}</h2></div></div><span className={`status-pill ${sub.status}`}>{sellerOrderStatus[sub.status] || sub.status}</span></div>
          <div className="ordered-items">{(items[sub.id] || []).map(item => <div className="ordered-item" key={item.id}><SmartImage src={item.product_image_url} fallback="OM" fit="contain" width={150}/><div><strong>{item.product_name}</strong>{Object.keys(item.variant_snapshot || {}).length > 0 && <span>{Object.values(item.variant_snapshot).join(' · ')}</span>}<span>{item.quantity} × {money(item.unit_price, sub.currency)}</span></div><strong>{money(item.line_total, sub.currency)}</strong></div>)}</div>
          {sub.status === 'refused' && <div className="refusal-box"><strong>Commande refusée</strong><p>{sub.refusal_reason}</p></div>}
          <div className="seller-order-footer"><div><span>Sous-total produits</span><strong>{money(sub.subtotal, sub.currency)}</strong><span>Livraison choisie</span><strong>{cdf(sub.delivery_fee_cdf ?? order.delivery_fee_cdf ?? delivery.feeCdf)}</strong></div>{conv && sub.status !== 'refused' && <Link className="button secondary" to={`/chat/${conv.id}`}><MessageCircle size={18}/> Discuter avec le vendeur</Link>}</div>
        </section>
      })}</div>
    </main>
  )
}
