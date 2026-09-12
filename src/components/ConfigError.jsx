import { AlertTriangle, Copy } from 'lucide-react'
export default function ConfigError() {
  const text = `VITE_SUPABASE_URL=https://mvbcazbyftjenjuydxft.supabase.co\nVITE_SUPABASE_PUBLISHABLE_KEY=VOTRE_CLE_PUBLISHABLE`
  return <main className="config-error"><div className="config-card"><AlertTriangle size={42}/><span className="eyebrow">Configuration locale</span><h1>One Market ne trouve pas Supabase.</h1><p>Crée le fichier <code>.env.local</code> à la racine du projet puis ajoute les deux variables publiques Supabase. La page blanche a été remplacée par cet écran pour que le problème soit identifiable.</p><pre>{text}</pre><button className="button secondary" onClick={() => navigator.clipboard?.writeText(text)}><Copy size={17}/> Copier l’exemple</button></div></main>
}
