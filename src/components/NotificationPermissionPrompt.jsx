import { BellRing, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { ensurePushSubscription } from '../lib/push'
import { supabase } from '../lib/supabase'

const DISMISS_KEY = 'om_notifications_prompt_dismissed_at'
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000

export default function NotificationPermissionPrompt() {
  const { user } = useAuth()
  const [visible, setVisible] = useState(false)
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined' || !('Notification' in window)) return undefined

    if (window.Notification.permission === 'granted') {
      ensurePushSubscription({ supabase, userId: user.id, app: 'market' }).catch(() => {})
      return undefined
    }
    if (window.Notification.permission === 'denied') return undefined

    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || 0)
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_MS) return undefined
    const timer = window.setTimeout(() => setVisible(true), 5000)
    return () => window.clearTimeout(timer)
  }, [user?.id])

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  async function enable() {
    if (!user?.id) return
    setRequesting(true)
    try {
      await ensurePushSubscription({ supabase, userId: user.id, app: 'market' })
      window.localStorage.removeItem(DISMISS_KEY)
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
      <div><strong>Activer les notifications ?</strong><p>Recevez les mises à jour importantes concernant vos commandes, votre boutique, vos messages et votre compte, même lorsque l’onglet n’est pas au premier plan.</p></div>
      <div className="notification-permission-actions"><button type="button" className="button primary" onClick={enable} disabled={requesting}>{requesting ? 'Activation…' : 'Activer'}</button><button type="button" className="button secondary" onClick={dismiss}>Plus tard</button></div>
    </aside>
  )
}
