import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Heart,
  Home,
  KeyRound,
  LogOut,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Loader from '../components/Loader'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import { money } from '../lib/format'
import { supabase } from '../lib/supabase'

const EMPTY_ADDRESS = {
  label: 'Domicile',
  full_name: '',
  phone: '',
  address_line1: '',
  address_line2: '',
  district: '',
  city: 'Lubumbashi',
  state_region: 'Haut-Katanga',
  instructions: '',
  is_default: false,
}

function statusLabel(status) {
  const labels = {
    pending_confirmation: 'À confirmer',
    confirmed: 'Confirmée',
    preparing: 'En préparation',
    ready: 'Prête',
    out_for_delivery: 'En livraison',
    delivered: 'Livrée',
    cancelled: 'Annulée',
    failed: 'Échouée',
  }
  return labels[status] || status || 'En attente'
}

function formatDate(value) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
  } catch {
    return ''
  }
}

export default function AccountPage() {
  const { user, profile, profileLoading, profileError, refreshProfile } = useAuth()
  const { favorites } = useFavorites()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'overview'

  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '' })
  const [orders, setOrders] = useState([])
  const [addresses, setAddresses] = useState([])
  const [notifications, setNotifications] = useState([])
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [addressForm, setAddressForm] = useState(EMPTY_ADDRESS)
  const [addressOpen, setAddressOpen] = useState(false)
  const [savingAddress, setSavingAddress] = useState(false)
  const [addressMessage, setAddressMessage] = useState('')
  const [securityForm, setSecurityForm] = useState({ password: '', confirm: '' })
  const [securityMessage, setSecurityMessage] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    if (!profile) return
    setProfileForm({ full_name: profile.full_name || '', phone: profile.phone || '' })
    setAddressForm(form => ({
      ...form,
      full_name: form.full_name || profile.full_name || '',
      phone: form.phone || profile.phone || '',
    }))
  }, [profile])

  useEffect(() => {
    if (!user?.id) return undefined
    let active = true
    setDashboardLoading(true)

    Promise.all([
      supabase.from('orders').select('id,order_number,status,grand_total,currency,created_at').eq('customer_id', user.id).order('created_at', { ascending: false }).limit(8),
      supabase.from('addresses').select('*').eq('customer_id', user.id).order('is_default', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
    ])
      .then(([orderResult, addressResult, notificationResult]) => {
        if (!active) return
        setOrders(orderResult.data || [])
        setAddresses(addressResult.data || [])
        setNotifications(notificationResult.data || [])
      })
      .catch(() => {
        if (!active) return
        setOrders([])
        setAddresses([])
        setNotifications([])
      })
      .finally(() => {
        if (active) setDashboardLoading(false)
      })

    return () => { active = false }
  }, [user?.id])

  const unreadCount = useMemo(() => notifications.filter(item => !item.is_read).length, [notifications])
  const deliveredCount = useMemo(() => orders.filter(item => item.status === 'delivered').length, [orders])
  const initials = (profile?.full_name || user?.email || 'OM')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()

  function changeTab(nextTab) {
    const next = new URLSearchParams(params)
    if (nextTab === 'overview') next.delete('tab')
    else next.set('tab', nextTab)
    setParams(next)
  }

  async function saveProfile(event) {
    event.preventDefault()
    setSavingProfile(true)
    setProfileMessage('')

    const payload = {
      full_name: profileForm.full_name.trim() || null,
      phone: profileForm.phone.trim() || null,
    }
    const { error } = await supabase.from('profiles').update(payload).eq('id', user.id)

    if (error) setProfileMessage(error.message || 'Impossible de mettre à jour le profil.')
    else {
      await refreshProfile()
      setProfileMessage('Vos informations ont été mises à jour.')
    }
    setSavingProfile(false)
  }

  async function saveAddress(event) {
    event.preventDefault()
    if (!user?.id || savingAddress) return
    setSavingAddress(true)
    setAddressMessage('')

    const payload = {
      customer_id: user.id,
      label: addressForm.label.trim() || 'Domicile',
      full_name: addressForm.full_name.trim(),
      phone: addressForm.phone.trim(),
      country_code: 'CD',
      address_line1: addressForm.address_line1.trim(),
      address_line2: addressForm.address_line2.trim() || null,
      district: addressForm.district.trim() || null,
      city: addressForm.city.trim(),
      state_region: addressForm.state_region.trim() || null,
      instructions: addressForm.instructions.trim() || null,
      is_default: Boolean(addressForm.is_default),
    }

    if (!payload.full_name || !payload.phone || !payload.address_line1 || !payload.city) {
      setAddressMessage('Complétez le nom, le téléphone, l’adresse et la ville.')
      setSavingAddress(false)
      return
    }

    if (payload.is_default) {
      await supabase.from('addresses').update({ is_default: false }).eq('customer_id', user.id)
    }

    const { data, error } = await supabase.from('addresses').insert(payload).select('*').single()
    if (error) setAddressMessage(error.message || 'Impossible d’enregistrer cette adresse.')
    else {
      setAddresses(current => [data, ...current.map(item => payload.is_default ? { ...item, is_default: false } : item)])
      setAddressForm({ ...EMPTY_ADDRESS, full_name: profile?.full_name || '', phone: profile?.phone || '' })
      setAddressOpen(false)
      setAddressMessage('Adresse enregistrée.')
    }
    setSavingAddress(false)
  }

  async function deleteAddress(addressId) {
    const { error } = await supabase.from('addresses').delete().eq('id', addressId).eq('customer_id', user.id)
    if (!error) setAddresses(current => current.filter(item => item.id !== addressId))
  }

  async function markAllNotificationsRead() {
    if (!user?.id || !unreadCount) return
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
    if (!error) setNotifications(current => current.map(item => ({ ...item, is_read: true })))
  }

  async function changePassword(event) {
    event.preventDefault()
    setSecurityMessage('')
    if (securityForm.password.length < 8) return setSecurityMessage('Utilisez au moins 8 caractères.')
    if (securityForm.password !== securityForm.confirm) return setSecurityMessage('Les deux mots de passe ne correspondent pas.')

    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: securityForm.password })
    if (error) setSecurityMessage(error.message || 'Impossible de modifier le mot de passe.')
    else {
      setSecurityForm({ password: '', confirm: '' })
      setSecurityMessage('Mot de passe mis à jour.')
    }
    setSavingPassword(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (profileLoading) return <Loader fullscreen />
  if (!profile) {
    return (
      <main className="section-shell page-space">
        <div className="account-card profile-load-error">
          <h2>Profil indisponible</h2>
          <p>{profileError || 'Le profil One Market n’a pas pu être chargé pour le moment.'}</p>
          <button className="button primary" type="button" onClick={refreshProfile}><RefreshCw size={17} /> Réessayer</button>
        </div>
      </main>
    )
  }

  return (
    <main className="section-shell client-account-page">
      <section className="client-account-hero">
        <div className="client-avatar">{initials}</div>
        <div className="client-account-hero-copy">
          <span className="eyebrow">Espace client One Market</span>
          <h1>Bonjour{profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
          <p>{user.email}</p>
        </div>
        <div className="client-account-hero-badge"><ShieldCheck size={17} /><span>Compte sécurisé</span></div>
      </section>

      <div className="client-account-layout">
        <aside className="client-account-sidebar">
          <button className={tab === 'overview' ? 'active' : ''} onClick={() => changeTab('overview')}><Home size={18} /><span>Vue d’ensemble</span></button>
          <button className={tab === 'profile' ? 'active' : ''} onClick={() => changeTab('profile')}><UserRound size={18} /><span>Mon profil</span></button>
          <button className={tab === 'addresses' ? 'active' : ''} onClick={() => changeTab('addresses')}><MapPin size={18} /><span>Mes adresses</span><em>{addresses.length}</em></button>
          <Link to="/orders"><Package size={18} /><span>Mes commandes</span><em>{orders.length}</em></Link>
          <Link to="/favorites"><Heart size={18} /><span>Mes favoris</span><em>{favorites.size}</em></Link>
          <button className={tab === 'notifications' ? 'active' : ''} onClick={() => changeTab('notifications')}><Bell size={18} /><span>Notifications</span>{unreadCount > 0 && <em className="is-alert">{unreadCount}</em>}</button>
          <button className={tab === 'security' ? 'active' : ''} onClick={() => changeTab('security')}><KeyRound size={18} /><span>Sécurité</span></button>
          <button className="client-account-logout" onClick={logout}><LogOut size={18} /><span>Se déconnecter</span></button>
        </aside>

        <section className="client-account-content">
          {dashboardLoading && <div className="client-account-inline-loader"><Loader /></div>}

          {!dashboardLoading && tab === 'overview' && (
            <>
              <div className="client-section-heading">
                <div><span>Tableau de bord</span><h2>Votre activité One Market</h2></div>
              </div>

              <div className="client-stat-grid">
                <Link to="/orders" className="client-stat-card"><Package size={22} /><div><strong>{orders.length}</strong><span>Commandes récentes</span></div><ChevronRight size={18} /></Link>
                <Link to="/favorites" className="client-stat-card"><Heart size={22} /><div><strong>{favorites.size}</strong><span>Produits favoris</span></div><ChevronRight size={18} /></Link>
                <button className="client-stat-card" onClick={() => changeTab('addresses')}><MapPin size={22} /><div><strong>{addresses.length}</strong><span>Adresses enregistrées</span></div><ChevronRight size={18} /></button>
                <button className="client-stat-card" onClick={() => changeTab('notifications')}><Bell size={22} /><div><strong>{unreadCount}</strong><span>Notifications non lues</span></div><ChevronRight size={18} /></button>
              </div>

              <div className="client-dashboard-grid">
                <section className="client-panel">
                  <div className="client-panel-head"><div><h3>Commandes récentes</h3><p>{deliveredCount} déjà livrée{deliveredCount > 1 ? 's' : ''}</p></div><Link to="/orders">Voir tout</Link></div>
                  <div className="client-order-list">
                    {orders.slice(0, 4).map(order => (
                      <Link to={`/orders/${order.id}`} className="client-order-row" key={order.id}>
                        <span className="client-order-icon"><Package size={18} /></span>
                        <div><strong>{order.order_number}</strong><small>{formatDate(order.created_at)}</small></div>
                        <span className={`client-order-status status-${order.status}`}>{statusLabel(order.status)}</span>
                        <b>{money(order.grand_total, order.currency)}</b>
                        <ChevronRight size={17} />
                      </Link>
                    ))}
                    {!orders.length && <div className="client-empty-panel"><Package size={24} /><strong>Aucune commande</strong><span>Vos prochaines commandes apparaîtront ici.</span><Link to="/catalog">Découvrir les produits</Link></div>}
                  </div>
                </section>

                <section className="client-panel client-account-summary">
                  <div className="client-panel-head"><div><h3>Mon compte</h3><p>Informations principales</p></div><button onClick={() => changeTab('profile')}>Modifier</button></div>
                  <div className="client-summary-profile"><div className="client-summary-avatar">{initials}</div><div><strong>{profile.full_name || 'Client One Market'}</strong><span>{profile.phone || 'Téléphone non renseigné'}</span><small>{user.email}</small></div></div>
                  <div className="client-account-trust"><CheckCircle2 size={18} /><span><strong>Paiement à la livraison</strong><small>Vos coordonnées servent uniquement à préparer et livrer vos commandes.</small></span></div>
                </section>
              </div>
            </>
          )}

          {!dashboardLoading && tab === 'profile' && (
            <section className="client-panel client-form-panel">
              <div className="client-section-heading"><div><span>Profil</span><h2>Informations personnelles</h2><p>Ces informations seront utilisées pour vos commandes et livraisons.</p></div></div>
              <form onSubmit={saveProfile} className="client-form-grid">
                <label>Nom complet<input value={profileForm.full_name} onChange={event => setProfileForm({ ...profileForm, full_name: event.target.value })} placeholder="Votre nom complet" /></label>
                <label>Téléphone<input value={profileForm.phone} onChange={event => setProfileForm({ ...profileForm, phone: event.target.value })} placeholder="+243…" /></label>
                <label className="client-field-wide">Adresse e-mail<input value={user.email || ''} disabled /></label>
                {profileMessage && <div className="client-message client-field-wide">{profileMessage}</div>}
                <div className="client-form-actions client-field-wide"><button className="button primary" disabled={savingProfile}><Save size={17} /> {savingProfile ? 'Enregistrement…' : 'Enregistrer les modifications'}</button></div>
              </form>
            </section>
          )}

          {!dashboardLoading && tab === 'addresses' && (
            <section className="client-panel">
              <div className="client-section-heading client-heading-row"><div><span>Livraison</span><h2>Mes adresses</h2><p>Enregistrez vos lieux de livraison en RDC.</p></div><button className="button primary" onClick={() => setAddressOpen(value => !value)}><Plus size={17} /> Ajouter une adresse</button></div>

              {addressOpen && (
                <form onSubmit={saveAddress} className="client-address-form">
                  <label>Libellé<input value={addressForm.label} onChange={event => setAddressForm({ ...addressForm, label: event.target.value })} placeholder="Domicile, Bureau…" /></label>
                  <label>Nom du destinataire<input value={addressForm.full_name} onChange={event => setAddressForm({ ...addressForm, full_name: event.target.value })} /></label>
                  <label>Téléphone<input value={addressForm.phone} onChange={event => setAddressForm({ ...addressForm, phone: event.target.value })} placeholder="+243…" /></label>
                  <label>Ville<input value={addressForm.city} onChange={event => setAddressForm({ ...addressForm, city: event.target.value })} /></label>
                  <label className="client-field-wide">Adresse complète<input value={addressForm.address_line1} onChange={event => setAddressForm({ ...addressForm, address_line1: event.target.value })} placeholder="Avenue, numéro, quartier…" /></label>
                  <label>Commune / Quartier<input value={addressForm.district} onChange={event => setAddressForm({ ...addressForm, district: event.target.value })} /></label>
                  <label>Province<input value={addressForm.state_region} onChange={event => setAddressForm({ ...addressForm, state_region: event.target.value })} /></label>
                  <label className="client-field-wide">Complément<input value={addressForm.address_line2} onChange={event => setAddressForm({ ...addressForm, address_line2: event.target.value })} placeholder="Étage, repère…" /></label>
                  <label className="client-field-wide">Instructions de livraison<textarea rows={3} value={addressForm.instructions} onChange={event => setAddressForm({ ...addressForm, instructions: event.target.value })} placeholder="Ex. Appelez avant d’arriver" /></label>
                  <label className="client-checkbox client-field-wide"><input type="checkbox" checked={addressForm.is_default} onChange={event => setAddressForm({ ...addressForm, is_default: event.target.checked })} /><span>Utiliser comme adresse par défaut</span></label>
                  {addressMessage && <div className="client-message client-field-wide">{addressMessage}</div>}
                  <div className="client-form-actions client-field-wide"><button type="button" className="button secondary" onClick={() => setAddressOpen(false)}>Annuler</button><button className="button primary" disabled={savingAddress}><Save size={17} /> {savingAddress ? 'Enregistrement…' : 'Enregistrer l’adresse'}</button></div>
                </form>
              )}

              <div className="client-address-grid">
                {addresses.map(address => (
                  <article className="client-address-card" key={address.id}>
                    <div className="client-address-card-head"><span className="client-address-icon"><MapPin size={19} /></span><div><strong>{address.label}</strong>{address.is_default && <small>Par défaut</small>}</div><button onClick={() => deleteAddress(address.id)} aria-label="Supprimer cette adresse"><Trash2 size={17} /></button></div>
                    <h3>{address.full_name}</h3>
                    <p>{address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ''}</p>
                    <span>{[address.district, address.city, address.state_region].filter(Boolean).join(' · ')}</span>
                    <small>{address.phone}</small>
                  </article>
                ))}
                {!addresses.length && !addressOpen && <div className="client-empty-panel client-field-wide"><MapPin size={25} /><strong>Aucune adresse enregistrée</strong><span>Ajoutez votre première adresse pour accélérer le passage de commande.</span></div>}
              </div>
              {!addressOpen && addressMessage && <div className="client-message">{addressMessage}</div>}
            </section>
          )}

          {!dashboardLoading && tab === 'notifications' && (
            <section className="client-panel">
              <div className="client-section-heading client-heading-row"><div><span>Centre de notifications</span><h2>Notifications</h2><p>Suivez les informations importantes liées à votre compte et vos commandes.</p></div>{unreadCount > 0 && <button className="button secondary" onClick={markAllNotificationsRead}>Tout marquer comme lu</button>}</div>
              <div className="client-notification-list">
                {notifications.map(notification => (
                  <article className={`client-notification ${notification.is_read ? '' : 'is-unread'}`} key={notification.id}>
                    <span className="client-notification-icon"><Bell size={18} /></span>
                    <div><strong>{notification.title}</strong><p>{notification.body}</p><small>{formatDate(notification.created_at)}</small></div>
                    {!notification.is_read && <i />}
                  </article>
                ))}
                {!notifications.length && <div className="client-empty-panel"><Bell size={25} /><strong>Aucune notification</strong><span>Vous êtes à jour.</span></div>}
              </div>
            </section>
          )}

          {!dashboardLoading && tab === 'security' && (
            <section className="client-panel client-form-panel">
              <div className="client-section-heading"><div><span>Sécurité</span><h2>Mot de passe</h2><p>Utilisez un mot de passe unique et difficile à deviner.</p></div></div>
              <form onSubmit={changePassword} className="client-form-grid">
                <label>Nouveau mot de passe<input type="password" autoComplete="new-password" value={securityForm.password} onChange={event => setSecurityForm({ ...securityForm, password: event.target.value })} placeholder="8 caractères minimum" /></label>
                <label>Confirmer le mot de passe<input type="password" autoComplete="new-password" value={securityForm.confirm} onChange={event => setSecurityForm({ ...securityForm, confirm: event.target.value })} /></label>
                {securityMessage && <div className="client-message client-field-wide">{securityMessage}</div>}
                <div className="client-security-note client-field-wide"><ShieldCheck size={20} /><span><strong>Connexion protégée par Supabase Auth</strong><small>Ne partagez jamais votre mot de passe ou vos codes de connexion.</small></span></div>
                <div className="client-form-actions client-field-wide"><button className="button primary" disabled={savingPassword}><KeyRound size={17} /> {savingPassword ? 'Mise à jour…' : 'Modifier le mot de passe'}</button></div>
              </form>
            </section>
          )}
        </section>
      </div>
    </main>
  )
}
