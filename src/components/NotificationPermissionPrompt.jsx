import { BellRing, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

const DISMISS_KEY = 'om_notifications_prompt_dismissed_at'
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000

export default function NotificationPermissionPrompt() {
  const { user } = useAuth()
  const [visible, setVisible] = useState(false)
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    if (!user || typeof window === 'undefined' || !('Notification' in window)) return undefined
    if (window.Notification.permission !== 'default') return undefined
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || 0)
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_MS) return undefined
    const timer = window.setTimeout(() => setVisible(true), 5000)
    return () => window.clearTimeout(timer)
  }, [user])

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  async function enable() {
    if (!('Notification' in window)) return
    setRequesting(true)
    try {
      const permission = await window.Notification.requestPermission()
      if (permission !== 'default') window.localStorage.removeItem(DISMISS_KEY)
      setVisible(false)
    } finally {
      setRequesting(false)
    }
  }

  if (!visible) return null

  return (
    <aside className="notification-permission-card" role="dialog" aria-label="Activer les notifications">
      <button type="button" className="notification-permission-close" onClick={dismiss} aria-label="Fermer"><X size={17}/></button>
      <span className="notification-permission-icon"><BellRing size={24}/></span>
      <div><strong>Activer les notifications ?</strong><p>Recevez les mises à jour importantes concernant vos commandes, votre boutique et vos messages.</p></div>
      <div className="notification-permission-actions"><button type="button" className="button primary" onClick={enable} disabled={requesting}>{requesting ? 'Activation…' : 'Activer'}</button><button type="button" className="button secondary" onClick={dismiss}>Plus tard</button></div>
    </aside>
  )
}
