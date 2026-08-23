import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { applicationsAPI, managerAPI, sitesAPI, usersAPI } from '../../services/api'
import ResponsiveTable from '../../components/ResponsiveTable'
import SuccessModal from '../../components/SuccessModal'
import { User, Mail, Phone, Calendar, FileText, Send, Check, X, AlertCircle, MapPin, Clock } from 'lucide-react'

const ManagerApplicants = () => {
  const navigate = useNavigate()
  const [applicants, setApplicants] = useState([])
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedApplicant, setSelectedApplicant] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showForwardModal, setShowForwardModal] = useState(false)
  const [showHireModal, setShowHireModal] = useState(false)
  const [forwardRole, setForwardRole] = useState('secretary')
  const [actionLoading, setActionLoading] = useState(false)
  const [hireData, setHireData] = useState({
    site_id: '',
    shift_type: 'day',
    start_date: '',
    email: ''
  })
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [hireDetails, setHireDetails] = useState(null)

  useEffect(() => {
    fetchApplicants()
    fetchSites()
  }, [])

  const fetchApplicants = async () => {
    setLoading(true)
    try {
      // Fetch all applicants assigned to manager (not just pending)
      const data = await applicationsAPI.getAll({ assigned_role: 'manager' })
      setApplicants(data.applications || [])
    } catch (error) {
      console.error('Error fetching applicants:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSites = async () => {
    try {
      const data = await sitesAPI.getAll()
      setSites(data.sites || [])
    } catch (error) {
      console.error('Error fetching sites:', error)
    }
  }

  const handleApplicantClick = (applicant) => {
    setSelectedApplicant(applicant)
    setHireData({
      site_id: '',
      shift_type: 'day',
      start_date: '',
      email: applicant.email || ''
    })
    setShowModal(true)
  }

  const handleStatusChange = async (status) => {
    if (!selectedApplicant) return
    
    setActionLoading(true)
    try {
      const updateData = { status }
      
      if (status === 'hired') {
        // Show hire modal for shift/site allocation
        setShowHireModal(true)
        return
      }
      
      await applicationsAPI.update(selectedApplicant.id, updateData)
      await fetchApplicants()
      setShowModal(false)
    } catch (error) {
      console.error('Error updating applicant status:', error)
      setErrorMessage(error.response?.data?.message || error.message || 'Failed to update applicant status')
      setShowErrorModal(true)
    } finally {
      setActionLoading(false)
    }
  }

  const handleHireConfirm = async () => {
    if (!selectedApplicant) return
    
    setActionLoading(true)
    try {
      // Create the user account directly with a temporary password
      // Backend will auto-generate the correct work number format (GBG-501 to GBG-2000)
      const tempPassword = Math.random().toString(36).slice(-8)
      
      // Create user account without work_number - backend will generate it
      const userResult = await usersAPI.create({
        email: selectedApplicant.email,
        full_name: selectedApplicant.full_name,
        role: 'guard',
        phone_number: selectedApplicant.phone,
        site_id: hireData.site_id,
        account_status: 'active'
      })

      // Create shift assignment
      if (hireData.site_id && hireData.start_date) {
        await managerAPI.createShift({
          guard_id: userResult.user?.id || null,
          site_id: hireData.site_id,
          date: hireData.start_date,
          shift_type: hireData.shift_type
        })
      }

      // Create uniform request
      await managerAPI.createUniformRequest({
        application_id: selectedApplicant.id,
        guard_id: userResult.user?.id || null,
        full_name: selectedApplicant.full_name
      })

      // Update application status
      await applicationsAPI.update(selectedApplicant.id, { status: 'hired' })
      
      await fetchApplicants()
      setShowHireModal(false)
      setShowModal(false)
      
      // Store hire details and show success modal
      const generatedWorkNumber = userResult.user?.work_number || 'GBG-XXX'
      setHireDetails({ workNumber: generatedWorkNumber, tempPassword, fullName: selectedApplicant.full_name })
      setSuccessMessage(`Guard hired successfully! Work Number: ${generatedWorkNumber}`)
      setShowSuccessModal(true)
    } catch (error) {
      console.error('Error hiring applicant:', error)
      setErrorMessage(error.response?.data?.message || error.message || 'Failed to hire applicant. Please try again.')
      setShowErrorModal(true)
    } finally {
      setActionLoading(false)
    }
  }

  const handleForward = async () => {
    if (!selectedApplicant) return
    
    setActionLoading(true)
    try {
      // Forward the application but don't remove it from manager's view
      await applicationsAPI.forward(selectedApplicant.id, forwardRole)
      // Don't call fetchApplicants() to keep it visible
      setShowForwardModal(false)
    } catch (error) {
      console.error('Error forwarding application:', error)
      setErrorMessage(error.response?.data?.message || error.message || 'Failed to forward application')
      setShowErrorModal(true)
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      reviewed: 'bg-blue-100 text-blue-800',
      shortlisted: 'bg-purple-100 text-purple-800',
      rejected: 'bg-red-100 text-red-800',
      hired: 'bg-green-100 text-green-800'
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
      </span>
    )
  }

  const columns = [
    { key: 'full_name', label: 'Applicant', render: (row) => (
      <div className="flex items-center gap-2">
        <User size={14} className="text-gray-400" />
        <span className="font-medium">{row.full_name || 'N/A'}</span>
      </div>
    )},
    { key: 'email', label: 'Email', render: (row) => (
      <div className="flex items-center gap-2">
        <Mail size={14} className="text-gray-400" />
        <span className="text-sm">{row.email || 'N/A'}</span>
      </div>
    )},
    { key: 'phone', label: 'Phone', render: (row) => (
      <div className="flex items-center gap-2">
        <Phone size={14} className="text-gray-400" />
        <span className="text-sm">{row.phone || 'N/A'}</span>
      </div>
    )},
    { key: 'status', label: 'Status', render: (row) => getStatusBadge(row.status) },
    { key: 'created_at', label: 'Applied On', render: (row) => row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Applicants</h1>
          <p className="text-gray-600 mt-1">Manage guard employment applications</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <ResponsiveTable
            columns={columns}
            rows={applicants}
            onRowClick={handleApplicantClick}
            loading={loading}
            emptyMessage="No applicants found"
          />
        </div>
      </div>

      {/* Applicant Details Modal */}
      {showModal && selectedApplicant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Applicant Details</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Full Name</label>
                <p className="text-gray-900 font-medium">{selectedApplicant.full_name}</p>
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Email</label>
                <p className="text-gray-900">{selectedApplicant.email}</p>
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Phone</label>
                <p className="text-gray-900">{selectedApplicant.phone}</p>
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Experience</label>
                <p className="text-gray-900">{selectedApplicant.experience || 'Not provided'}</p>
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Message</label>
                <p className="text-gray-900">{selectedApplicant.message || 'Not provided'}</p>
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Current Status</label>
                <div className="mt-1">{getStatusBadge(selectedApplicant.status)}</div>
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Applied On</label>
                <p className="text-gray-900">{new Date(selectedApplicant.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex gap-2">
                {selectedApplicant.status !== 'hired' && (
                  <button
                    onClick={() => handleStatusChange('hired')}
                    disabled={actionLoading}
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Check size={16} />
                    Hire
                  </button>
                )}
                {selectedApplicant.status !== 'rejected' && (
                  <button
                    onClick={() => handleStatusChange('rejected')}
                    disabled={actionLoading}
                    className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <X size={16} />
                    Reject
                  </button>
                )}
              </div>
              
              <button
                onClick={() => setShowForwardModal(true)}
                disabled={actionLoading}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send size={16} />
                Forward to Director/Secretary
              </button>
              
              <button
                onClick={() => setShowModal(false)}
                className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forward Modal */}
      {showForwardModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Forward Application</h2>
            <p className="text-gray-600 mb-4">Select where to forward this application:</p>
            
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="forwardRole"
                  value="secretary"
                  checked={forwardRole === 'secretary'}
                  onChange={(e) => setForwardRole(e.target.value)}
                  className="w-4 h-4 text-[#1a2a6c]"
                />
                <div>
                  <p className="font-medium text-gray-900">Secretary</p>
                  <p className="text-sm text-gray-500">For uniform allocation and processing</p>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="forwardRole"
                  value="director"
                  checked={forwardRole === 'director'}
                  onChange={(e) => setForwardRole(e.target.value)}
                  className="w-4 h-4 text-[#1a2a6c]"
                />
                <div>
                  <p className="font-medium text-gray-900">Director</p>
                  <p className="text-sm text-gray-500">For final review and approval</p>
                </div>
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowForwardModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleForward}
                disabled={actionLoading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading ? 'Forwarding...' : 'Forward'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hire Modal - Shift/Site Allocation */}
      {showHireModal && selectedApplicant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Hire Applicant</h2>
            <p className="text-gray-600 mb-4">Allocate shift and site for {selectedApplicant.full_name}:</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MapPin size={14} className="inline mr-1" />
                  Site
                </label>
                <select
                  value={hireData.site_id}
                  onChange={(e) => setHireData({...hireData, site_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                >
                  <option value="">Select a site</option>
                  {sites.map(site => (
                    <option key={site.id} value={site.id}>{site.client} - {site.location}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Clock size={14} className="inline mr-1" />
                  Shift Type
                </label>
                <select
                  value={hireData.shift_type}
                  onChange={(e) => setHireData({...hireData, shift_type: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                >
                  <option value="day">Day Shift</option>
                  <option value="night">Night Shift</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar size={14} className="inline mr-1" />
                  Start Date
                </label>
                <input
                  type="date"
                  value={hireData.start_date}
                  onChange={(e) => setHireData({...hireData, start_date: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Mail size={14} className="inline mr-1" />
                  Email (for notification)
                </label>
                <input
                  type="email"
                  value={hireData.email}
                  onChange={(e) => setHireData({...hireData, email: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                  placeholder="Email address"
                />
              </div>
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Uniform Terms</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    A uniform request will be created for this guard. KES 1,000 will be deducted monthly for 3 months.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowHireModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleHireConfirm}
                disabled={actionLoading || !hireData.site_id || !hireData.start_date}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Confirm Hire'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false)
          navigate('/manager/applicants')
        }}
        title="Success"
        message={
          hireDetails ? (
            <div>
              <p className="mb-2">{successMessage}</p>
              <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
                <p><strong>Guard Name:</strong> {hireDetails.fullName}</p>
                <p><strong>Work Number:</strong> {hireDetails.workNumber}</p>
                <p><strong>Temporary Password:</strong> {hireDetails.tempPassword}</p>
                <p className="text-xs text-gray-600 mt-2">Please provide these credentials to the guard.</p>
              </div>
            </div>
          ) : (
            successMessage
          )
        }
      />

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <X className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Error</h2>
                </div>
              </div>
              <button onClick={() => setShowErrorModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <p className="text-gray-700 mb-6">{errorMessage}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowErrorModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowErrorModal(false)
                  // Retry the last action based on context
                  if (showHireModal && selectedApplicant) {
                    handleHireConfirm()
                  }
                }}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ManagerApplicants