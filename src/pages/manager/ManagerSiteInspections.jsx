import { useState, useEffect } from 'react'
import { managerAPI } from '../../services/api'
import ResponsiveTable from '../../components/ResponsiveTable'
import { MapPin, User, AlertTriangle, Calendar, Eye } from 'lucide-react'

const ManagerSiteInspections = () => {
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSite, setSelectedSite] = useState(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetchSites()
  }, [])

  const fetchSites = async () => {
    setLoading(true)
    try {
      const data = await managerAPI.getSiteInspections()
      setSites(data.sites || [])
    } catch (error) {
      console.error('Error fetching sites:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSiteClick = (site) => {
    setSelectedSite(site)
    setShowModal(true)
  }

  const columns = [
    { key: 'client', label: 'Site', render: (row) => (
      <div className="flex items-center gap-2">
        <MapPin size={14} className="text-gray-400" />
        <span className="font-medium">{row.client || 'N/A'}</span>
      </div>
    )},
    { key: 'location', label: 'Location' },
    { key: 'incident_count', label: 'Incidents', render: (row) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
        row.incident_count >= 2 ? 'bg-red-100 text-red-800' :
        row.incident_count === 1 ? 'bg-yellow-100 text-yellow-800' :
        'bg-green-100 text-green-800'
      }`}>
        {row.incident_count || 0}
      </span>
    )},
    { key: 'day_shift_guards', label: 'Day Shift Guards', render: (row) => (
      <div className="text-sm">
        {row.day_shift_guards?.map(g => g.full_name).join(', ') || 'None'}
      </div>
    )},
    { key: 'night_shift_guards', label: 'Night Shift Guards', render: (row) => (
      <div className="text-sm">
        {row.night_shift_guards?.map(g => g.full_name).join(', ') || 'None'}
      </div>
    )},
    { key: 'status', label: 'Status', render: (row) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
        row.status === 'flagged' ? 'bg-red-100 text-red-800' :
        'bg-green-100 text-green-800'
      }`}>
        {row.status || 'active'}
      </span>
    )},
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Site Inspections</h1>
          <p className="text-gray-600 mt-1">Sites flagged for inspection based on incident reports</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <ResponsiveTable
            columns={columns}
            rows={sites}
            onRowClick={handleSiteClick}
            loading={loading}
            emptyMessage="No sites found for inspection"
          />
        </div>
      </div>

      {/* Site Details Modal */}
      {showModal && selectedSite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Site Inspection Details</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Site</label>
                <p className="text-gray-900 font-medium">{selectedSite.client}</p>
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Location</label>
                <p className="text-gray-900">{selectedSite.location}</p>
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Address</label>
                <p className="text-gray-900">{selectedSite.address || 'N/A'}</p>
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Incident Count</label>
                <p className="text-gray-900">{selectedSite.incident_count || 0} incidents reported</p>
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Day Shift Guards</label>
                <div className="mt-1 space-y-1">
                  {selectedSite.day_shift_guards?.length > 0 ? (
                    selectedSite.day_shift_guards.map((guard, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <User size={12} className="text-gray-400" />
                        <span>{guard.full_name} (Work #: {guard.work_number})</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-gray-500">No guards assigned</span>
                  )}
                </div>
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Night Shift Guards</label>
                <div className="mt-1 space-y-1">
                  {selectedSite.night_shift_guards?.length > 0 ? (
                    selectedSite.night_shift_guards.map((guard, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <User size={12} className="text-gray-400" />
                        <span>{guard.full_name} (Work #: {guard.work_number})</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-gray-500">No guards assigned</span>
                  )}
                </div>
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Status</label>
                <div className="mt-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedSite.status === 'flagged' ? 'bg-red-100 text-red-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {selectedSite.status || 'active'}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="mt-6 w-full bg-[#1a2a6c] text-white py-2 rounded-lg hover:bg-[#1a2a6c]/90"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ManagerSiteInspections