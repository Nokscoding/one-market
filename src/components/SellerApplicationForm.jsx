import { AlertCircle, CheckCircle2, FileCheck2, FileText, Globe2, LockKeyhole, ShieldCheck, Store, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { normalizeOptionalUrl, SELLER_STATUS, SELLER_TYPES, sellerType } from '../lib/seller'
import { supabase } from '../lib/supabase'

const BUCKET = 'seller-legal-documents'
const MAX_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
const EDITABLE_STATUSES = new Set(['draft', 'needs_information', 'rejected'])

const EMPTY_FORM = {
  seller_type: 'individual',
  business_name: '',
  legal_name: '',
  representative_name: '',
  phone: '',
  city: 'Lubumbashi',
  business_address: '',
  description: '',
  years_active: '',
  activity_categories: [],
  website_url: '',
  instagram_url: '',
  tiktok_url: '',
  facebook_url: '',
  linkedin_url: '',
  whatsapp_business: '',
  marketplace_url: '',
  other_social_url: '',
}

function normalizeApplication(data) {
  if (Array.isArray(data)) return data[0] || null
  return data || null
}

function cleanFilename(name = 'document') {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-100)
}

function mapApplicationToForm(application, fallbackPhone = '') {
  if (!application) return { ...EMPTY_FORM, phone: fallbackPhone || '' }
  return {
    seller_type: application.seller_type || 'individual',
    business_name: application.business_name || '',
    legal_name: application.legal_name || '',
    representative_name: application.representative_name || '',
    phone: application.phone || fallbackPhone || '',
    city: application.city || 'Lubumbashi',
    business_address: application.business_address || '',
    description: application.description || '',
    years_active: application.years_active ?? '',
    activity_categories: application.activity_categories || [],
    website_url: application.website_url || '',
    instagram_url: application.instagram_url || '',
    tiktok_url: application.tiktok_url || '',
    facebook_url: application.facebook_url || '',
    linkedin_url: application.linkedin_url || '',
    whatsapp_business: application.whatsapp_business || '',
    marketplace_url: application.marketplace_url || '',
    other_social_url: application.other_social_url || '',
  }
}

