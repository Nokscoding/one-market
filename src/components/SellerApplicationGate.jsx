import { BadgePercent, CheckCircle2, ShieldCheck, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LEGAL_VERSION } from '../lib/legal'
import { supabase } from '../lib/supabase'
import { logTechnicalError, userError } from '../lib/userErrors'
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
    if (!user?.id) return undefined
    let active = true
    supabase.from('profiles').select('seller_terms_accepted_at').eq('id', user.id).maybeSingle()
      .then(({ data, error: queryError }) => {
        if (!active) return
        if (queryError) {
          logTechnicalError('seller-terms-check', queryError)
          setError(userError(queryError, 'seller'))
        }
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
      logTechnicalError('seller-terms-accept', acceptError)
      setError(userError(acceptError, 'seller_application'))
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
        <h2>{children ? 'Confirmez les conditions de votre boutique.' : 'Des règles claires avant l’ouverture de votre boutique.'}</h2>
        <p>{children ? 'Pour continuer à gérer votre boutique, confirmez les règles vendeur de One Market. Cette acceptation est enregistrée dans votre compte.' : 'One Market vérifie l’identité et l’activité de chaque vendeur avant l’activation de sa boutique.'}</p>
      </div>

      <div className="seller-legal-summary">
        <div><ShieldCheck size={18}/><span><strong>Identité vérifiée</strong><small>Les documents sensibles restent privés et servent uniquement à la vérification.</small></span></div>
        <div><CheckCircle2 size={18}/><span><strong>Informations exactes</strong><small>Produits, prix et stock doivent refléter la réalité.</small></span></div>
        <div><BadgePercent size={18}/><span><strong>Commission générale : 30 %</strong><small>One Market applique par défaut 30 % sur le montant des produits vendus. Un taux spécifique peut être convenu pour votre boutique. Les frais de livraison ne sont pas inclus automatiquement dans cette commission.</small></span></div>
      </div>

      <label className="seller-legal-check">
        <input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)}/>
        <span>J’ai lu et j’accepte les <Link to="/legal/vendeurs" target="_blank">Conditions vendeur</Link>, notamment la politique de commission One Market de 30 % par défaut, ainsi que les <Link to="/legal/conditions" target="_blank">Conditions d’utilisation</Link> et la <Link to="/legal/confidentialite" target="_blank">Politique de confidentialité</Link>.</span>
      </label>

      {error && <div className="seller-application-message" role="alert">{error}</div>}
      <button className="button primary seller-legal-continue" type="button" disabled={!checked || saving} onClick={accept}>{saving ? 'Enregistrement…' : 'Accepter et continuer'}</button>
    </section>
  )
}