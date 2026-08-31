import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loader from './Loader'
export default function ProtectedRoute({ children }) { const { user, loading } = useAuth(); const location = useLocation(); if (loading) return <Loader />; if (!user) return <Navigate to="/auth" replace state={{ from: location.pathname }} />; return children }
