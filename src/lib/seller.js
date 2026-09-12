export const SELLER_TYPES = [
  {
    code: 'individual',
    title: 'Particulier',
    description: 'Pour vendre sans société constituée : vêtements, accessoires, créations, importation, vente Instagram/WhatsApp…',
    legalRequired: false,
  },
  {
    code: 'professional',
    title: 'Indépendant / professionnel',
    description: 'Pour une marque personnelle, un atelier, un commerçant individuel ou une activité professionnelle.',
    legalRequired: false,
  },
  {
    code: 'business',
    title: 'Entreprise / business',
    description: 'Pour une entreprise officiellement constituée avec représentant et documents légaux.',
    legalRequired: true,
  },
]

export const SELLER_STATUS = {
  draft: { label: 'Brouillon', tone: 'draft' },
  pending: { label: 'En vérification', tone: 'pending' },
  under_review: { label: 'En cours d’examen', tone: 'pending' },
  approved: { label: 'Approuvée', tone: 'approved' },
  rejected: { label: 'Refusée', tone: 'rejected' },
  needs_information: { label: 'Informations demandées', tone: 'attention' },
  suspended: { label: 'Suspendue', tone: 'rejected' },
}

export function sellerType(code) {
  return SELLER_TYPES.find(item => item.code === code) || SELLER_TYPES[0]
}

export function normalizeOptionalUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  return `https://${raw}`
}

export function publicSocialLinks(store) {
  return [
    ['Site web', store?.website_url],
    ['Instagram', store?.instagram_url],
    ['TikTok', store?.tiktok_url],
    ['Facebook', store?.facebook_url],
    ['LinkedIn', store?.linkedin_url],
    ['WhatsApp Business', store?.whatsapp_business],
  ].filter(([, url]) => Boolean(url))
}
