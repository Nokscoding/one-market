import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

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
  } catch {}
}

export function NotificationsProvider({ children }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const loadNotifications = useCallback(async () => {
    if (!user?.id) {
      setItems([])
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setItems(data || [])
    setLoading(false)
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
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  const markRead = useCallback(async id => {
    if (!user?.id) return
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', user.id)
    if (!error) setItems(current => current.map(item => item.id === id ? { ...item, is_read: true } : item))
  }, [user?.id])

  const markAllRead = useCallback(async () => {
    if (!user?.id) return
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
    if (!error) setItems(current => current.map(item => ({ ...item, is_read: true })))
  }, [user?.id])

  const unreadCount = useMemo(() => items.filter(item => !item.is_read).length, [items])
  const value = useMemo(() => ({ items, loading, unreadCount, loadNotifications, markRead, markAllRead }), [items, loading, unreadCount, loadNotifications, markRead, markAllRead])

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications() {
  return useContext(NotificationsContext)
}