export default function SellerApplicationForm({ embedded = false }) {
  const { user, profile } = useAuth()
  const [application, setApplication] = useState(null)
  const [documents, setDocuments] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [identityFile, setIdentityFile] = useState(null)
  const [legalFiles, setLegalFiles] = useState([])
  const [proofFiles, setProofFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const editable = !application || EDITABLE_STATUSES.has(application.status)
  const selectedType = sellerType(form.seller_type)
  const identityDocuments = useMemo(() => documents.filter(item => item.document_type === 'identity'), [documents])
  const legalDocuments = useMemo(() => documents.filter(item => item.document_type === 'legal'), [documents])
  const proofDocuments = useMemo(() => documents.filter(item => item.document_type === 'activity_proof'), [documents])

  useEffect(() => {
    if (!user?.id) return undefined
    let active = true
    setLoading(true)
    setMessage('')

    ;(async () => {
      const [{ data: appData, error: appError }, { data: categoryData }] = await Promise.all([
        supabase.from('seller_applications').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('categories').select('id,name').eq('is_active', true).order('sort_order'),
      ])
      if (appError) throw appError
      if (!active) return

      const current = appData || null
      setApplication(current)
      setForm(mapApplicationToForm(current, profile?.phone || ''))
      setCategories(categoryData || [])

      if (current?.id) {
        const docs = await supabase
          .from('seller_application_documents')
          .select('id,application_id,document_type,storage_path,original_name,mime_type,file_size,created_at')
          .eq('application_id', current.id)
          .order('created_at', { ascending: true })
        if (docs.error) throw docs.error
        if (active) setDocuments(docs.data || [])
      }
    })()
      .catch(error => { if (active) setMessage(error?.message || 'Impossible de charger le dossier vendeur.') })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [user?.id, profile?.phone])

  function validateFile(file) {
    if (!ALLOWED_TYPES.has(file.type)) throw new Error('Formats acceptés : PDF, JPG, PNG ou WebP.')
    if (file.size > MAX_FILE_BYTES) throw new Error('Chaque document doit faire 10 Mo maximum.')
  }

  async function uploadDocument(appId, file, documentType) {
    validateFile(file)
    const safeName = cleanFilename(file.name)
    const path = `${user.id}/${appId}/${documentType}-${crypto.randomUUID()}-${safeName}`
    const upload = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
    if (upload.error) throw upload.error

    const metadata = await supabase.from('seller_application_documents').insert({
      application_id: appId,
      user_id: user.id,
      document_type: documentType,
      storage_path: path,
      original_name: file.name,
      mime_type: file.type,
      file_size: file.size,
    }).select('id,application_id,document_type,storage_path,original_name,mime_type,file_size,created_at').single()

    if (metadata.error) {
      await supabase.storage.from(BUCKET).remove([path])
      throw metadata.error
    }
    return metadata.data
  }

  async function uploadSelectedFiles(appId) {
    const uploaded = []
    if (identityFile) uploaded.push(await uploadDocument(appId, identityFile, 'identity'))
    for (const file of legalFiles) uploaded.push(await uploadDocument(appId, file, 'legal'))
    for (const file of proofFiles) uploaded.push(await uploadDocument(appId, file, 'activity_proof'))
    if (uploaded.length) setDocuments(current => [...current, ...uploaded])
    setIdentityFile(null)
    setLegalFiles([])
    setProofFiles([])
    return uploaded
  }

  async function removeUploadedDocument(document) {
    if (!editable || saving) return
    setSaving(true)
    setMessage('')
    try {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([document.storage_path])
      if (storageError) throw storageError
      const { error } = await supabase.from('seller_application_documents').delete().eq('id', document.id)
      if (error) throw error
      setDocuments(current => current.filter(item => item.id !== document.id))
    } catch (error) {
      setMessage(error?.message || 'Impossible de supprimer ce document.')
    } finally {
      setSaving(false)
    }
  }

  function payload() {
    return {
      p_seller_type: form.seller_type,
      p_business_name: form.business_name.trim(),
      p_phone: form.phone.trim() || null,
      p_city: form.city.trim() || 'Lubumbashi',
      p_description: form.description.trim() || null,
      p_legal_name: form.legal_name.trim() || null,
      p_representative_name: form.representative_name.trim() || null,
      p_business_address: form.business_address.trim() || null,
      p_activity_categories: form.activity_categories,
      p_years_active: form.years_active === '' ? null : Math.max(0, Number(form.years_active) || 0),
      p_website_url: normalizeOptionalUrl(form.website_url),
      p_instagram_url: normalizeOptionalUrl(form.instagram_url),
      p_tiktok_url: normalizeOptionalUrl(form.tiktok_url),
      p_facebook_url: normalizeOptionalUrl(form.facebook_url),
      p_linkedin_url: normalizeOptionalUrl(form.linkedin_url),
      p_whatsapp_business: form.whatsapp_business.trim() || null,
      p_marketplace_url: normalizeOptionalUrl(form.marketplace_url),
      p_other_social_url: normalizeOptionalUrl(form.other_social_url),
    }
  }

  async function saveDraft() {
    const data = payload()
    if (!data.p_business_name) throw new Error('Indique le nom de la boutique ou de l’activité.')
    if (form.seller_type === 'business' && !form.representative_name.trim()) throw new Error('Indique le représentant de l’entreprise.')
    if (!form.description.trim()) throw new Error('Décris brièvement ton activité et ce que tu souhaites vendre.')

    const result = await supabase.rpc('save_seller_application', data)
    if (result.error) throw result.error
    const current = normalizeApplication(result.data)
    if (!current?.id) throw new Error('Impossible de créer le dossier vendeur.')
    setApplication(current)
    return current
  }

  async function submit(event) {
    event.preventDefault()
    if (!user?.id || saving) return
    setMessage('')
    setSaving(true)

    try {
      if (!editable && application) {
        const uploaded = await uploadSelectedFiles(application.id)
        setMessage(uploaded.length ? 'Nouveaux documents ajoutés au dossier en cours de vérification.' : 'Aucun nouveau document à enregistrer.')
        return
      }

      const hasIdentity = identityDocuments.length > 0 || Boolean(identityFile)
      const hasLegal = legalDocuments.length > 0 || legalFiles.length > 0
      if (!hasIdentity) throw new Error('Ajoute un passeport ou une pièce d’identité valide.')
      if (form.seller_type === 'business' && !hasLegal) throw new Error('Une entreprise doit fournir au moins un document légal (RCCM, NIF, ID Nat ou équivalent).')

      const current = await saveDraft()
      await uploadSelectedFiles(current.id)
      const submitted = await supabase.rpc('submit_seller_application', { p_application_id: current.id })
      if (submitted.error) throw submitted.error
      const finalApplication = normalizeApplication(submitted.data)
      setApplication(finalApplication || current)
      setMessage('Demande vendeur envoyée. One Market va maintenant vérifier ton activité et tes documents.')
    } catch (error) {
      const raw = error?.message || 'Impossible d’enregistrer le dossier vendeur.'
      const friendly = {
        IDENTITY_DOCUMENT_REQUIRED: 'Ajoute une pièce d’identité avant d’envoyer la demande.',
        BUSINESS_LEGAL_DOCUMENT_REQUIRED: 'Ajoute au moins un document légal pour le compte Business.',
        AUTH_REQUIRED: 'Reconnecte-toi puis réessaie.',
      }[raw] || raw
      setMessage(friendly)
    } finally {
      setSaving(false)
    }
  }

  function chooseOne(event, setter) {
    const file = event.target.files?.[0] || null
    event.target.value = ''
    if (!file) return
    try { validateFile(file); setter(file); setMessage('') }
    catch (error) { setter(null); setMessage(error.message) }
  }

  function chooseMany(event, setter) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    try {
      files.forEach(validateFile)
      setter(current => [...current, ...files].slice(0, 8))
      setMessage('')
    } catch (error) { setMessage(error.message) }
  }

  function toggleCategory(name) {
    setForm(current => ({
      ...current,
      activity_categories: current.activity_categories.includes(name)
        ? current.activity_categories.filter(item => item !== name)
        : [...current.activity_categories, name],
    }))
  }

  if (loading) return <div className="seller-application-loading">Chargement du dossier vendeur…</div>

  const status = application ? (SELLER_STATUS[application.status] || SELLER_STATUS.pending) : null
  const canAddDocuments = !application || !['approved', 'suspended'].includes(application.status)
  const hasPendingFiles = Boolean(identityFile || legalFiles.length || proofFiles.length)

  return (
    <section className={`seller-application-shell ${embedded ? 'is-embedded' : ''}`}>
      <div className="seller-application-heading">
        <div className="seller-application-heading-icon"><Store size={24}/></div>
        <div>
          <span className="eyebrow">Vendre sur One Market</span>
          <h2>{application ? 'Mon dossier vendeur' : 'Créer une boutique'}</h2>
          <p>One Market vérifie chaque vendeur avant l’activation de sa boutique.</p>
        </div>
        {status && <span className={`seller-application-pill ${status.tone}`}>{status.label}</span>}
      </div>

      {application && (
        <div className={`seller-application-status-box ${status.tone}`}>
          {application.status === 'approved' ? <CheckCircle2 size={22}/> : <AlertCircle size={22}/>} 
          <div>
            <strong>{application.status === 'pending' || application.status === 'under_review' ? 'Demande vendeur en cours de vérification.' : application.status === 'approved' ? 'Ta demande vendeur a été approuvée.' : application.status === 'needs_information' ? 'One Market a besoin d’informations supplémentaires.' : application.status === 'suspended' ? 'Ce dossier vendeur est suspendu.' : 'Tu peux corriger puis renvoyer ce dossier.'}</strong>
            {application.admin_note && <span>{application.admin_note}</span>}
          </div>
        </div>
      )}

      <form className="seller-application-form" onSubmit={submit}>
        <div className="seller-form-section-title"><span>1</span><div><strong>Type de vendeur</strong><small>Choisis le profil qui correspond réellement à ton activité.</small></div></div>
        <div className="seller-type-grid">
          {SELLER_TYPES.map(type => <button type="button" disabled={!editable} key={type.code} className={form.seller_type === type.code ? 'active' : ''} onClick={() => setForm(current => ({ ...current, seller_type: type.code }))}><strong>{type.title}</strong><span>{type.description}</span>{type.legalRequired && <small>Document légal requis</small>}</button>)}
        </div>

        <div className="seller-form-section-title"><span>2</span><div><strong>Activité</strong><small>Ces informations permettent à One Market de comprendre ce que tu vends.</small></div></div>
        <div className="seller-application-grid">
          <label>Nom de la boutique ou activité<input required disabled={!editable} value={form.business_name} onChange={event => setForm({ ...form, business_name: event.target.value })} placeholder="Ex. Noks Fashion"/></label>
          <label>Téléphone<input disabled={!editable} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="+243…"/></label>
          <label>Ville<input disabled={!editable} value={form.city} onChange={event => setForm({ ...form, city: event.target.value })}/></label>
          <label>Depuis combien d’années ?<input disabled={!editable} type="number" min="0" max="100" value={form.years_active} onChange={event => setForm({ ...form, years_active: event.target.value })} placeholder="Facultatif"/></label>
          {form.seller_type === 'business' && <><label>Raison sociale<input disabled={!editable} value={form.legal_name} onChange={event => setForm({ ...form, legal_name: event.target.value })} placeholder="Nom légal de l’entreprise"/></label><label>Représentant<input required disabled={!editable} value={form.representative_name} onChange={event => setForm({ ...form, representative_name: event.target.value })}/></label><label className="wide">Adresse de l’entreprise<input disabled={!editable} value={form.business_address} onChange={event => setForm({ ...form, business_address: event.target.value })}/></label></>}
          <label className="wide">Activité / produits<textarea disabled={!editable} rows={4} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Explique ce que tu vends, où tu vends actuellement et comment fonctionne ton activité."/></label>
        </div>

        <div className="seller-category-picker">
          <strong>Catégories de produits</strong><span>Sélection facultative mais recommandée.</span>
          <div>{categories.map(category => <button disabled={!editable} type="button" key={category.id} className={form.activity_categories.includes(category.name) ? 'active' : ''} onClick={() => toggleCategory(category.name)}>{category.name}</button>)}</div>
        </div>

        <div className="seller-form-section-title"><span>3</span><div><strong>Présence en ligne</strong><small>Facultatif, mais utile pour vérifier que l’activité existe déjà.</small></div></div>
        <div className="seller-social-grid">
          <label><Globe2 size={16}/> Site web<input disabled={!editable} value={form.website_url} onChange={event => setForm({ ...form, website_url: event.target.value })} placeholder="monsite.com"/></label>
          <label>Instagram<input disabled={!editable} value={form.instagram_url} onChange={event => setForm({ ...form, instagram_url: event.target.value })} placeholder="instagram.com/..."/></label>
          <label>TikTok<input disabled={!editable} value={form.tiktok_url} onChange={event => setForm({ ...form, tiktok_url: event.target.value })} placeholder="tiktok.com/@..."/></label>
          <label>Facebook<input disabled={!editable} value={form.facebook_url} onChange={event => setForm({ ...form, facebook_url: event.target.value })} placeholder="facebook.com/..."/></label>
          {form.seller_type === 'business' && <label>LinkedIn<input disabled={!editable} value={form.linkedin_url} onChange={event => setForm({ ...form, linkedin_url: event.target.value })} placeholder="linkedin.com/company/..."/></label>}
          <label>WhatsApp Business<input disabled={!editable} value={form.whatsapp_business} onChange={event => setForm({ ...form, whatsapp_business: event.target.value })} placeholder="+243… ou lien WhatsApp"/></label>
          <label>Autre marketplace<input disabled={!editable} value={form.marketplace_url} onChange={event => setForm({ ...form, marketplace_url: event.target.value })} placeholder="Lien facultatif"/></label>
          <label>Autre réseau<input disabled={!editable} value={form.other_social_url} onChange={event => setForm({ ...form, other_social_url: event.target.value })} placeholder="Lien facultatif"/></label>
        </div>

        <div className="seller-form-section-title"><span>4</span><div><strong>Vérification</strong><small>Les documents sont privés et ne sont jamais affichés sur la boutique.</small></div></div>
        <div className="seller-documents-section">
          <div className="seller-documents-title"><ShieldCheck size={20}/><div><strong>Identité et preuves d’activité</strong><span>{selectedType.title} · {selectedType.legalRequired ? 'identité + document légal requis' : 'seule l’identité est obligatoire'}</span></div></div>

          <div className="seller-document-grid">
            <article className="seller-document-card required">
              <div className="seller-document-card-head"><FileCheck2 size={21}/><div><strong>Passeport / pièce d’identité</strong><span>Obligatoire pour tous</span></div></div>
              {identityDocuments.map(doc => <div className="seller-uploaded-file" key={doc.id}><FileText size={17}/><span>{doc.original_name}</span>{editable ? <button type="button" onClick={() => removeUploadedDocument(doc)}><X size={15}/></button> : <CheckCircle2 size={16}/>}</div>)}
              {!identityDocuments.length && identityFile && <div className="seller-selected-file"><FileText size={17}/><span>{identityFile.name}</span><button type="button" onClick={() => setIdentityFile(null)}><X size={15}/></button></div>}
              {canAddDocuments && !identityDocuments.length && <label className="seller-file-button"><Upload size={17}/><span>{identityFile ? 'Remplacer' : 'Choisir un fichier'}</span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={event => chooseOne(event, setIdentityFile)}/></label>}
              <small>PDF, JPG, PNG ou WebP · 10 Mo max.</small>
            </article>

            <article className={`seller-document-card ${form.seller_type === 'business' ? 'required' : ''}`}>
              <div className="seller-document-card-head"><FileText size={21}/><div><strong>Documents légaux</strong><span>{form.seller_type === 'business' ? 'Obligatoire · RCCM, NIF, ID Nat…' : 'Facultatif si tu en possèdes'}</span></div></div>
              {legalDocuments.map(doc => <div className="seller-uploaded-file" key={doc.id}><FileText size={17}/><span>{doc.original_name}</span>{editable ? <button type="button" onClick={() => removeUploadedDocument(doc)}><X size={15}/></button> : <CheckCircle2 size={16}/>}</div>)}
              {legalFiles.map((file, index) => <div className="seller-selected-file" key={`${file.name}-${index}`}><FileText size={17}/><span>{file.name}</span><button type="button" onClick={() => setLegalFiles(current => current.filter((_, i) => i !== index))}><X size={15}/></button></div>)}
              {canAddDocuments && <label className="seller-file-button"><Upload size={17}/><span>Ajouter des documents</span><input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" onChange={event => chooseMany(event, setLegalFiles)}/></label>}
            </article>

            <article className="seller-document-card">
              <div className="seller-document-card-head"><Store size={21}/><div><strong>Preuves d’activité</strong><span>Facultatif · catalogue, capture de boutique, facture…</span></div></div>
              {proofDocuments.map(doc => <div className="seller-uploaded-file" key={doc.id}><FileText size={17}/><span>{doc.original_name}</span>{editable ? <button type="button" onClick={() => removeUploadedDocument(doc)}><X size={15}/></button> : <CheckCircle2 size={16}/>}</div>)}
              {proofFiles.map((file, index) => <div className="seller-selected-file" key={`${file.name}-${index}`}><FileText size={17}/><span>{file.name}</span><button type="button" onClick={() => setProofFiles(current => current.filter((_, i) => i !== index))}><X size={15}/></button></div>)}
              {canAddDocuments && <label className="seller-file-button"><Upload size={17}/><span>Ajouter une preuve</span><input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" onChange={event => chooseMany(event, setProofFiles)}/></label>}
            </article>
          </div>

          <div className="seller-document-privacy"><LockKeyhole size={18}/><span><strong>Stockage privé Supabase</strong><small>Accès limité au propriétaire du dossier et aux administrateurs One Market autorisés. Aucun lien public permanent.</small></span></div>
        </div>

        {message && <div className="seller-application-message">{message}</div>}
        <div className="seller-application-actions">
          {editable && <button className="button primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Envoyer ma demande vendeur'}</button>}
          {!editable && hasPendingFiles && <button className="button primary" disabled={saving}>{saving ? 'Envoi…' : 'Ajouter ces documents au dossier'}</button>}
          {!editable && !hasPendingFiles && <span className="seller-application-saved"><CheckCircle2 size={17}/> Dossier enregistré</span>}
        </div>
      </form>
    </section>
  )
}
