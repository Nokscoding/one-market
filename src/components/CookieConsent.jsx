import { Cookie, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const STORAGE_KEY = 'om_cookie_consent_v1'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try { setVisible(!localStorage.getItem(STORAGE_KEY)) }
    catch { setVisible(true) }
  }, [])

  function save(choice) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, savedAt: new Date().toISOString() })) } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside className="cookie-consent" role="dialog" aria-label="Préférences de confidentialité">
      <button className="cookie-consent-close" type="button" onClick={() => save('essential')} aria-label="Fermer"><X size={17}/></button>
      <div className="cookie-consent-icon"><Cookie size={21}/></div>
      <div className="cookie-consent-copy">
        <strong>Votre confidentialité compte.</strong>
        <p>One Market utilise le stockage essentiel pour la connexion, le panier et vos préférences. Aucun cookie publicitaire n’est nécessaire pour acheter.</p>
        <Link to="/legal/cookies">En savoir plus sur les cookies</Link>
      </div>
      <div className="cookie-consent-actions">
        <button type="button" className="button secondary" onClick={() => save('essential')}>Essentiels seulement</button>
        <button type="button" className="button primary" onClick={() => save('accepted')}>Accepter</button>
      </div>
    </aside>
  )
}
