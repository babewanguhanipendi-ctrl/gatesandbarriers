import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { sitesAPI, usersAPI } from '../../services/api'
import { useNavigate } from 'react-router-dom'
import {
  MapPin,
  Plus,
  Building2,
  Users,
  Phone,
  Search,
  ChevronRight,
  X,
  UserPlus,
  Sun,
  Moon,
  Trash2,
  AlertTriangle,
  Edit3,
  Save,
  Clock,
  Hash
} from 'lucide-react'
import SiteLocationPicker from '../../components/SiteLocationPicker'

const SiteManagement = () => {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [sites, setSites] = useState([])
  const [guards, setGuards] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddSiteModal, setShowAddSiteModal] = useState(false)
  const [showEditSiteModal, setShowEditSiteModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showAddGuardModal, setShowAddGuardModal] = useState(false)
  const [selectedSite, setSelectedSite] = useState(null)
  const [siteToDelete, setSiteToDelete] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Site form state
  const [siteForm, setSiteForm] = useState({
    site_name: '',
    location: '',
    address: '',
    client_name: '',
    contact_number: '',
    required_guards: 1,
    day_rate: '',
    night_rate: '',
    amount_offered: '',
    latitude: '',
    longitude: '',
    geofence_radius: 100,
  })

  // Guard assignment form state
  const [guardForm, setGuardForm] = useState({
    work_number: '',
    guard_id: '',
    guard_name: '',
    shift_type: 'day',
    is_overtime: false
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [sitesData, guardsData] = await Promise.all([
        sitesAPI.getAll(),
        usersAPI.getGuards()
      ])
      setSites(sitesData.sites || [])
      setGuards(guardsData.guards || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddSite = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const data = {
        site_name: siteForm.site_name,
        location: siteForm.location,
        address: siteForm.address,
        client_name: siteForm.client_name,
        contact_number: siteForm.contact_number,
        required_guards: parseInt(siteForm.required_guards, 10),
        day_rate: parseFloat(siteForm.day_rate) || 0,
        night_rate: parseFloat(siteForm.night_rate) || 0,
        amount_offered: parseFloat(siteForm.amount_offered),
        latitude: siteForm.latitude,
        longitude: siteForm.longitude,
        geofence_radius: 100,
      }
      await sitesAPI.create(data)
      alert('Site created successfully')
      setShowAddSiteModal(false)
      setSiteForm({
        site_name: '',
        location: '',
        address: '',
        client_name: '',
        contact_number: '',
        required_guards: 1,
        day_rate: '',
        night_rate: '',
        amount_offered: '',
      })
      await fetchData()
    } catch (error) {
      console.error('Error creating site:', error)
      alert(error.message || 'Failed to create site')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditSite = async (e) => {
    e.preventDefault()
    if (!selectedSite) return
    setSubmitting(true)
    try {
      const data = {
        site_name: siteForm.site_name,
        location: siteForm.location,
        address: siteForm.address,
        client_name: siteForm.client_name,
        contact_number: siteForm.contact_number,
        required_guards: parseInt(siteForm.required_guards, 10),
        day_rate: parseFloat(siteForm.day_rate) || 0,
        night_rate: parseFloat(siteForm.night_rate) || 0,
        amount_offered: parseFloat(siteForm.amount_offered),
        latitude: siteForm.latitude,
        longitude: siteForm.longitude,
        geofence_radius: 100,
      }
      await sitesAPI.update(selectedSite.id, data)
      alert('Site updated successfully')
      setShowEditSiteModal(false)
      setSelectedSite(null)
      await fetchData()
    } catch (error) {
      console.error('Error updating site:', error)
      alert(error.message || 'Failed to update site')
    } finally {
      setSubmitting(false)
    }
  }

  const openEditModal = (site) => {
    setSelectedSite(site)
    setSiteForm({
      site_name: site.site_name || '',
      location: site.location || '',
      address: site.address || '',
      client_name: site.client_name || '',
      contact_number: site.contact_number || '',
      required_guards: site.required_guards || 1,
      day_rate: site.day_rate || '',
      night_rate: site.night_rate || '',
      amount_offered: site.amount_offered || '',
      latitude: site.latitude ?? '',
      longitude: site.longitude ?? '',
      geofence_radius: 100,
    })
    setShowEditSiteModal(true)
  }

  const handleDeleteSite = async () => {
    if (!siteToDelete) return
    setDeleteLoading(true)
    try {
      const result = await sitesAPI.delete(siteToDelete.id)
      if (result.deactivated) {
        alert(`Site deactivated (${result.active_allocations} active allocation(s) found)`)
      } else {
        alert('Site deleted successfully')
      }
      setShowDeleteConfirm(false)
      setSiteToDelete(null)
      await fetchData()
    } catch (error) {
      console.error('Error deleting site:', error)
      alert(error.message || 'Failed to delete site')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleLookupGuard = async () => {
    if (!guardForm.work_number) {
      alert('Please enter a work number')
      return
    }

    try {
      const guard = guards.find(g => g.work_number === guardForm.work_number)
      if (guard) {
        setGuardForm({
          ...guardForm,
          guard_id: guard.id,
          guard_name: guard.full_name
        })
      } else {
        alert('Guard not found with that work number')
      }
    } catch (error) {
      console.error('Error looking up guard:', error)
    }
  }

  const handleAssignGuard = async (e) => {
    e.preventDefault()
    if (!guardForm.guard_id || !selectedSite) {
      alert('Please select a guard and site')
      return
    }

    setSubmitting(true)
    try {
      await usersAPI.update(guardForm.guard_id, {
        site_id: selectedSite.id,
        shift_type: guardForm.shift_type,
        is_overtime: guardForm.is_overtime
      })
      alert('Guard assigned to site successfully')
      setShowAddGuardModal(false)
      setGuardForm({
        work_number: '',
        guard_id: '',
        guard_name: '',
        shift_type: 'day',
        is_overtime: false
      })
      await fetchData()
    } catch (error) {
      console.error('Error assigning guard:', error)
      alert(error.message || 'Failed to assign guard')
    } finally {
      setSubmitting(false)
    }
  }

  const getSiteGuards = (siteId) => {
    return guards.filter(g => g.site_id === siteId)
  }

  const filteredSites = sites.filter(site =>
    !searchTerm || 
    site.site_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    site.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    site.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
          <div className="text-lg text-gray-600">Loading sites...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Site Management</h1>
          <p className="text-gray-600 mt-1">Create and manage company sites, locations, and guard allocations</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search sites..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent w-64"
            />
          </div>
          <button
            onClick={() => setShowAddSiteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 transition-colors"
          >
            <Plus size={20} />
            <span>Add Site</span>
          </button>
        </div>
      </div>

      {/* Sites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSites.map((site) => {
          const siteGuards = getSiteGuards(site.id)
          const guardCount = site.assigned_guard_count || siteGuards.length
          return (
            <div
              key={site.id}
              className={`bg-white rounded-xl shadow-sm border p-6 hover:shadow-lg transition-shadow ${
                site.status === 'inactive' ? 'border-red-200 opacity-75' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    site.status === 'inactive' ? 'bg-red-100' : 'bg-blue-100'
                  }`}>
                    <Building2 className={`w-6 h-6 ${site.status === 'inactive' ? 'text-red-600' : 'text-blue-600'}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{site.site_name}</h3>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <MapPin size={12} />
                      {site.location}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  site.status === 'inactive' 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {site.status}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                {site.client_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users size={16} className="text-gray-400" />
                    <span className="text-gray-600">{site.client_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Hash size={16} className="text-gray-400" />
                  <span className="text-gray-600">{guardCount} / {site.required_guards || 1} guards assigned</span>
                </div>
                {site.contact_number && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone size={16} className="text-gray-400" />
                    <span className="text-gray-600">{site.contact_number}</span>
                  </div>
                )}
                {site.created_by_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock size={16} className="text-gray-400" />
                    <span className="text-gray-500 text-xs">Created by: {site.created_by_name}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedSite(site)
                    setShowAddGuardModal(true)
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                >
                  <UserPlus size={16} />
                  Add Guard
                </button>
                <button
                  onClick={() => openEditModal(site)}
                  className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  onClick={() => {
                    setSiteToDelete(site)
                    setShowDeleteConfirm(true)
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-2 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  onClick={() => navigate(`/admin/sites/${site.id}`)}
                  className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Details
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {filteredSites.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">{searchTerm ? 'No sites match your search' : 'No sites created yet'}</p>
          <button
            onClick={() => setShowAddSiteModal(true)}
            className="mt-4 px-6 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 transition-colors"
          >
            Create Your First Site
          </button>
        </div>
      )}

      {/* Add Site Modal */}
      {showAddSiteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Add New Site</h2>
                <button
                  onClick={() => setShowAddSiteModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <form onSubmit={handleAddSite} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Site Name *
                </label>
                <input
                  type="text"
                  required
                  value={siteForm.site_name}
                  onChange={(e) => setSiteForm({ ...siteForm, site_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                  placeholder="e.g. Westlands Branch"
                />
              </div>

              <SiteLocationPicker
                latitude={siteForm.latitude}
                longitude={siteForm.longitude}
                onChange={(coordinates) => setSiteForm({ ...siteForm, ...coordinates })}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location *
                </label>
                <input
                  type="text"
                  required
                  value={siteForm.location}
                  onChange={(e) => setSiteForm({ ...siteForm, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                  placeholder="e.g. Westlands, Nairobi"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address *
                </label>
                <input
                  type="text"
                  required
                  value={siteForm.address}
                  onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                  placeholder="e.g. Moi Avenue, Nairobi"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Name
                </label>
                <input
                  type="text"
                  value={siteForm.client_name}
                  onChange={(e) => setSiteForm({ ...siteForm, client_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                  placeholder="e.g. ABC Corporation"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Number
                </label>
                <input
                  type="text"
                  value={siteForm.contact_number}
                  onChange={(e) => setSiteForm({ ...siteForm, contact_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                  placeholder="e.g. +254 712 345 678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Required Guards *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={siteForm.required_guards}
                  onChange={(e) => setSiteForm({ ...siteForm, required_guards: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                  placeholder="1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Day Rate (KES) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={siteForm.day_rate}
                    onChange={(e) => setSiteForm({ ...siteForm, day_rate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                    placeholder="e.g. 1500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Night Rate (KES) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={siteForm.night_rate}
                    onChange={(e) => setSiteForm({ ...siteForm, night_rate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                    placeholder="e.g. 2000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contractor Monthly Rate (KES) *
                </label>
                <input
                  type="number"
                  required
                  min="30000"
                  max="40000"
                  step="0.01"
                  value={siteForm.amount_offered}
                  onChange={(e) => setSiteForm({ ...siteForm, amount_offered: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                  placeholder="30,000 - 40,000"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-[#1a2a6c] text-white py-2 rounded-lg font-semibold hover:bg-[#1a2a6c]/90 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Site'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddSiteModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Site Modal */}
      {showEditSiteModal && selectedSite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Edit Site</h2>
                <button
                  onClick={() => {
                    setShowEditSiteModal(false)
                    setSelectedSite(null)
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <form onSubmit={handleEditSite} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Site Name *</label>
                <input type="text" required value={siteForm.site_name}
                  onChange={(e) => setSiteForm({ ...siteForm, site_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
                <input type="text" required value={siteForm.location}
                  onChange={(e) => setSiteForm({ ...siteForm, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent" />
              </div>
              <SiteLocationPicker
                latitude={siteForm.latitude}
                longitude={siteForm.longitude}
                onChange={(coordinates) => setSiteForm({ ...siteForm, ...coordinates })}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address *</label>
                <input type="text" required value={siteForm.address}
                  onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent" placeholder="e.g. Moi Avenue, Nairobi" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Client Name</label>
                <input type="text" value={siteForm.client_name}
                  onChange={(e) => setSiteForm({ ...siteForm, client_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number</label>
                <input type="text" value={siteForm.contact_number}
                  onChange={(e) => setSiteForm({ ...siteForm, contact_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Required Guards *</label>
                <input type="number" required min="1" value={siteForm.required_guards}
                  onChange={(e) => setSiteForm({ ...siteForm, required_guards: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Day Rate (KES) *</label>
                  <input type="number" required min="0" step="0.01" value={siteForm.day_rate}
                    onChange={(e) => setSiteForm({ ...siteForm, day_rate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent" placeholder="e.g. 1500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Night Rate (KES) *</label>
                  <input type="number" required min="0" step="0.01" value={siteForm.night_rate}
                    onChange={(e) => setSiteForm({ ...siteForm, night_rate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent" placeholder="e.g. 2000" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contractor Monthly Rate (KES) *
                </label>
                <input
                  type="number"
                  required
                  min="30000"
                  max="40000"
                  step="0.01"
                  value={siteForm.amount_offered}
                  onChange={(e) => setSiteForm({ ...siteForm, amount_offered: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                  placeholder="30,000 - 40,000"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-[#1a2a6c] text-white py-2 rounded-lg font-semibold hover:bg-[#1a2a6c]/90 transition-colors disabled:opacity-50">
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button"
                  onClick={() => { setShowEditSiteModal(false); setSelectedSite(null); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && siteToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Delete Site</h2>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-700 mb-2">
                Are you sure you want to delete <strong>{siteToDelete.site_name}</strong>?
              </p>
              <p className="text-sm text-gray-500 mb-6">
                If the site has active guard allocations, it will be deactivated instead.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteSite}
                  disabled={deleteLoading}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleteLoading ? 'Processing...' : 'Delete Site'}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setSiteToDelete(null); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Guard to Site Modal */}
      {showAddGuardModal && selectedSite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Add Guard to Site</h2>
                <button
                  onClick={() => {
                    setShowAddGuardModal(false)
                    setGuardForm({
                      work_number: '',
                      guard_id: '',
                      guard_name: '',
                      shift_type: 'day',
                      is_overtime: false
                    })
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Assigning to: <span className="font-semibold">{selectedSite.site_name}</span>
              </p>
            </div>
            <form onSubmit={handleAssignGuard} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Guard Work Number *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={guardForm.work_number}
                    onChange={(e) => setGuardForm({ ...guardForm, work_number: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                    placeholder="e.g. GB-001"
                  />
                  <button
                    type="button"
                    onClick={handleLookupGuard}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <Search size={20} />
                  </button>
                </div>
              </div>

              {guardForm.guard_name && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">Guard Found:</p>
                  <p className="text-lg font-bold text-green-700">{guardForm.guard_name}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shift Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setGuardForm({ ...guardForm, shift_type: 'day' })}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                      guardForm.shift_type === 'day'
                        ? 'border-yellow-500 bg-yellow-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Sun size={20} className={guardForm.shift_type === 'day' ? 'text-yellow-600' : 'text-gray-400'} />
                    <span className="font-medium">Day Shift</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuardForm({ ...guardForm, shift_type: 'night' })}
                    className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                      guardForm.shift_type === 'night'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Moon size={20} className={guardForm.shift_type === 'night' ? 'text-blue-600' : 'text-gray-400'} />
                    <span className="font-medium">Night Shift</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="overtime"
                  checked={guardForm.is_overtime}
                  onChange={(e) => setGuardForm({ ...guardForm, is_overtime: e.target.checked })}
                  className="w-4 h-4 text-[#1a2a6c] rounded focus:ring-[#1a2a6c]"
                />
                <label htmlFor="overtime" className="text-sm font-medium text-gray-700">
                  This is an overtime assignment
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting || !guardForm.guard_id}
                  className="flex-1 bg-[#1a2a6c] text-white py-2 rounded-lg font-semibold hover:bg-[#1a2a6c]/90 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Assigning...' : 'Assign Guard'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddGuardModal(false)
                    setGuardForm({
                      work_number: '',
                      guard_id: '',
                      guard_name: '',
                      shift_type: 'day',
                      is_overtime: false
                    })
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
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

export default SiteManagement