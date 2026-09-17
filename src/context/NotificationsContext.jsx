import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logTechnicalError, userError } from '../lib/userErrors'
import { useAuth } from './AuthContext'

const NotificationsContext = createContext(null)

function showBrowserNotification(notification) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (window.Notification.permission !== 'granted') return
  try {
    const popup = new window.Notification(notification.title || 'One Market', {
      body: notification.body || '',
      icon: '/favicon.ico',
      tag: notification.id || undefined,
    })
    popup.onclick = () => {
      window.focus()
      if (notification.link) window.location.assign(notification.link)
      popup.close()
    }
  } catch (error) {
    logTechnicalError('browser-notification', error)
  }
}

export function NotificationsProvider({ children }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadNotifications = useCallback(async () => {
    if (!user?.id) {
      setItems([])
      setError('')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await supabase
        .from('notifications')
        .select('id,user_id,type,title,body,link,is_read,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (result.error) throw result.error
      setItems(result.data || [])
    } catch (loadError) {
      logTechnicalError('notifications-load', loadError)
      setItems([])
      setError(userError(loadError, 'notifications'))
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    if (!user?.id) return undefined
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, payload => {
        const notification = payload.new
        setItems(current => current.some(item => item.id === notification.id) ? current : [notification, ...current].slice(0, 50))
        showBrowserNotification(notification)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, payload => {
        setItems(current => current.map(item => item.id === payload.new.id ? payload.new : item))
      })
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') logTechnicalError('notifications-realtime', new Error(status))
      })
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  const markRead = useCallback(async id => {
    if (!user?.id) return false
    try {
      const result = await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', user.id)
      if (result.error) throw result.error
      setItems(current => current.map(item => item.id === id ? { ...item, is_read: true } : item))
      return true
    } catch (markError) {
      logTechnicalError('notifications-mark-read', markError)
      setError(userError(markError, 'notifications'))
      return false
    }
  }, [user?.id])

  const markAllRead = useCallback(async () => {
    if (!user?.id) return false
    try {
      const result = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
      if (result.error) throw result.error
      setItems(current => current.map(item => ({ ...item, is_read: true })))
      return true
    } catch (markError) {
      logTechnicalError('notifications-mark-all', markError)
      setError(userError(markError, 'notifications'))
      return false
    }
  }, [user?.id])

  const unreadCount = useMemo(() => items.filter(item => !item.is_read).length, [items])
  const value = useMemo(() => ({ items, loading, error, unreadCount, loadNotifications, markRead, markAllRead }), [items, loading, error, unreadCount, loadNotifications, markRead, markAllRead])

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications() {
  return useContext(NotificationsContext)
}
