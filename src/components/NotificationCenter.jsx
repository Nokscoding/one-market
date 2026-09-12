import { Bell, CheckCheck, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useNotifications } from '../context/NotificationsContext'

function formatNotificationDate(value) {
  if (!value) return ''
  try { return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
  catch { return '' }
}

export default function NotificationCenter() {
  const { items, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)

  async function openNotification(item) {
    if (!item.is_read) await markRead(item.id)
    setOpen(false)
  }

  return (
    <div className="notification-center">
      <button className="notification-bell" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label="Notifications">
        <Bell size={22}/>
        {unreadCount > 0 && <b>{unreadCount > 99 ? '99+' : unreadCount}</b>}
      </button>

      {open && <div className="notification-popover">
        <div className="notification-popover-head">
          <div><strong>Notifications</strong><span>{unreadCount ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Tout est à jour'}</span></div>
          {unreadCount > 0 && <button type="button" onClick={markAllRead}><CheckCheck size={16}/> Tout lire</button>}
        </div>
        <div className="notification-popover-list">
          {items.slice(0, 8).map(item => item.link ? (
            <Link key={item.id} to={item.link} className={`notification-item ${item.is_read ? '' : 'is-unread'}`} onClick={() => openNotification(item)}>
              <span className="notification-item-dot"/>
              <div><strong>{item.title}</strong><p>{item.body}</p><small>{formatNotificationDate(item.created_at)}</small></div>
              <ExternalLink size={14}/>
            </Link>
          ) : (
            <button key={item.id} type="button" className={`notification-item ${item.is_read ? '' : 'is-unread'}`} onClick={() => openNotification(item)}>
              <span className="notification-item-dot"/>
              <div><strong>{item.title}</strong><p>{item.body}</p><small>{formatNotificationDate(item.created_at)}</small></div>
            </button>
          ))}
          {!items.length && <div className="notification-empty"><Bell size={22}/><strong>Aucune notification</strong><span>Les mises à jour importantes apparaîtront ici.</span></div>}
        </div>
        <Link className="notification-all-link" to="/account?tab=notifications" onClick={() => setOpen(false)}>Voir toutes les notifications</Link>
      </div>}
    </div>
  )
}
