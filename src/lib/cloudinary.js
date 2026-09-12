const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'nks-services'
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || ''
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])

export function cloudinaryReady() {
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET)
}

export function cloudinaryCloudName() {
  return CLOUDINARY_CLOUD_NAME
}

export async function uploadOneMarketImage(file, { folder = 'one-market/products', tags = [] } = {}) {
  if (!(file instanceof File)) throw new Error('Sélectionne une image.')
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error('Format non accepté. Utilise JPG, PNG, WebP ou AVIF.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image trop lourde. Maximum : 8 Mo.')
  if (!CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Upload Cloudinary One Market non configuré : preset manquant.')
  }

  const body = new FormData()
  body.append('file', file)
  body.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
  body.append('asset_folder', folder)
  if (tags.length) body.append('tags', tags.join(','))

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body,
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok || !result.secure_url) {
    throw new Error(result?.error?.message || 'Impossible d’envoyer l’image sur Cloudinary.')
  }

  return {
    secureUrl: result.secure_url,
    publicId: result.public_id || '',
    assetId: result.asset_id || '',
    width: result.width || null,
    height: result.height || null,
    format: result.format || '',
  }
}
