import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import ConfigError from './components/ConfigError'
import Footer from './components/Footer'
import Header from './components/Header'
import ProtectedRoute from './components/ProtectedRoute'
import AccountPage from './pages/AccountPage'
import AuthPage from './pages/AuthPage'
import CartPage from './pages/CartPage'
import Catalog from './pages/Catalog'
import CheckoutPage from './pages/CheckoutPage'
import HelpPage from './pages/HelpPage'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
import OrderPage from './pages/OrderPage'
import OrdersPage from './pages/OrdersPage'
import ProductPage from './pages/ProductPage'
import StorePage from './pages/StorePage'
import Stores from './pages/Stores'
import { supabaseConfigured } from './lib/supabase'

const Private = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>

export default function App() {
  const location = useLocation()
  const auth = location.pathname === '/auth'

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [location.pathname, location.search])

  if (!supabaseConfigured) return <ConfigError />

  return (
    <div className="app">
      {!auth && <Header />}
      <div className="route-stage" key={location.pathname + location.search}>
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/store/:slug" element={<StorePage />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/cart" element={<Private><CartPage /></Private>} />
          <Route path="/checkout" element={<Private><CheckoutPage /></Private>} />
          <Route path="/orders" element={<Private><OrdersPage /></Private>} />
          <Route path="/orders/:id" element={<Private><OrderPage /></Private>} />
          <Route path="/account" element={<Private><AccountPage /></Private>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      {!auth && <Footer />}
    </div>
  )
}
