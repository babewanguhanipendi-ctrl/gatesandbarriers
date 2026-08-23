import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI, removeToken } from '../services/api'

export const ROLES = {
  ADMIN: 'admin',
  DIRECTOR: 'director',
  MANAGER: 'manager',
  SUPERVISOR: 'supervisor',
  SECRETARY: 'secretary',
  GUARD: 'guard'
}

export const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing token on app load
    const token = localStorage.getItem('token')
    if (token) {
      fetchProfile()
    } else {
      setLoading(false)
    }
  }, [])

  const fetchProfile = async () => {
    try {
      const data = await authAPI.getProfile()
      setUser(data.user)
      setProfile(data.user)
      return data.user
    } catch (error) {
      console.error('Error fetching profile:', error)
      // Token invalid, clear it
      removeToken()
      setUser(null)
      setProfile(null)
      return null
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    removeToken()
    setUser(null)
    setProfile(null)
  }

  const hasRole = (role) => {
    if (!profile) return false
    if (profile.role === ROLES.ADMIN) return true // Admin has access to everything
    return profile.role === role
  }

  const hasAnyRole = (roles) => {
    if (!profile) return false
    if (profile.role === ROLES.ADMIN) return true
    return roles.includes(profile.role)
  }

  const value = {
    user,
    profile,
    loading,
    fetchProfile,
    logout,
    hasRole,
    hasAnyRole,
    isAdmin: hasRole(ROLES.ADMIN),
    isDirector: hasRole(ROLES.DIRECTOR),
    isManager: hasRole(ROLES.MANAGER),
    isSupervisor: hasRole(ROLES.SUPERVISOR),
    isSecretary: hasRole(ROLES.SECRETARY),
    isGuard: hasRole(ROLES.GUARD)
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}