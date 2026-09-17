const DIRECT_MESSAGES = {
  AUTH_REQUIRED: 'Votre session a expiré. Veuillez vous reconnecter.',
  INVALID_LOGIN_CREDENTIALS: 'Adresse e-mail ou mot de passe incorrect.',
  EMAIL_NOT_CONFIRMED: 'Veuillez confirmer votre adresse e-mail avant de vous connecter.',
  ADDRESS_NOT_FOUND: 'Cette adresse de livraison n’est plus disponible.',
  DELIVERY_METHOD_UNAVAILABLE: 'Ce mode de livraison n’est pas disponible.',
  PAYMENT_METHOD_UNAVAILABLE: 'Ce moyen de paiement n’est pas disponible.',
  PAYMENT_NOT_CONFIRMED: 'Le paiement Mobile Money de cette commande n’est pas encore confirmé par One Market.',
  PAYMENT_CANCELLED: 'Le paiement de cette commande a été annulé.',
  PAYMENT_STATUS_FINAL: 'Ce paiement a déjà été finalisé et ne peut plus être modifié.',
  INVALID_PAYMENT_TRANSITION: 'Cette transition de paiement n’est pas autorisée.',
  PAYMENT_CANCELLATION_TOO_LATE: 'Cette commande a déjà été prise en charge et ne peut plus être annulée par le paiement.',
  PRODUCT_UNAVAILABLE: 'Un produit de votre commande n’est plus disponible.',
  STORE_UNAVAILABLE: 'Une boutique de votre commande n’est plus disponible.',
  CART_EMPTY: 'Votre panier est vide.',
  CART_NOT_FOUND: 'Votre panier est indisponible. Actualisez la page puis réessayez.',
  MIXED_CURRENCY_CART: 'Votre panier contient des produits dans plusieurs devises. Passez des commandes séparées pour continuer.',
  INSUFFICIENT_STOCK: 'Le stock disponible est insuffisant pour finaliser cette commande.',
  VARIANT_REQUIRED: 'Choisissez une option pour ce produit avant de continuer.',
  VARIANT_UNAVAILABLE: 'L’option sélectionnée n’est plus disponible.',
  VARIANT_PRODUCT_MISMATCH: 'L’option sélectionnée ne correspond plus à ce produit.',
  RDC_ONLY: 'One Market livre actuellement uniquement en République démocratique du Congo.',
  SELLER_TERMS_REQUIRED: 'Vous devez accepter les conditions vendeur avant de continuer.',
  SELLER_APPLICATION_NOT_FOUND: 'Votre dossier vendeur est introuvable.',
  SELLER_ORDER_NOT_FOUND: 'Cette commande vendeur est introuvable.',
  INVALID_SELLER_ORDER_TRANSITION: 'Cette étape de commande n’est pas autorisée maintenant.',
  INVALID_SELLER_ORDER_ACTION: 'Cette action n’est pas disponible pour cette commande.',
  REFUSAL_REASON_REQUIRED: 'Indiquez la raison du refus de la commande.',
  REPORTER_PHONE_REQUIRED: 'Ajoutez un numéro de téléphone valide.',
  SELLER_ORDER_FINANCE_FORBIDDEN: 'Vous n’êtes pas autorisé à modifier les informations financières de cette commande.',
  SELLER_ORDER_IMMUTABLE_FIELDS: 'Ces informations de commande ne peuvent plus être modifiées.',
  ERP_FORBIDDEN: 'Vous n’êtes pas autorisé à effectuer cette action.',
  ORDER_NOT_FOUND: 'Cette commande est introuvable.',
  INVALID_DELIVERY_STATUS: 'Ce statut de livraison n’est pas valide.',
}

