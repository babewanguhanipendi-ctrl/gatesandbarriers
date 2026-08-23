import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, ROLES } from '../contexts/AuthContext'
import { notificationsAPI } from '../services/api'
import { Bell, LogOut, Menu, X } from 'lucide-react'
import BrandLogo from './BrandLogo'

const Sidebar = ({ onNavClick }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const sidebarRef = useRef(null)
  const toggleRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, hasRole, logout } = useAuth()

  const fetchUnreadCount = useCallback(async () => {
    if (!profile) return
    try {
      const data = await notificationsAPI.getUnreadCount()
      setUnreadCount(data.count || 0)
    } catch {
      // silently fail
    }
  }, [profile])

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  useEffect(() => {
    const handleDocumentPointerDown = (event) => {
      if (
        isOpen &&
        !sidebarRef.current?.contains(event.target) &&
        !toggleRef.current?.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown)
    return () => document.removeEventListener('pointerdown', handleDocumentPointerDown)
  }, [isOpen])

  const toggleSidebar = () => setIsOpen((open) => !open)

  const closeSidebar = () => setIsOpen(false)

  const toggleNotifications = () => {
    // Navigate to profile page notifications tab
    navigate('/profile')
    closeSidebar()
  }

  const handleNavClick = (sectionId) => {
    if (onNavClick) onNavClick(sectionId)
    setIsOpen(false)
  }

  const handleLogout = async () => {
    await logout()
    setIsOpen(false)
  }

  const getPortalInfo = () => {
    if (hasRole(ROLES.ADMIN)) {
      return { path: '/admin', label: 'Admin Portal', description: 'System oversight & settings' }
    } else if (hasRole(ROLES.DIRECTOR)) {
      return { path: '/director', label: 'Director Portal', description: 'Executive oversight' }
    } else if (hasRole(ROLES.MANAGER)) {
      return { path: '/manager', label: 'Manager Portal', description: 'Operational oversight' }
    } else if (hasRole(ROLES.SUPERVISOR)) {
      return { path: '/supervisor', label: 'Supervisor Portal', description: 'Execution & routing' }
    } else if (hasRole(ROLES.SECRETARY)) {
      return { path: '/secretary', label: 'Secretary Portal', description: 'Reports & records' }
    } else if (hasRole(ROLES.GUARD)) {
      return { path: '/guard', label: 'Guard Portal', description: 'Shifts & payroll' }
    }
    return null
  }

  const allPortals = [
    { path: '/admin', label: 'Admin Portal', description: 'System oversight & settings' },
    { path: '/manager', label: 'Manager Portal', description: 'Operational oversight' },
    { path: '/supervisor', label: 'Supervisor Portal', description: 'Execution & routing' },
    { path: '/director', label: 'Director Portal', description: 'Executive oversight' },
    { path: '/secretary', label: 'Secretary Portal', description: 'Reports & records' },
    { path: '/guard', label: 'Guard Portal', description: 'Shifts & payroll' },
  ]

  const userPortal = getPortalInfo()
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <>
      {/* Hamburger toggle button */}
      <button
        ref={toggleRef}
        onClick={toggleSidebar}
        className="fixed top-3 left-3 sm:top-4 sm:left-4 z-[60] flex h-10 w-10 items-center justify-center rounded-full bg-sky-700 text-white shadow-lg transition-transform active:scale-95"
        aria-label="Toggle sidebar"
        aria-expanded={isOpen}
      >
        {isOpen ? <X size={20} strokeWidth={2.5} aria-hidden="true" /> : <Menu size={22} strokeWidth={2.5} aria-hidden="true" />}
      </button>

      {/* Backdrop overlay - always present when sidebar is open, covers all screen sizes */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[55] transition-opacity duration-300"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar drawer - always overlay, never pushes content */}
      <aside
        ref={sidebarRef}
        className={`fixed top-0 left-0 z-[60] h-screen w-56 bg-sky-100 shadow-2xl transform transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } overflow-y-auto`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex flex-col h-full">
          {/* Logo Section - compact */}
          <div className="px-2 py-2 border-b border-sky-200">
            <Link to="/" className="flex items-center gap-2" onClick={closeSidebar}>
              <BrandLogo className="w-8 h-8 rounded-lg shrink-0 p-0.5" />
              <div>
                <h1 className="text-xs font-bold text-sky-950 leading-tight">
                  Gates & Barriers
                </h1>
                <p className="text-[9px] text-sky-700 leading-tight">Security Management</p>
              </div>
            </Link>
          </div>

          {/* User Profile Section - compact with logout */}
          {profile && (
            <div className="px-2 py-1.5 bg-sky-200 border-b border-sky-300">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#1a2a6c] to-[#b21f1f] flex items-center justify-center text-white font-semibold shrink-0 text-[10px]">
                  {profile.full_name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-sky-950 truncate leading-tight">{profile.full_name || 'User'}</p>
                  <p className="text-[9px] text-sky-700 capitalize leading-tight">
                    {profile.role}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors duration-150 shrink-0"
                  title="Logout"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Navigation - compact */}
          <nav className="flex-1 overflow-y-auto py-1.5">
            {!profile && (
              <div className="mb-1.5 px-2">
                <p className="px-2 py-1 text-[9px] font-semibold text-sky-700 uppercase tracking-wider">Portals</p>
                <Link
                  to="/login"
                  onClick={closeSidebar}
                  className="block px-2 py-2 text-[11px] font-semibold text-sky-900 hover:bg-sky-100 rounded transition-colors duration-150"
                >
                  Staff Portal
                </Link>
              </div>
            )}

            {profile && (
              <div>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">
                  {hasRole(ROLES.ADMIN) ? 'All Portals' : 'My Portal'}
                </p>
                <ul className="space-y-0.5">
                  {(hasRole(ROLES.ADMIN) ? allPortals : [userPortal].filter(Boolean)).map((portal) => (
                    <li key={portal.path}>
                      <Link
                        to={portal.path}
                        onClick={closeSidebar}
                        className={`block px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors duration-150 ${isActive(portal.path) ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                      >
                        {portal.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {profile && (
              <div className="mt-2">
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">Account</p>
                <ul className="space-y-0.5">
                  <li>
                    <button
                      onClick={toggleNotifications}
                      className="w-full block px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors duration-150"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1">
                          <Bell size={12} />
                          Notifications
                        </span>
                        {unreadCount > 0 && (
                          <span className="px-1 py-0.5 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                  <li>
                    <Link
                      to="/profile"
                      onClick={closeSidebar}
                      className={`block px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors duration-150 ${isActive('/profile') ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>My Profile</span>
                      </div>
                    </Link>
                  </li>
                </ul>
              </div>
            )}
          </nav>


          {/* Footer - compact */}
          {!profile && (
            <div className="p-2 border-t border-sky-200">
              <p className="text-[9px] text-center text-sky-700">Â© {new Date().getFullYear()} Gates & Barriers</p>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

export default Sidebar
