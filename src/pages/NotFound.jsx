import { ArrowLeft, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
export default function NotFound(){return <main className="not-found section-shell"><div className="not-found-code">404</div><h1>Cette page s'est perdue dans le marché.</h1><p>Le lien n'existe pas ou a été déplacé.</p><div><Link className="button primary" to="/"><ArrowLeft/> Accueil</Link><Link className="button secondary" to="/catalog"><Search/> Catalogue</Link></div></main>}
