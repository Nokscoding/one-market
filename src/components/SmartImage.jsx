import { useEffect, useMemo, useState } from 'react'

function optimizeImageUrl(src, width = 640) {
  if (!src) return ''
  try {
    const url = new URL(src)
    const safeWidth = Math.max(120, Math.min(1600, Number(width) || 640))
    const retinaWidth = Math.min(2400, Math.round(safeWidth * 2))

    if (url.hostname === 'images.unsplash.com') {
      url.searchParams.set('auto', 'format')
      url.searchParams.set('fit', 'max')
      url.searchParams.set('w', String(retinaWidth))
      url.searchParams.set('q', retinaWidth <= 700 ? '78' : '84')
      return url.toString()
    }

    if (url.hostname === 'res.cloudinary.com' && url.pathname.includes('/image/upload/')) {
      const marker = '/image/upload/'
      const [before, after] = url.pathname.split(marker)
      if (after) {
        const hasOneMarketTransform = after.startsWith('f_auto,q_auto:good,')
        if (!hasOneMarketTransform) {
          url.pathname = `${before}${marker}f_auto,q_auto:good,c_limit,w_${retinaWidth}/${after}`
        }
      }
      return url.toString()
    }

    return src
  } catch {
    return src
  }
}

export default function SmartImage({
  src,
  alt = '',
  className = '',
  fallback = 'OM',
  loading = 'lazy',
  fit = 'cover',
  width = 640,
  widthHint,
  fetchPriority,
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [useOriginal, setUseOriginal] = useState(false)
  const requestedWidth = widthHint || width
  const originalSrc = String(src || '').trim()
  const optimizedSrc = useMemo(() => optimizeImageUrl(originalSrc, requestedWidth), [originalSrc, requestedWidth])
  const imageSrc = useOriginal ? originalSrc : optimizedSrc

  useEffect(() => {
    setLoaded(false)
    setFailed(false)
    setUseOriginal(false)
  }, [optimizedSrc, originalSrc])

  const hasImage = Boolean(imageSrc) && !failed

  function handleError() {
    if (!useOriginal && originalSrc && optimizedSrc && optimizedSrc !== originalSrc) {
      setLoaded(false)
      setUseOriginal(true)
      return
    }
    setFailed(true)
  }

  return (
    <span
      className={`smart-image ${loaded ? 'is-loaded' : ''} ${hasImage && !loaded ? 'is-loading' : ''} ${!hasImage ? 'is-fallback' : ''} ${className}`.trim()}
      style={{ '--smart-fit': fit }}
    >
      {hasImage && (
        <img
          src={imageSrc}
          alt={alt}
          loading={loading}
          decoding="async"
          fetchPriority={fetchPriority}
          draggable="false"
          onLoad={() => setLoaded(true)}
          onError={handleError}
        />
      )}
      {!hasImage && <span className="smart-image-fallback" aria-hidden="true">{fallback}</span>}
      {hasImage && !loaded && <span className="smart-image-shimmer" aria-hidden="true" />}
    </span>
  )
}
