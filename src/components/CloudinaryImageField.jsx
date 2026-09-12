import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { cloudinaryCloudName, uploadOneMarketImage } from '../lib/cloudinary'
import SmartImage from './SmartImage'

export default function CloudinaryImageField({
  label = 'Image',
  value = '',
  folder = 'one-market/products',
  onChange,
  className = '',
  fit = 'cover',
}) {
  const inputId = useId()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function selectFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || uploading) return

    setUploading(true)
    setError('')
    try {
      const uploaded = await uploadOneMarketImage(file, {
        folder,
        tags: ['one-market', 'seller-upload'],
      })
      onChange?.(uploaded.secureUrl, uploaded)
    } catch (uploadError) {
      setError(uploadError?.message || 'Impossible d’envoyer cette image.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={`cloudinary-image-field ${className}`.trim()}>
      <div className="cloudinary-image-field-head">
        <span>{label}</span>
        <small>Cloudinary NKS · {cloudinaryCloudName()}</small>
      </div>

      <div className={`cloudinary-image-picker ${value ? 'has-image' : ''}`}>
        {value ? (
          <SmartImage src={value} alt={label} fallback="OM" fit={fit} widthHint={480} />
        ) : (
          <div className="cloudinary-image-empty"><ImagePlus size={25}/><span>Aucune image</span></div>
        )}

        <div className="cloudinary-image-actions">
          <label htmlFor={inputId} className="button secondary">
            {uploading ? <><Loader2 className="cloudinary-spin" size={17}/> Envoi…</> : <><ImagePlus size={17}/> {value ? 'Remplacer' : 'Choisir une image'}</>}
          </label>
          {value && <button type="button" className="icon-button danger" onClick={() => onChange?.('', null)} aria-label={`Supprimer ${label.toLowerCase()}`}><Trash2 size={17}/></button>}
        </div>
      </div>

      <input id={inputId} className="cloudinary-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={selectFile} disabled={uploading}/>
      <small className="cloudinary-image-help">JPG, PNG, WebP ou AVIF · 8 Mo max.</small>
      {error && <div className="seller-feedback cloudinary-image-error">{error}</div>}
    </div>
  )
}
