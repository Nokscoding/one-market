import { MapPin, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useMarketLocation } from '../context/MarketLocationContext'
import { MARKET_CITIES, MARKET_COUNTRIES } from '../lib/marketLocation'
import './market-location.css'

export default function MarketLocationPrompt() {
  const { chooserOpen, closeChooser, hasLocation, location, setLocation } = useMarketLocation()
  const [countryCode, setCountryCode] = useState(location.countryCode || 'CD')
  const [city, setCity] = useState(location.city || '')

  useEffect(() => {
    if (!chooserOpen) return
    setCountryCode(location.countryCode || 'CD')
    setCity(location.city || '')
  }, [chooserOpen, location.countryCode, location.city])

  const cities = useMemo(() => MARKET_CITIES[countryCode] || [], [countryCode])
  if (!chooserOpen) return null

  function submit(event) {
    event.preventDefault()
    const cleanCity = city.trim()
    if (!cleanCity) return
    setLocation({ countryCode, city: cleanCity })
  }

  return <div className="market-location-backdrop" role="presentation">
    <form className="market-location-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-label="Choisir votre localisation One Market">
      {hasLocation && <button type="button" className="market-location-close" onClick={closeChooser} aria-label="Fermer"><X size={18}/></button>}
      <span className="market-location-icon"><MapPin size={24}/></span>
      <div className="market-location-copy">
        <span>Votre marché local</span>
        <h2>Où souhaitez-vous acheter ?</h2>
        <p>One Market affiche en priorité les produits des boutiques de votre ville. Les produits d’autres villes restent disponibles, avec un délai et des frais de transport supplémentaires.</p>
      </div>

      <label>Pays
        <select value={countryCode} onChange={event => { setCountryCode(event.target.value); setCity('') }}>
          {MARKET_COUNTRIES.map(country => <option key={country.code} value={country.code}>{country.label}</option>)}
        </select>
      </label>

      <label>Ville
        <input list="one-market-city-list" value={city} onChange={event => setCity(event.target.value)} placeholder="Choisissez ou écrivez votre ville" autoComplete="address-level2"/>
        <datalist id="one-market-city-list">{cities.map(name => <option value={name} key={name}/>)}</datalist>
        <small>Votre ville n’est pas dans la liste ? Écrivez simplement son nom.</small>
      </label>

      <button className="button primary market-location-submit" disabled={!city.trim()}>Continuer sur One Market</button>
    </form>
  </div>
}
