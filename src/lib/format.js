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
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return ''
  }
}

export const orderStatus = {
  pending: 'En attente',
  pending_confirmation: 'À confirmer',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  ready: 'Prête pour la livraison',
  picked_up: 'Récupérée par le livreur',
  out_for_delivery: 'En livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  failed: 'Échec',
  refused: 'Refusée',
  problem: 'Problème signalé',
  open: 'En cours',
  completed: 'Terminée',
  partially_completed: 'Partiellement terminée',
}

export const sellerOrderStatus = {
  pending: 'À confirmer',
  awaiting_payment: 'En attente de paiement',
  confirmed: 'Confirmée',
  preparing: 'En préparation',
  ready: 'Prête pour enlèvement',
  picked_up: 'Récupérée',
  out_for_delivery: 'En livraison',
  in_delivery: 'En livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  failed: 'Échec',
  refused: 'Refusée',
}

export const paymentStatus = {
  pending_on_delivery: 'À payer au livreur',
  awaiting_mobile_money: 'Paiement à finaliser',
  payment_submitted: 'Paiement envoyé, vérification en cours',
  paid: 'Paiement confirmé',
  cash_received: 'Paiement reçu',
  cancelled: 'Paiement annulé',
  failed: 'Paiement échoué',
}

export const logisticsStatus = {
  pending: 'En attente',
  preparing: 'En préparation',
  ready: 'Prête',
  picked_up: 'Récupérée par le livreur',
  out_for_delivery: 'En livraison',
  delivered: 'Livrée',
  failed: 'Échec de livraison',
  problem: 'Problème signalé',
  refused: 'Refusée',
  cancelled: 'Annulée',
}
