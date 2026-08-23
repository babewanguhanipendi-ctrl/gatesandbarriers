import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ROLES } from '../contexts/AuthContext'

/**
 * Admin Route Protection Component
 * Provides strict isolation for Admin portal
 * - Only allows users with ADMIN role
 * - Redirects all other roles immediately
 * - Adds additional security layer beyond standard ProtectedRoute
 */
export const AdminRoute = ({ children }) => {
  const { profile, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-gray-600">Verifying admin access...</div>
      </div>
    )
  }

  // Strict check: Must be logged in AND have admin role
  if (!profile) {
    console.warn('Unauthorized access attempt to Admin portal: No user logged in')
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
    console.warn(`Unauthorized access attempt to Admin portal: User ${profile.email} has role ${profile.role}`)
    return <Navigate to="/" replace />
  }

  // Additional verification: Double-check role
  if (profile.role !== ROLES.ADMIN) {
    console.error('Critical security: Role mismatch detected for admin route')
    return <Navigate to="/login" replace />
  }

  return children
}

export default AdminRoute