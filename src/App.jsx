import { useEffect, useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import AccountSellerGateway from './components/AccountSellerGateway'
import CookieConsent from './components/CookieConsent'
import Footer from './components/Footer'
import Header from './components/Header'
import NotificationCenter from './components/NotificationCenter'
import NotificationPermissionPrompt from './components/NotificationPermissionPrompt'
import SiteIntro from './components/SiteIntro'
import ProtectedRoute from './components/ProtectedRoute'
import AuthPage from './pages/AuthPage'
import CartPage from './pages/CartPage'
import Catalog from './pages/Catalog'
import ChatPage from './pages/ChatPage'
import CheckoutPage from './pages/CheckoutPage'
import FavoritesPage from './pages/FavoritesPage'
import Home from './pages/Home'
import LegalPage from './pages/LegalPage'
import OrderPage from './pages/OrderPage'
import OrdersPage from './pages/OrdersPage'
import ProductPage from './pages/ProductPage'
import SellerEntry from './pages/SellerEntry'
import StorePage from './pages/StorePage'
import Stores from './pages/Stores'

function Private({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>
}

export default function App() {
  const location = useLocation()
  const authPage = location.pathname === '/auth'
  const sellerPage = location.pathname.startsWith('/seller')
  const standalonePage = authPage || sellerPage
  const [introVisible, setIntroVisible] = useState(true)
  const [introLeaving, setIntroLeaving] = useState(false)

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setIntroLeaving(true), 1600)
    const removeTimer = window.setTimeout(() => setIntroVisible(false), 2260)
    return () => {
      window.clearTimeout(leaveTimer)
      window.clearTimeout(removeTimer)
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('site-intro-lock', introVisible)
    document.body.classList.toggle('site-intro-lock', introVisible)
    return () => {
      document.documentElement.classList.remove('site-intro-lock')
      document.body.classList.remove('site-intro-lock')
    }
  }, [introVisible])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [location.pathname, location.search])

  return (
    <div className="app">
      {introVisible && <SiteIntro leaving={introLeaving} />}
      {!standalonePage && <Header />}
      {sellerPage && <><div className="seller-floating-notifications"><NotificationCenter/></div><Link className="seller-return-site" to="/">← Retourner sur One Market</Link></>}

      <div className="route-stage" key={`${location.pathname}${location.search}`}>
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/store/:slug" element={<StorePage />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/legal/:section" element={<LegalPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/favorites" element={<Private><FavoritesPage /></Private>} />
          <Route path="/cart" element={<Private><CartPage /></Private>} />
          <Route path="/checkout" element={<Private><CheckoutPage /></Private>} />
          <Route path="/orders" element={<Private><OrdersPage /></Private>} />
          <Route path="/orders/:id" element={<Private><OrderPage /></Private>} />
          <Route path="/chat/:id" element={<Private><ChatPage /></Private>} />
          <Route path="/account" element={<Private><AccountSellerGateway /></Private>} />
          <Route path="/seller" element={<Private><SellerEntry /></Private>} />
          <Route path="*" element={<Home />} />
        </Routes>
      </div>

      {!standalonePage && <Footer />}
      {!introVisible && <NotificationPermissionPrompt />}
      {!introVisible && !sellerPage && <CookieConsent />}
    </div>
  )
}
