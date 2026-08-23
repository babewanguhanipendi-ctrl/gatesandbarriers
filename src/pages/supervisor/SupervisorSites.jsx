import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { sitesAPI, supervisorAPI } from '../../services/api'
import {
  MapPin,
  Users,
  RefreshCw,
  Building2,
  Phone,
  Hash
} from 'lucide-react'

const SupervisorSites = () => {
  const { profile } = useAuth()
  const [managedSites, setManagedSites] = useState([])
  const [allocations, setAllocations] = useState([])
  const [activeTab, setActiveTab] = useState('all')
  const [selectedSite, setSelectedSite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [sitesData, allocationsData] = await Promise.all([
        sitesAPI.getAll({ status: 'active' }),
        supervisorAPI.getDutyAllocation().catch(() => ({ allocations: [] }))
      ])
      setManagedSites(sitesData.sites || [])
      setAllocations(allocationsData.allocations || [])
    } catch (error) {
      console.error('Error fetching managed sites:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const normalizeLocation = (value) => String(value || '').toLowerCase().replace(/[^a-z]/g, '')
  const allocationAreas = allocations.map(allocation => normalizeLocation(allocation.area)).filter(Boolean)
  const mySites = managedSites.filter(site => (
    site.supervisor_id === profile?.id ||
    allocationAreas.some(area => {
      const location = normalizeLocation(site.location_category || site.location)
      return location.includes(area) || area.includes(location)
    })
  ))
  const visibleSites = activeTab === 'my' ? mySites : managedSites

  const openSiteDetails = async (site) => {
    try {
      const data = await sitesAPI.getById(site.id)
      setSelectedSite(data.site || site)
    } catch (error) {
      console.error('Error loading site details:', error)
      setSelectedSite(site)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
          <div className="text-lg text-gray-600">Loading managed sites...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Managed Sites</h1>
              <p className="text-gray-600 mt-1">View-only list of all sites with allocated guards</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {['all', 'my'].map(tab => <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-3 text-sm font-semibold border-b-2 ${activeTab === tab ? 'border-[#1a2a6c] text-[#1a2a6c]' : 'border-transparent text-gray-500'}`}>{tab === 'all' ? 'All Sites' : 'My Sites'}</button>)}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#1a2a6c]" />
              {activeTab === 'all' ? 'All Sites' : 'My Sites'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              View-only. Showing {visibleSites.length} site(s)
            </p>
          </div>

          {visibleSites.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Sites Found</h3>
              <p className="text-gray-600">There are no sites in this list.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {visibleSites.map((site) => (
                <button key={site.id} onClick={() => openSiteDetails(site)} className="w-full text-left p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Site Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1a2a6c] to-[#b21f1f] flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-gray-900">{site.client_name || site.client || site.site_name}</p>
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <MapPin size={14} />
                            <span>{site.location}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-6">
              <div><h2 className="text-xl font-bold text-gray-900">{selectedSite.site_name || selectedSite.client_name || selectedSite.client}</h2><p className="text-sm text-gray-500">Site details</p></div>
              <button onClick={() => setSelectedSite(null)} className="px-3 py-2 text-gray-500 hover:bg-gray-100 rounded-lg">Close</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
              {[
                ['Client', selectedSite.client_name || selectedSite.client],
                ['Location', selectedSite.location],
                ['Address', selectedSite.address],
                ['Contact', selectedSite.contact_number],
                ['Required guards', selectedSite.required_guards],
                ['Day rate', selectedSite.day_rate],
                ['Night rate', selectedSite.night_rate],
                ['Status', selectedSite.status],
                ['Supervisor', selectedSite.allocated_supervisor_name || selectedSite.supervisor_name],
                ['Supervisor work number', selectedSite.allocated_supervisor_work_number]
              ].map(([label, value]) => <div key={label} className="rounded-lg bg-gray-50 p-4"><p className="text-xs uppercase text-gray-500">{label}</p><p className="mt-1 font-medium text-gray-900">{value || 'Not provided'}</p></div>)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SupervisorSites