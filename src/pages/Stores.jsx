import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import SmartImage from '../components/SmartImage'
import StoreTrustBadge from '../components/StoreTrustBadge'
import { supabase } from '../lib/supabase'

export default function Stores() {
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase
      .from('stores')
      .select('*')
      .eq('status', 'active')
      .eq('country_code', 'CD')
      .order('name')
      .then(({ data }) => {
        if (active) {
          setStores(data || [])
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setStores([])
          setLoading(false)
        }
      })
    return () => { active = false }
  }, [])

  if (loading) return <Loader fullscreen />

  return (
    <main className="section-shell page-space">
      <div className="page-title">
        <span className="eyebrow">One Market</span>
        <h1>Boutiques</h1>
        <p>Découvrez les boutiques disponibles sur One Market en RDC.</p>
      </div>
      {stores.length ? (
        <div className="store-directory">
          {stores.map(store => (
            <Link to={`/store/${store.slug}`} className="store-directory-card" key={store.id}>
              <div className="store-cover"><SmartImage src={store.banner_url} alt={store.name} fallback="OM" className="store-banner-smart" fit="cover"/></div>
              <div className="store-directory-info">
                <SmartImage src={store.logo_url} alt={store.name} fallback={store.name.slice(0,2).toUpperCase()} className="store-logo-smart" fit="contain"/>
                <div><div className="store-directory-name"><h3>{store.name}</h3><StoreTrustBadge store={store} compact/></div><p>RDC{store.city ? ` · ${store.city}` : ''}</p></div>
                <ArrowRight size={19}/>
              </div>
            </Link>
          ))}
        </div>
      ) : <EmptyState title="Aucune boutique disponible" text="Les boutiques disponibles en RDC apparaîtront ici."/>}
    </main>
  )
}
