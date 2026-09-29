import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { NotificationsProvider } from './context/NotificationsContext'
import { MarketLocationProvider } from './context/MarketLocationContext'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <MarketLocationProvider>
        <NotificationsProvider>
          <FavoritesProvider>
            <CartProvider>
              <App />
            </CartProvider>
          </FavoritesProvider>
        </NotificationsProvider>
        </MarketLocationProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
