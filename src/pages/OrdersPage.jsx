import { ArrowRight, Truck, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import { useAuth } from '../context/AuthContext'
import { cdf, deliveryOption } from '../lib/delivery'
import { dateTime, money, orderStatus } from '../lib/format'
import { supabase } from '../lib/supabase'

export default function OrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [suborders, setSuborders] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      const { data } = await supabase.from('orders').select('*').eq('customer_id', user.id).order('created_at', { ascending: false })
      if (!active) return
      const list = data || []
      setOrders(list)
      if (list.length) {
        const { data: subs } = await supabase.from('seller_orders').select('*').in('order_id', list.map(order => order.id)).order('created_at')
        if (!active) return
        const map = {}
        ;(subs || []).forEach(sub => { (map[sub.order_id] ||= []).push(sub) })
        setSuborders(map)
      }
      setLoading(false)
    }
    load().catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user.id])

  if (loading) return <Loader fullscreen />

  return (
    <main className="section-shell page-space orders-final-page">
      <div className="page-title"><span className="eyebrow">Compte</span><h1>Mes commandes</h1><p>Suivez chaque boutique, la livraison choisie et l’historique depuis une seule commande One Market.</p></div>
      {orders.length ? <div className="order-list">{orders.map(order => {
        const delivery = deliveryOption(order.delivery_method)
        return <Link to={`/orders/${order.id}`} className={`order-card order-card--final ${delivery.code === 'express' ? 'is-express' : ''}`} key={order.id}>
          <div><span className="order-number">{order.order_number}</span><h3>{orderStatus[order.status] || order.status}</h3><p>{dateTime(order.created_at)}</p></div>
          <div className="order-card-delivery">{delivery.code === 'express' ? <Zap size={17}/> : <Truck size={17}/>}<span><strong>{delivery.label}</strong><small>{cdf(order.delivery_fee_cdf ?? delivery.feeCdf)}</small></span></div>
          <div className="order-card-meta"><span>{(suborders[order.id] || []).length} boutique(s)</span><strong>{money(order.items_total, order.currency)}</strong><ArrowRight size={19}/></div>
        </Link>
      })}</div> : <EmptyState title="Aucune commande" text="Tes prochaines commandes apparaîtront ici." action={<Link className="button primary" to="/catalog">Découvrir les produits</Link>}/>} 
    </main>
  )
}
