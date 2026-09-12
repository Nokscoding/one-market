import { AlertCircle, CheckCircle2, FileCheck2, FileText, LockKeyhole, ShieldCheck, Store, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const EMPTY_FORM = { business_name: '', phone: '', city: 'Lubumbashi', description: '' }
const BUCKET = 'seller-legal-documents'
const MAX_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

function normalizeApplication(data) {
  if (Array.isArray(data)) return data[0] || null
  return data || null
}

function cleanFilename(name = 'document') {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(-100)
}

function statusCopy(status) {
  if (status === 'approved') return { label: 'Approuvée', text: 'Ta demande vendeur a été approuvée. Ton accès boutique peut maintenant être activé.', tone: 'approved' }
  if (status === 'rejected') return { label: 'À corriger', text: 'La demande nécessite une vérification ou des informations complémentaires.', tone: 'rejected' }
  return { label: 'En vérification', text: 'L’équipe One Market vérifie les informations et les documents transmis.', tone: 'pending' }
}

export default function SellerApplicationForm({ embedded = false }) {
  const { user, profile } = useAuth()
  const [application, setApplication] = useState(null)
  const [documents, setDocuments] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [identityFile, setIdentityFile] = useState(null)
  const [legalFiles, setLegalFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const identityDocuments = useMemo(() => documents.filter(item => item.document_type === 'identity'), [documents])
  const legalDocuments = useMemo(() => documents.filter(item => item.document_type === 'legal'), [documents])

  useEffect(() => {
    if (!user?.id) return undefined
    let active = true
    setLoading(true)
    setMessage('')

    ;(async () => {
      const { data, error } = await supabase
        .from('seller_applications')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      if (!active) return

      const current = data || null
      setApplication(current)
      setForm(current ? {
        business_name: current.business_name || '',
        phone: current.phone || profile?.phone || '',
        city: current.city || 'Lubumbashi',
        description: current.description || '',
      } : currentForm => ({ ...currentForm, phone: profile?.phone || currentForm.phone }))

      if (current?.id) {
        const docs = await supabase
          .from('seller_application_documents')
          .select('id,application_id,document_type,original_name,mime_type,file_size,created_at')
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

    const upload = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })
    if (upload.error) throw upload.error

    const metadata = await supabase.from('seller_application_documents').insert({
      application_id: appId,
      user_id: user.id,
      document_type: documentType,
      storage_path: path,
      original_name: file.name,
      mime_type: file.type,
      file_size: file.size,
    }).select('id,application_id,document_type,original_name,mime_type,file_size,created_at').single()

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
    if (uploaded.length) setDocuments(current => [...current, ...uploaded])
    setIdentityFile(null)
    setLegalFiles([])
  }

  async function submit(event) {
    event.preventDefault()
    if (!user?.id || saving) return
    setMessage('')

    const businessName = form.business_name.trim()
    if (!businessName) return setMessage('Indique le nom de la boutique ou de l’activité.')
    if (!application && !identityFile) return setMessage('Ajoute un passeport ou une pièce d’identité avant d’envoyer la demande.')

    setSaving(true)
    try {
      let current = application
      if (!current) {
        const result = await supabase.rpc('submit_seller_application', {
          p_business_name: businessName,
          p_phone: form.phone.trim() || null,
          p_city: form.city.trim() || 'Lubumbashi',
          p_description: form.description.trim() || null,
        })
        if (result.error) throw result.error
        current = normalizeApplication(result.data)
        if (!current?.id) throw new Error('La demande a été créée mais son identifiant est indisponible.')
        setApplication(current)
      }

      await uploadSelectedFiles(current.id)
      setMessage('Dossier vendeur enregistré. Tes documents sont stockés dans un espace privé.')
    } catch (error) {
      const text = error?.message || 'Impossible d’enregistrer le dossier vendeur.'
      setMessage(text === 'AUTH_REQUIRED' ? 'Reconnecte-toi puis réessaie.' : text)
    } finally {
      setSaving(false)
    }
  }

  function chooseIdentity(event) {
    const file = event.target.files?.[0] || null
    if (!file) return
    try { validateFile(file); setIdentityFile(file); setMessage('') }
    catch (error) { setIdentityFile(null); setMessage(error.message) }
    event.target.value = ''
  }

  function chooseLegal(event) {
    const files = Array.from(event.target.files || [])
    try {
      files.forEach(validateFile)
      setLegalFiles(current => [...current, ...files].slice(0, 8))
      setMessage('')
    } catch (error) {
      setMessage(error.message)
    }
    event.target.value = ''
  }

  if (loading) return <div className="seller-application-loading">Chargement du dossier vendeur…</div>

  const status = application ? statusCopy(application.status) : null
  const hasPendingFiles = Boolean(identityFile || legalFiles.length)

  return (
    <section className={`seller-application-shell ${embedded ? 'is-embedded' : ''}`}>
      <div className="seller-application-heading">
        <div className="seller-application-heading-icon"><Store size={24}/></div>
        <div>
          <span className="eyebrow">Vendre sur One Market</span>
          <h2>{application ? 'Mon dossier vendeur' : 'Créer une boutique'}</h2>
          <p>Les vendeurs sont vérifiés avant l’activation de leur boutique.</p>
        </div>
        {status && <span className={`seller-application-pill ${status.tone}`}>{status.label}</span>}
      </div>

      {application && (
        <div className={`seller-application-status-box ${status.tone}`}>
          {application.status === 'approved' ? <CheckCircle2 size={22}/> : <AlertCircle size={22}/>} 
          <div><strong>{status.text}</strong>{application.admin_note && <span>{application.admin_note}</span>}</div>
        </div>
      )}

      <form className="seller-application-form" onSubmit={submit}>
        <div className="seller-application-grid">
          <label>Nom de la boutique ou activité<input required disabled={Boolean(application)} value={form.business_name} onChange={event => setForm({ ...form, business_name: event.target.value })} placeholder="Ex. Noks Fashion"/></label>
          <label>Téléphone<input disabled={Boolean(application)} value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="+243…"/></label>
          <label>Ville<input disabled={Boolean(application)} value={form.city} onChange={event => setForm({ ...form, city: event.target.value })}/></label>
          <label className="wide">Activité / produits<textarea disabled={Boolean(application)} rows={4} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Décris les produits que tu souhaites vendre sur One Market."/></label>
        </div>

        <div className="seller-documents-section">
          <div className="seller-documents-title"><ShieldCheck size={20}/><div><strong>Vérification d’identité et documents légaux</strong><span>Ces fichiers ne sont jamais publics. Ils servent uniquement à la vérification vendeur.</span></div></div>

          <div className="seller-document-grid">
            <article className="seller-document-card required">
              <div className="seller-document-card-head"><FileCheck2 size={21}/><div><strong>Passeport / pièce d’identité</strong><span>Obligatoire</span></div></div>
              {identityDocuments.map(doc => <div className="seller-uploaded-file" key={doc.id}><FileText size={17}/><span>{doc.original_name}</span><CheckCircle2 size={16}/></div>)}
              {!identityDocuments.length && identityFile && <div className="seller-selected-file"><FileText size={17}/><span>{identityFile.name}</span><button type="button" onClick={() => setIdentityFile(null)}><X size={15}/></button></div>}
              {!identityDocuments.length && <label className="seller-file-button"><Upload size={17}/><span>{identityFile ? 'Remplacer le fichier' : 'Choisir un fichier'}</span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={chooseIdentity}/></label>}
              <small>PDF, JPG, PNG ou WebP · 10 Mo max.</small>
            </article>

            <article className="seller-document-card">
              <div className="seller-document-card-head"><FileText size={21}/><div><strong>Documents légaux</strong><span>RCCM, NIF, ID Nat…</span></div></div>
              {legalDocuments.map(doc => <div className="seller-uploaded-file" key={doc.id}><FileText size={17}/><span>{doc.original_name}</span><CheckCircle2 size={16}/></div>)}
              {legalFiles.map((file, index) => <div className="seller-selected-file" key={`${file.name}-${index}`}><FileText size={17}/><span>{file.name}</span><button type="button" onClick={() => setLegalFiles(current => current.filter((_, i) => i !== index))}><X size={15}/></button></div>)}
              <label className="seller-file-button"><Upload size={17}/><span>Ajouter des documents</span><input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" onChange={chooseLegal}/></label>
              <small>Plusieurs documents possibles · 10 Mo max. chacun.</small>
            </article>
          </div>

          <div className="seller-document-privacy"><LockKeyhole size={18}/><span><strong>Stockage privé</strong><small>Accès limité au propriétaire du dossier et aux administrateurs One Market autorisés.</small></span></div>
        </div>

        {message && <div className="seller-application-message">{message}</div>}
        <div className="seller-application-actions">
          {!application && <button className="button primary" disabled={saving}>{saving ? 'Création du dossier…' : 'Envoyer ma demande vendeur'}</button>}
          {application && hasPendingFiles && <button className="button primary" disabled={saving}>{saving ? 'Envoi des documents…' : 'Enregistrer les nouveaux documents'}</button>}
          {application && !hasPendingFiles && <span className="seller-application-saved"><CheckCircle2 size={17}/> Dossier enregistré</span>}
        </div>
      </form>
    </section>
  )
}
