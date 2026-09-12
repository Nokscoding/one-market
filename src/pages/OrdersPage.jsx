import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import { useAuth } from '../context/AuthContext'
import { dateTime, money, orderStatus } from '../lib/format'
import { supabase } from '../lib/supabase'

/**
 * ROUTE: /orders
 * PRIVÉ: client connecté
 * BUT: historique des commandes globales du client.
 * SUPABASE: orders, seller_orders.
 */

export default function OrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [suborders, setSuborders] = useState({})
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('orders').select('*').eq('customer_id', user.id).order('created_at', { ascending: false })
      const list = data || []; setOrders(list)
      if (list.length) {
        const { data: subs } = await supabase.from('seller_orders').select('*').in('order_id', list.map(o => o.id)).order('created_at')
        const map = {}; (subs || []).forEach(s => { (map[s.order_id] ||= []).push(s) }); setSuborders(map)
      }
      setLoading(false)
    }
    load()
  }, [user])
  if (loading) return <Loader fullscreen />
  return <main className="section-shell page-space"><div className="page-title"><span className="eyebrow">Compte</span><h1>Mes commandes</h1><p>Suivez chaque boutique séparément depuis une seule commande OneMarket.</p></div>{orders.length ? <div className="order-list">{orders.map(order => <Link to={`/orders/${order.id}`} className="order-card" key={order.id}><div><span className="order-number">{order.order_number}</span><h3>{orderStatus[order.status] || order.status}</h3><p>{dateTime(order.created_at)}</p></div><div className="order-card-meta"><span>{(suborders[order.id] || []).length} boutique(s)</span><strong>{money(order.items_total, order.currency)}</strong><ArrowRight size={19}/></div></Link>)}</div> : <EmptyState title="Aucune commande" text="Tes prochaines commandes apparaîtront ici." action={<Link className="button primary" to="/catalog">Découvrir les produits</Link>} />}</main>
}
