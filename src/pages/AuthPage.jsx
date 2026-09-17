import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'
import { LEGAL_VERSION } from '../lib/legal'
import { supabase } from '../lib/supabase'
import { logTechnicalError, userError } from '../lib/userErrors'

export default function AuthPage() {
  const { user } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState('login')
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })
  const [legalConsent, setLegalConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (user) return <Navigate to={location.state?.from || '/account'} replace />

  function authDestination() {
    const from = location.state?.from
    return from && from !== '/auth' ? from : '/account'
  }

  async function completeAuthNavigation(session) {
    if (!session) throw new Error('AUTH_REQUIRED')
    window.location.replace(authDestination())
  }

  async function submit(event) {
    event.preventDefault()
    if (loading) return
    setError('')
    setMessage('')

    try {
      const email = form.email.trim().toLowerCase()
      if (!email) throw new Error('Saisissez votre adresse e-mail.')

      if (mode === 'signup') {
        const fullName = form.full_name.trim()
        if (fullName.length < 2) throw new Error('Indiquez votre nom complet.')
        if (form.password.length < 8) throw new Error('Votre mot de passe doit contenir au moins 8 caractères.')
        if (!legalConsent) throw new Error('Vous devez accepter les Conditions d’utilisation et la Politique de confidentialité pour créer votre compte.')

        setLoading(true)
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password: form.password,
          options: {
            data: {
              full_name: fullName,
              terms_accepted: true,
              privacy_accepted: true,
              legal_version: LEGAL_VERSION,
            },
          },
        })
        if (authError) throw authError

        if (data.session) await completeAuthNavigation(data.session)
        else {
          setMessage('Compte créé. Consultez votre e-mail si une confirmation est demandée, puis connectez-vous.')
          setMode('login')
          setLegalConsent(false)
        }
      } else {
        setLoading(true)
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password: form.password })
        if (authError) throw authError
        const { data: persisted, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        await completeAuthNavigation(persisted?.session || data?.session)
      }
    } catch (submitError) {
      logTechnicalError('auth', submitError)
      const localMessage = submitError instanceof Error && [
        'Saisissez votre adresse e-mail.',
        'Indiquez votre nom complet.',
        'Votre mot de passe doit contenir au moins 8 caractères.',
        'Vous devez accepter les Conditions d’utilisation et la Politique de confidentialité pour créer votre compte.',
      ].includes(submitError.message)
        ? submitError.message
        : userError(submitError, mode === 'signup' ? 'signup' : 'auth')
      setError(localMessage)
    } finally {
      setLoading(false)
    }
  }

  function switchMode() {
    setMode(mode === 'login' ? 'signup' : 'login')
    setError('')
    setMessage('')
    setLegalConsent(false)
  }

  return (
    <main className="auth-layout">
      <section className="auth-brand"><Logo className="auth-logo"/><h1>Un seul compte pour tout One Market.</h1><p>Commandez auprès de boutiques en RDC, suivez vos livraisons et gérez votre espace vendeur avec le même compte.</p></section>
      <section className="auth-panel"><div className="auth-card"><span className="eyebrow">Compte One Market</span><h2>{mode === 'login' ? 'Bon retour.' : 'Créer un compte.'}</h2><p>{mode === 'login' ? 'Connectez-vous pour retrouver vos commandes et votre espace.' : 'Créez votre compte pour acheter, suivre vos commandes ou demander l’ouverture d’une boutique.'}</p>
        <form onSubmit={submit} noValidate>
          {mode === 'signup' && <label>Nom complet<input required autoComplete="name" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Votre nom complet"/></label>}
          <label>Adresse e-mail<input required type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="nom@exemple.com"/></label>
          <label>Mot de passe<div className="password-field"><input required minLength={mode === 'signup' ? 8 : 6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type={show ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••"/><button type="button" aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onClick={() => setShow(value => !value)}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
          {mode === 'signup' && <label className="legal-consent-check"><input required type="checkbox" checked={legalConsent} onChange={e => setLegalConsent(e.target.checked)}/><span><ShieldCheck size={17}/> J’accepte les <Link to="/legal/conditions" target="_blank">Conditions d’utilisation</Link> et j’ai lu la <Link to="/legal/confidentialite" target="_blank">Politique de confidentialité</Link>.</span></label>}
          {error && <div className="alert error" role="alert">{error}</div>}{message && <div className="alert success" role="status">{message}</div>}
          <button className="button primary full" disabled={loading || (mode === 'signup' && !legalConsent)}>{loading ? 'Chargement…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</button>
        </form>
        <div className="auth-switch">{mode === 'login' ? 'Pas encore de compte ?' : 'Déjà un compte ?'} <button type="button" onClick={switchMode}>{mode === 'login' ? 'Créer un compte' : 'Se connecter'}</button></div>
        <div className="auth-legal-links"><Link to="/legal/conditions">Conditions</Link><Link to="/legal/confidentialite">Confidentialité</Link><Link to="/legal/cookies">Cookies</Link></div>
      </div></section>
    </main>
  )
}