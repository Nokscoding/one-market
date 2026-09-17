import { CheckCircle2, MessageSquareText, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { logTechnicalError, userError } from '../lib/userErrors'
import RatingStars from './RatingStars'

function formatDate(value) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
  } catch {
    return ''
  }
}

export default function ProductReviews({ product }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [rating, setRating] = useState(0)
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')

  async function loadReviews() {
    setLoading(true)
    setError('')
    try {
      const result = await supabase
        .from('product_reviews')
        .select('id,product_id,user_id,rating,title,comment,verified_purchase,created_at,updated_at')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false })

      if (result.error) throw result.error
      const list = result.data || []
      setReviews(list)
      const own = list.find(item => item.user_id === user?.id)
      if (own) {
        setRating(own.rating)
        setTitle(own.title || '')
        setComment(own.comment || '')
      } else {
        setRating(0)
        setTitle('')
        setComment('')
      }
    } catch (queryError) {
      logTechnicalError('reviews-load', queryError)
      setError(userError(queryError, 'reviews'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReviews()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, user?.id])

  const ownReview = reviews.find(item => item.user_id === user?.id)
  const summary = useMemo(() => {
    const count = reviews.length
    const average = count ? reviews.reduce((total, item) => total + Number(item.rating || 0), 0) / count : 0
    const distribution = [5, 4, 3, 2, 1].map(star => ({ star, count: reviews.filter(item => item.rating === star).length }))
    return { count, average, distribution }
  }, [reviews])

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!user) {
      navigate('/auth', { state: { from: `${location.pathname}${location.search}#reviews` } })
      return
    }
    if (!rating) return setError('Choisissez une note entre 1 et 5 étoiles.')
    if (!comment.trim()) return setError('Écrivez un commentaire avant de publier votre avis.')

    setSaving(true)
    const payload = { rating, title: title.trim() || null, comment: comment.trim() }
    try {
      const response = ownReview
        ? await supabase.from('product_reviews').update(payload).eq('id', ownReview.id).eq('user_id', user.id)
        : await supabase.from('product_reviews').insert({ ...payload, product_id: product.id, user_id: user.id })
      if (response.error) throw response.error
      await loadReviews()
    } catch (saveError) {
      logTechnicalError('reviews-save', saveError)
      setError(userError(saveError, 'reviews'))
    } finally {
      setSaving(false)
    }
  }

  async function removeOwnReview() {
    if (!ownReview || !user || saving) return
    setSaving(true)
    setError('')
    try {
      const result = await supabase.from('product_reviews').delete().eq('id', ownReview.id).eq('user_id', user.id)
      if (result.error) throw result.error
      await loadReviews()
    } catch (deleteError) {
      logTechnicalError('reviews-delete', deleteError)
      setError(userError(deleteError, 'reviews'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="reviews-section" id="reviews">
      <div className="reviews-heading"><div><span className="eyebrow">Avis clients</span><h2>Ce qu’en pensent les acheteurs</h2></div><div className="reviews-heading-score"><strong>{summary.average ? summary.average.toFixed(1) : '—'}</strong><span>/ 5</span><RatingStars value={summary.average} count={summary.count}/></div></div>

      <div className="reviews-layout">
        <aside className="reviews-summary-card"><div className="reviews-big-score"><strong>{summary.average ? summary.average.toFixed(1) : '0.0'}</strong><span>{summary.count} avis</span></div><div className="review-bars">{summary.distribution.map(item => { const percent = summary.count ? Math.round((item.count / summary.count) * 100) : 0; return <div className="review-bar-row" key={item.star}><span>{item.star}★</span><div><i style={{ width: `${percent}%` }}/></div><small>{item.count}</small></div> })}</div></aside>

        <div className="review-form-card">
          <div className="review-form-title"><MessageSquareText size={20}/><div><strong>{ownReview ? 'Modifier votre avis' : 'Laisser un commentaire'}</strong><span>Votre retour aide les autres clients à choisir.</span></div></div>
          {!user ? <button className="button secondary" onClick={() => navigate('/auth', { state: { from: `${location.pathname}#reviews` } })}>Se connecter pour donner un avis</button> : <form onSubmit={submit} className="review-form">
            <label>Votre note<RatingStars value={rating} interactive onChange={setRating} label="Choisir une note"/></label>
            <label>Titre <small>(facultatif)</small><input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="Ex. Très bon produit"/></label>
            <label>Votre commentaire<textarea value={comment} onChange={event => setComment(event.target.value)} maxLength={2000} rows={4} placeholder="Parlez de la qualité, de la livraison, de votre expérience…"/></label>
            {error && <p className="form-error">{error}</p>}
            <div className="review-form-actions"><button className="button primary" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : ownReview ? 'Mettre à jour' : 'Publier mon avis'}</button>{ownReview && <button className="review-delete-button" type="button" onClick={removeOwnReview} disabled={saving}><Trash2 size={16}/> Supprimer</button>}</div>
          </form>}
        </div>
      </div>

      <div className="reviews-list">
        {loading && <div className="review-empty">Chargement des avis…</div>}
        {!loading && error && !reviews.length && <div className="review-empty"><strong>Impossible de charger les avis</strong><span>{error}</span><button className="button secondary" type="button" onClick={loadReviews}>Réessayer</button></div>}
        {!loading && !error && !reviews.length && <div className="review-empty">Aucun avis pour le moment. Soyez le premier à partager votre expérience.</div>}
        {!loading && reviews.map(review => <article className="review-card" key={review.id}><div className="review-card-top"><div><strong>{review.user_id === user?.id ? 'Votre avis' : 'Client One Market'}</strong><span>{formatDate(review.updated_at || review.created_at)}</span></div>{review.verified_purchase && <span className="verified-purchase"><CheckCircle2 size={15}/> Achat vérifié</span>}</div><RatingStars value={review.rating} compact/>{review.title && <h3>{review.title}</h3>}{review.comment && <p>{review.comment}</p>}</article>)}
      </div>
    </section>
  )
}
