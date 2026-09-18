export const ADDRESS_TYPES = [
  { code: 'home', label: 'Maison' },
  { code: 'work', label: 'Travail' },
  { code: 'other', label: 'Autre' },
]

export const DELIVERY_CITIES = [
  { city: 'Lubumbashi', region: 'Haut-Katanga' },
  { city: 'Kinshasa', region: 'Kinshasa' },
  { city: 'Kolwezi', region: 'Lualaba' },
]

export function addressTypeLabel(type, customLabel = '') {
  if (type === 'work') return 'Travail'
  if (type === 'other') return customLabel?.trim() || 'Autre'
  return 'Maison'
}

export function blankAddress(profile = {}) {
  return {
    address_type: 'home',
    label: 'Maison',
    full_name: profile.full_name || '',
    phone: profile.phone || '',
    whatsapp_phone: '',
    country_code: 'CD',
    city: 'Lubumbashi',
    state_region: 'Haut-Katanga',
    commune: '',
    district: '',
    address_line1: '',
    building: '',
    apartment: '',
    landmark: '',
    address_line2: '',
    instructions: '',
    latitude: null,
    longitude: null,
    is_default: false,
  }
}

export function validateAddress(form) {
  if (!form.full_name?.trim()) return 'Indiquez le nom complet du destinataire.'
  if (!form.phone?.trim()) return 'Ajoutez un numéro de téléphone pour que le livreur puisse vous contacter.'
  if (!form.city?.trim()) return 'Choisissez une ville de livraison.'
  if (!form.district?.trim()) return 'Complétez votre quartier avant de continuer.'
  if (!form.address_line1?.trim()) return 'Indiquez votre rue ou avenue.'
  if (form.address_type === 'other' && !form.label?.trim()) return 'Donnez un nom à cette adresse.'
  return ''
}

export function addressPayload(form, customerId) {
  const type = form.address_type || 'home'
  return {
    customer_id: customerId,
    address_type: type,
    label: addressTypeLabel(type, form.label),
    full_name: form.full_name.trim(),
    phone: form.phone.trim(),
    whatsapp_phone: form.whatsapp_phone?.trim() || null,
    country_code: 'CD',
    city: form.city.trim(),
    state_region: form.state_region?.trim() || null,
    commune: form.commune?.trim() || null,
    district: form.district.trim(),
    address_line1: form.address_line1.trim(),
    building: form.building?.trim() || null,
    apartment: form.apartment?.trim() || null,
    landmark: form.landmark?.trim() || null,
    address_line2: form.address_line2?.trim() || null,
    instructions: form.instructions?.trim() || null,
    latitude: form.latitude !== null && form.latitude !== '' && Number.isFinite(Number(form.latitude)) ? Number(form.latitude) : null,
    longitude: form.longitude !== null && form.longitude !== '' && Number.isFinite(Number(form.longitude)) ? Number(form.longitude) : null,
    is_default: Boolean(form.is_default),
  }
}

export function addressLines(address = {}) {
  const line1 = [address.address_line1, address.address_line2, address.building, address.apartment].filter(Boolean).join(', ')
  const line2 = [address.district, address.commune, address.city, address.state_region].filter(Boolean).join(', ')
  return [line1, line2, address.landmark ? `Repère : ${address.landmark}` : ''].filter(Boolean)
}
