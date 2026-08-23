import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { auditsAPI } from '../../services/api'
import PromptModal from '../../components/PromptModal'
import { Shield, AlertTriangle, CheckCircle, XCircle, Eye } from 'lucide-react'

const ManagerIncidents = () => {
  const { profile } = useAuth()
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [rejectionIncidentId, setRejectionIncidentId] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')

  useEffect(() => {
    fetchIncidents()
  }, [])

  const fetchIncidents = async () => {
    try {
      const data = await auditsAPI.getAll()
      setIncidents(data.audits || [])
    } catch (error) {
      console.error('Error fetching incidents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (incidentId) => {
    try {
      await auditsAPI.approve(incidentId, { penalty_amount: 0 })
      alert('Incident approved successfully')
      fetchIncidents()
    } catch (error) {
      alert('Failed to approve incident: ' + error.message)
    }
  }

  const handleReject = async (incidentId) => {
    setRejectionIncidentId(incidentId)
    setRejectionReason('')
  }

  const confirmReject = async () => {
    try {
      await auditsAPI.reject(rejectionIncidentId, rejectionReason.trim())
      alert('Incident rejected successfully')
      setRejectionIncidentId(null)
      fetchIncidents()
    } catch (error) {
      alert('Failed to reject incident: ' + error.message)
    }
  }

  const filteredIncidents = filter === 'all' 
    ? incidents 
    : incidents.filter(inc => inc.status === filter)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PromptModal
        isOpen={rejectionIncidentId !== null}
        onClose={() => setRejectionIncidentId(null)}
        title="Reject Incident"
        message="Enter a reason for rejecting this incident."
        value={rejectionReason}
        onChange={setRejectionReason}
        onConfirm={confirmReject}
        confirmText="Reject Incident"
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-8 h-8 text-[#1a2a6c]" />
            Incident Logs
          </h1>
          <p className="text-gray-600 mt-1">Review and approve incident reports from guards</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex gap-2">
            {['all', 'pending', 'approved', 'rejected', 'resolved'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                  filter === status
                    ? 'bg-[#1a2a6c] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Incidents List */}
        <div className="space-y-4">
          {filteredIncidents.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No incidents found</p>
            </div>
          ) : (
            filteredIncidents.map((incident) => (
              <div key={incident.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{incident.issue_type}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(incident.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                    incident.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    incident.status === 'approved' || incident.status === 'resolved' ? 'bg-green-100 text-green-800' :
                    incident.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {incident.status}
                  </span>
                </div>

                <p className="text-gray-700 mb-4">{incident.description}</p>

                <div className="flex items-center gap-6 text-sm text-gray-600 mb-4">
                  <div>
                    <span className="font-medium">Guard:</span> {incident.guard_name} ({incident.guard_work_number})
                  </div>
                  <div>
                    <span className="font-medium">Site:</span> {incident.site_client} - {incident.site_location}
                  </div>
                  <div>
                    <span className="font-medium">Reported by:</span> {incident.reporter_name}
                  </div>
                </div>

                {incident.penalty_amount && (
                  <div className="mb-4 text-sm">
                    <span className="text-gray-600">Penalty Amount: </span>
                    <span className="font-semibold text-red-600">KSh {parseFloat(incident.penalty_amount).toFixed(2)}</span>
                  </div>
                )}

                {incident.status === 'pending' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(incident.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle size={18} />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(incident.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <XCircle size={18} />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default ManagerIncidents
