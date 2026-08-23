import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { usersAPI, shiftsAPI, sitesAPI, supervisorAPI } from '../../services/api'
import ResponsiveTable from '../../components/ResponsiveTable'
import EmergencyContactModal from '../../components/EmergencyContactModal'
import ConfirmModal from '../../components/ConfirmModal'
import {
  Users,
  MapPin,
  Clock,
  Plus,
  RefreshCw,
  UserCheck,
  UserX,
  AlertCircle,
  CheckCircle,
  XCircle,
  Building2,
  Phone,
  Search,
  Filter,
  Calendar,
  ChevronDown,
  ChevronUp,
  Loader
} from 'lucide-react'

const SupervisorGuards = () => {
  const { profile } = useAuth()
  const [guards, setGuards] = useState([])
  const [sites, setSites] = useState([])
  const [shifts, setShifts] = useState([])
  const [allocations, setAllocations] = useState([])
  const [dutyAllocations, setDutyAllocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [siteChangeConfirmation, setSiteChangeConfirmation] = useState(null)
  const [showOvertimeModal, setShowOvertimeModal] = useState(false)
  const [selectedGuard, setSelectedGuard] = useState(null)
  const [shiftForm, setShiftForm] = useState({
    site_id: '',
    date: new Date().toISOString().split('T')[0],
    shift_type: 'day',
    notes: ''
  })
  const [overtimeForm, setOvertimeForm] = useState({
    site_id: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '',
    notes: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [clockingInGuardId, setClockingInGuardId] = useState(null)
  const [selectedGuardDetails, setSelectedGuardDetails] = useState(null)
  const [showGuardDetailsModal, setShowGuardDetailsModal] = useState(false)
  const [showAssignedSiteModal, setShowAssignedSiteModal] = useState(false)
  const [selectedAssignedGuard, setSelectedAssignedGuard] = useState(null)
  const [filterStatus, setFilterStatus] = useState(null)
  const [guardTab, setGuardTab] = useState('all')
  const [showEmergencyContactModal, setShowEmergencyContactModal] = useState(false)
  const [selectedGuardForEmergencyContact, setSelectedGuardForEmergencyContact] = useState(null)
  
  // Overtime search & allocation state
  const [overtimeSearchQuery, setOvertimeSearchQuery] = useState('')
  const [overtimeSearchResults, setOvertimeSearchResults] = useState([])
  const [searchingOvertime, setSearchingOvertime] = useState(false)
  const [showOvertimeSearch, setShowOvertimeSearch] = useState(false)
  const [overtimeAllocationResult, setOvertimeAllocationResult] = useState(null)
  const [showOvertimeResultModal, setShowOvertimeResultModal] = useState(false)
  const [uncoveredSites, setUncoveredSites] = useState([])
  const [scheduledOvertime, setScheduledOvertime] = useState([])
  const [showScheduledOvertime, setShowScheduledOvertime] = useState(false)

  useEffect(() => {
    fetchData()

    // Refresh automatically once per hour; manual refresh remains available.
    const pollInterval = setInterval(() => {
      fetchData()
    }, 60 * 60 * 1000)

    return () => clearInterval(pollInterval)
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [guardsData, sitesData, shiftsData, allocationsData, dutyData] = await Promise.all([
        usersAPI.getGuards({ status: 'active' }),
        sitesAPI.getAll({ status: 'active' }),
        shiftsAPI.getAll({ date_from: new Date().toISOString().split('T')[0], date_to: new Date().toISOString().split('T')[0] }),
        supervisorAPI.getAllocations().catch(() => ({ allocations: [] })),
        supervisorAPI.getDutyAllocation().catch(() => ({ allocations: [] }))
      ])
      setGuards(guardsData.guards || [])
      setSites(sitesData.sites || [])
      setShifts(shiftsData.shifts || [])
      setAllocations(allocationsData.allocations || [])
      setDutyAllocations(dutyData.allocations || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const submitShiftAssignment = async (changeSite = false) => {
    if (!selectedGuard || !shiftForm.site_id) return

    setSubmitting(true)
    try {
      // Create allocation (cross-portal sync)
      await supervisorAPI.createAllocation({
        guard_id: selectedGuard.id,
        site_id: shiftForm.site_id,
        shift_type: shiftForm.shift_type,
        date: shiftForm.date,
        notes: shiftForm.notes,
        change_site: changeSite
      })
      setSiteChangeConfirmation(null)
      setShowShiftModal(false)
      setSelectedGuard(null)
      setShiftForm({
        site_id: '',
        date: new Date().toISOString().split('T')[0],
        shift_type: 'day',
        notes: ''
      })
      await fetchData()
    } catch (error) {
      console.error('Error assigning shift:', error)
      alert('Failed to assign shift')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAssignShift = async (e) => {
    e.preventDefault()
    if (!selectedGuard || !shiftForm.site_id) return

    if (selectedGuard.site_id && selectedGuard.site_id !== shiftForm.site_id) {
      const currentSite = sites.find(site => site.id === selectedGuard.site_id)
      const newSite = sites.find(site => site.id === shiftForm.site_id)
      setSiteChangeConfirmation({
        currentSite: getSiteName(currentSite),
        newSite: getSiteName(newSite)
      })
      return
    }

    await submitShiftAssignment(false)
  }

  const handleAllocateOvertime = async (e) => {
    e.preventDefault()
    if (!selectedGuard || !overtimeForm.site_id) return

    setSubmitting(true)
    try {
      const result = await supervisorAPI.allocateOvertime({
        guard_id: selectedGuard.id,
        site_id: overtimeForm.site_id,
        date: overtimeForm.date,
        start_time: overtimeForm.start_time || undefined,
        notes: overtimeForm.notes
      })
      setShowOvertimeModal(false)
      setSelectedGuard(null)
      setOvertimeForm({
        site_id: '',
        date: new Date().toISOString().split('T')[0],
        start_time: '',
        notes: ''
      })
      // Show success result
      setOvertimeAllocationResult(result)
      setShowOvertimeResultModal(true)
      await fetchData()
    } catch (error) {
      console.error('Error allocating overtime:', error)
      alert('Failed to allocate overtime shift')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSupervisorClockIn = async (guard) => {
    const today = new Date().toISOString().split('T')[0]
    const todayShift = shifts.find(shift => (
      shift.guard_id === guard.id &&
      String(shift.date).slice(0, 10) === today &&
      !shift.check_in_time &&
      !shift.end_time
    ))
    const siteId = todayShift?.site_id || guard.site_id

    if (!siteId) {
      alert('Assign this guard to a site before clocking them in.')
      return
    }

    setClockingInGuardId(guard.id)
    try {
      await shiftsAPI.supervisorClockIn({
        guard_id: guard.id,
        site_id: siteId,
        shift_type: todayShift?.shift_type || 'day'
      })
      setShowGuardDetailsModal(false)
      setSelectedGuardDetails(null)
      await fetchData()
    } catch (error) {
      console.error('Error clocking in guard:', error)
      alert(error.message || 'Failed to clock in guard')
    } finally {
      setClockingInGuardId(null)
    }
  }

  // Overtime search function
  const handleOvertimeSearch = async (query) => {
    setOvertimeSearchQuery(query)
    if (query.length < 2) {
      setOvertimeSearchResults([])
      return
    }
    setSearchingOvertime(true)
    try {
      const result = await supervisorAPI.searchGuards(query)
      setOvertimeSearchResults(result.guards || [])
    } catch (error) {
      console.error('Error searching guards:', error)
      setOvertimeSearchResults([])
    } finally {
      setSearchingOvertime(false)
    }
  }

  // Fetch uncovered sites for overtime allocation
  const fetchUncoveredSites = async () => {
    try {
      const result = await supervisorAPI.getUncoveredSites()
      setUncoveredSites(result.uncovered_sites || [])
    } catch (error) {
      console.error('Error fetching uncovered sites:', error)
    }
  }

  // Fetch scheduled overtime
  const fetchScheduledOvertime = async () => {
    try {
      const result = await supervisorAPI.getScheduledOvertime()
      setScheduledOvertime(result.overtime_shifts || [])
    } catch (error) {
      console.error('Error fetching scheduled overtime:', error)
    }
  }

  const getGuardStatus = (guardId) => {
    const guard = guards.find(g => g.id === guardId)

    if (guard?.today_check_in_time && !guard.today_end_time) {
      return { status: 'active', label: 'On Shift', color: 'green' }
    }

    // Check if guard has an active allocation
    const activeAllocation = allocations.find(a => a.guard_id === guardId && a.status === 'active')
    if (activeAllocation) {
      return { status: 'assigned', label: 'Assigned', color: 'blue', allocation: activeAllocation }
    }

    // Check if guard is assigned to a site via user profile
    const isAssignedToSite = guard?.site_id
    if (isAssignedToSite) {
      const site = sites.find(s => s.id === guard.site_id)
      return { status: 'assigned', label: 'Assigned', color: 'blue', siteName: site?.client_name || site?.client || 'N/A' }
    }

    // Check if guard has a shift today
    const today = new Date().toISOString().split('T')[0]
    const todayShifts = shifts.filter(s => s.guard_id === guardId && String(s.date).slice(0, 10) === today)
    if (todayShifts.length === 0) {
      return { status: 'unassigned', label: 'Unassigned', color: 'gray' }
    }

    const hasActiveShift = todayShifts.some(s => s.check_in_time && !s.end_time)
    if (hasActiveShift) return { status: 'active', label: 'On Shift', color: 'green' }

    const hasCompletedShift = todayShifts.some(s => s.status === 'completed')
    if (hasCompletedShift) return { status: 'completed', label: 'Completed', color: 'blue' }

    return { status: 'scheduled', label: 'Scheduled', color: 'yellow' }
  }

  const getStatusBadge = (status) => {
    const colors = {
      green: 'bg-green-100 text-green-800 border-green-200',
      blue: 'bg-blue-100 text-blue-800 border-blue-200',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      gray: 'bg-gray-100 text-gray-800 border-gray-200'
    }
    return colors[status.color] || colors.gray
  }

  const handleStatusClick = (guard) => {
    const status = getGuardStatus(guard.id)
    if (status.status === 'assigned') {
      setSelectedAssignedGuard({
        guard: guard,
        allocation: status.allocation,
        siteName: status.siteName
      })
      setShowAssignedSiteModal(true)
    }
  }

  const handleGuardClick = (guard) => {
    setSelectedGuardDetails(guard)
    setShowGuardDetailsModal(true)
  }

  const handleEmergencyContactClick = (guard) => {
    setSelectedGuardForEmergencyContact(guard)
    setShowEmergencyContactModal(true)
  }

  const handleEmergencyContactSuccess = (updatedUser) => {
    setGuards(prevGuards => prevGuards.map(g => g.id === updatedUser.id ? { ...g, ...updatedUser } : g))
    if (selectedGuardDetails && selectedGuardDetails.id === updatedUser.id) {
      setSelectedGuardDetails({ ...selectedGuardDetails, ...updatedUser })
    }
  }

  const handleStatClick = (status) => {
    setFilterStatus(filterStatus === status ? null : status)
  }

  const normalizeLocation = (value) => String(value || '').toLowerCase().replace(/[^a-z]/g, '')

  const getMyGuards = () => {
    const areas = dutyAllocations.map(allocation => normalizeLocation(allocation.area)).filter(Boolean)
    const mySiteIds = new Set(sites.filter(site => (
      site.supervisor_id === profile?.id || areas.some(area => {
        const location = normalizeLocation(site.location_category || site.location)
        return location.includes(area) || area.includes(location)
      })
    )).map(site => site.id))

    return guards.filter(guard => (
      mySiteIds.has(guard.site_id) ||
      allocations.some(allocation => allocation.guard_id === guard.id && mySiteIds.has(allocation.site_id)) ||
      shifts.some(shift => shift.guard_id === guard.id && mySiteIds.has(shift.site_id))
    ))
  }

  const getVisibleGuards = () => {
    const source = guardTab === 'my' ? getMyGuards() : guards
    if (!filterStatus) return source
    return source.filter(guard => getGuardStatus(guard.id).status === filterStatus)
  }

  const getGuardShifts = (guardId) => {
    return shifts.filter(s => s.guard_id === guardId && s.date === new Date().toISOString().split('T')[0])
  }

  // Resolve site name from various possible field names
  const getSiteName = (site) => {
    if (!site) return 'Unassigned'
    return site.client_name || site.client || site.site_name || 'N/A'
  }

  const getSiteLocation = (site) => {
    if (!site) return ''
    return site.location || site.site_location || ''
  }

  const columns = [
    {
      key: 'full_name',
      label: 'Guard',
      render: (row) => (
        <button
          onClick={() => handleGuardClick(row)}
          className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded-lg transition-colors w-full text-left"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1a2a6c] to-[#b21f1f] flex items-center justify-center text-white font-semibold text-sm">
            {row.full_name?.charAt(0) || 'G'}
          </div>
          <div>
            <div className="font-medium text-gray-900 hover:text-[#1a2a6c]">{row.full_name}</div>
          </div>
        </button>
      )
    },
    {
      key: 'phone_number',
      label: 'Phone Number',
      render: (row) => row.phone_number || '--'
    },
    {
      key: 'work_number',
      label: 'Work Number',
      render: (row) => row.work_number || '--'
    },
  ]

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
            <div className="text-lg text-gray-600">Loading guards...</div>
          </div>
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
              <h1 className="text-3xl font-bold text-gray-900">Guard Roster</h1>
              <p className="text-gray-600 mt-1">Manage guards and assign shifts</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  fetchScheduledOvertime()
                  setShowScheduledOvertime(true)
                }}
                className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
              >
                <Clock size={16} />
                <span>Scheduled Overtime</span>
              </button>
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
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {['all', 'my'].map(tab => <button key={tab} onClick={() => setGuardTab(tab)} className={`px-4 py-3 text-sm font-semibold border-b-2 ${guardTab === tab ? 'border-[#1a2a6c] text-[#1a2a6c]' : 'border-transparent text-gray-500'}`}>{tab === 'all' ? 'All Guards' : 'My Guards'}</button>)}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#1a2a6c]" />
              {guardTab === 'all' ? 'All Guards' : 'My Guards'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {getVisibleGuards().length} guards in this list
            </p>
          </div>
          <ResponsiveTable
            columns={columns}
            rows={getVisibleGuards()}
            loading={loading}
            emptyMessage="No guards found"
          />
        </div>
      </div>

      {/* Assign Shift Modal */}
      {showShiftModal && selectedGuard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Assign Shift</h2>
              <p className="text-sm text-gray-600 mt-1">
                Assigning shift for {selectedGuard.full_name}
              </p>
            </div>
            <form onSubmit={handleAssignShift} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Site
                </label>
                <select
                  value={shiftForm.site_id}
                  onChange={(e) => setShiftForm({ ...shiftForm, site_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                  required
                >
                  <option value="">Select a site</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {getSiteName(site)} - {getSiteLocation(site)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={shiftForm.date}
                  onChange={(e) => setShiftForm({ ...shiftForm, date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shift Type
                </label>
                <select
                  value={shiftForm.shift_type}
                  onChange={(e) => setShiftForm({ ...shiftForm, shift_type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                >
                  <option value="day">Day Shift</option>
                  <option value="night">Night Shift</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={shiftForm.notes}
                  onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                  rows="3"
                  placeholder="Add any special instructions..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowShiftModal(false)
                    setSelectedGuard(null)
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-[#1a2a6c] to-[#b21f1f] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitting ? 'Assigning...' : 'Assign Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allocate Overtime Modal */}
      {showOvertimeModal && selectedGuard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                Allocate Overtime
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Allocating overtime for {selectedGuard.full_name}
              </p>
            </div>
            <form onSubmit={handleAllocateOvertime} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Site <span className="text-red-500">*</span>
                </label>
                <select
                  value={overtimeForm.site_id}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, site_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  required
                >
                  <option value="">Select a site</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {getSiteName(site)} - {getSiteLocation(site)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={overtimeForm.date}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time (Optional)
                </label>
                <input
                  type="time"
                  value={overtimeForm.start_time}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, start_time: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to start immediately (max 12 hours)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={overtimeForm.notes}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  rows="3"
                  placeholder="Add any special instructions for overtime..."
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  <strong>Note:</strong> Overtime shifts are limited to 12 hours maximum. The guard will be automatically clocked out after 12 hours.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowOvertimeModal(false)
                    setSelectedGuard(null)
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submitting ? 'Allocating...' : 'Allocate Overtime'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Guard Details Modal */}
      {showGuardDetailsModal && selectedGuardDetails && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Guard Details</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedGuardDetails.full_name} - {selectedGuardDetails.work_number}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowGuardDetailsModal(false)
                    setSelectedGuardDetails(null)
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XCircle className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Guard Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Full Name</p>
                  <p className="text-sm font-medium text-gray-900">{selectedGuardDetails.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Work Number</p>
                  <p className="text-sm font-medium text-gray-900">{selectedGuardDetails.work_number}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Phone</p>
                  <p className="text-sm font-medium text-gray-900">{selectedGuardDetails.phone_number || '--'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Email</p>
                  <p className="text-sm font-medium text-gray-900">{selectedGuardDetails.email || '--'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Assigned Site</p>
                  <p className="text-sm font-medium text-gray-900">
                    {(() => {
                      const site = sites.find(s => s.id === selectedGuardDetails.site_id)
                      return getSiteName(site)
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Location</p>
                  <p className="text-sm font-medium text-gray-900">
                    {(() => {
                      const site = sites.find(s => s.id === selectedGuardDetails.site_id)
                      return getSiteLocation(site) || '--'
                    })()}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setShowGuardDetailsModal(false)
                      setSelectedGuard(selectedGuardDetails)
                      setShowShiftModal(true)
                    }}
                    className="flex items-center gap-1 px-4 py-2 bg-[#1a2a6c] text-white text-sm rounded-lg hover:bg-[#1a2a6c]/90 transition-colors"
                  >
                    <Plus size={14} />
                    Assign Shift
                  </button>
                  <button
                    onClick={() => {
                      setShowGuardDetailsModal(false)
                      setSelectedGuard(selectedGuardDetails)
                      setShowOvertimeModal(true)
                    }}
                    className="flex items-center gap-1 px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    <Clock size={14} />
                    Allocate Overtime
                  </button>
                  <button
                    onClick={() => handleSupervisorClockIn(selectedGuardDetails)}
                    disabled={clockingInGuardId === selectedGuardDetails.id || getGuardStatus(selectedGuardDetails.id).status === 'active'}
                    className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <UserCheck size={14} />
                    {clockingInGuardId === selectedGuardDetails.id ? 'Clocking In...' : 'Clock In Guard'}
                  </button>
                  <button
                    onClick={() => handleEmergencyContactClick(selectedGuardDetails)}
                    className="flex items-center gap-1 px-4 py-2 bg-orange-100 text-orange-700 text-sm rounded-lg hover:bg-orange-200 transition-colors"
                  >
                    <Phone size={14} />
                    {selectedGuardDetails.emergency_contact ? 'Update' : 'Add'} Emergency Contact
                  </button>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Emergency Contact</h3>
                {selectedGuardDetails.emergency_contact ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-900">
                      <strong>Name:</strong> {selectedGuardDetails.emergency_contact}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      <strong>Phone:</strong> {selectedGuardDetails.emergency_phone}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No emergency contact set</p>
                )}
              </div>

              {/* Today's Shifts */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Today's Shifts</h3>
                <div className="space-y-2">
                  {getGuardShifts(selectedGuardDetails.id).length > 0 ? (
                    getGuardShifts(selectedGuardDetails.id).map((shift) => {
                      const site = sites.find(s => s.id === shift.site_id)
                      return (
                        <div key={shift.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <MapPin size={14} className="text-gray-400" />
                                <span className="text-sm font-medium text-gray-900">
                                  {getSiteName(site)} - {getSiteLocation(site)}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-gray-600">
                                <span className="flex items-center gap-1">
                                  <Clock size={12} />
                                  {shift.shift_type?.toUpperCase()}
                                </span>
                                <span className={`px-2 py-1 rounded-full border ${getStatusBadge(getGuardStatus(selectedGuardDetails.id))}`}>
                                  {getGuardStatus(selectedGuardDetails.id).label}
                                </span>
                              </div>
                              {shift.start_time && (
                                <p className="text-xs text-gray-500 mt-2">
                                  Started: {new Date(shift.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                  {shift.end_time && (
                                    <span> - Ended: {new Date(shift.end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                  )}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-sm text-gray-500 italic">No shifts scheduled for today</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assigned Site Details Modal */}
      {showAssignedSiteModal && selectedAssignedGuard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Guard Allocation</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedAssignedGuard.guard.full_name}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAssignedSiteModal(false)
                    setSelectedAssignedGuard(null)
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XCircle className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Building2 className="w-8 h-8 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Assigned Site</p>
                    <p className="text-lg font-bold text-blue-900">
                      {selectedAssignedGuard.allocation?.site_name || selectedAssignedGuard.siteName || 'N/A'}
                    </p>
                    {selectedAssignedGuard.allocation?.site_location && (
                      <p className="text-sm text-blue-700">
                        {selectedAssignedGuard.allocation.site_location}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              {selectedAssignedGuard.allocation && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Shift Type</p>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {selectedAssignedGuard.allocation.shift_type}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Date</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(selectedAssignedGuard.allocation.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
              {selectedAssignedGuard.allocation?.notes && (
                <div>
                  <p className="text-xs text-gray-500 uppercase">Notes</p>
                  <p className="text-sm text-gray-700">{selectedAssignedGuard.allocation.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Overtime Allocation Result Modal */}
      {showOvertimeResultModal && overtimeAllocationResult && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Overtime Allocated Successfully</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {overtimeAllocationResult.message || 'Overtime shift has been created'}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {overtimeAllocationResult.shift && (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Shift ID</p>
                        <p className="text-sm font-mono text-gray-900">{overtimeAllocationResult.shift.id?.substring(0, 8)}...</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Date</p>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(overtimeAllocationResult.shift.date).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Status</p>
                        <p className="text-sm font-medium text-green-600 capitalize">{overtimeAllocationResult.shift.status}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Rate</p>
                        <p className="text-sm font-medium text-gray-900">KES {overtimeAllocationResult.shift.daily_rate || 254} per shift</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    The overtime shift has been linked to the guard's schedule and will be reflected in payroll calculations.
                    A notification has been sent to the guard.
                  </p>
                </>
              )}
              <button
                onClick={() => {
                  setShowOvertimeResultModal(false)
                  setOvertimeAllocationResult(null)
                }}
                className="w-full px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled Overtime Modal */}
      {showScheduledOvertime && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-600" />
                    Scheduled Overtime Shifts
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    View all scheduled overtime shifts for your sites
                  </p>
                </div>
                <button
                  onClick={() => setShowScheduledOvertime(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XCircle className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-6">
              {scheduledOvertime.length > 0 ? (
                <div className="space-y-3">
                  {scheduledOvertime.map((shift) => (
                    <div key={shift.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-semibold text-sm">
                              {shift.guard_name?.charAt(0) || 'G'}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{shift.guard_name}</p>
                              <p className="text-xs text-gray-500">{shift.work_number}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600 ml-10">
                            <span className="flex items-center gap-1">
                              <Building2 size={14} className="text-gray-400" />
                              {shift.site_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin size={14} className="text-gray-400" />
                              {shift.location}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar size={14} className="text-gray-400" />
                              {new Date(shift.date).toLocaleDateString()}
                            </span>
                          </div>
                          {shift.start_time && (
                            <p className="text-xs text-gray-500 mt-2 ml-10">
                              Start: {new Date(shift.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                              {shift.end_time && (
                                <span> - End: {new Date(shift.end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                              )}
                            </p>
                          )}
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${
                          shift.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                          shift.status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' :
                          'bg-gray-100 text-gray-800 border-gray-200'
                        }`}>
                          {shift.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No scheduled overtime shifts found</p>
                  <p className="text-sm text-gray-400 mt-1">Overtime shifts will appear here once allocated</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Emergency Contact Modal */}
      {showEmergencyContactModal && selectedGuardForEmergencyContact && (
        <EmergencyContactModal
          isOpen={showEmergencyContactModal}
          onClose={() => {
            setShowEmergencyContactModal(false)
            setSelectedGuardForEmergencyContact(null)
          }}
          userId={selectedGuardForEmergencyContact.id}
          userData={selectedGuardForEmergencyContact}
          onSuccess={handleEmergencyContactSuccess}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(siteChangeConfirmation)}
        onClose={() => setSiteChangeConfirmation(null)}
        onConfirm={() => submitShiftAssignment(true)}
        title="Change Guard Site?"
        message={siteChangeConfirmation ? `${selectedGuard?.full_name} is currently assigned to ${siteChangeConfirmation.currentSite}. Assigning this shift will permanently change the guard's site to ${siteChangeConfirmation.newSite}. Continue?` : ''}
        confirmText="Change Site and Assign"
        cancelText="Keep Current Site"
        variant="warning"
        loading={submitting}
      />
    </div>
  )
}

export default SupervisorGuards