import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import SmartImage from '../components/SmartImage'
import StoreTrustBadge from '../components/StoreTrustBadge'
import { supabase } from '../lib/supabase'
import { logTechnicalError, userError } from '../lib/userErrors'

export default function Stores() {
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    ;(async () => {
      const { data, error: queryError } = await supabase
        .from('stores')
        .select('id,name,slug,description,logo_url,banner_url,country_code,city,currency,status,primary_category_id,is_verified,is_partner,created_at')
        .eq('status', 'active')
        .eq('country_code', 'CD')
        .order('name')
      if (queryError) throw queryError
      if (active) setStores(data || [])
    })().catch(loadError => {
      logTechnicalError('stores-directory', loadError)
      if (active) {
        setStores([])
        setError(userError(loadError, 'generic'))
      }
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [retryKey])

  if (loading) return <Loader fullscreen />
  if (error) return <main className="section-shell page-space"><EmptyState title="Impossible de charger les boutiques" text={error} action={<button className="button primary" type="button" onClick={() => setRetryKey(value => value + 1)}>Réessayer</button>}/></main>

  return (
    <main className="section-shell page-space">
      <div className="page-title">
        <span className="eyebrow">One Market</span>
        <h1>Boutiques</h1>
        <p>Découvrez les boutiques disponibles sur One Market en RDC.</p>
      </div>
      {stores.length ? (
        <div className="store-directory">
          {stores.map((store, storeIndex) => (
            <Link to={`/store/${store.slug}`} className="store-directory-card" key={store.id}>
              <div className="store-cover"><SmartImage src={store.banner_url} alt={store.name} className="store-banner-smart" fit="cover" width={500} sizes="(max-width: 760px) 94vw, (max-width: 1100px) 46vw, 380px" loading={storeIndex < 2 ? 'eager' : 'lazy'}/></div>
              <div className="store-directory-info">
                <SmartImage src={store.logo_url} alt={store.name} className="store-logo-smart" fit="contain" width={90} sizes="64px"/>
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
