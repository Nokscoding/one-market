import { useEffect, useMemo, useState } from 'react'

const CLOUDINARY_MARKER = '/image/upload/'
const CLOUDINARY_TRANSFORM_TOKEN = /(?:^|,)(?:a|ar|b|bo|c|co|dpr|e|f|fl|g|h|l|o|q|r|t|u|w|x|y|z)_[^,/]+/i

function clampWidth(value, min = 120, max = 1800) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 640)))
}

function canTransformCloudinary(url) {
  if (url.hostname !== 'res.cloudinary.com' || !url.pathname.includes(CLOUDINARY_MARKER)) return false
  const after = url.pathname.split(CLOUDINARY_MARKER)[1] || ''
  const firstSegment = after.split('/')[0] || ''
  return Boolean(after) && !CLOUDINARY_TRANSFORM_TOKEN.test(firstSegment)
}

function transformImageUrl(src, width) {
  if (!src) return src

  try {
    const url = new URL(src)
    const targetWidth = clampWidth(width)

    if (url.hostname === 'images.unsplash.com') {
      url.searchParams.set('auto', 'format')
      url.searchParams.set('fit', 'max')
      url.searchParams.set('w', String(targetWidth))
      url.searchParams.set('q', targetWidth <= 700 ? '78' : '84')
      return url.toString()
    }

    if (canTransformCloudinary(url)) {
      const [before, after] = url.pathname.split(CLOUDINARY_MARKER)
      url.pathname = `${before}${CLOUDINARY_MARKER}f_auto,q_auto,c_limit,w_${targetWidth}/${after}`
      return url.toString()
    }

    return src
  } catch {
    return src
  }
}

function buildImageRequest(src, layoutWidth) {
  const original = String(src || '').trim()
  if (!original) return { original: '', optimized: '', srcSet: '' }

  const cssWidth = clampWidth(layoutWidth, 120, 900)
  const maxWidth = clampWidth(cssWidth * 2, 240, 1800)
  const optimized = transformImageUrl(original, maxWidth)

  if (optimized === original) return { original, optimized, srcSet: '' }

  const widths = [...new Set([
    clampWidth(cssWidth, 120, maxWidth),
    clampWidth(cssWidth * 1.5, 180, maxWidth),
    maxWidth,
  ])].sort((a, b) => a - b)

  const srcSet = widths
    .map(candidateWidth => `${transformImageUrl(original, candidateWidth)} ${candidateWidth}w`)
    .join(', ')

  return { original, optimized, srcSet }
}

function makeInitialState(sourceKey, candidates) {
  return {
    sourceKey,
    attempt: 0,
    phase: candidates.length ? 'loading' : 'failed',
  }
}

export default function SmartImage({
  src,
  alt = '',
  className = '',
  fallback = '',
  loading = 'lazy',
  fit = 'cover',
  width = 640,
  widthHint,
  sizes,
  fetchPriority,
  onLoad,
  onError,
}) {
  const requestedWidth = widthHint || width
  const request = useMemo(() => buildImageRequest(src, requestedWidth), [src, requestedWidth])
  const candidates = useMemo(
    () => [...new Set([request.optimized, request.original].filter(Boolean))],
    [request.optimized, request.original],
  )
  const sourceKey = candidates.join('|')
  const [state, setState] = useState(() => makeInitialState(sourceKey, candidates))
  const currentState = state.sourceKey === sourceKey ? state : makeInitialState(sourceKey, candidates)
  const imageSrc = candidates[currentState.attempt] || ''
  const isOptimizedAttempt = currentState.attempt === 0 && imageSrc === request.optimized && request.optimized !== request.original
  const phase = imageSrc ? currentState.phase : 'failed'

  useEffect(() => {
    setState(current => current.sourceKey === sourceKey ? current : makeInitialState(sourceKey, candidates))
  }, [sourceKey, candidates])

  function handleLoad(event) {
    setState(current => ({
      ...(current.sourceKey === sourceKey ? current : makeInitialState(sourceKey, candidates)),
      sourceKey,
      phase: 'loaded',
    }))
    onLoad?.(event)
  }

  function handleError(event) {
    const nextAttempt = currentState.attempt + 1
    if (nextAttempt < candidates.length) {
      setState({ sourceKey, attempt: nextAttempt, phase: 'loading' })
      return
    }
    setState({ sourceKey, attempt: currentState.attempt, phase: 'failed' })
    onError?.(event)
  }

  return (
    <span
      className={`smart-image is-${phase} ${className}`.trim()}
      style={{ '--smart-fit': fit }}
      aria-busy={phase === 'loading' ? 'true' : undefined}
    >
      {imageSrc && phase !== 'failed' && (
        <img
          src={imageSrc}
          srcSet={isOptimizedAttempt && request.srcSet ? request.srcSet : undefined}
          sizes={isOptimizedAttempt && request.srcSet ? sizes : undefined}
          alt={alt}
          loading={loading}
          decoding="async"
          fetchPriority={fetchPriority}
          draggable="false"
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
      {phase === 'failed' && (
        <span className="smart-image-fallback" role="img" aria-label={alt || fallback || 'Image indisponible'}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4.75 5.75h14.5v12.5H4.75z" />
            <path d="m6.75 16 3.35-3.55 2.4 2.35 1.65-1.7 3.1 2.9" />
            <circle cx="9" cy="9.25" r="1.2" />
          </svg>
        </span>
      )}
    </span>
  )
}
