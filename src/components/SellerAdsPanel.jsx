import { Megaphone, Package, Store, Tag, Image as ImageIcon, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import CloudinaryImageField from './CloudinaryImageField'
import { supabase } from '../lib/supabase'
import { logTechnicalError, userError } from '../lib/userErrors'
import '../styles/seller-ads.css'

const STATUS_LABELS = {
  pending_payment: 'Paiement à confirmer',
  pending_review: 'En validation',
  scheduled: 'Programmée',
  active: 'Active',
  completed: 'Terminée',
  rejected: 'Refusée',
  cancelled: 'Annulée',
}
const PAYMENT_LABELS = {
  pending: 'Paiement en attente',
  paid: 'Payée',
  failed: 'Paiement échoué',
  refund_pending: 'Remboursement en attente',
  refunded: 'Remboursée',
}
const TYPE_ICONS = { product: Package, store: Store, category: Tag, home_banner: ImageIcon }

function usd(value) {
  return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'USD',minimumFractionDigits:2}).format(Number(value)||0)
}
function shortDate(value) {
  if (!value) return '—'
  try { return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)) }
  catch { return '—' }
}

export default function SellerAdsPanel({ store, products = [], categories = [] }) {
  const [packages,setPackages]=useState([])
  const [campaigns,setCampaigns]=useState([])
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [feedback,setFeedback]=useState('')
  const [packageCode,setPackageCode]=useState('')
  const [productId,setProductId]=useState('')
  const [categoryId,setCategoryId]=useState('')
  const [title,setTitle]=useState('')
  const [mediaUrl,setMediaUrl]=useState('')
  const [destinationUrl,setDestinationUrl]=useState('')
  const [note,setNote]=useState('')

  const selectedPackage=useMemo(()=>packages.find(item=>item.code===packageCode)||null,[packages,packageCode])

  async function load() {
    if (!store?.id) return
    setLoading(true); setFeedback('')
    try {
      const [packageResult,campaignResult]=await Promise.all([
        supabase.from('ad_packages').select('id,code,name,description,target_type,placement,duration_days,price_usd,sort_order').eq('is_active',true).order('sort_order'),
        supabase.rpc('list_my_ad_campaigns',{ p_store_id:store.id }),
      ])
      if(packageResult.error) throw packageResult.error
      if(campaignResult.error) throw campaignResult.error
      setPackages(packageResult.data||[])
      setCampaigns(campaignResult.data||[])
      setPackageCode(current=>current||(packageResult.data?.[0]?.code||''))
    } catch(error) {
      logTechnicalError('seller-ads-load',error)
      setFeedback(userError(error,'seller'))
    } finally { setLoading(false) }
  }

  useEffect(()=>{ load() },[store?.id])

  useEffect(()=>{
    setProductId('')
    setCategoryId('')
    setTitle('')
    setMediaUrl('')
    setDestinationUrl('')
    setNote('')
  },[packageCode])

  async function submit(event) {
    event.preventDefault()
    if(!selectedPackage||saving||!store?.id) return
    setSaving(true); setFeedback('')
    try {
      const {error}=await supabase.rpc('create_ad_campaign',{
        p_package_code:selectedPackage.code,
        p_store_id:store.id,
        p_product_id:selectedPackage.target_type==='product'?productId||null:null,
        p_category_id:selectedPackage.target_type==='category'?categoryId||null:null,
        p_title:selectedPackage.target_type==='home_banner'?title.trim()||null:null,
        p_media_url:selectedPackage.target_type==='home_banner'?mediaUrl||null:null,
        p_destination_url:destinationUrl.trim()||null,
        p_seller_note:note.trim()||null,
      })
      if(error) throw error
      setFeedback('Campagne créée. Le paiement doit maintenant être confirmé par One Market avant activation.')
      await load()
    } catch(error) {
      logTechnicalError('seller-ads-create',error)
      setFeedback(userError(error,'seller'))
    } finally { setSaving(false) }
  }

  async function cancel(campaign) {
    if(!campaign?.id||saving) return
    setSaving(true); setFeedback('')
    try {
      const {error}=await supabase.rpc('cancel_ad_campaign',{p_campaign_id:campaign.id})
      if(error) throw error
      setFeedback('Campagne annulée.')
      await load()
    } catch(error) {
      logTechnicalError('seller-ads-cancel',error)
      setFeedback(userError(error,'seller'))
    } finally { setSaving(false) }
  }

  if(loading) return <section className="seller-panel"><div className="seller-ads-loading">Chargement de One Market Ads…</div></section>

  return <div className="seller-ads-space">
    <section className="seller-panel">
      <div className="seller-panel-head">
        <div><h2>One Market Ads</h2><p>Boostez votre visibilité. Le paiement est validé manuellement pour le moment.</p></div>
        <span className="seller-ads-chip"><Megaphone size={15}/> Sponsorisé</span>
      </div>

      {feedback&&<div className="seller-feedback seller-ads-feedback" role="status">{feedback}</div>}

      <div className="seller-ad-package-grid">
        {packages.map(item=>{
          const Icon=TYPE_ICONS[item.target_type]||Megaphone
          return <button type="button" key={item.id} className={`seller-ad-package ${packageCode===item.code?'active':''}`} onClick={()=>setPackageCode(item.code)}>
            <span><Icon size={20}/></span>
            <div><strong>{item.name}</strong><small>{item.description}</small></div>
            <b>{usd(item.price_usd)}</b>
          </button>
        })}
      </div>

      {selectedPackage&&<form className="seller-ad-form" onSubmit={submit}>
        <div className="seller-ad-summary"><span>Offre choisie</span><strong>{selectedPackage.name}</strong><b>{usd(selectedPackage.price_usd)}</b></div>

        {selectedPackage.target_type==='product'&&<label>Produit à sponsoriser<select required value={productId} onChange={e=>setProductId(e.target.value)}><option value="">Choisir un produit</option>{products.filter(p=>p.is_active&&!p.is_demo).map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>}
        {selectedPackage.target_type==='category'&&<label>Catégorie ciblée<select required value={categoryId} onChange={e=>setCategoryId(e.target.value)}><option value="">Choisir une catégorie</option>{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>}
        {selectedPackage.target_type==='home_banner'&&<>
          <label>Titre de la campagne<input required maxLength="160" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex. Nouvelle collection"/></label>
          <CloudinaryImageField label="Visuel de la bannière" value={mediaUrl} folder="one-market/ads" onChange={setMediaUrl} fit="cover"/>
        </>}
        <label>Lien au clic <small>Facultatif</small><input value={destinationUrl} onChange={e=>setDestinationUrl(e.target.value)} placeholder={selectedPackage.target_type==='product'?'/product/…':'/store/… ou https://…'}/></label>
        <label>Note pour One Market <small>Facultatif</small><textarea rows="3" value={note} onChange={e=>setNote(e.target.value)} placeholder="Informations utiles pour la validation"/></label>

        <div className="seller-ad-payment-note"><strong>Paiement provisoire : validation manuelle</strong><span>Après création, One Market confirme le paiement puis active automatiquement la campagne pour {selectedPackage.duration_days} jour{selectedPackage.duration_days>1?'s':''}. Le Mobile Money automatique sera branché ensuite.</span></div>
        <button className="button primary" disabled={saving}>{saving?'Création…':`Créer la campagne · ${usd(selectedPackage.price_usd)}`}</button>
      </form>}
    </section>

    <section className="seller-panel">
      <div className="seller-panel-head"><div><h2>Mes campagnes</h2><p>Suivez paiement, validation et période de diffusion.</p></div><span>{campaigns.length}</span></div>
      <div className="seller-ad-campaigns">
        {campaigns.map(campaign=>{
          const pkg=packages.find(item=>item.id===campaign.package_id)
          const canCancel=['pending_payment','pending_review','scheduled'].includes(campaign.status)
          return <article key={campaign.id}>
            <div className="seller-ad-campaign-main">
              <span className={`seller-ad-status status-${campaign.status}`}>{STATUS_LABELS[campaign.status]||campaign.status}</span>
              <strong>{pkg?.name||'Campagne One Market Ads'}</strong>
              <small>{PAYMENT_LABELS[campaign.payment_status]||campaign.payment_status} · {usd(campaign.amount_usd)}</small>
            </div>
            <div className="seller-ad-campaign-dates"><span>Début <strong>{shortDate(campaign.starts_at)}</strong></span><span>Fin <strong>{shortDate(campaign.ends_at)}</strong></span></div>
            {campaign.rejection_reason&&<p>{campaign.rejection_reason}</p>}
            {canCancel&&<button type="button" className="seller-ad-cancel" disabled={saving} onClick={()=>cancel(campaign)}><XCircle size={15}/> Annuler</button>}
          </article>
        })}
        {!campaigns.length&&<div className="seller-empty"><Megaphone size={26}/><strong>Aucune campagne</strong><span>Choisissez une offre ci-dessus pour commencer.</span></div>}
      </div>
    </section>
  </div>
}
