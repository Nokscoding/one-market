import { CheckCircle2, ShieldCheck, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LEGAL_VERSION } from '../lib/legal'
import { supabase } from '../lib/supabase'
import Loader from './Loader'
import SellerApplicationForm from './SellerApplicationForm'

export default function SellerApplicationGate({ embedded = false, children = null }) {
  const { user, refreshProfile } = useAuth()
  const [accepted, setAccepted] = useState(false)
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.id) return
    let active = true
    supabase.from('profiles').select('seller_terms_accepted_at').eq('id', user.id).maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!active) return
        if (queryError) setError('Impossible de vérifier les conditions vendeur.')
        setAccepted(Boolean(data?.seller_terms_accepted_at))
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user?.id])

  async function accept() {
    if (!checked || saving) return
    setSaving(true)
    setError('')
    try {
      const { error: rpcError } = await supabase.rpc('accept_seller_terms', { p_legal_version: LEGAL_VERSION })
      if (rpcError) throw rpcError
      setAccepted(true)
      await refreshProfile()
    } catch (acceptError) {
      setError(acceptError?.message || 'Impossible d’enregistrer ton acceptation.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="seller-legal-gate-loading"><Loader /></div>
  if (accepted) return children || <SellerApplicationForm embedded={embedded} />

  return (
    <section className={`seller-legal-gate ${embedded ? 'is-embedded' : ''}`}>
      <div className="seller-legal-gate-icon"><Store size={26}/></div>
      <div className="seller-legal-gate-copy">
        <span className="eyebrow">Avant de vendre</span>
        <h2>{children ? 'Confirme les conditions de ta boutique.' : 'Les règles sont les mêmes pour toutes les boutiques.'}</h2>
        <p>{children ? 'Pour continuer à gérer ta boutique, confirme les règles vendeur de One Market. Cette acceptation est enregistrée dans ton compte.' : 'One Market vérifie l’identité et l’activité des vendeurs. Avant de créer ton dossier, lis et accepte les règles qui protègent les clients, les vendeurs et la marketplace.'}</p>
      </div>

      <div className="seller-legal-summary">
        <div><ShieldCheck size={18}/><span><strong>Identité vérifiée</strong><small>Les documents sensibles restent privés.</small></span></div>
        <div><CheckCircle2 size={18}/><span><strong>Informations exactes</strong><small>Produits, prix et stock doivent refléter la réalité.</small></span></div>
        <div><Store size={18}/><span><strong>Règles marketplace</strong><small>Les produits interdits, contrefaits ou trompeurs sont refusés.</small></span></div>
      </div>

      <label className="seller-legal-check">
        <input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)}/>
        <span>J’accepte les <Link to="/legal/vendeurs" target="_blank">Conditions vendeur</Link>, les <Link to="/legal/conditions" target="_blank">Conditions d’utilisation</Link> et la <Link to="/legal/confidentialite" target="_blank">Politique de confidentialité</Link>.</span>
      </label>

      {error && <div className="seller-application-message">{error}</div>}
      <button className="button primary seller-legal-continue" type="button" disabled={!checked || saving} onClick={accept}>{saving ? 'Enregistrement…' : 'Accepter et continuer'}</button>
    </section>
  )
}
