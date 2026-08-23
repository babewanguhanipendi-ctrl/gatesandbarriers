import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { authAPI } from '../services/api'
import { AlertCircle } from 'lucide-react'
import BrandLogo from '../components/BrandLogo'

const getDefaultRoute = (role) => {
  switch (role) {
    case 'admin': return '/admin'
    case 'director': return '/director'
    case 'manager': return '/manager'
    case 'supervisor': return '/supervisor'
    case 'secretary': return '/secretary'
    case 'guard': return '/guard'
    default: return '/'
  }
}

const LoginPage = () => {
  const navigate = useNavigate()
  const { fetchProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loginWorkNumber, setLoginWorkNumber] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await authAPI.login(loginWorkNumber, loginPassword)
      const profile = await fetchProfile()
      navigate(getDefaultRoute(profile?.role))
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-950 via-sky-800 to-cyan-700 p-3 sm:p-4 safe-area-top">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden mx-auto">
        <div className="bg-sky-950 p-5 sm:p-6 text-center">
          <BrandLogo className="mx-auto mb-3 h-20 w-28 sm:h-24 sm:w-36" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Gates & Barriers</h1>
          <p className="text-gray-200 mt-1 text-sm">Staff Access</p>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg text-sm bg-red-100 text-red-700 border border-red-200 flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Work Number</label>
            <input
              type="text"
              required
              value={loginWorkNumber}
              onChange={(e) => setLoginWorkNumber(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent outline-none"
              placeholder="e.g. GBD-001"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent outline-none"
              placeholder="Password"
              autoComplete="current-password"
            />
          </div>

          <div className="text-right">
            <Link to="/forgot-password" className="text-sm text-[#1a2a6c] hover:underline">
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
              className="w-full rounded-lg bg-sky-800 py-3 font-bold text-white shadow-sm transition-colors hover:bg-sky-900 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
