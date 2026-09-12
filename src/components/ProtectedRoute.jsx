import { Navigate, useLocation } from 'react-router-dom'
import Loader from './Loader'
import { useAuth } from '../context/AuthContext'
export default function ProtectedRoute({ children }) { const { user, loading } = useAuth(); const location = useLocation(); if (loading) return <Loader fullscreen/>; if (!user) return <Navigate to="/auth" replace state={{ from: location.pathname + location.search }}/>; return children }
