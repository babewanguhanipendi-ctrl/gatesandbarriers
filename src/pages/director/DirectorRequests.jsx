import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { requestsAPI, directorAPI } from '../../services/api'
import { Mail, Phone, MapPin, DollarSign, Shield, CheckCircle, XCircle, Clock, Forward } from 'lucide-react'

const DirectorRequests = () => {
  const { profile } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [replyBody, setReplyBody] = useState('')
  const [replySubject, setReplySubject] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadRequests()
  }, [])

  const loadRequests = async () => {
    try {
      setLoading(true)
      const response = await requestsAPI.getAll()
      setRequests(response.requests || [])
    } catch (err) {
      setError(err.message || 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }

  const handleReply = async (requestId) => {
    if (!replySubject.trim() || !replyBody.trim()) {
      alert('Please fill in both subject and reply body')
      return
    }

    try {
      setSubmitting(true)
      await requestsAPI.reply(requestId, {
        subject: replySubject,
        body: replyBody
      })
      alert('Reply sent successfully!')
      setSelectedRequest(null)
      setReplySubject('')
      setReplyBody('')
      loadRequests()
    } catch (err) {
      alert(err.message || 'Failed to send reply')
    } finally {
      setSubmitting(false)
    }
  }

  const handleForward = async (requestId) => {
    try {
      setSubmitting(true)
      await requestsAPI.forward(requestId, 'manager')
      alert('Request forwarded to manager successfully!')
      loadRequests()
    } catch (err) {
      alert(err.message || 'Failed to forward request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleContractAction = async (requestId, action) => {
    try {
      setSubmitting(true)
      await directorAPI.approveContract(requestId, action, '')
      alert(`Contract ${action === 'approve' ? 'approved' : 'rejected'} successfully`)
      loadRequests()
    } catch (err) {
      alert(err.message || 'Failed to process contract')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      reviewed: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      completed: 'bg-gray-100 text-gray-800'
    }
    return styles[status] || 'bg-gray-100 text-gray-800'
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Contractor Requests</h1>
        <p className="text-gray-600 mt-1">Review and manage contractor bid submissions</p>
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
          <button onClick={loadRequests} className="ml-4 underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="w-8 h-8 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No contractor requests yet</p>
            </div>
          ) : (
            requests.map((request) => (
              <div key={request.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{request.contractor_name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <a href={`mailto:${request.contractor_email}`} className="text-blue-600 hover:underline">
                          {request.contractor_email}
                        </a>
                      </div>
                      {request.contractor_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          <span>{request.contractor_phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{request.site_location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        <span>{request.security_type}</span>
                      </div>
                      {request.budget_estimate && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          <span>KES {request.budget_estimate}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{formatDate(request.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Site Details */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Site Details</h4>
                  <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-600">
                    <div><span className="font-medium">Property Type:</span> {request.property_type}</div>
                    <div><span className="font-medium">Coverage Hours:</span> {request.coverage_hours}</div>
                    <div><span className="font-medium">Guards Needed:</span> {request.guards_needed}</div>
                    {request.entry_points && (
                      <div><span className="font-medium">Entry Points:</span> {request.entry_points}</div>
                    )}
                    {request.risk_notes && (
                      <div className="md:col-span-2">
                        <span className="font-medium">Risk Notes:</span> {request.risk_notes}
                      </div>
                    )}
                  </div>
                </div>

                 {/* Actions */}
                 <div className="flex gap-2">
                   <button
                     onClick={() => setSelectedRequest(request)}
                     className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                   >
                     <Mail className="w-4 h-4" />
                     Reply to Contractor
                   </button>
                   {request.status === 'pending' && (
                     <>
                       <button
                         onClick={() => handleContractAction(request.id, 'approve')}
                         disabled={submitting}
                         className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                       >
                         <CheckCircle className="w-4 h-4" />
                         Approve
                       </button>
                       <button
                         onClick={() => handleContractAction(request.id, 'reject')}
                         disabled={submitting}
                         className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                       >
                         <XCircle className="w-4 h-4" />
                         Reject
                       </button>
                     </>
                   )}
                 </div>

                {/* Reply Modal */}
                {selectedRequest?.id === request.id && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-900">Reply to {request.contractor_name}</h3>
                        <button
                          onClick={() => {
                            setSelectedRequest(null)
                            setReplySubject('')
                            setReplyBody('')
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                          <input
                            type="text"
                            value={replySubject}
                            onChange={(e) => setReplySubject(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Re: Your security request"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                          <textarea
                            value={replyBody}
                            onChange={(e) => setReplyBody(e.target.value)}
                            rows={6}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter your reply to the contractor..."
                          />
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => handleReply(request.id)}
                            disabled={submitting}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                          >
                            {submitting ? 'Sending...' : 'Send Reply'}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedRequest(null)
                              setReplySubject('')
                              setReplyBody('')
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default DirectorRequests