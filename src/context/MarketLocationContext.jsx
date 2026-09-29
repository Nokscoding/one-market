import { createContext, useContext, useMemo, useState } from 'react'
import { readMarketLocation, saveMarketLocation } from '../lib/marketLocation'

const MarketLocationContext = createContext(null)

export function MarketLocationProvider({ children }) {
  const [location, setLocationState] = useState(() => readMarketLocation())
  const [chooserOpen, setChooserOpen] = useState(() => !readMarketLocation().city)

  function setLocation(next) {
    const saved = saveMarketLocation(next)
    setLocationState(saved)
    setChooserOpen(false)
  }

  const value = useMemo(() => ({
    location,
    hasLocation: Boolean(location.city),
    chooserOpen,
    openChooser: () => setChooserOpen(true),
    closeChooser: () => { if (location.city) setChooserOpen(false) },
    setLocation,
  }), [location, chooserOpen])

  return <MarketLocationContext.Provider value={value}>{children}</MarketLocationContext.Provider>
}

export function useMarketLocation() {
  const value = useContext(MarketLocationContext)
  if (!value) throw new Error('useMarketLocation must be used inside MarketLocationProvider')
  return value
}
