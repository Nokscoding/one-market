import { useEffect, useState } from 'react'

export default function SmartImage({
  src,
  alt = '',
  className = '',
  fallback = 'OM',
  loading = 'lazy',
  fit = 'cover',
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setLoaded(false)
    setFailed(false)
  }, [src])

  const hasImage = Boolean(src) && !failed

  return (
    <span
      className={`smart-image ${loaded ? 'is-loaded' : ''} ${!hasImage ? 'is-fallback' : ''} ${className}`.trim()}
      style={{ '--smart-fit': fit }}
    >
      {hasImage && (
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
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
