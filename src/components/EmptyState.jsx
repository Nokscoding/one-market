import { PackageOpen } from 'lucide-react'
export default function EmptyState({ title='Rien à afficher', text='', action=null }) { return <div className="empty-state"><div className="empty-icon"><PackageOpen size={30}/></div><h3>{title}</h3>{text && <p>{text}</p>}{action}</div> }
