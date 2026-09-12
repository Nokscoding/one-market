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

const EMPTY_TICKET = { category: 'general', subject: '', message: '', order_id: '' }

function statusLabel(status) {
  const labels = {
    pending_confirmation: 'À confirmer', confirmed: 'Confirmée', preparing: 'En préparation', ready: 'Prête',
    out_for_delivery: 'En livraison', delivered: 'Livrée', cancelled: 'Annulée', failed: 'Échouée',
  }
  return labels[status] || status || 'En attente'
}

function ticketStatus(status) {
  return { open: 'Ouvert', in_progress: 'En cours', resolved: 'Résolu', closed: 'Fermé' }[status] || status
}

function formatDate(value) {
  if (!value) return ''
  try { return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) }
  catch { return '' }
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
  const [tickets, setTickets] = useState([])
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
  const [ticketForm, setTicketForm] = useState(EMPTY_TICKET)
  const [ticketMessage, setTicketMessage] = useState('')
  const [savingTicket, setSavingTicket] = useState(false)

  useEffect(() => {
    if (!profile) return
    setProfileForm({ full_name: profile.full_name || '', phone: profile.phone || '' })
    setAddressForm(form => ({ ...form, full_name: form.full_name || profile.full_name || '', phone: form.phone || profile.phone || '' }))
  }, [profile])

  useEffect(() => {
    if (!user?.id) return undefined
    let active = true
    setDashboardLoading(true)
    Promise.all([
      supabase.from('orders').select('id,order_number,status,grand_total,currency,created_at').eq('customer_id', user.id).order('created_at', { ascending: false }).limit(12),
      supabase.from('addresses').select('*').eq('customer_id', user.id).order('is_default', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('support_tickets').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
    ]).then(([o, a, n, t]) => {
      if (!active) return
      setOrders(o.data || [])
      setAddresses(a.data || [])
      setNotifications(n.data || [])
      setTickets(t.data || [])
    }).catch(() => {
      if (!active) return
      setOrders([]); setAddresses([]); setNotifications([]); setTickets([])
    }).finally(() => { if (active) setDashboardLoading(false) })
    return () => { active = false }
  }, [user?.id])

  const unreadCount = useMemo(() => notifications.filter(item => !item.is_read).length, [notifications])
  const initials = (profile?.full_name || user?.email || 'OM').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()

  function changeTab(nextTab) {
    const next = new URLSearchParams(params)
    if (nextTab === 'overview') next.delete('tab'); else next.set('tab', nextTab)
    setParams(next)
  }

  async function saveProfile(event) {
    event.preventDefault(); setSavingProfile(true); setProfileMessage('')
    const payload = { full_name: profileForm.full_name.trim() || null, phone: profileForm.phone.trim() || null }
    const { error } = await supabase.from('profiles').update(payload).eq('id', user.id)
    if (error) setProfileMessage(error.message || 'Impossible de mettre à jour le profil.')
    else { await refreshProfile(); setProfileMessage('Informations mises à jour.') }
    setSavingProfile(false)
  }

  async function saveAddress(event) {
    event.preventDefault(); if (!user?.id || savingAddress) return
    setSavingAddress(true); setAddressMessage('')
    const payload = {
      customer_id: user.id, label: addressForm.label.trim() || 'Domicile', full_name: addressForm.full_name.trim(),
      phone: addressForm.phone.trim(), country_code: 'CD', address_line1: addressForm.address_line1.trim(),
      address_line2: addressForm.address_line2.trim() || null, district: addressForm.district.trim() || null,
      city: addressForm.city.trim(), state_region: addressForm.state_region.trim() || null,
      instructions: addressForm.instructions.trim() || null, is_default: Boolean(addressForm.is_default),
    }
    if (!payload.full_name || !payload.phone || !payload.address_line1 || !payload.city) {
      setAddressMessage('Complète le nom, le téléphone, l’adresse et la ville.'); setSavingAddress(false); return
    }
    if (payload.is_default) await supabase.from('addresses').update({ is_default: false }).eq('customer_id', user.id)
    const { data, error } = await supabase.from('addresses').insert(payload).select('*').single()
    if (error) setAddressMessage(error.message || 'Impossible d’enregistrer cette adresse.')
    else {
      setAddresses(current => [data, ...current.map(item => payload.is_default ? { ...item, is_default: false } : item)])
      setAddressForm({ ...EMPTY_ADDRESS, full_name: profile?.full_name || '', phone: profile?.phone || '' })
      setAddressOpen(false); setAddressMessage('Adresse enregistrée.')
    }
    setSavingAddress(false)
  }

  async function deleteAddress(id) {
    const { error } = await supabase.from('addresses').delete().eq('id', id).eq('customer_id', user.id)
    if (!error) setAddresses(current => current.filter(item => item.id !== id))
  }

  async function markAllNotificationsRead() {
    if (!user?.id || !unreadCount) return
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
    if (!error) setNotifications(current => current.map(item => ({ ...item, is_read: true })))
  }

  async function changePassword(event) {
    event.preventDefault(); setSecurityMessage('')
    if (securityForm.password.length < 8) return setSecurityMessage('Utilise au moins 8 caractères.')
    if (securityForm.password !== securityForm.confirm) return setSecurityMessage('Les deux mots de passe ne correspondent pas.')
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: securityForm.password })
    if (error) setSecurityMessage(error.message || 'Impossible de modifier le mot de passe.')
    else { setSecurityForm({ password: '', confirm: '' }); setSecurityMessage('Mot de passe mis à jour.') }
    setSavingPassword(false)
  }

  async function submitTicket(event) {
    event.preventDefault(); setTicketMessage('')
    if (ticketForm.subject.trim().length < 3 || ticketForm.message.trim().length < 10) return setTicketMessage('Décris un peu plus le problème.')
    setSavingTicket(true)
    const payload = {
      user_id: user.id, category: ticketForm.category, subject: ticketForm.subject.trim(), message: ticketForm.message.trim(),
      order_id: ticketForm.order_id || null,
    }
    const { data, error } = await supabase.from('support_tickets').insert(payload).select('*').single()
    if (error) setTicketMessage(error.message || 'Impossible d’envoyer le signalement.')
    else { setTickets(current => [data, ...current]); setTicketForm(EMPTY_TICKET); setTicketMessage('Signalement envoyé. Notre équipe pourra le traiter depuis le support.') }
    setSavingTicket(false)
  }

  async function logout() { await supabase.auth.signOut(); navigate('/') }

  if (profileLoading) return <Loader fullscreen />
  if (!profile) return <main className="section-shell page-space"><div className="account-card profile-load-error"><h2>Profil indisponible</h2><p>{profileError || 'Le profil One Market n’a pas pu être chargé.'}</p><button className="button primary" onClick={refreshProfile}><RefreshCw size={17}/> Réessayer</button></div></main>

  const nav = [
    ['overview', Home, 'Mon compte'],
    ['profile', UserRound, 'Infos personnelles'],
    ['addresses', MapPin, 'Adresses'],
    ['client', LayoutDashboard, 'Espace client'],
    ['orders', Package, 'Mes commandes'],
    ['payments', CreditCard, 'Modes de paiement'],
    ['support', CircleHelp, 'Signaler un problème'],
    ['favorites', Heart, 'Favoris'],
    ['notifications', Bell, 'Notifications'],
    ['security', KeyRound, 'Sécurité'],
  ]

  return (
    <main className="section-shell client-account-page">
      <section className="client-account-hero">
        <div className="client-avatar">{initials}</div>
        <div className="client-account-hero-copy"><span className="eyebrow">Espace client One Market</span><h1>Bonjour{profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1><p>{user.email}</p></div>
        <div className="client-account-hero-badge"><ShieldCheck size={17}/><span>Compte sécurisé</span></div>
      </section>

      <div className="client-account-layout">
        <aside className="client-account-sidebar">
          {nav.map(([id, Icon, label]) => {
            if (id === 'orders') return <Link key={id} to="/orders"><Icon size={18}/><span>{label}</span><em>{orders.length}</em></Link>
            if (id === 'favorites') return <Link key={id} to="/favorites"><Icon size={18}/><span>{label}</span><em>{favorites.size}</em></Link>
            return <button key={id} className={tab === id ? 'active' : ''} onClick={() => changeTab(id)}><Icon size={18}/><span>{label}</span>{id === 'addresses' && <em>{addresses.length}</em>}{id === 'notifications' && unreadCount > 0 && <em className="is-alert">{unreadCount}</em>}</button>
          })}
          <button className="client-account-logout" onClick={logout}><LogOut size={18}/><span>Se déconnecter</span></button>
        </aside>

        <section className="client-account-content">
          {dashboardLoading && <div className="client-account-inline-loader"><Loader /></div>}

          {!dashboardLoading && tab === 'overview' && <>
            <div className="client-section-heading"><div><span>Mon compte</span><h2>Bienvenue dans ton espace One Market</h2><p>Retrouve ici tes achats, tes adresses, tes favoris et l’assistance.</p></div></div>
            <div className="client-stat-grid">
              <Link to="/orders" className="client-stat-card"><Package size={22}/><div><strong>{orders.length}</strong><span>Commandes</span></div><ChevronRight size={18}/></Link>
              <Link to="/favorites" className="client-stat-card"><Heart size={22}/><div><strong>{favorites.size}</strong><span>Favoris</span></div><ChevronRight size={18}/></Link>
              <button className="client-stat-card" onClick={() => changeTab('addresses')}><MapPin size={22}/><div><strong>{addresses.length}</strong><span>Adresses</span></div><ChevronRight size={18}/></button>
              <button className="client-stat-card" onClick={() => changeTab('support')}><CircleHelp size={22}/><div><strong>{tickets.filter(t => !['resolved','closed'].includes(t.status)).length}</strong><span>Demandes ouvertes</span></div><ChevronRight size={18}/></button>
            </div>
            <div className="client-dashboard-grid">
              <section className="client-panel"><div className="client-panel-head"><div><h3>Commandes récentes</h3><p>Suivi de tes derniers achats</p></div><Link to="/orders">Voir tout</Link></div><div className="client-order-list">{orders.slice(0,4).map(order => <Link to={`/orders/${order.id}`} className="client-order-row" key={order.id}><span className="client-order-icon"><Package size={18}/></span><div><strong>{order.order_number}</strong><small>{formatDate(order.created_at)}</small></div><span className={`client-order-status status-${order.status}`}>{statusLabel(order.status)}</span><b>{money(order.grand_total, order.currency)}</b><ChevronRight size={17}/></Link>)}{!orders.length && <div className="client-empty-panel"><Package size={24}/><strong>Aucune commande</strong><span>Commence tes achats sur One Market.</span><Link to="/catalog">Voir les produits</Link></div>}</div></section>
              <section className="client-panel client-account-summary"><div className="client-panel-head"><div><h3>Informations du compte</h3><p>Profil principal</p></div><button onClick={() => changeTab('profile')}>Modifier</button></div><div className="client-summary-profile"><div className="client-summary-avatar">{initials}</div><div><strong>{profile.full_name || 'Client One Market'}</strong><span>{profile.phone || 'Téléphone non renseigné'}</span><small>{user.email}</small></div></div><div className="client-account-trust"><CheckCircle2 size={18}/><span><strong>Paiement à la livraison</strong><small>Mode actif pour la V1 en RDC.</small></span></div></section>
            </div>
          </>}

          {!dashboardLoading && tab === 'profile' && <section className="client-panel client-form-panel"><div className="client-section-heading"><div><span>Infos personnelles</span><h2>Informations personnelles</h2><p>Ces données servent à préparer et livrer tes commandes.</p></div></div><form onSubmit={saveProfile} className="client-form-grid"><label>Nom complet<input value={profileForm.full_name} onChange={e => setProfileForm({...profileForm,full_name:e.target.value})}/></label><label>Téléphone<input value={profileForm.phone} onChange={e => setProfileForm({...profileForm,phone:e.target.value})} placeholder="+243…"/></label><label className="client-field-wide">E-mail<input value={user.email || ''} disabled/></label>{profileMessage && <div className="client-message client-field-wide">{profileMessage}</div>}<div className="client-form-actions client-field-wide"><button className="button primary" disabled={savingProfile}><Save size={17}/> {savingProfile?'Enregistrement…':'Enregistrer'}</button></div></form></section>}

          {!dashboardLoading && tab === 'addresses' && <section className="client-panel"><div className="client-section-heading client-heading-row"><div><span>Livraison</span><h2>Mes adresses</h2><p>Enregistre les lieux où tu veux recevoir tes commandes.</p></div><button className="button secondary" onClick={() => setAddressOpen(v=>!v)}><Plus size={17}/> Ajouter une adresse</button></div>{addressOpen && <form onSubmit={saveAddress} className="client-address-form"><label>Nom de l’adresse<input value={addressForm.label} onChange={e=>setAddressForm({...addressForm,label:e.target.value})}/></label><label>Nom du destinataire<input value={addressForm.full_name} onChange={e=>setAddressForm({...addressForm,full_name:e.target.value})}/></label><label>Téléphone<input value={addressForm.phone} onChange={e=>setAddressForm({...addressForm,phone:e.target.value})}/></label><label>Ville<input value={addressForm.city} onChange={e=>setAddressForm({...addressForm,city:e.target.value})}/></label><label className="client-field-wide">Adresse<input value={addressForm.address_line1} onChange={e=>setAddressForm({...addressForm,address_line1:e.target.value})}/></label><label>Commune / quartier<input value={addressForm.district} onChange={e=>setAddressForm({...addressForm,district:e.target.value})}/></label><label>Province<input value={addressForm.state_region} onChange={e=>setAddressForm({...addressForm,state_region:e.target.value})}/></label><label className="client-field-wide">Indications<textarea value={addressForm.instructions} onChange={e=>setAddressForm({...addressForm,instructions:e.target.value})}/></label><label className="client-checkbox client-field-wide"><input type="checkbox" checked={addressForm.is_default} onChange={e=>setAddressForm({...addressForm,is_default:e.target.checked})}/><span>Utiliser comme adresse par défaut</span></label>{addressMessage && <div className="client-message client-field-wide">{addressMessage}</div>}<div className="client-form-actions client-field-wide"><button className="button primary" disabled={savingAddress}>{savingAddress?'Enregistrement…':'Enregistrer l’adresse'}</button></div></form>}<div className="client-address-grid">{addresses.map(address=><article className="client-address-card" key={address.id}><div className="client-address-card-head"><span className="client-address-icon"><MapPin size={17}/></span><div><strong>{address.label}</strong>{address.is_default&&<small>Par défaut</small>}</div><button onClick={()=>deleteAddress(address.id)} aria-label="Supprimer"><Trash2 size={16}/></button></div><h3>{address.full_name}</h3><p>{address.address_line1}{address.district?`, ${address.district}`:''}</p><span>{address.city}{address.state_region?` · ${address.state_region}`:''}</span><small>{address.phone}</small></article>)}</div></section>}

          {!dashboardLoading && tab === 'client' && <section className="client-panel"><div className="client-section-heading"><div><span>Espace client</span><h2>Services client One Market</h2><p>Les raccourcis utiles pour gérer ton expérience d’achat.</p></div></div><div className="client-service-grid"><Link to="/orders"><Package size={22}/><strong>Suivre mes commandes</strong><span>Statut, détails et historique</span></Link><button onClick={()=>changeTab('payments')}><CreditCard size={22}/><strong>Modes de paiement</strong><span>Voir les moyens disponibles</span></button><button onClick={()=>changeTab('support')}><CircleHelp size={22}/><strong>Assistance</strong><span>Signaler un problème</span></button><button onClick={()=>changeTab('addresses')}><MapPin size={22}/><strong>Livraison</strong><span>Gérer mes adresses</span></button><Link to="/favorites"><Heart size={22}/><strong>Mes favoris</strong><span>Produits enregistrés</span></Link><button onClick={()=>changeTab('security')}><ShieldCheck size={22}/><strong>Sécurité</strong><span>Protéger mon compte</span></button></div></section>}

          {!dashboardLoading && tab === 'payments' && <section className="client-panel"><div className="client-section-heading"><div><span>Paiement</span><h2>Modes de paiement</h2><p>Pour le lancement One Market en RDC, le paiement se fait à la livraison.</p></div></div><div className="payment-method-list"><article className="payment-method-card is-active"><div className="payment-method-icon"><CreditCard size={24}/></div><div><div className="payment-method-title"><strong>Paiement à la livraison</strong><span>Actif</span></div><p>Tu commandes sur One Market et tu paies au moment de recevoir ta commande.</p></div></article><article className="payment-method-card is-coming"><div className="payment-method-icon"><CreditCard size={24}/></div><div><div className="payment-method-title"><strong>Mobile Money</strong><span>Bientôt</span></div><p>M-Pesa, Airtel Money et autres moyens locaux pourront être ajoutés plus tard.</p></div></article><article className="payment-method-card is-coming"><div className="payment-method-icon"><CreditCard size={24}/></div><div><div className="payment-method-title"><strong>Carte bancaire</strong><span>Bientôt</span></div><p>Les paiements par carte seront intégrés dans une version future.</p></div></article></div></section>}

          {!dashboardLoading && tab === 'support' && <section className="client-panel"><div className="client-section-heading"><div><span>Assistance</span><h2>Signaler un problème</h2><p>Commande, livraison, paiement, produit ou compte : envoie une demande au support.</p></div></div><form className="support-form" onSubmit={submitTicket}><label>Type de problème<select value={ticketForm.category} onChange={e=>setTicketForm({...ticketForm,category:e.target.value})}><option value="general">Question générale</option><option value="order">Commande</option><option value="payment">Paiement</option><option value="delivery">Livraison</option><option value="product">Produit</option><option value="account">Compte</option><option value="technical">Problème technique</option></select></label><label>Commande concernée<select value={ticketForm.order_id} onChange={e=>setTicketForm({...ticketForm,order_id:e.target.value})}><option value="">Aucune / non précisée</option>{orders.map(order=><option value={order.id} key={order.id}>{order.order_number}</option>)}</select></label><label className="client-field-wide">Sujet<input maxLength={140} value={ticketForm.subject} onChange={e=>setTicketForm({...ticketForm,subject:e.target.value})} placeholder="Résume le problème"/></label><label className="client-field-wide">Message<textarea rows={5} maxLength={3000} value={ticketForm.message} onChange={e=>setTicketForm({...ticketForm,message:e.target.value})} placeholder="Explique ce qui s’est passé…"/></label>{ticketMessage&&<div className="client-message client-field-wide">{ticketMessage}</div>}<div className="client-form-actions client-field-wide"><button className="button primary" disabled={savingTicket}>{savingTicket?'Envoi…':'Envoyer le signalement'}</button></div></form><div className="support-history"><h3>Mes signalements</h3>{tickets.length?tickets.map(ticket=><article key={ticket.id}><div><strong>{ticket.subject}</strong><span>{formatDate(ticket.created_at)}</span></div><em className={`ticket-status status-${ticket.status}`}>{ticketStatus(ticket.status)}</em></article>):<p>Aucun signalement pour le moment.</p>}</div></section>}

          {!dashboardLoading && tab === 'notifications' && <section className="client-panel"><div className="client-section-heading client-heading-row"><div><span>Activité</span><h2>Notifications</h2><p>Informations importantes liées à ton compte et tes commandes.</p></div>{unreadCount>0&&<button className="button secondary" onClick={markAllNotificationsRead}>Tout marquer comme lu</button>}</div><div className="client-notification-list">{notifications.map(item=><article className={`client-notification ${item.is_read?'':'is-unread'}`} key={item.id}><span className="client-notification-icon"><Bell size={17}/></span><div><strong>{item.title}</strong><p>{item.body}</p><small>{formatDate(item.created_at)}</small></div>{!item.is_read&&<i/>}</article>)}{!notifications.length&&<div className="client-empty-panel"><Bell size={24}/><strong>Aucune notification</strong><span>Tout est calme pour le moment.</span></div>}</div></section>}

          {!dashboardLoading && tab === 'security' && <section className="client-panel client-form-panel"><div className="client-section-heading"><div><span>Sécurité</span><h2>Mot de passe et sécurité</h2><p>Utilise un mot de passe unique et difficile à deviner.</p></div></div><div className="client-security-note"><ShieldCheck size={20}/><span><strong>Connexion protégée par Supabase Auth</strong><small>One Market ne stocke pas ton mot de passe en clair.</small></span></div><form onSubmit={changePassword} className="client-form-grid client-security-form"><label>Nouveau mot de passe<input type="password" value={securityForm.password} onChange={e=>setSecurityForm({...securityForm,password:e.target.value})}/></label><label>Confirmer<input type="password" value={securityForm.confirm} onChange={e=>setSecurityForm({...securityForm,confirm:e.target.value})}/></label>{securityMessage&&<div className="client-message client-field-wide">{securityMessage}</div>}<div className="client-form-actions client-field-wide"><button className="button primary" disabled={savingPassword}><KeyRound size={17}/> {savingPassword?'Modification…':'Modifier le mot de passe'}</button></div></form></section>}
        </section>
      </div>
    </main>
  )
}
