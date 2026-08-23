import { useState, useEffect } from 'react'
import { X, Phone, User, AlertTriangle, Check } from 'lucide-react'
import { usersAPI } from '../services/api'

const EmergencyContactModal = ({ isOpen, onClose, userId, userData, onSuccess }) => {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    emergency_contact: '',
    emergency_phone: ''
  })

  useEffect(() => {
    if (isOpen && userId) {
      fetchEmergencyContacts()
    }
  }, [isOpen, userId])

  const fetchEmergencyContacts = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await usersAPI.getEmergencyContacts(userId)
      setFormData({
        emergency_contact: data.emergency_contact || '',
        emergency_phone: data.emergency_phone || ''
      })
    } catch (err) {
      console.error('Failed to fetch emergency contacts:', err)
      setError(err.message || 'Failed to load emergency contacts')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.emergency_contact.trim() || !formData.emergency_phone.trim()) {
      setError('Both contact name and phone number are required')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const data = await usersAPI.updateEmergencyContacts(userId, formData)
      
      setSuccess(true)
      setError('')
      
      // Notify parent component
      if (onSuccess) {
        onSuccess(data.user)
      }

      // Auto-close after 1.5 seconds
      setTimeout(() => {
        handleClose()
      }, 1500)
    } catch (err) {
      console.error('Failed to update emergency contacts:', err)
      setError(err.message || 'Failed to update emergency contacts')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setFormData({ emergency_contact: '', emergency_phone: '' })
    setError('')
    setSuccess(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                Emergency Contact
              </h2>
              {userData && (
                <p className="text-sm text-gray-600 mt-1">
                  Managing emergency contact for <span className="font-semibold">{userData.full_name}</span>
                </p>
              )}
            </div>
            <button
              onClick={handleClose}
              disabled={submitting}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-800 font-medium">
                  Emergency contact updated successfully!
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Contact Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="w-4 h-4 inline mr-2" />
                    Contact Person Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.emergency_contact}
                    onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                    placeholder="Enter full name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                    disabled={submitting}
                  />
                </div>

                {/* Contact Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone className="w-4 h-4 inline mr-2" />
                    Contact Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.emergency_phone}
                    onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                    placeholder="e.g., 0712345678"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                    disabled={submitting}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This contact will be used in case of emergencies
                  </p>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-xs text-blue-800">
                    <strong>Note:</strong> Emergency contact information is critical for staff safety. 
                    Please ensure the contact person is aware and reachable at all times.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {!loading && (
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || success}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-[#1a2a6c] to-[#b21f1f] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : success ? (
                  <>
                    <Check className="w-5 h-5" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save Contact</span>
                )}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default EmergencyContactModal