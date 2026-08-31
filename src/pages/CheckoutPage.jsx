import { Check, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Loader from '../components/Loader'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { money } from '../lib/format'
import { supabase } from '../lib/supabase'

/**
 * ROUTE: /checkout
 * PRIVÉ: client connecté
 * BUT: adresse de livraison + création de commande.
 * SUPABASE: addresses + RPC checkout_cart(p_address_id).
 * ATTENTION: le comportement réel du checkout dépend aussi de la fonction SQL côté Supabase.
 */

const blank = { label: 'Domicile', full_name: '', phone: '', country_code: 'CD', address_line1: '', address_line2: '', district: '', city: '', state_region: '', postal_code: '', instructions: '', is_default: false }

export default function CheckoutPage() {
  const { user, profile } = useAuth()
  const { items, total, refreshCart } = useCart()
  const navigate = useNavigate()
  const [addresses, setAddresses] = useState([])
  const [selected, setSelected] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...blank })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function loadAddresses() {
    const { data } = await supabase.from('addresses').select('*').eq('customer_id', user.id).order('is_default', { ascending: false }).order('created_at')
    setAddresses(data || [])
    if (!selected && data?.length) setSelected(data[0].id)
    setLoading(false)
  }
  useEffect(() => { if (user) { setForm(v => ({ ...v, full_name: profile?.full_name || '', phone: profile?.phone || '', country_code: profile?.country_code || 'CD' })); loadAddresses() } }, [user])

  async function saveAddress(e) {
    e.preventDefault(); setError('')
    const payload = { ...form, customer_id: user.id, address_line2: form.address_line2 || null, district: form.district || null, state_region: form.state_region || null, postal_code: form.postal_code || null, instructions: form.instructions || null }
    const { data, error: insertError } = await supabase.from('addresses').insert(payload).select().single()
    if (insertError) return setError(insertError.message)
    setShowForm(false); setForm({ ...blank, full_name: profile?.full_name || '', phone: profile?.phone || '', country_code: profile?.country_code || 'CD' }); await loadAddresses(); setSelected(data.id)
  }

  async function checkout() {
    if (!selected) return setError('Choisis une adresse de livraison.')
    setSubmitting(true); setError('')
    const { data, error: rpcError } = await supabase.rpc('checkout_cart', { p_address_id: selected })
    if (rpcError) { setError(rpcError.message); setSubmitting(false); return }
    await refreshCart(); navigate(`/orders/${data}`)
  }

  if (loading) return <Loader fullscreen />
  return <main className="section-shell page-space"><div className="page-title"><span className="eyebrow">Checkout</span><h1>Finaliser la commande</h1><p>Le paiement et la livraison seront ensuite organisés avec chaque vendeur dans le chat.</p></div><div className="checkout-layout"><div><section className="checkout-section"><div className="section-heading compact"><h2>Adresse de livraison</h2><button className="text-button" onClick={() => setShowForm(v => !v)}><Plus size={17} /> Nouvelle adresse</button></div>{addresses.length ? <div className="address-grid">{addresses.map(a => <button key={a.id} className={`address-card ${selected === a.id ? 'active' : ''}`} onClick={() => setSelected(a.id)}><div className="address-check">{selected === a.id && <Check size={15} />}</div><strong>{a.label || 'Adresse'}</strong><span>{a.full_name} · {a.phone}</span><span>{a.address_line1}{a.address_line2 ? `, ${a.address_line2}` : ''}</span><span>{[a.district, a.city, a.state_region, a.postal_code].filter(Boolean).join(', ')}</span><small>{a.country_code === 'US' ? 'États-Unis' : 'République démocratique du Congo'}</small></button>)}</div> : <div className="soft-panel"><p>Ajoute une adresse pour continuer.</p></div>}{showForm && <form className="address-form" onSubmit={saveAddress}><div className="form-grid"><label>Nom complet<input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}/></label><label>Téléphone<input required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+243… / +1…"/></label><label>Pays<select value={form.country_code} onChange={e => setForm({ ...form, country_code: e.target.value })}><option value="CD">RDC</option><option value="US">États-Unis</option></select></label><label>Libellé<input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Domicile"/></label><label className="span-2">Adresse<input required value={form.address_line1} onChange={e => setForm({ ...form, address_line1: e.target.value })} placeholder="Rue, avenue, numéro…"/></label><label className="span-2">Complément<input value={form.address_line2} onChange={e => setForm({ ...form, address_line2: e.target.value })} placeholder="Appartement, bâtiment…"/></label>{form.country_code === 'CD' ? <label>Commune / quartier<input value={form.district} onChange={e => setForm({ ...form, district: e.target.value })}/></label> : <><label>État<input required value={form.state_region} onChange={e => setForm({ ...form, state_region: e.target.value })}/></label><label>ZIP code<input required value={form.postal_code} onChange={e => setForm({ ...form, postal_code: e.target.value })}/></label></>}<label>Ville<input required value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}/></label><label className="span-2">Instructions<input value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} placeholder="Repère ou consigne de livraison"/></label></div><button className="button secondary">Enregistrer l’adresse</button></form>}</section></div><aside className="summary-card"><h3>Commande</h3><div><span>{items.reduce((s,i) => s+i.quantity,0)} article(s)</span><strong>{money(total, 'USD')}</strong></div><div><span>Livraison</span><span>À convenir</span></div><hr/><div className="summary-total"><span>Total articles</span><strong>{money(total, 'USD')}</strong></div>{error && <div className="alert error">{error}</div>}<button className="button primary full" disabled={submitting || !items.length} onClick={checkout}>{submitting ? 'Création…' : 'Passer la commande'}</button><p>Une boutique peut refuser une commande avant le paiement, notamment pour une livraison internationale.</p></aside></div></main>
}
