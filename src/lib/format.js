export function money(value, currency = 'USD') {
  const amount = Number(value || 0)
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export function dateTime(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export const orderStatus = {
  open: 'En cours',
  completed: 'Terminée',
  partially_completed: 'Partiellement terminée',
  refused: 'Refusée',
}

export const sellerOrderStatus = {
  awaiting_payment: 'En attente de paiement',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  in_delivery: 'En livraison',
  delivered: 'Livrée',
  refused: 'Refusée',
}
