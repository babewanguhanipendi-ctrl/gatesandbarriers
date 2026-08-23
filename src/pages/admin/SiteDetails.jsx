import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sitesAPI, usersAPI } from '../../services/api'
import { MapPin, Building2, Users, Phone, ArrowLeft, Sun, Moon } from 'lucide-react'
import SitePinpointMap from '../../components/SitePinpointMap'

const SiteDetails = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [site, setSite] = useState(null)
  const [siteGuards, setSiteGuards] = useState([])
  const [loading, setLoading] = useState(true)
  const [latitude, setLatitude] = useState(null)
  const [longitude, setLongitude] = useState(null)
  const [radius, setRadius] = useState(50)

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    try {
      const [siteData, guardsData] = await Promise.all([
        sitesAPI.getById(id),
        usersAPI.getGuards()
      ])
      setSite(siteData.site)
      setSiteGuards(guardsData.guards.filter(g => g.site_id === id) || [])
      // Store geolocation data from the site
      if (siteData.site) {
        setLatitude(siteData.site.latitude)
        setLongitude(siteData.site.longitude)
        setRadius(siteData.site.geofence_radius || 50)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
          <div className="text-lg text-gray-600">Loading site details...</div>
        </div>
      </div>
    )
  }

  if (!site) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-gray-600">Site not found</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{site.site_name}</h1>
          <p className="text-gray-600 mt-1">Site Details & Guard Management</p>
        </div>
      </div>

      {/* Site Information Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-[#1a2a6c]" />
          Site Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Site Name</p>
              <p className="text-lg font-semibold text-gray-900">{site.site_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 flex items-center gap-1">
                <MapPin size={14} /> Location
              </p>
              <p className="text-base text-gray-900">{site.location}</p>
            </div>
            {site.client_name && (
              <div>
                <p className="text-sm font-medium text-gray-500">Client Name</p>
                <p className="text-base text-gray-900">{site.client_name}</p>
              </div>
            )}
          </div>
          <div className="space-y-4">
            {site.contact_number && (
              <div>
                <p className="text-sm font-medium text-gray-500 flex items-center gap-1">
                  <Phone size={14} /> Contact Number
                </p>
                <p className="text-base text-gray-900">{site.contact_number}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-500">Required Guards</p>
              <p className="text-lg font-semibold text-gray-900">{site.required_guards || 1}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Status</p>
              <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${
                site.status === 'inactive' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
              }`}>{site.status}</span>
            </div>
          </div>
        </div>
        {/* Geofence Map */}
        {latitude !== null && longitude !== null && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-medium text-blue-600 mb-2">Site Geofence Map</h3>
            <SitePinpointMap
              latitude={latitude}
              longitude={longitude}
              radiusMeters={radius}
            />
          </div>
        )}
      </div>

      {/* Assigned Guards Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Users className="w-6 h-6 text-[#1a2a6c]" />
          Assigned Guards ({siteGuards.length})
        </h2>
        {siteGuards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {siteGuards.map((guard) => (
              <div key={guard.id} className="border border-gray-200 rounded-lg p-4 hover:border-[#1a2a6c] transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1a2a6c] to-[#b21f1f] flex items-center justify-center text-white font-semibold text-lg">
                    {guard.full_name?.charAt(0) || 'G'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{guard.full_name}</p>
                    <p className="text-sm text-gray-500">{guard.work_number}</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone size={14} /> {guard.phone_number || 'N/A'}
                  </div>
                  <div className="flex items-center gap-2">
                    {guard.shift_type === 'night' ? (
                      <>
                        <Moon size={14} className="text-blue-600" />
                        <span className="text-blue-600 font-medium">Night Shift</span>
                      </>
                    ) : (
                      <>
                        <Sun size={14} className="text-yellow-600" />
                        <span className="text-yellow-600 font-medium">Day Shift</span>
                      </>
                    )}
                    {guard.is_overtime && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full ml-auto">OT</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No guards assigned yet</p>
          </div>
        )}
      </div>

      {/* Assigned Supervisor Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Users className="w-6 h-6 text-[#1a2a6c]" />
          Assigned Supervisor
        </h2>
        {site.allocated_supervisor_name ? (
          <div className="flex items-center gap-3 border border-gray-200 rounded-lg p-4">
            <div className="w-12 h-12 rounded-full bg-sky-600 flex items-center justify-center text-white font-semibold text-lg">
              {site.allocated_supervisor_name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{site.allocated_supervisor_name}</p>
              <p className="text-sm text-gray-500">{site.allocated_supervisor_work_number || 'Work number not provided'}</p>
              <p className="text-sm font-medium text-green-700">Daily pay: KES {Number(site.allocated_supervisor_daily_rate || 400).toFixed(2)}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No supervisor assigned to this site location.</p>
        )}
      </div>

    </div>
  )
}

export default SiteDetails