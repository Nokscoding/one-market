import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', country_code: 'CD' })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  if (user) return <Navigate to={location.state?.from || '/account'} replace />

  async function submit(e) {
    e.preventDefault(); setError(''); setMessage(''); setLoading(true)
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({ email: form.email.trim(), password: form.password, options: { data: { full_name: form.full_name.trim() } } })
        if (authError) throw authError
        if (data.session) { await supabase.from('profiles').update({ country_code: form.country_code }).eq('id', data.user.id); navigate(location.state?.from || '/') }
        else { setMessage('Compte créé. Vérifie ton email si une confirmation est demandée, puis connecte-toi.'); setMode('login') }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password })
        if (authError) throw authError
        navigate(location.state?.from || '/')
      }
    } catch (e) { setError(e.message || 'Une erreur est survenue.') } finally { setLoading(false) }
  }

  return <main className="auth-layout"><section className="auth-brand"><Logo className="auth-logo" /><h1>Un seul compte pour tout OneMarket.</h1><p>Commandez auprès de boutiques en RDC ou aux États-Unis, puis échangez directement avec chaque vendeur.</p></section><section className="auth-panel"><div className="auth-card"><span className="eyebrow">Compte OneMarket</span><h2>{mode === 'login' ? 'Bon retour.' : 'Créer un compte.'}</h2><p>{mode === 'login' ? 'Connecte-toi pour retrouver tes commandes et conversations.' : 'Quelques informations suffisent pour commencer.'}</p><form onSubmit={submit}>{mode === 'signup' && <><label>Nom complet<input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Votre nom" /></label><label>Pays<select value={form.country_code} onChange={e => setForm({ ...form, country_code: e.target.value })}><option value="CD">République démocratique du Congo</option><option value="US">États-Unis</option></select></label></>}<label>Email<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="nom@exemple.com" /></label><label>Mot de passe<div className="password-field"><input required minLength={6} type={show ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" /><button type="button" onClick={() => setShow(v => !v)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>{error && <div className="alert error">{error}</div>}{message && <div className="alert success">{message}</div>}<button className="button primary full" disabled={loading}>{loading ? 'Chargement…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</button></form><div className="auth-switch">{mode === 'login' ? 'Pas encore de compte ?' : 'Déjà un compte ?'} <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage('') }}>{mode === 'login' ? 'Créer un compte' : 'Se connecter'}</button></div></div></section></main>
}
