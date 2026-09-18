import {
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Heart,
  Home,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Loader from '../components/Loader'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../context/FavoritesContext'
import { ADDRESS_TYPES, DELIVERY_CITIES, addressLines, addressPayload, addressTypeLabel, blankAddress, validateAddress } from '../lib/address'
import { money, orderStatus } from '../lib/format'
import { supabase } from '../lib/supabase'
import { logTechnicalError, userError } from '../lib/userErrors'

const EMPTY_TICKET = { category: 'general', subject: '', message: '', order_id: '' }

function formatDate(value) {
  if (!value) return ''
  try { return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) }
  catch { return '' }
}

function ticketStatus(status) {
  return { open: 'Ouvert', in_progress: 'En cours', resolved: 'Résolu', closed: 'Fermé' }[status] || 'En cours'
}

export default function AccountPage() {
  const { user, profile, profileLoading, refreshProfile } = useAuth()
  const { favorites } = useFavorites()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'overview'

  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '' })
  const [orders, setOrders] = useState([])
  const [addresses, setAddresses] = useState([])
  const [notifications, setNotifications] = useState([])
  const [tickets, setTickets] = useState([])
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [addressForm, setAddressForm] = useState(() => blankAddress())
  const [addressOpen, setAddressOpen] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState('')
  const [savingAddress, setSavingAddress] = useState(false)
  const [addressMessage, setAddressMessage] = useState('')
  const [deleteAddressTarget, setDeleteAddressTarget] = useState(null)
  const [securityForm, setSecurityForm] = useState({ password: '', confirm: '' })
  const [securityMessage, setSecurityMessage] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [ticketForm, setTicketForm] = useState(EMPTY_TICKET)
  const [ticketMessage, setTicketMessage] = useState('')
  const [savingTicket, setSavingTicket] = useState(false)

  useEffect(() => {
    if (!profile) return
    setProfileForm({ full_name: profile.full_name || '', phone: profile.phone || '' })
    setAddressForm(current => ({ ...current, full_name: current.full_name || profile.full_name || '', phone: current.phone || profile.phone || '' }))
  }, [profile])

  async function loadDashboard() {
    if (!user?.id) return
    setDashboardLoading(true)
    setDashboardError('')
    try {
      const [orderResult, addressResult, notificationResult, ticketResult] = await Promise.all([
        supabase.from('orders').select('id,order_number,status,grand_total,items_total,currency,payment_status,delivery_method,created_at').eq('customer_id', user.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('addresses').select('id,customer_id,address_type,label,full_name,phone,whatsapp_phone,country_code,address_line1,address_line2,commune,district,city,state_region,instructions,is_default,building,apartment,landmark,latitude,longitude,created_at').eq('customer_id', user.id).order('is_default', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('notifications').select('id,user_id,title,body,type,link,is_read,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('support_tickets').select('id,ticket_number,user_id,category,subject,message,status,order_id,created_at,updated_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      ])
      if (orderResult.error) throw orderResult.error
      if (addressResult.error) throw addressResult.error
      if (notificationResult.error) throw notificationResult.error
      if (ticketResult.error) throw ticketResult.error
      setOrders(orderResult.data || [])
      setAddresses(addressResult.data || [])
      setNotifications(notificationResult.data || [])
      setTickets(ticketResult.data || [])
    } catch (loadError) {
      logTechnicalError('account-dashboard', loadError)
      setDashboardError(userError(loadError, 'profile'))
    } finally { setDashboardLoading(false) }
  }

  useEffect(() => { loadDashboard() }, [user?.id])

  const unreadCount = useMemo(() => notifications.filter(item => !item.is_read).length, [notifications])
  const initials = (profile?.full_name || user?.email || 'OM').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()

  function changeTab(nextTab) {
    const next = new URLSearchParams(params)
    if (nextTab === 'overview') next.delete('tab')
    else next.set('tab', nextTab)
    setParams(next)
  }

  async function saveProfile(event) {
    event.preventDefault()
    if (savingProfile) return
    setSavingProfile(true)
    setProfileMessage('')
    try {
      const payload = { full_name: profileForm.full_name.trim() || null, phone: profileForm.phone.trim() || null }
      if (!payload.full_name) return setProfileMessage('Indiquez votre nom complet.')
      const { error } = await supabase.from('profiles').update(payload).eq('id', user.id)
      if (error) throw error
      await refreshProfile()
      setProfileMessage('Vos informations ont été enregistrées.')
    } catch (saveError) {
      logTechnicalError('account-profile-save', saveError)
      setProfileMessage(userError(saveError, 'profile'))
    } finally { setSavingProfile(false) }
  }

  function startNewAddress() {
    setEditingAddressId('')
    setAddressForm(blankAddress(profile || {}))
    setAddressMessage('')
    setAddressOpen(true)
  }

  function startEditAddress(address) {
    setEditingAddressId(address.id)
    setAddressForm({ ...blankAddress(profile || {}), ...address, address_type: address.address_type || 'home' })
    setAddressMessage('')
    setAddressOpen(true)
  }

  function chooseAddressType(code) {
    setAddressForm(current => ({ ...current, address_type: code, label: code === 'home' ? 'Maison' : code === 'work' ? 'Travail' : current.address_type === 'other' ? current.label : '' }))
  }

  function chooseCity(city) {
    const cityData = DELIVERY_CITIES.find(item => item.city === city)
    setAddressForm(current => ({ ...current, city, state_region: cityData?.region || current.state_region }))
  }

  async function saveAddress(event) {
    event.preventDefault()
    if (!user?.id || savingAddress) return
    const validation = validateAddress(addressForm)
    if (validation) return setAddressMessage(validation)
    setSavingAddress(true)
    setAddressMessage('')
    try {
      const payload = addressPayload(addressForm, user.id)
      const result = editingAddressId
        ? await supabase.from('addresses').update(payload).eq('id', editingAddressId).eq('customer_id', user.id).select('id,customer_id,address_type,label,full_name,phone,whatsapp_phone,country_code,address_line1,address_line2,commune,district,city,state_region,postal_code,instructions,is_default,building,apartment,landmark,latitude,longitude,created_at,updated_at').single()
        : await supabase.from('addresses').insert({ ...payload, is_default: addresses.length ? payload.is_default : true }).select('id,customer_id,address_type,label,full_name,phone,whatsapp_phone,country_code,address_line1,address_line2,commune,district,city,state_region,postal_code,instructions,is_default,building,apartment,landmark,latitude,longitude,created_at,updated_at').single()
      if (result.error) throw result.error
      await loadDashboard()
      setAddressOpen(false)
      setEditingAddressId('')
      setAddressForm(blankAddress(profile || {}))
      setAddressMessage(editingAddressId ? 'Votre adresse a été modifiée.' : 'Votre adresse a été enregistrée.')
    } catch (addressError) {
      logTechnicalError('account-address-save', addressError)
      setAddressMessage(userError(addressError, 'address'))
    } finally { setSavingAddress(false) }
  }

  async function setDefaultAddress(address) {
    setAddressMessage('')
    try {
      const result = await supabase.from('addresses').update({ is_default: true }).eq('id', address.id).eq('customer_id', user.id)
      if (result.error) throw result.error
      await loadDashboard()
      setAddressMessage('Adresse par défaut mise à jour.')
    } catch (addressError) {
      logTechnicalError('account-address-default', addressError)
      setAddressMessage(userError(addressError, 'address'))
    }
  }

  async function confirmDeleteAddress() {
    if (!deleteAddressTarget) return
    const target = deleteAddressTarget
    setDeleteAddressTarget(null)
    setAddressMessage('')
    try {
      const result = await supabase.from('addresses').delete().eq('id', target.id).eq('customer_id', user.id)
      if (result.error) throw result.error
      await loadDashboard()
      setAddressMessage('Adresse supprimée de votre compte. Les anciennes commandes conservent leur adresse de livraison enregistrée.')
    } catch (addressError) {
      logTechnicalError('account-address-delete', addressError)
      setAddressMessage(userError(addressError, 'address'))
    }
  }

  async function markAllNotificationsRead() {
    if (!user?.id || !unreadCount) return
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
      if (error) throw error
      setNotifications(current => current.map(item => ({ ...item, is_read: true })))
    } catch (notificationError) {
      logTechnicalError('account-notifications', notificationError)
    }
  }

  async function changePassword(event) {
    event.preventDefault()
    setSecurityMessage('')
    if (securityForm.password.length < 8) return setSecurityMessage('Votre mot de passe doit contenir au moins 8 caractères.')
    if (securityForm.password !== securityForm.confirm) return setSecurityMessage('Les deux mots de passe ne correspondent pas.')
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: securityForm.password })
      if (error) throw error
      setSecurityForm({ password: '', confirm: '' })
      setSecurityMessage('Votre mot de passe a été mis à jour.')
    } catch (passwordError) {
      logTechnicalError('account-password', passwordError)
      setSecurityMessage(userError(passwordError, 'profile'))
    } finally { setSavingPassword(false) }
  }

  async function submitTicket(event) {
    event.preventDefault()
    setTicketMessage('')
    if (ticketForm.subject.trim().length < 3) return setTicketMessage('Indiquez brièvement le sujet de votre demande.')
    if (ticketForm.message.trim().length < 10) return setTicketMessage('Décrivez un peu plus le problème rencontré.')
    setSavingTicket(true)
    try {
      const payload = { user_id: user.id, category: ticketForm.category, subject: ticketForm.subject.trim(), message: ticketForm.message.trim(), order_id: ticketForm.order_id || null }
      const { data, error } = await supabase.from('support_tickets').insert(payload).select('id,ticket_number,user_id,category,subject,message,status,priority,source,target_type,order_id,store_id,product_id,seller_order_id,reporter_phone,created_at,updated_at').single()
      if (error) throw error
      setTickets(current => [data, ...current])
      setTicketForm(EMPTY_TICKET)
      setTicketMessage('Votre demande a été envoyée au support One Market.')
    } catch (ticketError) {
      logTechnicalError('account-support', ticketError)
      setTicketMessage(userError(ticketError, 'support'))
    } finally { setSavingTicket(false) }
  }

  async function logout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (profileLoading) return <Loader fullscreen />
  if (!profile) return <main className="section-shell page-space"><div className="account-card profile-load-error"><h2>Profil indisponible</h2><p>Votre profil One Market n’a pas pu être chargé.</p><button className="button primary" onClick={refreshProfile}><RefreshCw size={17}/> Réessayer</button></div></main>

  const nav = [
    ['overview', Home, 'Mon compte'],
    ['profile', UserRound, 'Informations'],
    ['addresses', MapPin, 'Adresses'],
    ['client', LayoutDashboard, 'Espace client'],
    ['payments', CreditCard, 'Paiement'],
    ['support', CircleHelp, 'Assistance'],
    ['notifications', Bell, 'Notifications'],
    ['security', KeyRound, 'Sécurité'],
  ]

  return (
    <main className="section-shell client-account-page">
      <section className="client-account-hero">
        <div className="client-avatar">{initials}</div>
        <div className="client-account-hero-copy"><span className="eyebrow">Compte One Market</span><h1>Bonjour{profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1><p>{user.email}</p></div>
        <div className="client-account-hero-badge"><ShieldCheck size={17}/><span>Compte sécurisé</span></div>
      </section>

      <div className="client-account-layout">
        <aside className="client-account-sidebar">
          {nav.map(([id, Icon, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => changeTab(id)}><Icon size={18}/><span>{label}</span>{id === 'addresses' && <em>{addresses.length}</em>}{id === 'notifications' && unreadCount > 0 && <em className="is-alert">{unreadCount}</em>}</button>)}
          <Link to="/orders"><Package size={18}/><span>Mes commandes</span><em>{orders.length}</em></Link>
          <Link to="/favorites"><Heart size={18}/><span>Favoris</span><em>{favorites.size}</em></Link>
          <button className="client-account-logout" onClick={logout}><LogOut size={18}/><span>Se déconnecter</span></button>
        </aside>

        <section className="client-account-content">
          {dashboardLoading && <div className="client-account-inline-loader"><Loader /></div>}
          {dashboardError && <div className="account-retry-state" role="alert"><span>{dashboardError}</span><button className="button secondary" onClick={loadDashboard}><RefreshCw size={16}/> Réessayer</button></div>}

          {!dashboardLoading && !dashboardError && tab === 'overview' && <>
            <div className="client-section-heading"><div><span>Mon compte</span><h2>Vos informations et vos achats</h2><p>Retrouvez vos commandes, adresses, favoris et demandes d’assistance.</p></div></div>
            <div className="client-stat-grid">
              <Link to="/orders" className="client-stat-card"><Package size={22}/><div><strong>{orders.length}</strong><span>Commandes</span></div><ChevronRight size={18}/></Link>
              <Link to="/favorites" className="client-stat-card"><Heart size={22}/><div><strong>{favorites.size}</strong><span>Favoris</span></div><ChevronRight size={18}/></Link>
              <button className="client-stat-card" onClick={() => changeTab('addresses')}><MapPin size={22}/><div><strong>{addresses.length}</strong><span>Adresses</span></div><ChevronRight size={18}/></button>
              <button className="client-stat-card" onClick={() => changeTab('support')}><CircleHelp size={22}/><div><strong>{tickets.filter(t => !['resolved','closed'].includes(t.status)).length}</strong><span>Demandes ouvertes</span></div><ChevronRight size={18}/></button>
            </div>
            <div className="client-dashboard-grid">
              <section className="client-panel"><div className="client-panel-head"><div><h3>Commandes récentes</h3><p>Vos derniers achats</p></div><Link to="/orders">Voir tout</Link></div><div className="client-order-list">{orders.slice(0,4).map(order => <Link to={`/orders/${order.id}`} className="client-order-row" key={order.id}><span className="client-order-icon"><Package size={18}/></span><div><strong>{order.order_number}</strong><small>{formatDate(order.created_at)}</small></div><span className={`client-order-status status-${order.status}`}>{orderStatus[order.status] || 'En cours'}</span><b>{money(order.items_total ?? order.grand_total, order.currency)}</b><ChevronRight size={17}/></Link>)}{!orders.length && <div className="client-empty-panel"><Package size={24}/><strong>Aucune commande</strong><span>Vos prochaines commandes apparaîtront ici.</span><Link to="/catalog">Voir les produits</Link></div>}</div></section>
              <section className="client-panel client-account-summary"><div className="client-panel-head"><div><h3>Adresse par défaut</h3><p>Utilisée en priorité au checkout</p></div><button onClick={() => changeTab('addresses')}>Gérer</button></div>{addresses.find(a => a.is_default) ? <div className="account-default-address"><MapPin size={20}/><span><strong>{addressTypeLabel(addresses.find(a => a.is_default).address_type, addresses.find(a => a.is_default).label)}</strong><small>{addresses.find(a => a.is_default).full_name}</small>{addressLines(addresses.find(a => a.is_default)).map((line, i) => <small key={i}>{line}</small>)}</span></div> : <div className="client-empty-panel"><MapPin size={24}/><strong>Aucune adresse</strong><span>Ajoutez une adresse pour commander plus rapidement.</span><button onClick={() => { changeTab('addresses'); startNewAddress() }}>Ajouter</button></div>}</section>
            </div>
          </>}

          {!dashboardLoading && !dashboardError && tab === 'profile' && <section className="client-panel client-form-panel"><div className="client-section-heading"><div><span>Informations</span><h2>Informations personnelles</h2><p>Ces informations servent notamment à préparer vos commandes.</p></div></div><form onSubmit={saveProfile} className="client-form-grid"><label>Nom complet<input value={profileForm.full_name} onChange={e => setProfileForm({...profileForm,full_name:e.target.value})}/></label><label>Téléphone<input inputMode="tel" value={profileForm.phone} onChange={e => setProfileForm({...profileForm,phone:e.target.value})} placeholder="+243…"/></label><label className="wide">Adresse e-mail<input disabled value={user.email || ''}/><small>Votre adresse e-mail est liée à votre compte One Market.</small></label>{profileMessage && <div className="client-form-message wide">{profileMessage}</div>}<div className="client-form-actions wide"><button className="button primary" disabled={savingProfile}><Save size={17}/>{savingProfile?'Enregistrement…':'Enregistrer'}</button></div></form></section>}

          {!dashboardLoading && !dashboardError && tab === 'addresses' && <section className="client-panel client-address-panel">
            <div className="client-panel-head"><div><h2>Mes adresses</h2><p>Choisissez l’adresse proposée par défaut lors de vos commandes.</p></div><button className="button primary" onClick={startNewAddress}><Plus size={17}/> Ajouter une adresse</button></div>
            {addressMessage && <div className="client-form-message">{addressMessage}</div>}
            <div className="account-address-grid">{addresses.map(address => <article key={address.id} className={`account-address-card ${address.is_default ? 'is-default' : ''}`}><div className="account-address-card-head"><div><strong>{addressTypeLabel(address.address_type, address.label)}</strong>{address.is_default && <span>Par défaut</span>}</div><MapPin size={19}/></div><p>{address.full_name}</p><small>{address.phone}</small>{addressLines(address).map((line, index) => <small key={index}>{line}</small>)}<div className="account-address-actions"><button onClick={() => startEditAddress(address)}>Modifier</button>{!address.is_default && <button onClick={() => setDefaultAddress(address)}>Définir par défaut</button>}<button className="danger-text" onClick={() => setDeleteAddressTarget(address)}><Trash2 size={15}/> Supprimer</button></div></article>)}{!addresses.length && !addressOpen && <div className="client-empty-panel"><MapPin size={26}/><strong>Aucune adresse enregistrée</strong><span>Ajoutez une adresse pour simplifier votre prochaine commande.</span></div>}</div>

            {addressOpen && <form className="account-address-editor ecommerce-address-form" onSubmit={saveAddress} noValidate><div className="account-address-editor-head"><div><span>Adresse</span><h3>{editingAddressId ? 'Modifier l’adresse' : 'Nouvelle adresse'}</h3></div><button type="button" onClick={() => setAddressOpen(false)} aria-label="Fermer"><X size={18}/></button></div><fieldset className="address-type-fieldset"><legend>Enregistrer cette adresse comme</legend><div className="address-type-options">{ADDRESS_TYPES.map(type => <button type="button" key={type.code} className={addressForm.address_type === type.code ? 'active' : ''} onClick={() => chooseAddressType(type.code)}>{type.label}</button>)}</div></fieldset>{addressForm.address_type === 'other' && <label>Nom de l’adresse<input required value={addressForm.label} onChange={e => setAddressForm({...addressForm,label:e.target.value})} placeholder="Ex. Chez maman, Entrepôt"/></label>}<div className="client-form-grid"><label>Nom complet<input required value={addressForm.full_name} onChange={e => setAddressForm({...addressForm,full_name:e.target.value})}/></label><label>Téléphone<input required inputMode="tel" value={addressForm.phone} onChange={e => setAddressForm({...addressForm,phone:e.target.value})} placeholder="+243…"/></label><label>WhatsApp <small>Facultatif</small><input inputMode="tel" value={addressForm.whatsapp_phone || ''} onChange={e => setAddressForm({...addressForm,whatsapp_phone:e.target.value})}/></label><label>Ville<select value={addressForm.city} onChange={e => chooseCity(e.target.value)}>{DELIVERY_CITIES.map(item => <option key={item.city}>{item.city}</option>)}</select></label><label>Commune <small>Facultatif</small><input value={addressForm.commune || ''} onChange={e => setAddressForm({...addressForm,commune:e.target.value})} placeholder="Ex. Lubumbashi"/></label><label>Quartier<input required value={addressForm.district || ''} onChange={e => setAddressForm({...addressForm,district:e.target.value})} placeholder="Ex. Golf, Kampemba…"/></label><label>Avenue / rue<input required value={addressForm.address_line1} onChange={e => setAddressForm({...addressForm,address_line1:e.target.value})}/></label><label>Numéro / parcelle <small>Facultatif</small><input value={addressForm.address_line2 || ''} onChange={e => setAddressForm({...addressForm,address_line2:e.target.value})}/></label><label>Immeuble / résidence <small>Facultatif</small><input value={addressForm.building || ''} onChange={e => setAddressForm({...addressForm,building:e.target.value})}/></label><label>Appartement / étage <small>Facultatif</small><input value={addressForm.apartment || ''} onChange={e => setAddressForm({...addressForm,apartment:e.target.value})}/></label><label className="wide">Point de repère<input value={addressForm.landmark || ''} onChange={e => setAddressForm({...addressForm,landmark:e.target.value})} placeholder="Ex. En face de l’église…"/></label><label className="wide">Instructions pour le livreur<textarea rows={3} maxLength={300} value={addressForm.instructions || ''} onChange={e => setAddressForm({...addressForm,instructions:e.target.value})}/></label><label className="seller-checkbox wide"><input type="checkbox" checked={Boolean(addressForm.is_default)} onChange={e => setAddressForm({...addressForm,is_default:e.target.checked})}/><span>Utiliser comme adresse par défaut</span></label></div><div className="client-form-actions"><button type="button" className="button secondary" onClick={() => setAddressOpen(false)}>Annuler</button><button className="button primary" disabled={savingAddress}>{savingAddress?'Enregistrement…':editingAddressId?'Enregistrer les modifications':'Enregistrer l’adresse'}</button></div></form>}
          </section>}

          {!dashboardLoading && !dashboardError && tab === 'client' && <section className="client-panel"><div className="client-section-heading"><div><span>Espace client</span><h2>Achats et suivi</h2><p>Accédez rapidement aux principales fonctions de votre compte.</p></div></div><div className="client-shortcut-grid"><Link to="/orders"><Package size={22}/><strong>Mes commandes</strong><span>Voir le suivi et le détail de vos achats.</span></Link><Link to="/cart"><Package size={22}/><strong>Mon panier</strong><span>Retrouver les produits que vous souhaitez commander.</span></Link><Link to="/favorites"><Heart size={22}/><strong>Mes favoris</strong><span>Retrouver les produits enregistrés.</span></Link><button onClick={() => changeTab('support')}><CircleHelp size={22}/><strong>Assistance</strong><span>Signaler un problème à One Market.</span></button></div></section>}

          {!dashboardLoading && !dashboardError && tab === 'payments' && <section className="client-panel"><div className="client-section-heading"><div><span>Paiement</span><h2>Modes de paiement</h2><p>One Market n’enregistre pas de carte bancaire dans cette version.</p></div></div><div className="account-payment-options"><article><CreditCard size={22}/><span><strong>Paiement à la livraison</strong><small>Réglez votre commande auprès du livreur à la réception.</small></span></article><article><CreditCard size={22}/><span><strong>Mobile Money</strong><small>Lorsque disponible, le paiement est finalisé avec One Market et confirmé avant règlement vendeur.</small></span></article></div></section>}

          {!dashboardLoading && !dashboardError && tab === 'support' && <section className="client-panel client-form-panel"><div className="client-section-heading"><div><span>Assistance</span><h2>Signaler un problème</h2><p>Décrivez le problème. Vous pouvez l’associer à une commande.</p></div></div><form onSubmit={submitTicket} className="client-form-grid"><label>Catégorie<select value={ticketForm.category} onChange={e=>setTicketForm({...ticketForm,category:e.target.value})}><option value="general">Question générale</option><option value="order">Commande</option><option value="payment">Paiement</option><option value="delivery">Livraison</option><option value="product">Produit</option></select></label><label>Commande <small>Facultatif</small><select value={ticketForm.order_id} onChange={e=>setTicketForm({...ticketForm,order_id:e.target.value})}><option value="">Aucune</option>{orders.map(order=><option key={order.id} value={order.id}>{order.order_number}</option>)}</select></label><label className="wide">Sujet<input value={ticketForm.subject} onChange={e=>setTicketForm({...ticketForm,subject:e.target.value})}/></label><label className="wide">Votre message<textarea rows={5} value={ticketForm.message} onChange={e=>setTicketForm({...ticketForm,message:e.target.value})}/></label>{ticketMessage&&<div className="client-form-message wide">{ticketMessage}</div>}<div className="client-form-actions wide"><button className="button primary" disabled={savingTicket}>{savingTicket?'Envoi…':'Envoyer la demande'}</button></div></form><div className="support-ticket-history"><h3>Mes demandes</h3>{tickets.map(ticket=><article key={ticket.id}><span><strong>{ticket.ticket_number || 'Demande support'}</strong><small>{ticket.subject}</small></span><span>{ticketStatus(ticket.status)}</span></article>)}{!tickets.length&&<p>Aucune demande envoyée.</p>}</div></section>}

          {!dashboardLoading && !dashboardError && tab === 'notifications' && <section className="client-panel"><div className="client-panel-head"><div><h2>Notifications</h2><p>Mises à jour de commandes et informations utiles.</p></div>{unreadCount>0&&<button onClick={markAllNotificationsRead}>Tout marquer comme lu</button>}</div><div className="account-notification-list">{notifications.map(notification=><Link to={notification.link || '#'} key={notification.id} className={!notification.is_read?'is-unread':''}><span><strong>{notification.title || 'One Market'}</strong><small>{notification.body}</small></span><time>{formatDate(notification.created_at)}</time></Link>)}{!notifications.length&&<div className="client-empty-panel"><Bell size={24}/><strong>Aucune notification</strong><span>Les informations importantes apparaîtront ici.</span></div>}</div></section>}

          {!dashboardLoading && !dashboardError && tab === 'security' && <section className="client-panel client-form-panel"><div className="client-section-heading"><div><span>Sécurité</span><h2>Modifier le mot de passe</h2><p>Utilisez un mot de passe d’au moins 8 caractères.</p></div></div><form onSubmit={changePassword} className="client-form-grid"><label>Nouveau mot de passe<input type="password" autoComplete="new-password" minLength={8} value={securityForm.password} onChange={e=>setSecurityForm({...securityForm,password:e.target.value})}/></label><label>Confirmer le mot de passe<input type="password" autoComplete="new-password" minLength={8} value={securityForm.confirm} onChange={e=>setSecurityForm({...securityForm,confirm:e.target.value})}/></label>{securityMessage&&<div className="client-form-message wide">{securityMessage}</div>}<div className="client-form-actions wide"><button className="button primary" disabled={savingPassword}><KeyRound size={17}/>{savingPassword?'Enregistrement…':'Mettre à jour le mot de passe'}</button></div></form></section>}
        </section>
      </div>

      {deleteAddressTarget && <div className="account-modal-backdrop" onMouseDown={() => setDeleteAddressTarget(null)}><section className="account-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-address-title" onMouseDown={event => event.stopPropagation()}><header><div><span>Adresse</span><h2 id="delete-address-title">Supprimer cette adresse ?</h2></div><button onClick={() => setDeleteAddressTarget(null)} aria-label="Fermer"><X size={19}/></button></header><p>Cette adresse sera supprimée de votre compte. Les anciennes commandes conserveront cependant l’adresse enregistrée au moment de l’achat.</p><footer><button className="button secondary" onClick={() => setDeleteAddressTarget(null)}>Annuler</button><button className="button primary danger" onClick={confirmDeleteAddress}>Supprimer</button></footer></section></div>}
    </main>
  )
}