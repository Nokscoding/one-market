import { ArrowRight, Banknote, RefreshCw, Truck, Zap } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import { useAuth } from '../context/AuthContext'
import { cdf, deliveryOption } from '../lib/delivery'
import { dateTime, money, orderStatus, paymentStatus } from '../lib/format'
import { supabase } from '../lib/supabase'
import { logTechnicalError, userError } from '../lib/userErrors'

export default function OrdersPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [suborders, setSuborders] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError('')
    try {
      const result = await supabase
        .from('orders')
        .select('id,order_number,status,payment_method,payment_status,items_total,currency,delivery_method,delivery_fee_cdf,logistics_status,created_at')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
      if (result.error) throw result.error

      const list = result.data || []
      setOrders(list)
      if (!list.length) {
        setSuborders({})
        return
      }

      const subsResult = await supabase
        .from('seller_orders')
        .select('id,order_id,store_id,status')
        .in('order_id', list.map(order => order.id))
        .order('created_at')
      if (subsResult.error) throw subsResult.error

      const map = {}
      ;(subsResult.data || []).forEach(sub => { (map[sub.order_id] ||= []).push(sub) })
      setSuborders(map)
    } catch (loadError) {
      logTechnicalError('orders-list', loadError)
      setOrders([])
      setSuborders({})
      setError(userError(loadError, 'orders'))
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { load() }, [load])

  if (loading) return <Loader fullscreen />

  return (
    <main className="section-shell page-space orders-final-page">
      <div className="page-title"><span className="eyebrow">Compte</span><h1>Mes commandes</h1><p>Suivez vos achats, leur paiement et leur livraison depuis un seul endroit.</p></div>

      {error && <div className="order-page-error" role="alert"><span>{error}</span><button className="button secondary" type="button" onClick={load}><RefreshCw size={16}/> Réessayer</button></div>}

      {!error && orders.length ? <div className="order-list">{orders.map(order => {
        const delivery = deliveryOption(order.delivery_method)
        const shops = suborders[order.id] || []
        return <Link to={`/orders/${order.id}`} className={`order-card order-card--final ${delivery.code === 'express' ? 'is-express' : ''}`} key={order.id}>
          <div className="order-card-primary"><span className="order-number">{order.order_number}</span><h3>{orderStatus[order.status] || 'Commande en cours'}</h3><p>{dateTime(order.created_at)}</p></div>
          <div className="order-card-delivery">{delivery.code === 'express' ? <Zap size={17}/> : <Truck size={17}/>}<span><strong>{delivery.label}</strong><small>{cdf(order.delivery_fee_cdf ?? delivery.feeCdf)}</small></span></div>
          <div className="order-card-payment"><Banknote size={16}/><span><strong>{order.payment_method === 'mobile_money' ? 'Mobile Money' : 'Paiement à la livraison'}</strong><small>{paymentStatus[order.payment_status] || 'Paiement en attente'}</small></span></div>
          <div className="order-card-meta"><span>{shops.length} boutique{shops.length > 1 ? 's' : ''}</span><strong>{money(order.items_total, order.currency)}</strong><ArrowRight size={19}/></div>
        </Link>
      })}</div> : !error && <EmptyState title="Aucune commande" text="Vos prochaines commandes apparaîtront ici dès qu’elles auront été enregistrées." action={<Link className="button primary" to="/catalog">Découvrir les produits</Link>}/>} 
    </main>
  )
}