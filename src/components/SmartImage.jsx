import { useEffect, useMemo, useState } from 'react'

function optimizeImageUrl(src, width = 640) {
  if (!src) return ''
  try {
    const url = new URL(src)
    if (url.hostname === 'images.unsplash.com') {
      url.searchParams.set('auto', 'format')
      url.searchParams.set('fit', 'max')
      url.searchParams.set('w', String(width))
      url.searchParams.set('q', width <= 320 ? '68' : width <= 700 ? '74' : '82')
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
  fetchPriority,
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const optimizedSrc = useMemo(() => optimizeImageUrl(src, width), [src, width])

  useEffect(() => {
    setLoaded(false)
    setFailed(false)
  }, [optimizedSrc])

  const hasImage = Boolean(optimizedSrc) && !failed

  return (
    <span
      className={`smart-image ${loaded ? 'is-loaded' : ''} ${!hasImage ? 'is-fallback' : ''} ${className}`.trim()}
      style={{ '--smart-fit': fit }}
    >
      {hasImage && (
        <img
          src={optimizedSrc}
          alt={alt}
          loading={loading}
          decoding="async"
          fetchPriority={fetchPriority}
          draggable="false"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
      <span className="smart-image-fallback" aria-hidden={hasImage && loaded ? 'true' : 'false'}>{fallback}</span>
      {hasImage && !loaded && <span className="smart-image-shimmer" aria-hidden="true" />}
    </span>
  )
}
