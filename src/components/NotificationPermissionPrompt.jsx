import { BellRing, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { ensurePushSubscription, getPushEnvironment, preparePushSupport, showPushReadyNotification } from '../lib/push'
import { supabase } from '../lib/supabase'

const DISMISS_KEY = 'om_notifications_prompt_dismissed_at'
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000

export default function NotificationPermissionPrompt() {
  const { user } = useAuth()
  const [visible, setVisible] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return undefined

    preparePushSupport().catch(() => {})
    const environment = getPushEnvironment()

    if (environment.requiresInstall) {
      const timer = window.setTimeout(() => {
        setMessage('Sur iPhone/iPad, ajoutez d’abord One Market à l’écran d’accueil avec Partager → Sur l’écran d’accueil. Ouvrez ensuite One Market depuis l’icône installée puis appuyez sur Activer.')
        setVisible(true)
      }, 2200)
      return () => window.clearTimeout(timer)
    }

    if (!environment.supported) {
      const timer = window.setTimeout(() => {
        setMessage('Ce navigateur ne permet pas les notifications push. Utilisez un navigateur récent ou installez One Market comme application sur iPhone.')
        setVisible(true)
      }, 2200)
      return () => window.clearTimeout(timer)
    }

    if (environment.permission === 'granted') {
      ensurePushSubscription({ supabase, userId: user.id, app: 'market' }).catch(() => {})
      return undefined
    }

    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || 0)
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_MS) return undefined

    const timer = window.setTimeout(() => {
      if (environment.permission === 'denied') {
        setMessage('Les notifications sont actuellement bloquées. Réactivez-les dans les autorisations du site ou de l’application puis revenez ici.')
      }
      setVisible(true)
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [user?.id])

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  async function enable() {
    if (!user?.id || requesting) return

    const environment = getPushEnvironment()
    if (environment.requiresInstall) {
      setMessage('Sur iPhone/iPad : Partager → Sur l’écran d’accueil → Ajouter. Ouvrez ensuite One Market depuis l’icône installée et appuyez à nouveau sur Activer.')
      return
    }
    if (!environment.supported) {
      setMessage('Les notifications push ne sont pas disponibles dans ce navigateur.')
      return
    }

    setRequesting(true)
    setMessage('')
    try {
      const enabled = await ensurePushSubscription({ supabase, userId: user.id, app: 'market' })
      if (enabled) {
        window.localStorage.removeItem(DISMISS_KEY)
        await showPushReadyNotification({
          title: 'Notifications One Market activées',
          body: 'Commandes, messages, boutique et modération pourront maintenant vous prévenir sur cet appareil.',
          link: window.location.pathname + window.location.search,
        }).catch(() => {})
        setMessage('Notifications activées. Une notification test vient d’être envoyée sur cet appareil.')
        window.setTimeout(() => setVisible(false), 2200)
        return
      }

      if (window.Notification?.permission === 'denied') {
        setMessage('Les notifications sont bloquées. Autorisez-les dans les paramètres du site ou de l’application puis réessayez.')
      } else {
        setMessage('L’autorisation système n’a pas été accordée. Appuyez à nouveau sur Activer si vous souhaitez recevoir les notifications.')
      }
    } catch (activationError) {
      const raw = String(activationError?.message || '')
      if (raw.includes('PUSH_IOS_INSTALL_REQUIRED')) {
        setMessage('Sur iPhone/iPad, installez d’abord One Market sur l’écran d’accueil puis ouvrez l’application installée.')
      } else if (raw.includes('PUSH_UNSUPPORTED')) {
        setMessage('Ce navigateur ne prend pas en charge les notifications push.')
      } else if (raw.includes('PUSH_CONFIG_MISSING')) {
        setMessage('La configuration des notifications One Market est momentanément indisponible.')
      } else if (raw.toLowerCase().includes('permission')) {
        setMessage('Le navigateur a bloqué la demande. Vérifiez les autorisations du site puis réessayez.')
      } else {
        setMessage('Impossible d’activer les notifications pour le moment. Réessayez dans quelques instants.')
      }
    } finally {
      setRequesting(false)
    }
  }

  if (!visible) return null

  return (
    <aside className="notification-permission-card" role="dialog" aria-label="Activer les notifications">
      <button type="button" className="notification-permission-close" onClick={dismiss} aria-label="Fermer"><X size={17}/></button>
      <span className="notification-permission-icon"><BellRing size={24}/></span>
      <div><strong>Activer les notifications ?</strong><p>Recevez les mises à jour concernant vos commandes, vos messages et votre compte. Les vendeurs reçoivent aussi les nouvelles commandes et les messages de modération.</p></div>
      {message && <div className="notification-permission-message" role="status">{message}</div>}
      <div className="notification-permission-actions"><button type="button" className="button primary" onClick={enable} disabled={requesting}>{requesting ? 'Activation…' : 'Activer'}</button><button type="button" className="button secondary" onClick={dismiss}>Plus tard</button></div>
    </aside>
  )
}
