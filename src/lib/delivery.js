export const DELIVERY_OPTIONS = [
  {
    code: 'standard',
    label: 'Livraison normale',
    feeCdf: 5000,
    description: 'Délai standard One Market.',
    short: 'Standard',
  },
  {
    code: 'express',
    label: 'Livraison express',
    feeCdf: 10000,
    description: 'Traitement et livraison prioritaires.',
    short: 'Express',
  },
]

export const ONE_MARKET_PLUS = {
  name: 'One Market Plus',
  status: 'coming_soon',
  plans: [
    { code: 'monthly', label: 'Mensuel', priceCdf: 15000, duration: '1 mois' },
    { code: 'quarterly', label: '3 mois', priceCdf: 40000, duration: '3 mois' },
    { code: 'annual', label: 'Annuel', priceCdf: 140000, duration: '12 mois' },
  ],
  benefits: [
    'Livraison normale à 0 FC pendant la période active',
    'Livraison express ramenée à 5 000 FC',
    'Traitement prioritaire des commandes éligibles',
    'Offres réservées lorsque des promotions One Market sont disponibles',
  ],
}

export function deliveryOption(code) {
  return DELIVERY_OPTIONS.find(item => item.code === code) || DELIVERY_OPTIONS[0]
}

export function cdf(value) {
  const amount = Math.max(0, Number(value) || 0)
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount)} FC`
}
