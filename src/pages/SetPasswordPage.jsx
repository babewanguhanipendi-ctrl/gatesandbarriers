import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import { CheckCircle, AlertCircle } from 'lucide-react'
import BrandLogo from '../components/BrandLogo'

const SetPasswordPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''
  const workNumber = searchParams.get('wn') || ''

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [success, setSuccess] = useState(false)

  if (!token || !workNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-950 via-sky-800 to-cyan-700 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Link</h2>
          <p className="text-sm text-gray-600 mb-4">
            This password setup link is invalid or expired. Please contact your administrator for a new link.
          </p>
          <Link
            to="/login"
            className="inline-block rounded-lg bg-sky-800 px-6 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-sky-900 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    setLoading(true)

    try {
      const response = await authAPI.setPassword({
        token,
        work_number: workNumber,
        password,
        confirm_password: confirmPassword
      })
      setMessage(response.message || 'Password set successfully.')
      setSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err) {
      setError(err.message || 'Failed to set password')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-950 via-sky-800 to-cyan-700 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Set!</h2>
          <p className="text-gray-600 mb-4">
            Your password has been set successfully. You can now sign in with your new password.
          </p>
          <p className="text-sm text-gray-500">Redirecting to login page...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-950 via-sky-800 to-cyan-700 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-sky-950 p-6 text-center">
          <BrandLogo className="w-20 h-20 rounded-2xl mx-auto mb-3 p-1" />
          <h1 className="text-3xl font-bold text-white">Set Your Password</h1>
          <p className="text-gray-200 mt-1 text-sm">Gates & Barriers Staff Account</p>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg text-sm bg-red-100 text-red-700 border border-red-200 flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {message && (
          <div className="mx-6 mt-4 p-3 rounded-lg text-sm bg-green-100 text-green-700 border border-green-200">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            Account: <strong>{workNumber}</strong>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password *</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent outline-none"
              placeholder="Minimum 6 characters"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent outline-none ${
                confirmPassword && password !== confirmPassword
                  ? 'border-red-500 bg-red-50'
                  : confirmPassword && password === confirmPassword
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300'
              }`}
              placeholder="Re-enter your password"
              autoComplete="new-password"
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
            )}
            {confirmPassword && password === confirmPassword && password.length >= 6 && (
              <p className="text-xs text-green-600 mt-1">Passwords match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sky-800 py-3 font-bold text-white shadow-sm transition-colors hover:bg-sky-900 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Setting Password...' : 'Set Password'}
          </button>
        </form>

        <div className="px-6 pb-6 text-center text-sm">
          <Link to="/login" className="text-[#1a2a6c] hover:underline">Back to Sign In</Link>
        </div>
      </div>
    </div>
  )
}

export default SetPasswordPage
