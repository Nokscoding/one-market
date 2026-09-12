import { ArrowRight, Banknote, Crown, Heart, Minus, Plus, ShieldCheck, Store, Trash2, Truck, Zap } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AddedToCartPage from './AddedToCartPage'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import SmartImage from '../components/SmartImage'
import { useCart } from '../context/CartContext'
import { useFavorites } from '../context/FavoritesContext'
import { cdf, DELIVERY_OPTIONS, ONE_MARKET_PLUS } from '../lib/delivery'
import { money } from '../lib/format'

export default function CartPage() {
  const [params] = useSearchParams()
  const { items, loading, count, total, hasIssues, deliveryMethod, deliveryFeeCdf, setDeliveryMethod, updateQuantity, removeItem, clearCart } = useCart()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [busyId, setBusyId] = useState('')
  const [message, setMessage] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const [deliverySaving, setDeliverySaving] = useState(false)
  const [plusOpen, setPlusOpen] = useState(false)

  if (params.get('added') === '1') return <AddedToCartPage />
  if (loading) return <Loader fullscreen />

  if (!items.length) return <main className="section-shell page-space cart-empty-page"><EmptyState title="Votre panier est vide" text="Ajoutez des produits de plusieurs boutiques. One Market organisera automatiquement votre commande par vendeur." action={<Link className="button primary" to="/catalog">Découvrir les produits</Link>}/></main>

  const groups = Object.values(items.reduce((acc, item) => {
    const key = item.store?.id || 'unknown'
    if (!acc[key]) acc[key] = { store: item.store, items: [], subtotal: 0 }
    acc[key].items.push(item)
    acc[key].subtotal += item.unitPrice * item.quantity
    return acc
  }, {}))

  async function changeQuantity(item, nextQuantity) {
    if (busyId) return
    setMessage(''); setBusyId(item.id)
    try { await updateQuantity(item.id, nextQuantity) }
    catch (error) { setMessage(error?.message || 'Impossible de modifier cette quantité.') }
    finally { setBusyId('') }
  }

  async function moveToFavorites(item) {
    if (busyId) return
    setMessage(''); setBusyId(item.id)
    try {
      if (!isFavorite(item.product.id)) await toggleFavorite(item.product.id)
      await removeItem(item.id)
      setMessage('Produit déplacé dans vos favoris.')
    } catch (error) { setMessage(error?.message || 'Impossible de déplacer ce produit.') }
    finally { setBusyId('') }
  }

  async function deleteItem(item) {
    if (busyId) return
    setMessage(''); setBusyId(item.id)
    try { await removeItem(item.id) }
    catch (error) { setMessage(error?.message || 'Impossible de supprimer ce produit.') }
    finally { setBusyId('') }
  }

  async function emptyCart() {
    if (!confirmClear) {
      setConfirmClear(true)
      window.setTimeout(() => setConfirmClear(false), 5000)
      return
    }
    setMessage('')
    try { await clearCart() }
    catch (error) { setMessage(error?.message || 'Impossible de vider le panier.') }
  }

  async function chooseDelivery(code) {
    if (deliverySaving || code === deliveryMethod) return
    setDeliverySaving(true); setMessage('')
    try { await setDeliveryMethod(code) }
    catch (error) { setMessage(error?.message || 'Impossible de modifier la livraison.') }
    finally { setDeliverySaving(false) }
  }

  return (
    <main className="section-shell cart-final-page">
      <div className="cart-final-heading"><div><span className="eyebrow">Panier One Market</span><h1>Votre panier</h1><p>{count} article{count > 1 ? 's' : ''} · {groups.length} boutique{groups.length > 1 ? 's' : ''}</p></div><div className="cart-heading-actions"><Link to="/catalog">Continuer mes achats</Link><button className={confirmClear ? 'is-confirm' : ''} onClick={emptyCart}>{confirmClear ? 'Confirmer : vider le panier' : 'Vider le panier'}</button></div></div>
      {message && <div className="cart-feedback">{message}</div>}
      {hasIssues && <div className="cart-warning"><ShieldCheck size={18}/><span><strong>Votre panier nécessite une vérification.</strong> Corrigez les quantités ou retirez les articles indisponibles avant de commander.</span></div>}

      <div className="cart-final-layout">
        <div className="cart-final-groups">
          {groups.map(group => <section className="cart-store-card" key={group.store?.id || 'unknown'}>
            <header className="cart-store-head"><div className="cart-store-title"><span><Store size={18}/></span><div><strong>{group.store?.name || 'Boutique One Market'}</strong><small>Boutique RDC</small></div></div><div className="cart-store-subtotal"><span>Sous-total boutique</span><strong>{money(group.subtotal, 'USD')}</strong></div></header>
            <div className="cart-store-items">{group.items.map(item => {
              const maxStock = Number(item.availableStock || 0)
              const unavailable = !item.isAvailable
              const quantityIssue = item.quantityTooHigh
              const itemBusy = busyId === item.id
              const lineTotal = item.unitPrice * item.quantity
              return <article className={`cart-final-item ${unavailable || quantityIssue ? 'has-issue' : ''}`} key={item.id}>
                <Link to={`/product/${item.product.id}`} className="cart-final-image-link"><SmartImage src={item.image} alt={item.product.name} fallback="OM" fit="contain" className="cart-final-image" width={220}/></Link>
                <div className="cart-final-product"><Link to={`/product/${item.product.id}`} className="cart-final-name">{item.product.name}</Link>{item.variant && <span className="cart-final-variant">{Object.values(item.variant.attributes || {}).join(' · ')}</span>}<div className="cart-final-stock">{unavailable ? <span className="is-out">Indisponible</span> : quantityIssue ? <span className="is-low">Stock disponible : {maxStock}</span> : maxStock <= 5 ? <span className="is-low">Plus que {maxStock} en stock</span> : <span>En stock</span>}</div><strong className="cart-final-unit-price">{money(item.unitPrice, item.product.currency)} <small>/ unité</small></strong><div className="cart-final-mobile-actions"><button onClick={() => moveToFavorites(item)} disabled={itemBusy}><Heart size={15}/> Mettre en favoris</button><button onClick={() => deleteItem(item)} disabled={itemBusy}><Trash2 size={15}/> Supprimer</button></div></div>
                <div className="cart-final-quantity"><span>Quantité</span><div className="qty-control cart-qty-control"><button disabled={itemBusy || item.quantity <= 1} onClick={() => changeQuantity(item, item.quantity - 1)}><Minus size={15}/></button><span>{item.quantity}</span><button disabled={itemBusy || unavailable || item.quantity >= maxStock} onClick={() => changeQuantity(item, item.quantity + 1)}><Plus size={15}/></button></div><small>{maxStock > 0 ? `Max. ${maxStock}` : 'Stock indisponible'}</small></div>
                <div className="cart-final-line-price"><span>Total</span><strong>{money(lineTotal, item.product.currency)}</strong></div>
                <div className="cart-final-actions"><button title="Mettre dans les favoris" onClick={() => moveToFavorites(item)} disabled={itemBusy}><Heart size={18}/></button><button title="Supprimer" className="danger" onClick={() => deleteItem(item)} disabled={itemBusy}><Trash2 size={18}/></button></div>
              </article>
            })}</div>
          </section>)}

          <section className="cart-delivery-card"><div className="cart-delivery-head"><Truck size={22}/><div><span className="eyebrow">Livraison</span><h2>Choisissez votre livraison</h2><p>Le tarif sélectionné sera confirmé avec votre commande.</p></div></div><div className="cart-delivery-options">{DELIVERY_OPTIONS.map(option => <button type="button" disabled={deliverySaving} key={option.code} className={deliveryMethod === option.code ? 'active' : ''} onClick={() => chooseDelivery(option.code)}><span className="cart-delivery-radio">{deliveryMethod === option.code && <i/>}</span><div><strong>{option.label}</strong><small>{option.description}</small></div><b>{cdf(option.feeCdf)}</b>{option.code === 'express' && <em><Zap size={13}/> Prioritaire</em>}</button>)}</div></section>

          <section className="cart-plus-card"><div className="cart-plus-main"><div className="cart-plus-icon"><Crown size={22}/></div><div><span>One Market Plus</span><strong>Commandez souvent, dépensez moins en livraison.</strong><p>Formules à partir de {cdf(ONE_MARKET_PLUS.plans[0].priceCdf)} / mois.</p></div><button type="button" onClick={() => setPlusOpen(value => !value)}>{plusOpen ? 'Masquer' : 'Découvrir'}</button></div>{plusOpen && <div className="cart-plus-details"><div className="cart-plus-plans">{ONE_MARKET_PLUS.plans.map(plan => <span key={plan.code}><strong>{plan.label}</strong><b>{cdf(plan.priceCdf)}</b><small>{plan.duration}</small></span>)}</div><ul>{ONE_MARKET_PLUS.benefits.map(benefit => <li key={benefit}><CheckCircle2Fallback/>{benefit}</li>)}</ul></div>}</section>
        </div>

        <aside className="cart-final-summary">
          <div className="cart-summary-card"><span className="cart-summary-kicker">Résumé de la commande</span><h2>{count} article{count > 1 ? 's' : ''}</h2><div className="cart-summary-row"><span>Sous-total articles</span><strong>{money(total, 'USD')}</strong></div><div className="cart-summary-row"><span>{deliveryMethod === 'express' ? 'Livraison express' : 'Livraison normale'}</span><strong>{cdf(deliveryFeeCdf)}</strong></div><div className="cart-summary-row"><span>Mode de paiement</span><b>Paiement à la livraison</b></div><div className="cart-summary-total"><span>Total produits</span><strong>{money(total, 'USD')}</strong></div><div className="cart-summary-cdf"><span>+ Livraison</span><strong>{cdf(deliveryFeeCdf)}</strong></div><small>Les produits sont facturés en USD et la livraison en FC.</small>{hasIssues ? <button className="button primary full" disabled>Corrigez le panier avant de continuer</button> : <Link className="button primary full" to="/checkout">Finaliser la commande <ArrowRight size={18}/></Link>}<div className="cart-summary-security"><ShieldCheck size={18}/><span><strong>Commande vérifiée</strong><small>Les quantités et les frais sont vérifiés avant confirmation.</small></span></div></div>
          <div className="cart-marketplace-benefits"><div><Banknote size={18}/><span><strong>Paiement à la livraison</strong><small>Payez directement le livreur à la réception.</small></span></div><div><Truck size={18}/><span><strong>Livraison RDC</strong><small>Normale ou express selon votre choix.</small></span></div><div><Store size={18}/><span><strong>Panier multi-boutiques</strong><small>Chaque boutique prépare uniquement ses articles.</small></span></div></div>
        </aside>
      </div>
    </main>
  )
}

function CheckCircle2Fallback() {
  return <span className="cart-plus-check">✓</span>
}
