import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { uniformRequestsAPI, supervisorAPI } from '../../services/api'
import { Package, Check, AlertCircle, Bike, Shield } from 'lucide-react'

const SupervisorUniformRequest = () => {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [existingRequest, setExistingRequest] = useState(null)
  const [dutyAllocation, setDutyAllocation] = useState(null)
  const [items, setItems] = useState({
    shirt: true,
    trouser: true,
    belt: true,
    whistle: true,
    shoes: false
  })

  // Uniform items configuration
  const uniformItems = [
    { id: 'shirt', name: 'Shirt', compulsory: true, price: 3000, description: 'Security uniform shirt' },
    { id: 'trouser', name: 'Trouser', compulsory: true, price: 0, description: 'Security uniform trouser' },
    { id: 'belt', name: 'Belt', compulsory: true, price: 0, description: 'Security belt' },
    { id: 'whistle', name: 'Whistle', compulsory: true, price: 0, description: 'Signaling whistle' },
    { id: 'shoes', name: 'Shoes', compulsory: false, price: 3000, description: 'Security boots/shoes' }
  ]

  useEffect(() => {
    checkExistingRequest()
    loadDutyAllocation()
  }, [])

  const loadDutyAllocation = async () => {
    try {
      const result = await supervisorAPI.getDutyAllocation()
      setDutyAllocation(result.allocations?.[0] || null)
    } catch (error) {
      console.error('Error loading duty allocation:', error)
    }
  }

  const checkExistingRequest = async () => {
    setLoading(true)
    try {
      // Check if supervisor already has a uniform request
      const result = await uniformRequestsAPI.getMyRequests()
      const myRequest = result.uniformRequests?.[0]
      if (myRequest) {
        setExistingRequest(myRequest)
      }
    } catch (error) {
      console.error('Error checking existing request:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleItemChange = (itemId, value) => {
    // Compulsory items cannot be unchecked
    const item = uniformItems.find(i => i.id === itemId)
    if (item?.compulsory && !value) return

    setItems(prev => ({
      ...prev,
      [itemId]: value
    }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const requestedItems = uniformItems.filter(item => items[item.id]).map(item => item.name).join(', ')
      await uniformRequestsAPI.create({ item_name: requestedItems })
      alert('Uniform request submitted successfully!')
      checkExistingRequest()
    } catch (error) {
      console.error('Error submitting request:', error)
      alert('Failed to submit uniform request. Please try again.')
    } finally {
      setSubmitting(false)
    }
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
          <p className="text-gray-600 mt-1">Request your security uniform items</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#1a2a6c]" />
            Current Duty Equipment
          </h2>
          {dutyAllocation ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg"><p className="text-xs text-blue-700 uppercase">Area</p><p className="font-bold text-blue-900 capitalize">{dutyAllocation.area}</p></div>
              <div className="p-4 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500 uppercase">Uniform</p><p className="font-bold text-gray-900 capitalize">{dutyAllocation.uniform_status || profile?.uniform_status || 'Pending'}</p></div>
              <div className="p-4 bg-gray-50 rounded-lg flex items-center gap-3"><Bike className="text-gray-500" /><div><p className="text-xs text-gray-500 uppercase">Motorcycle</p><p className="font-bold text-gray-900">{dutyAllocation.motorcycle ? 'Allocated' : 'Not allocated'}</p></div></div>
              <div className="p-4 bg-gray-50 rounded-lg flex items-center gap-3"><Shield className="text-gray-500" /><div><p className="text-xs text-gray-500 uppercase">Motor Gear</p><p className="font-bold text-gray-900">{dutyAllocation.motor_gear ? 'Allocated' : 'Not allocated'}</p></div></div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No duty equipment allocation has been recorded.</p>
          )}
        </div>

        {existingRequest && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-blue-600" />
              <p className="text-sm text-blue-800">
                You already have a uniform request submitted. Status: <strong>{existingRequest.status}</strong>
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-[#1a2a6c]" />
            Select Uniform Items
          </h2>

          <div className="space-y-4">
            {uniformItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {item.compulsory && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      Compulsory
                    </span>
                  )}
                  <label className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#1a2a6c] focus:ring-offset-2">
                    <input
                      type="checkbox"
                      checked={items[item.id] || false}
                      onChange={(e) => handleItemChange(item.id, e.target.checked)}
                      disabled={item.compulsory}
                      className="sr-only"
                    />
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        items[item.id] ? 'translate-x-5 bg-[#1a2a6c]' : 'translate-x-0'
                      }`}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Important Terms & Conditions</p>
                <ul className="text-xs text-yellow-700 mt-2 space-y-1">
                  <li>• KES 1,000 is deducted monthly from your salary for 3 months (total KES 3,000)</li>
                  <li>• The deduction covers the compulsory uniform set (Shirt, Trouser, Belt, Whistle)</li>
                  <li>• If you resign following the correct procedure and return all company items, the KES 3,000 will be refunded</li>
                  <li>• Shoes are optional at KES 3,000 (one-time payment)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setItems({
                shirt: true,
                trouser: true,
                belt: true,
                whistle: true,
                shoes: false
              })}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Reset
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !!existingRequest}
              className="px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : existingRequest ? 'Request Submitted' : 'Submit Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SupervisorUniformRequest