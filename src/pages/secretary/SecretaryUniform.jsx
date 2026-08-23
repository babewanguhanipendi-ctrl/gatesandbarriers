import { useState, useEffect } from 'react'
import { secretaryAPI, uniformRequestsAPI } from '../../services/api'
import ResponsiveTable from '../../components/ResponsiveTable'
import { User, Package, Shirt, AlertCircle, Check, X, Send, Clock } from 'lucide-react'

const SecretaryUniform = () => {
  const [uniformRequests, setUniformRequests] = useState([])
  const [newUniformRequests, setNewUniformRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [newLoading, setNewLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [selectedNewRequest, setSelectedNewRequest] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [activeTab, setActiveTab] = useState('new')
  const [allocationStatus, setAllocationStatus] = useState({})

  const uniformItems = [
    { id: 'shirt', name: 'Shirt', compulsory: true, price: 3000, description: 'Security uniform shirt' },
    { id: 'rungu', name: 'Rungu', compulsory: true, price: 0, description: 'Traditional security baton' },
    { id: 'rungu_holder', name: 'Rungu Holder', compulsory: true, price: 0, description: 'Holder for rungu' },
    { id: 'trouser', name: 'Trouser', compulsory: true, price: 0, description: 'Security uniform trouser' },
    { id: 'belt', name: 'Belt', compulsory: true, price: 0, description: 'Security belt' },
    { id: 'whistle', name: 'Whistle', compulsory: true, price: 0, description: 'Signaling whistle' },
    { id: 'shoes', name: 'Shoes', compulsory: false, price: 3000, description: 'Security boots/shoes' },
    { id: 'raincoat', name: 'Raincoat', compulsory: false, price: 0, description: 'Issued by Manager per site requirements' },
    { id: 'torch', name: 'Torch', compulsory: false, price: 0, description: 'Flashlight for night shifts' }
  ]

  useEffect(() => {
    fetchUniformRequests()
    fetchNewUniformRequests()
  }, [])

  const fetchUniformRequests = async () => {
    setLoading(true)
    try {
      const data = await secretaryAPI.getUniformRequests()
      const requests = (data.uniformRequests || []).map(req => ({
        ...req,
        shirt: req.shirt ?? true,
        rungu: req.rungu ?? true,
        rungu_holder: req.rungu_holder ?? true,
        trouser: req.trouser ?? true,
        belt: req.belt ?? true,
        whistle: req.whistle ?? true,
        shoes: req.shoes ?? false,
        raincoat: req.raincoat ?? false,
        torch: req.torch ?? false
      }))
      setUniformRequests(requests)
    } catch (error) {
      console.error('Error fetching legacy uniform requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchNewUniformRequests = async () => {
    setNewLoading(true)
    try {
      const data = await uniformRequestsAPI.getAll()
      setNewUniformRequests(data.uniformRequests || [])
    } catch (error) {
      console.error('Error fetching new uniform requests:', error)
    } finally {
      setNewLoading(false)
    }
  }

  const handleNewRowClick = (request) => {
    setSelectedNewRequest(request)
    setRejectReason('')
    setShowNewModal(true)
  }

  const handleDisburse = async (requestId) => {
    setActionLoading(true)
    setErrorMessage('')
    try {
      const data = await uniformRequestsAPI.updateStatus(requestId, { status: 'disbursed' })
      setSuccessMessage(data.message || 'Uniform marked as disbursed')
      setShowNewModal(false)
      setSelectedNewRequest(null)
      await fetchNewUniformRequests()
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      setErrorMessage(error.message || 'Failed to disburse uniform')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (requestId) => {
    if (!rejectReason.trim()) {
      setErrorMessage('Please provide a reason for rejection')
      return
    }
    setActionLoading(true)
    setErrorMessage('')
    try {
      const data = await uniformRequestsAPI.updateStatus(requestId, {
        status: 'rejected',
        notes: rejectReason.trim()
      })
      setSuccessMessage(data.message || 'Uniform request rejected')
      setShowNewModal(false)
      setSelectedNewRequest(null)
      setRejectReason('')
      await fetchNewUniformRequests()
      setTimeout(() => setSuccessMessage(''), 5000)
    } catch (error) {
      setErrorMessage(error.message || 'Failed to reject uniform request')
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      disbursed: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
      issued: 'bg-green-100 text-green-800 border-green-200'
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
        {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
      </span>
    )
  }

  const newColumns = [
    { key: 'guard_name', label: 'Guard Name', render: (row) => (
      <div className="flex items-center gap-2">
        <User size={14} className="text-gray-400" />
        <span className="font-medium">{row.guard_name || 'N/A'}</span>
      </div>
    )},
    { key: 'guard_work_number', label: 'Work Number', render: (row) => (
      <span className="text-sm text-gray-600">{row.guard_work_number || 'N/A'}</span>
    )},
    { key: 'item_name', label: 'Item Requested', render: (row) => (
      <span className="font-medium text-[#1a2a6c]">{row.item_name}</span>
    )},
    { key: 'requested_at', label: 'Request Date', render: (row) => (
      <div className="flex items-center gap-1 text-sm text-gray-600">
        <Clock className="w-3 h-3" />
        {row.requested_at ? new Date(row.requested_at).toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        }) : 'N/A'}
      </div>
    )},
    { key: 'status', label: 'Status', render: (row) => getStatusBadge(row.status) },
    { key: 'actions', label: 'Actions', render: (row) => (
      <div className="flex items-center gap-2">
        {row.status === 'pending' && (
          <button
            onClick={(e) => { e.stopPropagation(); handleNewRowClick(row) }}
            className="px-3 py-1.5 bg-[#1a2a6c] text-white text-xs rounded-lg hover:bg-[#1a2a6c]/90 transition-colors flex items-center gap-1"
          >
            <Check className="w-3 h-3" />
            Process
          </button>
        )}
        {row.status !== 'pending' && (
          <span className="text-xs text-gray-400">Processed</span>
        )}
      </div>
    )}
  ]

  const legacyColumns = [
    { key: 'full_name', label: 'Applicant', render: (row) => (
      <div className="flex items-center gap-2">
        <User size={14} className="text-gray-400" />
        <span className="font-medium">{row.full_name || 'N/A'}</span>
      </div>
    )},
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'guard_name', label: 'Guard', render: (row) => row.guard_name || 'Not yet a guard' },
    { key: 'status', label: 'Status', render: (row) => getStatusBadge(row.status) },
    { key: 'created_at', label: 'Requested On', render: (row) => row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Uniform Management</h1>
          <p className="text-gray-600 mt-1">Manage guard uniform requests and allocations</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700">{successMessage}</p>
          </div>
        )}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <X className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}

        <div className="mb-6 flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('new')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'new'
                ? 'border-[#1a2a6c] text-[#1a2a6c]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Guard Item Requests
              {newUniformRequests.filter(r => r.status === 'pending').length > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {newUniformRequests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('legacy')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'legacy'
                ? 'border-[#1a2a6c] text-[#1a2a6c]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <Shirt className="w-4 h-4" />
              New Hire Allocation
            </span>
          </button>
        </div>

        {activeTab === 'new' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-[#1a2a6c]" />
                Guard Uniform Requests
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Guards submit individual item requests. Click "Process" to disburse or reject.
              </p>
            </div>
            <ResponsiveTable
              columns={newColumns}
              rows={newUniformRequests}
              loading={newLoading}
              emptyMessage="No uniform requests from guards yet"
            />
          </div>
        )}

        {activeTab === 'legacy' && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-[#1a2a6c]" />
                Uniform Items & Pricing
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Item</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Price (KES)</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {uniformItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                        <td className="px-4 py-3 text-sm">
                          {item.compulsory ? (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">Compulsory</span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">Optional</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.price > 0 ? `KES ${item.price.toLocaleString()}` : '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Shirt className="w-5 h-5 text-[#1a2a6c]" />
                  New Hire Uniform Requests
                </h2>
              </div>
              <ResponsiveTable
                columns={legacyColumns}
                rows={uniformRequests}
                loading={loading}
                emptyMessage="No uniform requests found"
              />
            </div>
          </>
        )}
      </div>

      {showNewModal && selectedNewRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Process Uniform Request</h2>
              <p className="text-sm text-gray-600 mt-1">
                {selectedNewRequest.guard_name} ({selectedNewRequest.guard_work_number})
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Package className="w-8 h-8 text-[#1a2a6c] bg-[#1a2a6c]/10 p-1.5 rounded-lg" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Requested Item</p>
                    <p className="text-lg font-bold text-[#1a2a6c]">{selectedNewRequest.item_name}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase">Requested On</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {selectedNewRequest.requested_at
                      ? new Date(selectedNewRequest.requested_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                      : 'N/A'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase">Guard Phone</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{selectedNewRequest.guard_phone || 'N/A'}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason (required if rejecting)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter reason if rejecting this request..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent resize-none"
                  rows={3}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Send className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">Delivery Notification</p>
                    <p className="text-xs text-blue-700 mt-1">
                      When disbursed, the guard will receive: "Your uniform will be delivered by the supervisor of your particular site. In case of failure, please follow up."
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-between">
              <button onClick={() => { setShowNewModal(false); setSelectedNewRequest(null); setRejectReason(''); setErrorMessage('') }}
                disabled={actionLoading}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <div className="flex gap-3">
                <button onClick={() => handleReject(selectedNewRequest.id)}
                  disabled={actionLoading || !rejectReason.trim()}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 flex items-center gap-2">
                  {actionLoading ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <X className="w-4 h-4" />}
                  Reject
                </button>
                <button onClick={() => handleDisburse(selectedNewRequest.id)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gradient-to-r from-[#1a2a6c] to-[#b21f1f] text-white rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                  {actionLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                  Disburse & Notify
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SecretaryUniform