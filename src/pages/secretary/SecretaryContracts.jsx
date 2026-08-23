import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { secretaryAPI, notificationsAPI } from '../../services/api'
import { Mail, Phone, MapPin, Shield, DollarSign, Calendar, Send, CheckCircle, Clock, X } from 'lucide-react'

const SecretaryContracts = () => {
  const { profile } = useAuth()
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedContract, setSelectedContract] = useState(null)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [emailForm, setEmailForm] = useState({
    subject: '',
    body: '',
    meeting_date: '',
    meeting_location: ''
  })

  useEffect(() => {
    loadContracts()
  }, [])

  const loadContracts = async () => {
    try {
      setLoading(true)
      const response = await secretaryAPI.getContracts()
      setContracts(response.contracts || [])
    } catch (err) {
      setError(err.message || 'Failed to load contracts')
    } finally {
      setLoading(false)
    }
  }

  const handleSendEmail = async (e) => {
    e.preventDefault()
    if (!selectedContract) return

    try {
      setSubmitting(true)
      
      // Send email with meeting details
      await secretaryAPI.sendContractEmail(selectedContract.id, emailForm)
      
      // If meeting details are provided, send notifications to director and manager
      if (emailForm.meeting_date && emailForm.meeting_location) {
        try {
          // Send notification to director
          await notificationsAPI.create({
            user_id: selectedContract.director_id,
            title: 'Meeting Scheduled with Client',
            message: `A meeting has been scheduled for ${selectedContract.contractor_name} on ${new Date(emailForm.meeting_date).toLocaleString()} at ${emailForm.meeting_location}.`,
            notification_type: 'meeting_scheduled',
            priority: 'high',
            metadata: {
              contract_id: selectedContract.id,
              meeting_date: emailForm.meeting_date,
              meeting_location: emailForm.meeting_location,
              contractor_name: selectedContract.contractor_name
            }
          })

          // Send notification to manager
          if (selectedContract.manager_id) {
            await notificationsAPI.create({
              user_id: selectedContract.manager_id,
              title: 'Meeting Scheduled with Client',
              message: `A meeting has been scheduled for ${selectedContract.contractor_name} on ${new Date(emailForm.meeting_date).toLocaleString()} at ${emailForm.meeting_location}.`,
              notification_type: 'meeting_scheduled',
              priority: 'high',
              metadata: {
                contract_id: selectedContract.id,
                meeting_date: emailForm.meeting_date,
                meeting_location: emailForm.meeting_location,
                contractor_name: selectedContract.contractor_name
              }
            })
          }
        } catch (notificationError) {
          console.error('Error sending notifications:', notificationError)
          // Don't fail the whole operation if notifications fail
        }
      }
      
      alert('Email and notifications sent successfully!')
      setShowEmailModal(false)
      setShowScheduleModal(false)
      setSelectedContract(null)
      setEmailForm({ subject: '', body: '', meeting_date: '', meeting_location: '' })
      loadContracts()
    } catch (err) {
      alert(err.message || 'Failed to send email')
    } finally {
      setSubmitting(false)
    }
  }

  const openEmailModal = (contract) => {
    setSelectedContract(contract)
    setEmailForm({
      subject: contract.reply_subject || '',
      body: contract.reply_body || '',
      meeting_date: '',
      meeting_location: ''
    })
    setShowEmailModal(true)
  }

  const openScheduleModal = (contract) => {
    setSelectedContract(contract)
    setEmailForm({
      subject: contract.reply_subject || '',
      body: contract.reply_body || '',
      meeting_date: contract.meeting_scheduled_date ? new Date(contract.meeting_scheduled_date).toISOString().slice(0, 16) : '',
      meeting_location: contract.meeting_location || ''
    })
    setShowScheduleModal(true)
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

  const getMeetingStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800',
      rescheduled: 'bg-orange-100 text-orange-800'
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Client Contracts</h1>
          <p className="text-gray-600 mt-1">View director replies and send emails to clients</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
            <button onClick={loadContracts} className="ml-4 underline">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="w-8 h-8 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : contracts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center py-12">
              <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Contracts Yet</h3>
              <p className="text-gray-600">Director replies to client requests will appear here</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {contracts.map((contract) => (
              <div key={contract.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{contract.contractor_name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(contract.status)}`}>
                        {contract.status}
                      </span>
                      {contract.meeting_status && (
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getMeetingStatusBadge(contract.meeting_status)}`}>
                          {contract.meeting_status}
                        </span>
                      )}
                    </div>
                    <div className="grid md:grid-cols-2 gap-3 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <a href={`mailto:${contract.contractor_email}`} className="text-blue-600 hover:underline">
                          {contract.contractor_email}
                        </a>
                      </div>
                      {contract.contractor_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          <span>{contract.contractor_phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{contract.site_location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        <span>{contract.security_type}</span>
                      </div>
                      {contract.budget_estimate && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          <span>KES {contract.budget_estimate}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>Replied: {formatDate(contract.replied_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Site Details */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Site Details</h4>
                  <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-600">
                    <div><span className="font-medium">Property Type:</span> {contract.property_type}</div>
                    <div><span className="font-medium">Coverage Hours:</span> {contract.coverage_hours}</div>
                    <div><span className="font-medium">Guards Needed:</span> {contract.guards_needed}</div>
                  </div>
                </div>

                {/* Director's Reply */}
                {contract.reply_subject && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">Director's Reply</h4>
                    <div className="text-sm text-blue-800">
                      <div className="font-medium mb-1">Subject: {contract.reply_subject}</div>
                      <div className="whitespace-pre-wrap">{contract.reply_body}</div>
                    </div>
                  </div>
                )}

                {/* Meeting Details */}
                {contract.meeting_id && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                    <h4 className="text-sm font-semibold text-purple-900 mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Meeting Details
                    </h4>
                    <div className="grid md:grid-cols-2 gap-2 text-sm text-purple-800">
                      {contract.meeting_scheduled_date && (
                        <div>
                          <span className="font-medium">Scheduled:</span> {formatDate(contract.meeting_scheduled_date)}
                        </div>
                      )}
                      {contract.meeting_location && (
                        <div>
                          <span className="font-medium">Location:</span> {contract.meeting_location}
                        </div>
                      )}
                      {contract.meeting_agenda && (
                        <div className="md:col-span-2">
                          <span className="font-medium">Agenda:</span> {contract.meeting_agenda}
                        </div>
                      )}
                      {contract.email_sent && (
                        <div className="flex items-center gap-1 text-green-700">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm">Email sent to client</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => openEmailModal(contract)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Send Email to Client
                  </button>
                  {!contract.email_sent && (
                    <button
                      onClick={() => openScheduleModal(contract)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Calendar className="w-4 h-4" />
                      Schedule Meeting
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Email Modal */}
      {showEmailModal && selectedContract && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Send Email to {selectedContract.contractor_name}</h3>
              <button
                onClick={() => {
                  setShowEmailModal(false)
                  setSelectedContract(null)
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                <input
                  type="email"
                  value={selectedContract.contractor_email}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                <textarea
                  value={emailForm.body}
                  onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Sending...' : 'Send Email'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEmailModal(false)
                    setSelectedContract(null)
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Meeting Modal */}
      {showScheduleModal && selectedContract && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Schedule Meeting & Send Email</h3>
              <button
                onClick={() => {
                  setShowScheduleModal(false)
                  setSelectedContract(null)
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                <input
                  type="email"
                  value={selectedContract.contractor_email}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                <textarea
                  value={emailForm.body}
                  onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Meeting Details</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Date & Time</label>
                    <input
                      type="datetime-local"
                      value={emailForm.meeting_date}
                      onChange={(e) => setEmailForm({ ...emailForm, meeting_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Location</label>
                    <input
                      type="text"
                      value={emailForm.meeting_location}
                      onChange={(e) => setEmailForm({ ...emailForm, meeting_location: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Office, Conference Room"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  {submitting ? 'Scheduling...' : 'Schedule Meeting & Send Email'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowScheduleModal(false)
                    setSelectedContract(null)
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default SecretaryContracts