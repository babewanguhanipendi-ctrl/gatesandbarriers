import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BackButton from './BackButton'
import { useAuth } from '../contexts/AuthContext'

/**
 * Shared Authenticated Layout Component
 * Provides a consistent layout with sidebar and back button for all authenticated views
 */
const AuthenticatedLayout = ({ showBackButton = true, backButtonFallback = '/' }) => {
  const { profile } = useAuth()

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 mobile-bottom-padding">
        {/* Back Button - shown at the top of authenticated pages */}
        {showBackButton && (
          <div className="mb-4">
            <BackButton fallback={backButtonFallback || (profile ? `/${profile.role}` : '/')} />
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}

export default AuthenticatedLayout