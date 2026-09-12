import { Star } from 'lucide-react'

export default function RatingStars({ value = 0, count = null, compact = false, interactive = false, onChange, label }) {
  const numericValue = Math.max(0, Math.min(5, Number(value) || 0))
  const rounded = Math.round(numericValue)

  return (
    <div className={`rating-stars ${compact ? 'rating-stars--compact' : ''} ${interactive ? 'rating-stars--interactive' : ''}`} aria-label={label || `${numericValue.toFixed(1)} sur 5`}>
      <span className="rating-stars-icons" aria-hidden={!interactive}>
        {[1, 2, 3, 4, 5].map(star => interactive ? (
          <button key={star} type="button" className={star <= rounded ? 'is-filled' : ''} onClick={() => onChange?.(star)} aria-label={`${star} étoile${star > 1 ? 's' : ''}`}>
            <Star size={compact ? 14 : 18} />
          </button>
        ) : (
          <Star key={star} size={compact ? 14 : 18} className={star <= rounded ? 'is-filled' : ''} />
        ))}
      </span>
      {!interactive && <span className="rating-value">{numericValue > 0 ? numericValue.toFixed(1) : '—'}</span>}
      {count !== null && !interactive && <span className="rating-count">({Number(count) || 0})</span>}
    </div>
  )
}
