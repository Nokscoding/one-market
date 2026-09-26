export const MARKET_COUNTRIES = [
  { code: 'CD', label: 'RDC' },
  { code: 'US', label: 'États-Unis' },
]

export const MARKET_CITIES = {
  CD: [
    'Kinshasa','Lubumbashi','Kolwezi','Likasi','Kipushi','Kasumbalesa','Kamina','Kalemie',
    'Mbuji-Mayi','Kananga','Tshikapa','Mwene-Ditu','Kabinda','Kisangani','Goma','Bukavu',
    'Uvira','Bunia','Beni','Butembo','Kindu','Matadi','Boma','Kikwit','Bandundu','Mbandaka',
    'Gemena','Lisala','Isiro','Buta','Gbadolite','Inongo','Boende','Lodja','Ilebo','Kasongo',
    'Manono','Pweto','Fungurume','K Likasi'
  ],
  US: [
    'New York','Los Angeles','Chicago','Houston','Phoenix','Philadelphia','San Antonio',
    'San Diego','Dallas','Austin','Jacksonville','Fort Worth','San Jose','Columbus',
    'Charlotte','Indianapolis','San Francisco','Seattle','Denver','Washington','Boston',
    'Nashville','Detroit','Portland','Las Vegas','Miami','Atlanta','Orlando','Tampa'
  ],
}

export const LOCATION_STORAGE_KEY = 'one_market_location_v1'

export function normalizeMarketLocation(value) {
  const raw = value && typeof value === 'object' ? value : {}
  const countryCode = raw.countryCode === 'US' ? 'US' : 'CD'
  const city = String(raw.city || '').trim()
  return { countryCode, city }
}

export function readMarketLocation() {
  if (typeof window === 'undefined') return { countryCode: 'CD', city: '' }
  try {
    return normalizeMarketLocation(JSON.parse(window.localStorage.getItem(LOCATION_STORAGE_KEY) || '{}'))
  } catch {
    return { countryCode: 'CD', city: '' }
  }
}

export function saveMarketLocation(location) {
  const next = normalizeMarketLocation(location)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next))
  }
  return next
}

export function sameCity(a, b) {
  return String(a || '').trim().toLocaleLowerCase('fr') === String(b || '').trim().toLocaleLowerCase('fr')
}

export function rankProductsForLocation(products, location) {
  const country = location?.countryCode || 'CD'
  const city = String(location?.city || '').trim()
  return [...(products || [])]
    .filter(product => !product?.store?.country_code || product.store.country_code === country)
    .map((product,index) => {
      const storeCity = String(product?.store?.city || '').trim()
      const local = city && sameCity(storeCity, city)
      const countryMatch = product?.store?.country_code === country
      return { product, index, locationScore: local ? 2 : countryMatch ? 1 : 0 }
    })
    .sort((a,b) => b.locationScore - a.locationScore || a.index - b.index)
    .map(row => row.product)
}

export function rankStoresForLocation(stores, location) {
  const country = location?.countryCode || 'CD'
  const city = String(location?.city || '').trim()
  return [...(stores || [])]
    .filter(store => !store.country_code || store.country_code === country)
    .map((store,index) => ({ store, index, local: city && sameCity(store.city, city) ? 1 : 0 }))
    .sort((a,b) => b.local - a.local || a.index - b.index)
    .map(row => row.store)
}
