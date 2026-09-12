import { ArrowRight, Package } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import { useAuth } from '../context/AuthContext'
import { money, shortDate, statusLabel } from '../lib/format'
import { supabase } from '../lib/supabase'
export default function OrdersPage(){const{user}=useAuth();const[orders,setOrders]=useState([]),[loading,setLoading]=useState(true);useEffect(()=>{supabase.from('orders').select('*').eq('customer_id',user.id).order('created_at',{ascending:false}).then(({data})=>{setOrders(data||[]);setLoading(false)})},[user.id]);if(loading)return <Loader fullscreen/>;return <main className="section-shell page-space"><div className="page-heading"><span className="eyebrow">Votre historique</span><h1>Vos commandes</h1><p>Suivez toutes vos commandes One Market.</p></div>{orders.length?<div className="orders-list">{orders.map(o=><Link to={`/orders/${o.id}`} className="order-card" key={o.id}><div className="order-icon"><Package/></div><div className="order-main"><span>{shortDate(o.created_at)}</span><h3>{o.order_number}</h3><p>{statusLabel(o.status)} · Paiement à la livraison</p></div><div className="order-amount"><strong>{money(o.grand_total,o.currency)}</strong><ArrowRight/></div></Link>)}</div>:<EmptyState title="Aucune commande" text="Votre première commande apparaîtra ici." action={<Link className="button primary" to="/catalog">Commencer mes achats</Link>}/>}</main>}
