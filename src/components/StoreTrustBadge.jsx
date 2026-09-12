import { BadgeCheck } from 'lucide-react'

export default function StoreTrustBadge({ store, compact = false }) {
  if (!store?.is_partner && !store?.is_verified) return null
  const partner = Boolean(store.is_partner)
  const label = partner ? 'Partenaire One Market' : 'Boutique vérifiée'
  return (
    <span className={`store-trust-badge ${partner ? 'is-partner' : 'is-verified'} ${compact ? 'is-compact' : ''}`} title={label} aria-label={label}>
      <BadgeCheck size={compact ? 14 : 16}/>
      {!compact && <span>{label}</span>}
    </span>
  )
}
