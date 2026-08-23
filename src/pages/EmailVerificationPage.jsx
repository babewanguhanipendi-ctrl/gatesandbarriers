import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authAPI } from '../services/api'
import { CheckCircle, XCircle, Mail, Loader } from 'lucide-react'

const EmailVerificationPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('verifying') // verifying, success, error
  const [message, setMessage] = useState('')

  useEffect(() => {
    verifyEmail()
  }, [])

  const verifyEmail = async () => {
    const token = searchParams.get('token')

    if (!token) {
      setStatus('error')
      setMessage('Invalid verification link. No token provided.')
      return
    }

    try {
      const response = await authAPI.verifyEmail(token)
      setStatus('success')
      setMessage(response.message || 'Email verified successfully!')
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err) {
      setStatus('error')
      setMessage(err.message || 'Failed to verify email. The link may be invalid or expired.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-950 via-sky-800 to-cyan-700 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          {status === 'verifying' && (
            <>
              <div className="flex justify-center mb-4">
                <Loader className="w-16 h-16 text-[#1a2a6c] animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Verifying Your Email</h1>
              <p className="text-gray-600">Please wait while we verify your email address...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center mb-4">
                <CheckCircle className="w-16 h-16 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h1>
              <p className="text-gray-600 mb-4">{message}</p>
              <p className="text-sm text-gray-500">You will be redirected to the login page in a few seconds...</p>
              <button
                onClick={() => navigate('/login')}
                className="mt-4 px-6 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 transition-colors"
              >
                Go to Login Now
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center mb-4">
                <XCircle className="w-16 h-16 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h1>
              <p className="text-gray-600 mb-4">{message}</p>
              <div className="space-y-2">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full px-6 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 transition-colors"
                >
                  Go to Login
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="w-full px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Go to Home
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default EmailVerificationPage