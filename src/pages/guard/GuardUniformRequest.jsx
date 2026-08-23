import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { uniformRequestsAPI } from '../../services/api'
import { Package, Check, X, AlertCircle, Plus, Minus, Clock, User, Truck } from 'lucide-react'

const GuardUniformRequest = () => {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [myRequests, setMyRequests] = useState([])
  const [itemName, setItemName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pendingCount, setPendingCount] = useState(0)
  const [confirmingId, setConfirmingId] = useState(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)

  // Common uniform items for quick selection
  const quickItems = [
    'Shirt',
    'Trouser',
    'Belt',
    'Shoes',
    'Whistle',
    'Rungu',
    'Rungu Holder',
    'Raincoat',
    'Torch'
  ]

  useEffect(() => {
    fetchMyRequests()
  }, [])

  const fetchMyRequests = async () => {
    setLoading(true)
    try {
      const data = await uniformRequestsAPI.getMyRequests()
      const requests = data.uniformRequests || []
      setMyRequests(requests)
      setPendingCount(requests.filter(r => r.status === 'pending').length)
    } catch (error) {
      console.error('Error fetching requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleQuickSelect = (item) => {
    setItemName(item)
  }

  const handleSubmit = async () => {
    if (!itemName.trim()) {
      setError('Please enter or select a uniform item name')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const data = await uniformRequestsAPI.create({ item_name: itemName.trim() })
      setSuccess(data.message || 'Uniform request submitted successfully!')
      setItemName('')
      await fetchMyRequests()
      setTimeout(() => setSuccess(''), 5000)
    } catch (error) {
      setError(error.message || 'Failed to submit uniform request')
      setTimeout(() => setError(''), 5000)
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmClick = (request) => {
    setSelectedRequest(request)
    setShowConfirmModal(true)
  }

  const handleConfirmReceipt = async (received, follow_up = false) => {
    if (!selectedRequest) return

    setConfirmingId(selectedRequest.id)
    try {
      const data = await uniformRequestsAPI.confirmReceipt(selectedRequest.id, received, follow_up)
      setSuccess(data.message || 'Receipt confirmed successfully')
      await fetchMyRequests()
      setShowConfirmModal(false)
      setSelectedRequest(null)
      setTimeout(() => setSuccess(''), 5000)
    } catch (error) {
      setError(error.message || 'Failed to confirm receipt')
      setTimeout(() => setError(''), 5000)
    } finally {
      setConfirmingId(null)
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      disbursed: 'bg-blue-100 text-blue-800 border-blue-200',
      rejected: 'bg-red-100 text-red-800 border-red-200'
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
        {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
      </span>
    )
  }

  const getDeliveryStatusBadge = (request) => {
    if (request.status !== 'disbursed') return null

    if (request.follow_up_requested) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium border bg-red-100 text-red-800 border-red-200">
          Follow-up Requested
        </span>
      )
    }

    if (request.guard_confirmed) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium border bg-green-100 text-green-800 border-green-200">
          Delivered & Confirmed
        </span>
      )
    }

    if (request.delivery_status === 'delayed') {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium border bg-orange-100 text-orange-800 border-orange-200">
          Delivery Delayed
        </span>
      )
    }

    if (request.delivery_status === 'pending_delivery' || !request.delivery_status) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium border bg-blue-100 text-blue-800 border-blue-200">
          Pending Delivery
        </span>
      )
    }

    return null
  }

  const canConfirmReceipt = (request) => {
    return request.status === 'disbursed' && !request.guard_confirmed && request.delivery_status !== 'delivered'
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
            <div className="text-lg text-gray-600">Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Uniform Request</h1>
          <p className="text-gray-600 mt-1">Request individual uniform items and confirm deliveries</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <X className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {/* Pending Count Alert */}
        {pendingCount > 0 && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-800">
              You have <strong>{pendingCount}</strong> pending uniform request{pendingCount > 1 ? 's' : ''}.
              You can have a maximum of <strong>2</strong> pending requests at a time.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* New Request Form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#1a2a6c]" />
              Request New Item
            </h2>

            {/* Quick Select Items */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Select Items
              </label>
              <div className="flex flex-wrap gap-2">
                {quickItems.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleQuickSelect(item)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      itemName === item
                        ? 'bg-[#1a2a6c] text-white border-[#1a2a6c]'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#1a2a6c] hover:text-[#1a2a6c]'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Item Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Or Type Item Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g., New Shirt, Boots, Cap..."
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                maxLength={255}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || !itemName.trim() || pendingCount >= 2}
              className="w-full px-4 py-3 bg-gradient-to-r from-[#1a2a6c] to-[#b21f1f] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : pendingCount >= 2 ? (
                <>
                  <AlertCircle className="w-5 h-5" />
                  <span>Max Pending Requests Reached</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  <span>Submit Request</span>
                </>
              )}
            </button>

            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Item Limit</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    You can only have <strong>2 pending requests</strong> at a time.
                    Wait for the secretary to process existing requests before submitting new ones.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* My Requests History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-[#1a2a6c]" />
                My Requests
                {myRequests.length > 0 && (
                  <span className="text-sm font-normal text-gray-500">({myRequests.length})</span>
                )}
              </h2>
            </div>

            <div className="divide-y divide-gray-200">
              {myRequests.length === 0 ? (
                <div className="p-8 text-center">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No uniform requests yet</p>
                  <p className="text-xs text-gray-400 mt-1">Use the form to request your first item</p>
                </div>
              ) : (
                myRequests.map((request) => (
                  <div key={request.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{request.item_name}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            {new Date(request.requested_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                          {getStatusBadge(request.status)}
                          {getDeliveryStatusBadge(request)}
                        </div>
                        {request.notes && (
                          <p className="text-xs text-gray-500 mt-2">{request.notes}</p>
                        )}

                        {/* Confirm Receipt Button for disbursed items */}
                        {canConfirmReceipt(request) && (
                          <button
                            onClick={() => handleConfirmClick(request)}
                            className="mt-3 flex items-center gap-2 px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 transition-colors text-sm"
                          >
                            <Truck className="w-4 h-4" />
                            Confirm Delivery
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Confirm Delivery</h3>
            <p className="text-gray-700 mb-2">
              Have you received: <strong>{selectedRequest.item_name}</strong>?
            </p>
            <p className="text-sm text-gray-600 mb-6">
              Please confirm receipt of this uniform item. If you haven't received it, you can request a follow-up.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleConfirmReceipt(true, false)}
                disabled={confirmingId === selectedRequest.id}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {confirmingId === selectedRequest.id ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Confirming...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    <span>Yes, I Received It</span>
                  </>
                )}
              </button>

              <button
                onClick={() => handleConfirmReceipt(false, true)}
                disabled={confirmingId === selectedRequest.id}
                className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {confirmingId === selectedRequest.id ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5" />
                    <span>Not Received - Request Follow-Up</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setShowConfirmModal(false)
                  setSelectedRequest(null)
                }}
                disabled={confirmingId === selectedRequest.id}
                className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>Note:</strong> If you click "Not Received", a follow-up will be requested and both the Secretary and Supervisor will be notified immediately.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GuardUniformRequest