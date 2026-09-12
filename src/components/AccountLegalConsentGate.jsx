import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LEGAL_VERSION } from '../lib/legal'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function AccountLegalConsentGate() {
  const { refreshProfile } = useAuth()
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function accept() {
    if (!checked || saving) return
    setSaving(true)
    setError('')
    try {
      const { error: rpcError } = await supabase.rpc('accept_legal_terms', { p_legal_version: LEGAL_VERSION })
      if (rpcError) throw rpcError
      await refreshProfile()
    } catch (acceptError) {
      setError(acceptError?.message || 'Impossible d’enregistrer ton acceptation.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="account-legal-gate-page">
      <section className="account-legal-gate-card">
        <div className="account-legal-gate-icon"><ShieldCheck size={28}/></div>
        <span className="eyebrow">Compte One Market</span>
        <h1>Confirme les règles de One Market.</h1>
        <p>Avant d’utiliser ton espace personnel, confirme que tu acceptes les conditions qui encadrent ton compte et la protection de tes données.</p>

        <label className="legal-consent-check account-legal-gate-check">
          <input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)}/>
          <span>J’accepte les <Link to="/legal/conditions" target="_blank">Conditions d’utilisation</Link> et j’ai lu la <Link to="/legal/confidentialite" target="_blank">Politique de confidentialité</Link>.</span>
        </label>

        {error && <div className="alert error">{error}</div>}
        <button className="button primary full" type="button" disabled={!checked || saving} onClick={accept}>{saving ? 'Enregistrement…' : 'Accepter et continuer'}</button>
      </section>
    </main>
  )
}
