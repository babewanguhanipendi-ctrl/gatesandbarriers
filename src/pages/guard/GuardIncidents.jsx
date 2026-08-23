import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { auditsAPI } from '../../services/api'
import { Shield, AlertTriangle, Plus, X, Check } from 'lucide-react'

const GuardIncidents = () => {
  const { profile } = useAuth()
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    issue_type: '',
    description: '',
    threat_level: 'low'
  })

  useEffect(() => {
    fetchIncidents()
  }, [])

  const fetchIncidents = async () => {
    try {
      const data = await auditsAPI.getAll({ guard_id: profile.id })
      setIncidents(data.audits || [])
    } catch (error) {
      console.error('Error fetching incidents:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      await auditsAPI.create({
        issue_type: formData.issue_type,
        description: formData.description,
        reporter_id: profile.id,
        guard_id: profile.id,
        site_id: profile.site_id,
        priority: formData.threat_level || 'medium'
      })

      setShowForm(false)
      setFormData({ issue_type: '', description: '', threat_level: 'low' })
      fetchIncidents()
    } catch (error) {
      console.error('Error submitting incident:', error)
      alert('Failed to submit incident: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const getThreatBadge = (level) => {
    const colors = {
      low: 'bg-green-100 text-green-800 border-green-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      critical: 'bg-red-100 text-red-800 border-red-200'
    }
    return colors[level] || colors.low
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-8 h-8 text-[#1a2a6c]" />
              Incident Reports
            </h1>
            <p className="text-gray-600 mt-1">Report and track security incidents</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90"
          >
            <Plus size={18} />
            Report Incident
          </button>
        </div>

        {/* Incident Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Report Incident</h2>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Incident Type *
                  </label>
                  <input
                    type="text"
                    value={formData.issue_type}
                    onChange={(e) => setFormData({ ...formData, issue_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c]"
                    placeholder="e.g., Trespassing, Theft, Vandalism"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Threat Level *
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {['low', 'medium', 'high', 'critical'].map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setFormData({ ...formData, threat_level: level })}
                        className={`px-4 py-2 rounded-lg border-2 font-medium capitalize transition-all ${
                          formData.threat_level === level
                            ? getThreatBadge(level) + ' border-current'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c]"
                    placeholder="Describe the incident in detail..."
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Incidents List */}
        <div className="space-y-4">
          {incidents.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No incidents reported yet</p>
            </div>
          ) : (
            incidents.map((incident) => (
              <div key={incident.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{incident.issue_type}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(incident.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getThreatBadge(incident.priority || 'low')}`}>
                    {(incident.priority || 'low').toUpperCase()}
                  </span>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">{incident.description}</p>
                <div className="mt-3">
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                    incident.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    incident.status === 'resolved' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {incident.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default GuardIncidents