import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { uniformRequestsAPI } from '../../services/api'
import { Package, Truck, Check, X, AlertCircle, Clock, User, MapPin } from 'lucide-react'

const SupervisorUniformDelivery = () => {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [deliveries, setDeliveries] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchDeliveries()
  }, [])

  const fetchDeliveries = async () => {
    setLoading(true)
    try {
      const data = await uniformRequestsAPI.getDeliveryAssignments()
      setDeliveries(data.deliveries || [])
    } catch (error) {
      console.error('Error fetching deliveries:', error)
      setError('Failed to load delivery assignments')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateDeliveryStatus = async (requestId, delivery_status) => {
    setUpdating(true)
    try {
      const data = await uniformRequestsAPI.updateDeliveryStatus(requestId, delivery_status)
      setSuccess(data.message || `Delivery status updated to ${delivery_status}`)
      await fetchDeliveries()
      setTimeout(() => setSuccess(''), 5000)
    } catch (error) {
      setError(error.message || 'Failed to update delivery status')
      setTimeout(() => setError(''), 5000)
    } finally {
      setUpdating(false)
    }
  }

  const getDeliveryStatusBadge = (request) => {
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

  const canUpdateDelivery = (request) => {
    return request.status === 'disbursed' && !request.guard_confirmed
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
            <div className="text-lg text-gray-600">Loading delivery assignments...</div>
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
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-8 h-8 text-[#1a2a6c]" />
            Uniform Delivery Tracking
          </h1>
          <p className="text-gray-600 mt-1">Manage and track uniform deliveries to guards</p>
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

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Delivery</p>
                <p className="text-2xl font-bold text-gray-900">
                  {deliveries.filter(d => d.delivery_status === 'pending_delivery' || !d.delivery_status).length}
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Follow-ups Required</p>
                <p className="text-2xl font-bold text-gray-900">
                  {deliveries.filter(d => d.follow_up_requested).length}
                </p>
              </div>
              <div className="bg-red-100 p-3 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Assignments</p>
                <p className="text-2xl font-bold text-gray-900">{deliveries.length}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Deliveries List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Delivery Assignments</h2>
            <p className="text-sm text-gray-600 mt-1">Click on a delivery to update its status</p>
          </div>

          <div className="divide-y divide-gray-200">
            {deliveries.length === 0 ? (
              <div className="p-12 text-center">
                <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Deliveries</h3>
                <p className="text-gray-500">All uniform deliveries have been completed.</p>
              </div>
            ) : (
              deliveries.map((delivery) => (
                <div key={delivery.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-start gap-3">
                        <div className="bg-[#1a2a6c]/10 p-2 rounded-lg">
                          <Package className="w-5 h-5 text-[#1a2a6c]" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{delivery.item_name}</h3>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <User className="w-4 h-4" />
                              <span>{delivery.guard_name} ({delivery.guard_work_number})</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <MapPin className="w-4 h-4" />
                              <span>{delivery.site_client} - {delivery.site_location}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-3">
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              {new Date(delivery.requested_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </div>
                            {getDeliveryStatusBadge(delivery)}
                          </div>
                          {delivery.notes && (
                            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <p className="text-xs text-yellow-800">{delivery.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {canUpdateDelivery(delivery) && (
                      <div className="flex flex-col gap-2 ml-4">
                        <button
                          onClick={() => handleUpdateDeliveryStatus(delivery.id, 'delivered')}
                          disabled={updating}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
                        >
                          <Check className="w-4 h-4" />
                          Mark Delivered
                        </button>
                        <button
                          onClick={() => handleUpdateDeliveryStatus(delivery.id, 'delayed')}
                          disabled={updating}
                          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 text-sm"
                        >
                          <AlertCircle className="w-4 h-4" />
                          Mark Delayed
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SupervisorUniformDelivery