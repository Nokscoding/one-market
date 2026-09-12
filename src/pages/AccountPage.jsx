import { LogOut, Package, RefreshCw, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Loader from '../components/Loader'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function AccountPage() {
  const { user, profile, profileLoading, profileError, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ full_name: '', phone: '', country_code: 'CD', preferred_language: 'fr' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name || '', phone: profile.phone || '', country_code: profile.country_code || 'CD', preferred_language: profile.preferred_language || 'fr' })
  }, [profile])

  if (profileLoading) return <Loader />
  if (!profile) return <main className="section-shell page-space"><div className="account-card profile-load-error"><h2>Profil indisponible</h2><p>{profileError || 'Le profil OneMarket n’a pas pu être chargé pour le moment.'}</p><button className="button primary" type="button" onClick={refreshProfile}><RefreshCw size={17} /> Réessayer</button></div></main>

  async function save(e) {
    e.preventDefault(); setSaving(true); setMessage('')
    const { error } = await supabase.from('profiles').update(form).eq('id', user.id)
    if (!error) { await refreshProfile(); setMessage('Profil mis à jour.') } else setMessage(error.message)
    setSaving(false)
  }

  async function logout() { await supabase.auth.signOut(); navigate('/') }

  return <main className="section-shell page-space"><div className="page-title"><span className="eyebrow">Compte OneMarket</span><h1>{profile.full_name || 'Mon compte'}</h1><p>{user.email}</p></div><div className="account-layout"><nav className="account-nav"><Link to="/orders"><Package size={18} /> Mes commandes</Link><button onClick={logout}><LogOut size={18} /> Se déconnecter</button></nav><section className="account-card"><h2>Informations personnelles</h2><form onSubmit={save} className="account-form"><label>Nom complet<input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></label><label>Téléphone<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+243… / +1…" /></label><label>Pays<select value={form.country_code} onChange={e => setForm({ ...form, country_code: e.target.value })}><option value="CD">République démocratique du Congo</option><option value="US">États-Unis</option></select></label><label>Langue<select value={form.preferred_language} onChange={e => setForm({ ...form, preferred_language: e.target.value })}><option value="fr">Français</option><option value="en">English (préparé)</option></select></label>{message && <div className="alert success">{message}</div>}<button className="button primary" disabled={saving}><Save size={17} /> {saving ? 'Enregistrement…' : 'Enregistrer'}</button></form></section></div></main>
}
