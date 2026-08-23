import { Shield, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Sidebar from './Sidebar'
import BackButton from './BackButton'

const AdminLayout = ({ children, showBackButton = true }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const { logout } = useAuth()

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 mobile-bottom-padding">
        {/* Back Button */}
        {showBackButton && (
          <div className="mb-4">
            <BackButton fallback="/" />
          </div>
        )}
        {children}
      </main>
    </div>
  )
}

export default AdminLayout
