import { useState, useEffect } from 'react'
import { applicationsAPI, secretaryAPI, usersAPI } from '../../services/api'
import ResponsiveTable from '../../components/ResponsiveTable'
import { User, Mail, Phone, Check, X } from 'lucide-react'

const SecretaryApplications = () => {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedApplicant, setSelectedApplicant] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [supervisors, setSupervisors] = useState([])

  useEffect(() => {
    fetchApplications()
    fetchSupervisors()
  }, [])

  const fetchApplications = async () => {
    setLoading(true)
    try {
      const data = await applicationsAPI.getAll({ assigned_role: 'secretary' })
      setApplications(data.applications || [])
    } catch (error) {
      console.error('Error fetching applications:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSupervisors = async () => {
    try {
      const data = await usersAPI.getAll({ role: 'supervisor' })
      setSupervisors(data.users || [])
    } catch (error) {
      console.error('Error fetching supervisors:', error)
    }
  }

  const handleApplicantClick = (applicant) => {
    setSelectedApplicant(applicant)
    setShowModal(true)
  }

  const handleStatusChange = async (status) => {
    if (!selectedApplicant) return

    setActionLoading(true)
    try {
      const updateData = { status }

      // Build supervisor contact list
      const supervisorContacts = supervisors.length > 0
        ? supervisors.map(s => `- ${s.full_name} (Work: ${s.work_number || 'N/A'}, Phone: ${s.phone_number || s.email})`).join('\n')
        : '- Supervisor contacts will be provided by the admin team'

      if (status === 'hired') {
        // Push details to secretary for uniform allocation
        await secretaryAPI.createUniformRequest({
          application_id: selectedApplicant.id,
          guard_id: null,
          full_name: selectedApplicant.full_name
        })
        // Send email to applicant with supervisor contacts and company website
        await applicationsAPI.reply(selectedApplicant.id, {
          subject: 'Application Accepted - Welcome to Gates & Barriers',
          body: `Congratulations ${selectedApplicant.full_name}! Your application has been accepted.

Please contact our supervisors for your onboarding process:
${supervisorContacts}

Company website: https://gatesandbarriers.com

We look forward to having you on our team!`
        })
      } else if (status === 'rejected') {
        // Send rejection email
        await applicationsAPI.reply(selectedApplicant.id, {
          subject: 'Application Status Update - Gates & Barriers',
          body: `Dear ${selectedApplicant.full_name},

Thank you for your interest in joining Gates & Barriers Security. After careful consideration, we regret to inform you that your application has not been successful at this time.

We encourage you to apply again in the future.

Best regards,
Gates & Barriers Team`
        })
      }

      await applicationsAPI.update(selectedApplicant.id, updateData)
      await fetchApplications()
      setShowModal(false)
    } catch (error) {
      console.error('Error updating application status:', error)
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
          <h1 className="text-3xl font-bold text-gray-900">Recruitment/Applications</h1>
          <p className="text-gray-600 mt-1">Review and process guard applications</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <ResponsiveTable
            columns={columns}
            rows={applications}
            onRowClick={handleApplicantClick}
            loading={loading}
            emptyMessage="No applications assigned to secretary"
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
                onClick={() => setShowModal(false)}
                className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SecretaryApplications