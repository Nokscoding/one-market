export function money(value, currency = 'USD') {
  const amount = Number(value || 0)
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2,
  }).format(amount)
}

export function shortDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

export function statusLabel(status) {
  return ({
    pending_confirmation: 'À confirmer', confirmed: 'Confirmée', preparing: 'En préparation',
    ready: 'Prête', out_for_delivery: 'En livraison', delivered: 'Livrée',
    cancelled: 'Annulée', failed: 'Échouée', pending: 'En attente', refused: 'Refusée',
  })[status] || status || '—'
}
