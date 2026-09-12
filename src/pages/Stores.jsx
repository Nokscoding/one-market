import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Loader from '../components/Loader'
import { supabase } from '../lib/supabase'

export default function Stores() {
  const [stores, setStores] = useState([]); const [loading, setLoading] = useState(true)
  useEffect(() => { supabase.from('stores').select('*').eq('status', 'active').order('name').then(({ data }) => { setStores(data || []); setLoading(false) }) }, [])
  if (loading) return <Loader fullscreen />
  return <main className="section-shell page-space"><div className="page-title"><span className="eyebrow">OneMarket</span><h1>Boutiques</h1><p>Une sélection privée de vendeurs approuvés.</p></div><div className="store-directory">{stores.map(store => <Link to={`/store/${store.slug}`} className="store-directory-card" key={store.id}><div className="store-cover">{store.banner_url ? <img src={store.banner_url} alt="" /> : <div className="store-cover-mark" />}</div><div className="store-directory-info">{store.logo_url ? <img className="store-logo" src={store.logo_url} alt="" /> : <div className="store-logo fallback">{store.name.slice(0,2).toUpperCase()}</div>}<div><h3>{store.name}</h3><p>{store.country_code === 'US' ? 'États-Unis' : 'RDC'}{store.city ? ` · ${store.city}` : ''}</p></div><ArrowRight size={19} /></div></Link>)}</div></main>
}
