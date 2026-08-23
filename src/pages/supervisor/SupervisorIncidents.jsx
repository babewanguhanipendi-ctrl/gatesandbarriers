import { useState, useEffect } from 'react'
import { supervisorAPI } from '../../services/api'
import { AlertTriangle, Send, ChevronDown, ChevronUp, User, MapPin } from 'lucide-react'

const SupervisorIncidents = () => {
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [escalatingId, setEscalatingId] = useState(null)
  const [escalationNotes, setEscalationNotes] = useState({})

  useEffect(() => {
    fetchIncidents()
  }, [])

  const fetchIncidents = async () => {
    try {
      const data = await supervisorAPI.getIncidents()
      setIncidents(data.incidents || [])
    } catch (err) {
      console.error('Failed to fetch incidents:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEscalate = async (incidentId) => {
    const notes = escalationNotes[incidentId] || ''
    try {
      setEscalatingId(incidentId)
      await supervisorAPI.escalateIncident(incidentId, notes)
      alert('Incident escalated to manager successfully!')
      setEscalationNotes({ ...escalationNotes, [incidentId]: '' })
      fetchIncidents()
    } catch (err) {
      alert('Failed to escalate incident: ' + err.message)
    } finally {
      setEscalatingId(null)
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A'
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-gray-400">Loading incidents...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Incident Escalation</h1>
        <p className="text-gray-600 mt-1">Review incident reports and escalate to managers for action</p>
      </div>

      {/* Incidents List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Pending Incidents</h2>
          <p className="text-sm text-gray-600 mt-1">
            {incidents.length} incident{incidents.length !== 1 ? 's' : ''} requiring attention
          </p>
        </div>

        {incidents.length === 0 ? (
          <div className="p-12 text-center">
            <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Incidents</h3>
            <p className="text-gray-600">All incidents have been resolved or escalated</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {incidents.map((incident) => (
              <div key={incident.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <h3 className="font-semibold text-gray-900">{incident.issue_type}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(incident.priority || 'medium')}`}>
                        {incident.priority || 'medium'}
                      </span>
                    </div>
                    
                    <p className="text-gray-700 mb-3">{incident.description}</p>
                    
                    <div className="flex items-center gap-6 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{incident.guard_name} ({incident.guard_work_number})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{incident.site_name} - {incident.site_location}</span>
                      </div>
                    </div>

                    <div className="text-sm text-gray-500">
                      <span>Reported by: {incident.reporter_name}</span>
                      <span className="mx-2">•</span>
                      <span>{formatDate(incident.created_at)}</span>
                    </div>

                    {incident.penalty_amount && (
                      <div className="mt-2 text-sm">
                        <span className="text-gray-600">Penalty Amount: </span>
                        <span className="font-semibold text-red-600">KSh {parseFloat(incident.penalty_amount).toFixed(2)}</span>
                      </div>
                    )}

                    {/* Escalation Form */}
                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Add notes for manager (optional)
                      </label>
                      <textarea
                        value={escalationNotes[incident.id] || ''}
                        onChange={(e) => setEscalationNotes({ ...escalationNotes, [incident.id]: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent mb-3"
                        placeholder="Add any additional context or recommendations for the manager..."
                      />
                      <button
                        onClick={() => handleEscalate(incident.id)}
                        disabled={escalatingId === incident.id}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        <Send size={18} />
                        <span>{escalatingId === incident.id ? 'Escalating...' : 'Push to Manager'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SupervisorIncidents