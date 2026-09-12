import { MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import { dateTime, money, orderStatus, sellerOrderStatus } from '../lib/format'
import { supabase } from '../lib/supabase'

/**
 * ROUTE: /orders/:id
 * PRIVÉ: client connecté
 * BUT: détail d'une commande globale découpée en sous-commandes vendeurs.
 * SUPABASE: orders, seller_orders, order_items, stores, conversations + Realtime.
 */

export default function OrderPage() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [subs, setSubs] = useState([])
  const [items, setItems] = useState({})
  const [stores, setStores] = useState({})
  const [conversations, setConversations] = useState({})
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data: o } = await supabase.from('orders').select('*').eq('id', id).maybeSingle(); setOrder(o || null)
    if (o) {
      const { data: s } = await supabase.from('seller_orders').select('*').eq('order_id', o.id).order('created_at')
      const list = s || []; setSubs(list)
      if (list.length) {
        const ids = list.map(x => x.id); const storeIds = [...new Set(list.map(x => x.store_id))]
        const [{ data: oi }, { data: st }, { data: conv }] = await Promise.all([
          supabase.from('order_items').select('*').in('seller_order_id', ids),
          supabase.from('stores').select('id,name,slug,country_code,logo_url').in('id', storeIds),
          supabase.from('conversations').select('*').in('seller_order_id', ids),
        ])
        const im = {}; (oi || []).forEach(x => { (im[x.seller_order_id] ||= []).push(x) }); setItems(im)
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
  return <main className="section-shell page-space"><div className="order-header"><div><span className="eyebrow">{order.order_number}</span><h1>{orderStatus[order.status] || order.status}</h1><p>Passée le {dateTime(order.created_at)}</p></div><strong>{money(order.items_total, order.currency)}</strong></div><div className="seller-order-list">{subs.map(sub => { const store = stores[sub.store_id]; const conv = conversations[sub.id]; return <section className="seller-order-card" key={sub.id}><div className="seller-order-head"><div>{store?.logo_url ? <img src={store.logo_url} alt="" /> : <div className="mini-store-logo">{store?.name?.slice(0,2).toUpperCase() || 'OM'}</div>}<div><span>{store?.country_code === 'US' ? 'USA' : 'RDC'}{sub.is_cross_border ? ' · International' : ''}</span><h2>{store?.name || 'Boutique'}</h2></div></div><span className={`status-pill ${sub.status}`}>{sellerOrderStatus[sub.status] || sub.status}</span></div><div className="ordered-items">{(items[sub.id] || []).map(item => <div className="ordered-item" key={item.id}>{item.product_image_url ? <img src={item.product_image_url} alt="" /> : <div className="order-item-placeholder">OM</div>}<div><strong>{item.product_name}</strong>{Object.keys(item.variant_snapshot || {}).length > 0 && <span>{Object.values(item.variant_snapshot).join(' · ')}</span>}<span>{item.quantity} × {money(item.unit_price, sub.currency)}</span></div><strong>{money(item.line_total, sub.currency)}</strong></div>)}</div>{sub.status === 'refused' && <div className="refusal-box"><strong>Commande refusée</strong><p>{sub.refusal_reason}</p></div>}<div className="seller-order-footer"><div><span>Sous-total</span><strong>{money(sub.subtotal, sub.currency)}</strong>{Number(sub.delivery_fee) > 0 && <><span>Livraison</span><strong>{money(sub.delivery_fee, sub.currency)}</strong></>}</div>{conv && sub.status !== 'refused' && <Link className="button secondary" to={`/chat/${conv.id}`}><MessageCircle size={18} /> Discuter avec le vendeur</Link>}</div></section>})}</div></main>
}
