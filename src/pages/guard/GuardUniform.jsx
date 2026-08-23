import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { Package, Check, X, AlertTriangle, Plus, ShoppingBag } from 'lucide-react'
import { uniformRequestsAPI } from '../../services/api'

const GuardUniform = () => {
  const { profile } = useAuth()
  const [uniforms, setUniforms] = useState([])
  const [loading, setLoading] = useState(true)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [requestItem, setRequestItem] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [requestMessage, setRequestMessage] = useState('')
  const [uniformAllocation, setUniformAllocation] = useState(null)

  useEffect(() => {
    fetchUniforms()
  }, [])

  const fetchUniforms = async () => {
    try {
      const data = await uniformRequestsAPI.getMyRequests()
      setUniforms(data.uniformRequests || [])
      try {
        const res = await fetch(`/api/users/${profile.id}`)
        const userData = await res.json()
        if (userData.user) {
          setUniformAllocation(userData.user)
        }
      } catch (e) { /* non-critical */ }
    } catch (error) {
      console.error('Error fetching uniforms:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRequestReplacement = async () => {
    if (!requestItem.trim()) {
      setRequestMessage('Please select a uniform item')
      return
    }
    setRequesting(true)
    try {
      await uniformRequestsAPI.create({ item_name: requestItem.trim() })
      setRequestMessage('')
      setShowRequestModal(false)
      setRequestItem('')
      fetchUniforms()
    } catch (error) {
      setRequestMessage(error.message || 'Failed to submit request. You may have reached the 2-item limit.')
    } finally {
      setRequesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const allocatedItems = uniforms.filter(u => u.status === 'disbursed')
  const pendingItems = uniforms.filter(u => u.status === 'pending')
  const canRequestUniform = pendingItems.length < 2

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-8 h-8 text-[#1a2a6c]" />
            My Uniform
          </h1>
          <p className="text-gray-600 mt-1">View your allocated uniform items and request replacements</p>
        </div>

        <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Uniform Request</p>
              <p className="text-xs text-gray-500">{pendingItems.length}/2 pending requests used</p>
            </div>
            <button
              onClick={() => canRequestUniform && setShowRequestModal(true)}
              disabled={!canRequestUniform}
              className="px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
              Request New Uniform
            </button>
          </div>
          {!canRequestUniform && (
            <p className="text-xs text-red-600 mt-2">You already have 2 pending uniform requests. Wait for one to be processed before requesting another item.</p>
          )}
        </div>
        {uniformAllocation && (
          <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-500">Uniform Status:</span>
                <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                  uniformAllocation.uniform_status === 'complete' 
                    ? 'bg-green-100 text-green-800'
                    : uniformAllocation.uniform_status === 'allocated'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {uniformAllocation.uniform_status?.charAt(0).toUpperCase() + uniformAllocation.uniform_status?.slice(1) || 'Allocated'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">Allocated Uniform Items</h2>
          {allocatedItems.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No uniform items allocated yet</p>
              <p className="text-sm text-gray-400 mt-1">Contact your supervisor for uniform allocation</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Item</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Allocated Date</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Delivery</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {allocatedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.item_name}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          item.status === 'disbursed' ? 'bg-green-100 text-green-800' : 
                          'bg-gray-100 text-gray-800'
                        }`}>{item.status}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {item.requested_at ? new Date(item.requested_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          item.delivery_status === 'delivered' ? 'bg-green-100 text-green-800' :
                          item.delivery_status === 'pending_delivery' ? 'bg-yellow-100 text-yellow-800' :
                          item.delivery_status === 'delayed' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {item.delivery_status ? item.delivery_status.replace(/_/g, ' ') : 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {item.status === 'disbursed' && item.delivery_status === 'pending_delivery' && (
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                try { await uniformRequestsAPI.confirmReceipt(item.id, true); fetchUniforms() } catch(e) {}
                              }}
                              className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                            >
                              <Check size={12} className="inline mr-1" /> Confirm
                            </button>
                            <button
                              onClick={async () => {
                                try { await uniformRequestsAPI.confirmReceipt(item.id, false, true); fetchUniforms() } catch(e) {}
                              }}
                              className="px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
                            >
                              <AlertTriangle size={12} className="inline mr-1" /> Follow Up
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pendingItems.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Pending Requests</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Item</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Requested Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pendingItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.item_name}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Pending</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {item.requested_at ? new Date(item.requested_at).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showRequestModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <ShoppingBag size={20} /> Request Uniform Item
                </h2>
                <button onClick={() => { setShowRequestModal(false); setRequestMessage('') }} className="p-1 hover:bg-gray-100 rounded">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">Max 2 pending requests at a time.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                  <select value={requestItem} onChange={(e) => setRequestItem(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1a2a6c]">
                    <option value="">Select an item</option>
                    <option value="Shirt">Shirt</option>
                    <option value="Trouser">Trouser</option>
                    <option value="Belt">Belt</option>
                    <option value="Whistle">Whistle</option>
                    <option value="Rungu">Rungu</option>
                    <option value="Rungu Holder">Rungu Holder</option>
                    <option value="Shoes">Shoes</option>
                    <option value="Raincoat">Raincoat</option>
                    <option value="Torch">Torch</option>
                  </select>
                </div>
                {requestMessage && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{requestMessage}</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => { setShowRequestModal(false); setRequestMessage('') }}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300">Cancel</button>
                  <button onClick={handleRequestReplacement} disabled={requesting || !requestItem}
                    className="flex-1 bg-[#1a2a6c] text-white py-2 rounded-lg hover:bg-[#1a2a6c]/90 disabled:opacity-50">
                    {requesting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GuardUniform
