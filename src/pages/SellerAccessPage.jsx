import { AlertCircle, BarChart3, CheckCircle2, ClipboardList, ShoppingBag } from 'lucide-react'
import { useEffect, useState } from 'react'
import Loader from '../components/Loader'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import SellerPage from './SellerPage'

const SELLER_ROLES = new Set(['seller', 'admin', 'global_admin'])
const EMPTY_APPLICATION = { business_name: '', phone: '', city: 'Lubumbashi', description: '' }
const LOAD_TIMEOUT_MS = 7000

function withTimeout(promise, ms = LOAD_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => window.setTimeout(() => reject(new Error('Le chargement vendeur a pris trop de temps. Réessaie.')), ms)),
  ])
}

export default function SellerAccessPage() {
  const { user, profile, profileLoading } = useAuth()
  const isSeller = SELLER_ROLES.has(profile?.role)
  const [application, setApplication] = useState(null)
  const [form, setForm] = useState(EMPTY_APPLICATION)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user?.id || profileLoading) return undefined
    if (isSeller) {
      setLoading(false)
      return undefined
    }

    let active = true
    setLoading(true)
    setMessage('')

    withTimeout(
      supabase
        .from('seller_applications')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
    )
      .then(({ data, error }) => {
        if (!active) return
        if (error) throw error
        setApplication(data || null)
        setForm(current => ({ ...current, phone: profile?.phone || current.phone }))
      })
      .catch(error => {
        if (active) setMessage(error?.message || 'Impossible de charger la demande vendeur.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [user?.id, profileLoading, profile?.role, profile?.phone, isSeller])

  async function submit(event) {
    event.preventDefault()
    if (!user?.id || saving) return
    setSaving(true)
    setMessage('')

    const payload = {
      user_id: user.id,
      business_name: form.business_name.trim(),
      phone: form.phone.trim() || null,
      city: form.city.trim() || 'Lubumbashi',
      description: form.description.trim() || null,
    }

    if (!payload.business_name) {
      setMessage('Indique le nom de ta boutique ou activité.')
      setSaving(false)
      return
    }

    try {
      const { data, error } = await withTimeout(
        supabase.from('seller_applications').insert(payload).select('*').single(),
      )
      if (error) throw error
      setApplication(data)
      setMessage('Demande envoyée. Elle doit maintenant être approuvée par One Market.')
    } catch (error) {
      setMessage(error?.message || 'Impossible d’envoyer la demande vendeur.')
    } finally {
      setSaving(false)
    }
  }

  if (profileLoading || loading) return <Loader fullscreen />
  if (!user) return null
  if (isSeller) return <SellerPage />

  return (
    <main className="section-shell seller-join-page">
      <section className="seller-join-hero">
        <div>
          <span className="eyebrow">Vendre sur One Market</span>
          <h1>Ouvre ta boutique sur One Market.</h1>
          <p>Publie tes produits, gère ton stock et reçois les commandes depuis un seul espace vendeur.</p>
        </div>
        <div className="seller-join-points">
          <div><ShoppingBag size={21}/><span><strong>Catalogue vendeur</strong><small>Produits, prix et stock.</small></span></div>
          <div><ClipboardList size={21}/><span><strong>Commandes</strong><small>Suivi de chaque commande reçue.</small></span></div>
          <div><BarChart3 size={21}/><span><strong>Statistiques</strong><small>Activité et ventes de la boutique.</small></span></div>
        </div>
      </section>

      <section className="seller-join-card">
        {application ? (
          <div className={`seller-application-status status-${application.status}`}>
            {application.status === 'pending' ? <AlertCircle size={26}/> : <CheckCircle2 size={26}/>} 
            <div>
              <span>Demande vendeur</span>
              <h2>{application.business_name}</h2>
              <p>{application.status === 'pending' ? 'Ta demande est en attente de validation par One Market.' : application.status === 'approved' ? 'Ta demande a été approuvée. Ton accès vendeur sera activé.' : 'Ta demande n’a pas été approuvée pour le moment.'}</p>
              {application.admin_note && <small>{application.admin_note}</small>}
              {message && <div className="seller-feedback">{message}</div>}
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="seller-join-form">
            <div><span className="eyebrow">Demande vendeur</span><h2>Parle-nous de ta boutique</h2></div>
            <label>Nom de la boutique ou activité<input required value={form.business_name} onChange={event => setForm({ ...form, business_name: event.target.value })} placeholder="Ex. Noks Fashion"/></label>
            <div className="seller-form-row">
              <label>Téléphone<input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="+243…"/></label>
              <label>Ville<input value={form.city} onChange={event => setForm({ ...form, city: event.target.value })}/></label>
            </div>
            <label>Que veux-tu vendre ?<textarea rows={4} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Décris rapidement les produits que tu veux proposer."/></label>
            {message && <div className="seller-feedback">{message}</div>}
            <button className="button primary" disabled={saving}>{saving ? 'Envoi…' : 'Envoyer ma demande'}</button>
          </form>
        )}
      </section>
    </main>
  )
}
