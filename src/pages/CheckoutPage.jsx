import { Banknote, Check, LocateFixed, MapPin, MessageCircle, Plus, Truck, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Loader from '../components/Loader'
import SmartImage from '../components/SmartImage'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { ADDRESS_TYPES, DELIVERY_CITIES, addressLines, addressPayload, addressTypeLabel, blankAddress, validateAddress } from '../lib/address'
import { cdf, DELIVERY_OPTIONS, deliveryOption } from '../lib/delivery'
import { money } from '../lib/format'
import { supabase } from '../lib/supabase'
import { logTechnicalError, userError } from '../lib/userErrors'

const DEFAULT_PAYMENT_SETTINGS = {
  cod_enabled: true,
  mobile_money_enabled: false,
  mobile_money_whatsapp: '243995585991',
  mobile_money_display: '0995585991',
}

function whatsappDigits(value) {
  let digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('0')) digits = `243${digits.slice(1)}`
  return digits
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
  const [form, setForm] = useState(() => blankAddress())
  const [loading, setLoading] = useState(true)
  const [savingAddress, setSavingAddress] = useState(false)
  const [locating, setLocating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [customerNote, setCustomerNote] = useState('')
  const [buyItem, setBuyItem] = useState(null)
  const [selectedDelivery, setSelectedDelivery] = useState(deliveryMethod || 'standard')
  const [deliverySaving, setDeliverySaving] = useState(false)
  const [paymentSettings, setPaymentSettings] = useState(DEFAULT_PAYMENT_SETTINGS)
  const [paymentMethod, setPaymentMethod] = useState('cod')

  useEffect(() => { setSelectedDelivery(deliveryMethod || 'standard') }, [deliveryMethod])
  useEffect(() => { setForm(current => ({ ...current, full_name: current.full_name || profile?.full_name || '', phone: current.phone || profile?.phone || '' })) }, [profile?.full_name, profile?.phone])

  useEffect(() => {
    let active = true
    supabase.from('marketplace_settings').select('value').eq('key', 'payments').maybeSingle().then(({ data, error: settingsError }) => {
      if (!active) return
      if (settingsError) {
        logTechnicalError('checkout-payment-settings', settingsError)
        return
      }
      if (!data?.value) return
      const next = { ...DEFAULT_PAYMENT_SETTINGS, ...data.value }
      setPaymentSettings(next)
      if (!next.cod_enabled && next.mobile_money_enabled) setPaymentMethod('mobile_money')
      if (!next.mobile_money_enabled && next.cod_enabled) setPaymentMethod('cod')
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!user?.id) return undefined
    let active = true
    setLoading(true)
    setError('')

    ;(async () => {
      const addressResult = await supabase
        .from('addresses')
        .select('id,address_type,label,full_name,phone,whatsapp_phone,country_code,address_line1,address_line2,commune,district,city,state_region,instructions,is_default,building,apartment,landmark,latitude,longitude,created_at')
        .eq('customer_id', user.id)
        .eq('country_code', 'CD')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })
      if (addressResult.error) throw addressResult.error
      if (!active) return
      setAddresses(addressResult.data || [])
      if (addressResult.data?.length) setSelected(current => current || addressResult.data[0].id)
      else setShowForm(true)

      if (buyNowMode && buyProductId) {
        const productResult = await supabase
          .from('products')
          .select('id,store_id,name,price,currency,stock_qty,has_variants,is_active')
          .eq('id', buyProductId)
          .eq('is_active', true)
          .maybeSingle()
        if (productResult.error) throw productResult.error
        const product = productResult.data
        if (!product || !active) { setBuyItem(null); return }

        const [storeResult, imagesResult, variantResult] = await Promise.all([
          supabase.from('stores').select('id,name,slug,country_code,status').eq('id', product.store_id).eq('country_code', 'CD').eq('status', 'active').maybeSingle(),
          supabase.from('product_images').select('secure_url,sort_order').eq('product_id', product.id).order('sort_order').limit(1),
          buyVariantId ? supabase.from('product_variants').select('id,product_id,price,stock_qty,attributes,is_active').eq('id', buyVariantId).eq('product_id', product.id).eq('is_active', true).maybeSingle() : Promise.resolve({ data: null, error: null }),
        ])
        if (storeResult.error) throw storeResult.error
        if (imagesResult.error) throw imagesResult.error
        if (variantResult.error) throw variantResult.error
        if (!active) return
        const variant = variantResult.data || null
        setBuyItem({ product, variant, store: storeResult.data, image: imagesResult.data?.[0]?.secure_url || '', unitPrice: Number(variant?.price ?? product.price ?? 0), quantity: buyQuantity })
      }
    })().catch(loadError => {
      if (!active) return
      logTechnicalError('checkout-load', loadError)
      setError(userError(loadError, 'checkout'))
    }).finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [user?.id, buyNowMode, buyProductId, buyVariantId, buyQuantity])

  const checkoutItems = useMemo(() => buyNowMode
    ? (buyItem ? [buyItem] : [])
    : items.map(item => ({ product: item.product, variant: item.variant, store: item.store, image: item.image, unitPrice: item.unitPrice, quantity: item.quantity })), [buyNowMode, buyItem, items])
  const checkoutTotal = useMemo(() => buyNowMode ? (buyItem ? buyItem.unitPrice * buyItem.quantity : 0) : total, [buyNowMode, buyItem, total])
  const checkoutCount = checkoutItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  const chosenDelivery = deliveryOption(selectedDelivery)
  const displayedDeliveryFee = selectedDelivery === deliveryMethod ? deliveryFeeCdf : chosenDelivery.feeCdf
  const selectedAddress = addresses.find(address => address.id === selected) || null
  const mobileMoneyNumber = paymentSettings.mobile_money_display || paymentSettings.mobile_money_whatsapp || '0995585991'

  function resetAddressForm() {
    setForm(blankAddress(profile || {}))
    setFormError('')
  }

  function chooseAddressType(code) {
    setForm(current => ({ ...current, address_type: code, label: code === 'home' ? 'Maison' : code === 'work' ? 'Travail' : current.address_type === 'other' ? current.label : '' }))
  }

  function chooseCity(city) {
    const cityData = DELIVERY_CITIES.find(item => item.city === city)
    setForm(current => ({ ...current, city, state_region: cityData?.region || current.state_region }))
  }

  async function saveAddress(event) {
    event.preventDefault()
    if (!user?.id || savingAddress) return
    setFormError('')
    const validation = validateAddress(form)
    if (validation) return setFormError(validation)

    setSavingAddress(true)
    try {
      const payload = addressPayload(form, user.id)
      if (payload.is_default) {
        const resetResult = await supabase.from('addresses').update({ is_default: false }).eq('customer_id', user.id).eq('is_default', true)
        if (resetResult.error) throw resetResult.error
      }
      if (!addresses.length) payload.is_default = true
      const result = await supabase.from('addresses').insert(payload).select('id,customer_id,address_type,label,full_name,phone,whatsapp_phone,country_code,address_line1,address_line2,commune,district,city,state_region,postal_code,instructions,is_default,building,apartment,landmark,latitude,longitude,created_at,updated_at').single()
      if (result.error) throw result.error
      setAddresses(current => [result.data, ...current.map(address => payload.is_default ? { ...address, is_default: false } : address)])
      setSelected(result.data.id)
      setShowForm(false)
      resetAddressForm()
    } catch (addressError) {
      logTechnicalError('checkout-save-address', addressError)
      setFormError(userError(addressError, 'address'))
    } finally {
      setSavingAddress(false)
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation || locating) return setFormError('La localisation n’est pas disponible sur cet appareil.')
    setLocating(true)
    setFormError('')
    navigator.geolocation.getCurrentPosition(
      position => {
        setForm(current => ({ ...current, latitude: position.coords.latitude, longitude: position.coords.longitude }))
        setLocating(false)
      },
      () => {
        setFormError('Votre position n’a pas pu être récupérée. Vous pouvez continuer avec l’adresse écrite.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  async function chooseDelivery(code) {
    if (deliverySaving) return
    setSelectedDelivery(code)
    setDeliverySaving(true)
    setError('')
    try { await setDeliveryMethod(code) }
    catch (deliveryError) {
      logTechnicalError('checkout-delivery', deliveryError)
      setError(userError(deliveryError, 'delivery'))
    } finally { setDeliverySaving(false) }
  }

  async function checkout() {
    if (!selected) return setError('Choisissez une adresse de livraison.')
    if (!checkoutItems.length) return setError('Votre panier ne contient aucun article à commander.')
    if (paymentMethod === 'cod' && !paymentSettings.cod_enabled) return setError('Le paiement à la livraison est momentanément indisponible.')
    if (paymentMethod === 'mobile_money' && !paymentSettings.mobile_money_enabled) return setError('Le paiement Mobile Money est momentanément indisponible.')

    const whatsappWindow = paymentMethod === 'mobile_money' ? window.open('about:blank', '_blank') : null
    setSubmitting(true)
    setError('')

    try {
      const common = { p_address_id: selected, p_customer_note: customerNote.trim() || null, p_delivery_method: selectedDelivery, p_payment_method: paymentMethod }
      const result = buyNowMode
        ? await supabase.rpc('checkout_buy_now', { ...common, p_product_id: buyProductId, p_product_variant_id: buyVariantId || null, p_quantity: buyQuantity })
        : await supabase.rpc('checkout_cart', common)
      if (result.error) throw result.error
      if (!result.data) throw new Error('ORDER_NOT_FOUND')

      if (!buyNowMode) await refreshCart()

      if (paymentMethod === 'mobile_money') {
        const orderResult = await supabase.from('orders').select('order_number').eq('id', result.data).maybeSingle()
        const orderNumber = orderResult.data?.order_number || 'One Market'
        const digits = whatsappDigits(paymentSettings.mobile_money_whatsapp || mobileMoneyNumber)
        const text = encodeURIComponent(`Bonjour One Market, je souhaite finaliser le paiement Mobile Money de ma commande ${orderNumber}. Total produits : ${money(checkoutTotal, 'USD')} + livraison ${cdf(displayedDeliveryFee)}.`)
        const whatsappUrl = `https://wa.me/${digits}?text=${text}`
        if (whatsappWindow && !whatsappWindow.closed) whatsappWindow.location.href = whatsappUrl
      }

      navigate(`/orders/${result.data}`)
    } catch (checkoutError) {
      whatsappWindow?.close()
      logTechnicalError('checkout-submit', checkoutError)
      setError(userError(checkoutError, 'checkout'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Loader fullscreen />

  return (
    <main className="section-shell checkout-market-page">
      <div className="page-title checkout-page-title"><span className="eyebrow">Commande One Market</span><h1>{buyNowMode ? 'Acheter maintenant' : 'Finaliser la commande'}</h1><p>Vérifiez les articles, l’adresse, la livraison et le paiement avant de confirmer.</p></div>

      <div className="checkout-market-layout">
        <div className="checkout-market-main">
          <section className="checkout-market-section">
            <div className="checkout-market-section-head"><span>1</span><div><h2>Articles</h2><p>{checkoutCount} article{checkoutCount > 1 ? 's' : ''}</p></div></div>
            <div className="checkout-item-list">{checkoutItems.map((item, index) => <article className="checkout-item-row" key={`${item.product?.id}-${item.variant?.id || index}`}><SmartImage src={item.image} alt={item.product?.name || ''} fit="contain" className="checkout-item-image" width={220}/><div className="checkout-item-main"><span>{item.store?.name || 'Boutique One Market'}</span><strong>{item.product?.name}</strong>{item.variant && <small>{Object.values(item.variant.attributes || {}).join(' · ')}</small>}</div><div className="checkout-item-qty"><span>Qté</span><b>{item.quantity}</b></div><div className="checkout-item-price"><span>{money(item.unitPrice, item.product?.currency || 'USD')}</span><strong>{money(item.unitPrice * item.quantity, item.product?.currency || 'USD')}</strong></div></article>)}{!checkoutItems.length && <div className="soft-panel"><p>Aucun article disponible.</p><Link to="/catalog">Retour au catalogue</Link></div>}</div>
          </section>

          <section className="checkout-market-section">
            <div className="checkout-market-section-head"><span>2</span><div><h2>Adresse de livraison</h2><p>Choisissez où recevoir votre commande.</p></div><button className="text-button" type="button" onClick={() => { setShowForm(value => !value); resetAddressForm() }}><Plus size={17}/> Nouvelle adresse</button></div>

            {addresses.length ? <div className="address-grid checkout-address-grid">{addresses.map(address => <button type="button" key={address.id} className={`address-card ${selected === address.id ? 'active' : ''}`} onClick={() => setSelected(address.id)}><div className="address-check">{selected === address.id && <Check size={15}/>}</div><div className="address-card-title"><strong>{addressTypeLabel(address.address_type, address.label)}</strong>{address.is_default && <small>Par défaut</small>}</div><span>{address.full_name} · {address.phone}</span>{addressLines(address).map((line, index) => <span key={index}>{line}</span>)}<small>République démocratique du Congo</small></button>)}</div> : <div className="soft-panel"><p>Ajoutez une adresse pour continuer.</p></div>}

            {showForm && <form className="address-form checkout-address-form ecommerce-address-form" onSubmit={saveAddress} noValidate>
              <fieldset className="address-type-fieldset"><legend>Enregistrer cette adresse comme</legend><div className="address-type-options">{ADDRESS_TYPES.map(type => <button type="button" key={type.code} className={form.address_type === type.code ? 'active' : ''} onClick={() => chooseAddressType(type.code)}>{type.label}</button>)}</div></fieldset>
              {form.address_type === 'other' && <label>Nom de l’adresse<input required value={form.label} onChange={event => setForm({ ...form, label: event.target.value })} placeholder="Ex. Chez maman, Entrepôt"/></label>}
              <div className="form-grid">
                <label>Nom complet<input required autoComplete="name" value={form.full_name} onChange={event => setForm({ ...form, full_name: event.target.value })} placeholder="Nom du destinataire"/></label>
                <label>Numéro de téléphone<input required inputMode="tel" autoComplete="tel" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="+243 9xx xxx xxx"/></label>
                <label>Numéro WhatsApp <small>Facultatif</small><input inputMode="tel" value={form.whatsapp_phone} onChange={event => setForm({ ...form, whatsapp_phone: event.target.value })} placeholder="Si différent du numéro principal"/></label>
                <label>Ville<select required value={form.city} onChange={event => chooseCity(event.target.value)}>{DELIVERY_CITIES.map(item => <option key={item.city} value={item.city}>{item.city}</option>)}</select></label>
                <label>Commune <small>Facultatif</small><input value={form.commune || ''} onChange={event => setForm({ ...form, commune: event.target.value })} placeholder="Ex. Lubumbashi"/></label><label>Quartier<input required value={form.district} onChange={event => setForm({ ...form, district: event.target.value })} placeholder="Ex. Golf, Kampemba…"/></label>
                <label>Avenue / rue<input required value={form.address_line1} onChange={event => setForm({ ...form, address_line1: event.target.value })} placeholder="Ex. Avenue Kasa-Vubu"/></label>
                <label>Numéro / parcelle <small>Facultatif</small><input value={form.address_line2} onChange={event => setForm({ ...form, address_line2: event.target.value })} placeholder="Ex. 24"/></label>
                <label>Immeuble / résidence <small>Facultatif</small><input value={form.building} onChange={event => setForm({ ...form, building: event.target.value })} placeholder="Ex. Résidence Mwangaza"/></label>
                <label>Appartement / étage <small>Facultatif</small><input value={form.apartment} onChange={event => setForm({ ...form, apartment: event.target.value })} placeholder="Ex. Appartement 4, 2e étage"/></label>
                <label className="span-2">Point de repère <small>Recommandé</small><input value={form.landmark} onChange={event => setForm({ ...form, landmark: event.target.value })} placeholder="Ex. En face de l’église, à côté de la station-service…"/></label>
                <label className="span-2">Instructions pour le livreur <small>Facultatif</small><textarea rows="3" maxLength="300" value={form.instructions} onChange={event => setForm({ ...form, instructions: event.target.value })} placeholder="Ex. Appelez-moi en arrivant, portail bleu…"/></label>
              </div>
              <div className="address-form-tools"><button className="button secondary" type="button" disabled={locating} onClick={useCurrentLocation}><LocateFixed size={17}/>{locating ? 'Localisation…' : form.latitude ? 'Position ajoutée' : 'Préciser ma position'}</button><label className="address-default-check"><input type="checkbox" checked={form.is_default} onChange={event => setForm({ ...form, is_default: event.target.checked })}/><span>Utiliser comme adresse par défaut</span></label></div>
              {formError && <div className="alert error" role="alert">{formError}</div>}
              <div className="address-form-actions"><button className="button secondary" type="button" onClick={() => setShowForm(false)}>Annuler</button><button className="button primary" disabled={savingAddress}>{savingAddress ? 'Enregistrement…' : 'Enregistrer l’adresse'}</button></div>
            </form>}
          </section>

          <section className="checkout-market-section">
            <div className="checkout-market-section-head"><span>3</span><div><h2>Livraison</h2><p>Choisissez le service qui vous convient.</p></div></div>
            <div className="checkout-delivery-grid">{DELIVERY_OPTIONS.map(option => <button type="button" disabled={deliverySaving} key={option.code} className={`checkout-delivery-option ${selectedDelivery === option.code ? 'active' : ''}`} onClick={() => chooseDelivery(option.code)}><div className="checkout-delivery-icon">{option.code === 'express' ? <Zap size={21}/> : <Truck size={21}/>}</div><div><strong>{option.label}</strong><span>{option.description}</span></div><b>{cdf(option.feeCdf)}</b><div className="payment-radio">{selectedDelivery === option.code && <Check size={15}/>}</div></button>)}</div>
          </section>

          <section className="checkout-market-section">
            <div className="checkout-market-section-head"><span>4</span><div><h2>Mode de paiement</h2><p>Choisissez comment régler votre commande.</p></div></div>
            <div className="payment-method-grid">
              {paymentSettings.cod_enabled && <button type="button" className={`payment-method-card ${paymentMethod === 'cod' ? 'active' : ''}`} onClick={() => setPaymentMethod('cod')}><Banknote size={22}/><span><strong>Paiement à la livraison</strong><small>Payez au livreur lorsque vous recevez votre commande.</small></span><span className="payment-radio">{paymentMethod === 'cod' && <Check size={15}/>}</span></button>}
              {paymentSettings.mobile_money_enabled && <button type="button" className={`payment-method-card ${paymentMethod === 'mobile_money' ? 'active' : ''}`} onClick={() => setPaymentMethod('mobile_money')}><MessageCircle size={22}/><span><strong>Mobile Money</strong><small>Finalisez le paiement avec One Market via WhatsApp.</small></span><span className="payment-radio">{paymentMethod === 'mobile_money' && <Check size={15}/>}</span></button>}
            </div>
            <label className="checkout-note-label">Instructions concernant la commande <small>Facultatif</small><textarea rows="3" maxLength="400" value={customerNote} onChange={event => setCustomerNote(event.target.value)} placeholder="Une précision utile concernant votre commande…"/></label>
          </section>

          <section className="checkout-market-section checkout-review-section">
            <div className="checkout-market-section-head"><span>5</span><div><h2>Vérification</h2><p>Contrôlez les informations avant de confirmer.</p></div></div>
            <div className="checkout-review-grid">
              <div><MapPin size={18}/><span><strong>Livraison à</strong>{selectedAddress ? <>{<b>{addressTypeLabel(selectedAddress.address_type, selectedAddress.label)}</b>}<small>{selectedAddress.full_name} · {selectedAddress.phone}</small>{addressLines(selectedAddress).map((line, index) => <small key={index}>{line}</small>)}</> : <small>Aucune adresse sélectionnée</small>}</span>{selectedAddress && <button type="button" onClick={() => document.querySelector('.checkout-address-grid')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Modifier</button>}</div>
              <div><Truck size={18}/><span><strong>Livraison</strong><b>{chosenDelivery.label}</b><small>{cdf(displayedDeliveryFee)}</small></span></div>
              <div><Banknote size={18}/><span><strong>Paiement</strong><b>{paymentMethod === 'mobile_money' ? 'Mobile Money' : 'Paiement à la livraison'}</b><small>{paymentMethod === 'mobile_money' ? `Assistance : ${mobileMoneyNumber}` : 'À régler à la réception'}</small></span></div>
            </div>
          </section>

          {error && <div className="alert error checkout-global-error" role="alert">{error}</div>}
        </div>

        <aside className="checkout-summary-card">
          <h2>Résumé</h2>
          <div><span>Produits ({checkoutCount})</span><strong>{money(checkoutTotal, 'USD')}</strong></div>
          <div><span>Livraison</span><strong>{cdf(displayedDeliveryFee)}</strong></div>
          <p className="checkout-currency-note">Les produits sont facturés en USD et la livraison en CDF. Ces montants ne sont pas mélangés dans un total artificiel.</p>
          <button className="button primary full" type="button" disabled={submitting || !selected || !checkoutItems.length} onClick={checkout}>{submitting ? 'Enregistrement de la commande…' : 'Passer la commande'}</button>
          <small>Votre commande n’est confirmée qu’après son enregistrement réussi dans One Market.</small>
        </aside>
      </div>
    </main>
  )
}