import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authAPI } from '../services/api'
import BrandLogo from '../components/BrandLogo'

const ForgotPasswordPage = () => {
  const [searchParams] = useSearchParams()
  const resetToken = searchParams.get('token') || ''
  const verifyToken = searchParams.get('verify') || ''
  const initialStep = useMemo(() => {
    if (verifyToken) return 'verify'
    if (resetToken) return 'reset'
    return 'request'
  }, [resetToken, verifyToken])

  const [step, setStep] = useState(initialStep)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [requestForm, setRequestForm] = useState({ work_number: '', phone_number: '' })
  const [resetForm, setResetForm] = useState({ token: resetToken, code: '', password: '' })

  const handleRequest = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const response = await authAPI.forgotPassword(requestForm)
      setMessage(response.message || 'Password reset link and code sent to your Gmail address.')
    } catch (err) {
      setError(err.message || 'Failed to start password reset')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const response = await authAPI.resetPassword(resetForm)
      setMessage(response.message || 'New password saved. Verify your Gmail before logging in with it.')
      setStep('request')
    } catch (err) {
      setError(err.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const response = await authAPI.verifyPasswordReset(verifyToken)
      setMessage(response.message || 'Password reset verified. You can now sign in.')
    } catch (err) {
      setError(err.message || 'Failed to verify password reset')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-950 via-sky-800 to-cyan-700 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-sky-950 p-6 text-center">
          <BrandLogo className="w-20 h-20 rounded-2xl mx-auto mb-3 p-1" />
          <h1 className="text-3xl font-bold text-white">Password Help</h1>
          <p className="text-gray-200 mt-1 text-sm">Gates & Barriers Staff</p>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg text-sm bg-red-100 text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {message && (
          <div className="mx-6 mt-4 p-3 rounded-lg text-sm bg-green-100 text-green-700 border border-green-200">
            {message}
          </div>
        )}

        {step === 'request' && (
          <form onSubmit={handleRequest} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Work Number</label>
              <input
                type="text"
                required
                value={requestForm.work_number}
                onChange={(e) => setRequestForm({ ...requestForm, work_number: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent outline-none"
                placeholder="e.g. GB-001"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                required
                value={requestForm.phone_number}
                onChange={(e) => setRequestForm({ ...requestForm, phone_number: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent outline-none"
                placeholder="Registered phone number"
                autoComplete="tel"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-sky-800 py-3 font-bold text-white shadow-sm transition-colors hover:bg-sky-900 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send Reset Link and Code'}
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handleReset} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
              <input
                type="text"
                required
                value={resetForm.code}
                onChange={(e) => setResetForm({ ...resetForm, code: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent outline-none"
                placeholder="6 digit code"
                inputMode="numeric"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={resetForm.password}
                onChange={(e) => setResetForm({ ...resetForm, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent outline-none"
                placeholder="Minimum 6 characters"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-sky-800 py-3 font-bold text-white shadow-sm transition-colors hover:bg-sky-900 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Saving...' : 'Set New Password'}
            </button>
          </form>
        )}

        {step === 'verify' && (
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600">
              Verify this password reset before logging in with the new password.
            </p>
            <button
              type="button"
              onClick={handleVerify}
              disabled={loading}
              className="w-full rounded-lg bg-sky-800 py-3 font-bold text-white shadow-sm transition-colors hover:bg-sky-900 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Verifying...' : 'Verify Password Reset'}
            </button>
          </div>
        )}

        <div className="px-6 pb-6 text-center text-sm">
          <Link to="/login" className="text-[#1a2a6c] hover:underline">Back to Sign In</Link>
        </div>
      </div>
    </div>
  )
}

export default ForgotPasswordPage