const CONTEXT_DEFAULTS = {
  auth: 'Impossible de vous connecter pour le moment. Réessayez dans quelques instants.',
  signup: 'Impossible de créer votre compte pour le moment. Réessayez dans quelques instants.',
  profile: 'Impossible d’enregistrer vos informations pour le moment.',
  address: 'Impossible d’enregistrer cette adresse pour le moment.',
  cart: 'Impossible de mettre à jour votre panier pour le moment.',
  checkout: 'Impossible de passer votre commande pour le moment. Aucun paiement n’a été effectué.',
  orders: 'Impossible de charger vos commandes pour le moment.',
  messages: 'Impossible de charger ou d’envoyer les messages pour le moment.',
  favorites: 'Impossible de charger vos favoris pour le moment.',
  reviews: 'Impossible de charger ou d’enregistrer les avis pour le moment.',
  notifications: 'Impossible de charger vos notifications pour le moment.',
  image: 'Impossible d’envoyer cette image pour le moment.',
  catalog: 'Impossible de charger les produits pour le moment.',
  seller: 'Impossible de charger votre espace vendeur pour le moment.',
  seller_application: 'Impossible d’enregistrer votre dossier vendeur pour le moment.',
  product: 'Impossible d’enregistrer ce produit pour le moment.',
  store: 'Impossible d’enregistrer cette boutique pour le moment.',
  payment: 'Le paiement n’a pas pu être confirmé.',
  delivery: 'Impossible de mettre à jour la livraison pour le moment.',
  support: 'Impossible d’envoyer votre demande pour le moment.',
  generic: 'Une erreur est survenue. Veuillez réessayer.',
}

function normalize(error) {
  if (!error) return ''
  if (typeof error === 'string') return error.trim()
  return String(error.message || error.error_description || error.details || error.code || '').trim()
}

export function userError(error, context = 'generic') {
  const raw = normalize(error)
  if (!raw) return CONTEXT_DEFAULTS[context] || CONTEXT_DEFAULTS.generic
  const upper = raw.toUpperCase()

  for (const [key, message] of Object.entries(DIRECT_MESSAGES)) {
    if (upper.includes(key)) return message
  }

  if (/invalid login credentials/i.test(raw)) return 'Adresse e-mail ou mot de passe incorrect.'
  if (/email not confirmed/i.test(raw)) return 'Veuillez confirmer votre adresse e-mail avant de vous connecter.'
  if (/user already registered|already been registered|duplicate key.*email/i.test(raw)) return 'Cette adresse e-mail est déjà utilisée.'
  if (/password.*(short|characters)|weak password/i.test(raw)) return 'Votre mot de passe doit contenir au moins 8 caractères.'
  if (/jwt|token.*expired|session.*expired/i.test(raw)) return 'Votre session a expiré. Veuillez vous reconnecter.'
  if (/row-level security|rls|permission denied|42501|forbidden/i.test(raw)) return 'Vous n’êtes pas autorisé à effectuer cette action.'
  if (/invalid input syntax.*uuid|invalid uuid|user_id invalid/i.test(raw)) return 'Une information nécessaire n’est pas valide. Veuillez réessayer.'
  if (/23505|duplicate key|unique constraint/i.test(raw)) return 'Cette information est déjà enregistrée.'
  if (/foreign key|23503/i.test(raw)) return 'Une information liée n’est plus disponible. Actualisez la page puis réessayez.'
  if (/failed to fetch|networkerror|network request failed|fetch failed/i.test(raw)) return 'Impossible de se connecter au service. Vérifiez votre connexion Internet puis réessayez.'
  if (/database error saving new user/i.test(raw)) return 'Impossible de finaliser la création du compte. Réessayez dans un instant.'
  if (/storage.*(not found|bucket)/i.test(raw)) return 'Impossible d’accéder au fichier pour le moment. Réessayez.'

  return CONTEXT_DEFAULTS[context] || CONTEXT_DEFAULTS.generic
}

export function logTechnicalError(scope, error) {
  if (import.meta.env.DEV) console.error(`[OneMarket:${scope}]`, error)
}
