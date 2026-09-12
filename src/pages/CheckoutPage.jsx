import { Banknote, Check, CreditCard, Plus, Smartphone, Truck, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Loader from '../components/Loader'
import SmartImage from '../components/SmartImage'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { cdf, DELIVERY_OPTIONS, deliveryOption } from '../lib/delivery'
import { money } from '../lib/format'
import { supabase } from '../lib/supabase'

const blank = {
  label: 'Domicile', full_name: '', phone: '', country_code: 'CD', address_line1: '', address_line2: '', district: '', city: 'Lubumbashi', state_region: 'Haut-Katanga', postal_code: '', instructions: '', is_default: false,
}

function checkoutErrorMessage(message) {
  return {
    DELIVERY_METHOD_UNAVAILABLE: 'Ce mode de livraison n’est pas disponible.',
    INSUFFICIENT_STOCK: 'Le stock a changé. Retourne au panier pour vérifier les quantités.',
    ADDRESS_NOT_FOUND: 'Cette adresse de livraison n’est plus disponible.',
    PRODUCT_UNAVAILABLE: 'Un produit de la commande n’est plus disponible.',
    STORE_UNAVAILABLE: 'Une boutique de la commande n’est plus disponible.',
  }[message] || message
}

export default function CheckoutPage() {
  const { user, profile } = useAuth()
  const { items, total, deliveryMethod, deliveryFeeCdf, setDeliveryMethod, refreshCart } = useCart()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const buyNowMode = params.get('mode') === 'buy-now'
  const buyProductId = params.get('product') || ''
  const buyVariantId = params.get('variant') || ''
  const buyQuantity = Math.max(1, Math.min(99, Number(params.get('qty')) || 1))

  const [addresses, setAddresses] = useState([])
  const [selected, setSelected] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...blank })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [customerNote, setCustomerNote] = useState('')
  const [buyItem, setBuyItem] = useState(null)
  const [selectedDelivery, setSelectedDelivery] = useState(deliveryMethod || 'standard')
  const [deliverySaving, setDeliverySaving] = useState(false)

  useEffect(() => { setSelectedDelivery(deliveryMethod || 'standard') }, [deliveryMethod])

  useEffect(() => {
    if (!user?.id) return undefined
    let active = true
    setForm(current => ({ ...current, full_name: current.full_name || profile?.full_name || '', phone: current.phone || profile?.phone || '', country_code: 'CD' }))

    ;(async () => {
      const { data } = await supabase.from('addresses').select('*').eq('customer_id', user.id).eq('country_code', 'CD').order('is_default', { ascending: false }).order('created_at')
      if (!active) return
      setAddresses(data || [])
      if (data?.length) setSelected(current => current || data[0].id)

      if (buyNowMode && buyProductId) {
        const { data: product } = await supabase.from('products').select('*').eq('id', buyProductId).eq('is_active', true).maybeSingle()
        if (!product || !active) { setBuyItem(null); return }
        const [{ data: store }, { data: images }, variantResult] = await Promise.all([
          supabase.from('stores').select('id,name,slug,country_code,status').eq('id', product.store_id).eq('country_code', 'CD').eq('status', 'active').maybeSingle(),
          supabase.from('product_images').select('secure_url,sort_order').eq('product_id', product.id).order('sort_order').limit(1),
          buyVariantId ? supabase.from('product_variants').select('*').eq('id', buyVariantId).eq('product_id', product.id).eq('is_active', true).maybeSingle() : Promise.resolve({ data: null }),
        ])
        if (!active) return
        const variant = variantResult.data || null
        setBuyItem({ product, variant, store, image: images?.[0]?.secure_url || '', unitPrice: Number(variant?.price ?? product.price ?? 0), quantity: buyQuantity })
      }
    })().catch(() => { if (active) setError('Impossible de préparer le checkout.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user?.id, profile?.full_name, profile?.phone, buyNowMode, buyProductId, buyVariantId, buyQuantity])

  async function saveAddress(event) {
    event.preventDefault(); setError('')
    const payload = { ...form, customer_id: user.id, country_code: 'CD', address_line2: form.address_line2 || null, district: form.district || null, state_region: form.state_region || null, postal_code: form.postal_code || null, instructions: form.instructions || null }
    if (payload.is_default) await supabase.from('addresses').update({ is_default: false }).eq('customer_id', user.id)
    const { data, error: insertError } = await supabase.from('addresses').insert(payload).select().single()
    if (insertError) return setError(insertError.message)
    setAddresses(current => [data, ...current.map(address => payload.is_default ? { ...address, is_default: false } : address)])
    setSelected(data.id); setShowForm(false); setForm({ ...blank, full_name: profile?.full_name || '', phone: profile?.phone || '' })
  }

  const checkoutItems = useMemo(() => buyNowMode ? (buyItem ? [buyItem] : []) : items.map(item => ({ product: item.product, variant: item.variant, store: item.store, image: item.image, unitPrice: item.unitPrice, quantity: item.quantity })), [buyNowMode, buyItem, items])
  const checkoutTotal = useMemo(() => buyNowMode ? (buyItem ? buyItem.unitPrice * buyItem.quantity : 0) : total, [buyNowMode, buyItem, total])
  const checkoutCount = checkoutItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  const chosenDelivery = deliveryOption(selectedDelivery)
  const displayedDeliveryFee = selectedDelivery === deliveryMethod ? deliveryFeeCdf : chosenDelivery.feeCdf

  async function chooseDelivery(code) {
    if (deliverySaving) return
    setSelectedDelivery(code); setDeliverySaving(true); setError('')
    try { await setDeliveryMethod(code) }
    catch (e) { setError(e?.message || 'Impossible de modifier la livraison.') }
    finally { setDeliverySaving(false) }
  }

  async function checkout() {
    if (!selected) return setError('Choisis une adresse de livraison.')
    if (paymentMethod !== 'cod') return setError('Ce mode de paiement n’est pas encore disponible.')
    if (!checkoutItems.length) return setError('Aucun article à commander.')
    setSubmitting(true); setError('')

    const common = { p_address_id: selected, p_customer_note: customerNote.trim() || null, p_delivery_method: selectedDelivery }
    const result = buyNowMode
      ? await supabase.rpc('checkout_buy_now', { ...common, p_product_id: buyProductId, p_product_variant_id: buyVariantId || null, p_quantity: buyQuantity, p_payment_method: paymentMethod })
      : await supabase.rpc('checkout_cart', common)

    if (result.error) {
      setError(checkoutErrorMessage(result.error.message))
      setSubmitting(false)
      return
    }

    if (!buyNowMode) await refreshCart()
    navigate(`/orders/${result.data}`)
  }

  if (loading) return <Loader fullscreen />

  return (
    <main className="section-shell checkout-market-page">
      <div className="page-title checkout-page-title"><span className="eyebrow">Commande One Market</span><h1>{buyNowMode ? 'Acheter maintenant' : 'Finaliser la commande'}</h1><p>Vérifiez les articles, l’adresse, la livraison et le paiement.</p></div>
      <div className="checkout-market-layout">
        <div className="checkout-market-main">
          <section className="checkout-market-section"><div className="checkout-market-section-head"><span>1</span><div><h2>Articles</h2><p>{checkoutCount} article{checkoutCount > 1 ? 's' : ''}</p></div></div><div className="checkout-item-list">{checkoutItems.map((item, index) => <article className="checkout-item-row" key={`${item.product?.id}-${item.variant?.id || index}`}><SmartImage src={item.image} alt={item.product?.name || ''} fallback="OM" fit="contain" className="checkout-item-image" width={220}/><div className="checkout-item-main"><span>{item.store?.name || 'Boutique One Market'}</span><strong>{item.product?.name}</strong>{item.variant && <small>{Object.values(item.variant.attributes || {}).join(' · ')}</small>}</div><div className="checkout-item-qty"><span>Qté</span><b>{item.quantity}</b></div><div className="checkout-item-price"><span>{money(item.unitPrice, item.product?.currency || 'USD')}</span><strong>{money(item.unitPrice * item.quantity, item.product?.currency || 'USD')}</strong></div></article>)}{!checkoutItems.length && <div className="soft-panel"><p>Aucun article disponible.</p><Link to="/catalog">Retour au catalogue</Link></div>}</div></section>

          <section className="checkout-market-section"><div className="checkout-market-section-head"><span>2</span><div><h2>Adresse de livraison</h2><p>Livraison en RDC</p></div><button className="text-button" onClick={() => setShowForm(value => !value)}><Plus size={17}/> Nouvelle adresse</button></div>{addresses.length ? <div className="address-grid checkout-address-grid">{addresses.map(address => <button type="button" key={address.id} className={`address-card ${selected === address.id ? 'active' : ''}`} onClick={() => setSelected(address.id)}><div className="address-check">{selected === address.id && <Check size={15}/>}</div><strong>{address.label || 'Adresse'}</strong><span>{address.full_name} · {address.phone}</span><span>{address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ''}</span><span>{[address.district, address.city, address.state_region].filter(Boolean).join(', ')}</span><small>République démocratique du Congo</small></button>)}</div> : <div className="soft-panel"><p>Ajoute une adresse pour continuer.</p></div>}{showForm && <form className="address-form checkout-address-form" onSubmit={saveAddress}><div className="form-grid"><label>Nom complet<input required value={form.full_name} onChange={event => setForm({ ...form, full_name: event.target.value })}/></label><label>Téléphone<input required value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="+243…"/></label><label>Libellé<input value={form.label} onChange={event => setForm({ ...form, label: event.target.value })}/></label><label>Ville<input required value={form.city} onChange={event => setForm({ ...form, city: event.target.value })}/></label><label className="span-2">Adresse<input required value={form.address_line1} onChange={event => setForm({ ...form, address_line1: event.target.value })}/></label><label>Commune / quartier<input value={form.district} onChange={event => setForm({ ...form, district: event.target.value })}/></label><label>Province<input value={form.state_region} onChange={event => setForm({ ...form, state_region: event.target.value })}/></label><label className="span-2">Complément<input value={form.address_line2} onChange={event => setForm({ ...form, address_line2: event.target.value })}/></label><label className="span-2">Instructions<input value={form.instructions} onChange={event => setForm({ ...form, instructions: event.target.value })}/></label></div><button className="button secondary">Enregistrer l’adresse</button></form>}</section>

          <section className="checkout-market-section"><div className="checkout-market-section-head"><span>3</span><div><h2>Livraison</h2><p>Le tarif final est calculé côté serveur.</p></div></div><div className="checkout-delivery-grid">{DELIVERY_OPTIONS.map(option => <button type="button" disabled={deliverySaving} key={option.code} className={`checkout-delivery-option ${selectedDelivery === option.code ? 'active' : ''}`} onClick={() => chooseDelivery(option.code)}><div className="checkout-delivery-icon">{option.code === 'express' ? <Zap size={21}/> : <Truck size={21}/>}</div><div><strong>{option.label}</strong><span>{option.description}</span></div><b>{cdf(option.feeCdf)}</b><div className="payment-radio">{selectedDelivery === option.code && <Check size={15}/>}</div></button>)}</div></section>

          <section className="checkout-market-section"><div className="checkout-market-section-head"><span>4</span><div><h2>Mode de paiement</h2><p>Choisissez un moyen disponible</p></div></div><div className="payment-method-grid"><button type="button" className={`payment-method-card ${paymentMethod === 'cod' ? 'active' : ''}`} onClick={() => setPaymentMethod('cod')}><div className="payment-method-icon"><Banknote size={24}/></div><div><strong>Paiement à la livraison</strong><span>Payez à la réception</span><small>Disponible</small></div><div className="payment-radio">{paymentMethod === 'cod' && <Check size={15}/>}</div></button><button type="button" className="payment-method-card disabled" disabled><div className="payment-method-icon"><Smartphone size={24}/></div><div><strong>Mobile Money</strong><span>M-Pesa, Airtel Money, Orange Money</span><small>Bientôt</small></div></button><button type="button" className="payment-method-card disabled" disabled><div className="payment-method-icon"><CreditCard size={24}/></div><div><strong>Carte bancaire</strong><span>Visa / Mastercard</span><small>Bientôt</small></div></button></div></section>

          <section className="checkout-market-section checkout-note-section"><div className="checkout-market-section-head"><span>5</span><div><h2>Note pour la commande</h2><p>Facultatif</p></div></div><textarea value={customerNote} onChange={event => setCustomerNote(event.target.value)} maxLength={500} rows={3} placeholder="Ex. Appelez-moi avant la livraison…"/></section>
        </div>

        <aside className="checkout-market-summary"><div className="checkout-summary-head"><Truck size={21}/><div><strong>Résumé de la commande</strong><span>{chosenDelivery.label}</span></div></div><div className="checkout-summary-line"><span>Articles ({checkoutCount})</span><strong>{money(checkoutTotal, 'USD')}</strong></div><div className="checkout-summary-line"><span>Livraison</span><strong>{cdf(displayedDeliveryFee)}</strong></div><div className="checkout-summary-total"><span>Total produits</span><strong>{money(checkoutTotal, 'USD')}</strong></div><div className="checkout-summary-cdf"><span>+ Livraison</span><strong>{cdf(displayedDeliveryFee)}</strong></div><small className="checkout-currency-note">Produits en USD + livraison en FC, sans conversion arbitraire.</small>{error && <div className="alert error">{error}</div>}<button className="button primary full checkout-confirm-button" disabled={submitting || !checkoutItems.length || !selected} onClick={checkout}>{submitting ? 'Création de la commande…' : 'Confirmer la commande'}</button><p>Le stock et le tarif de livraison sont revérifiés côté Supabase. Aucun débit en ligne n’est effectué pour la V1.</p>{!buyNowMode ? <Link className="checkout-back-cart" to="/cart">Retour au panier</Link> : <Link className="checkout-back-cart" to={`/product/${buyProductId}`}>Retour au produit</Link>}</aside>
      </div>
    </main>
  )
}
