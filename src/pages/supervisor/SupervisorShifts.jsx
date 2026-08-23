import { useState, useEffect } from 'react'
import { supervisorAPI, shiftsAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { useNotification } from '../../contexts/NotificationContext'
import ModalWrapper from '../../components/ModalWrapper'
import { Clock, MapPin, Users, RefreshCw, AlertTriangle, CheckCircle, XCircle, Search, UserPlus, ShieldAlert, Activity } from 'lucide-react'

const SupervisorShifts = () => {
  const { profile } = useAuth()
  const { showConfirm, showErrorToast } = useNotification()
  const [activeTab, setActiveTab] = useState('active')
  const [activeShifts, setActiveShifts] = useState([])
  const [supervisorClockedIn, setSupervisorClockedIn] = useState(true)
  const [missedOff, setMissedOff] = useState([])
  const [overtimeShifts, setOvertimeShifts] = useState([])
  const [uncoveredSites, setUncoveredSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [allocating, setAllocating] = useState(false)
  const [selectedSite, setSelectedSite] = useState(null)
  const [selectedGuard, setSelectedGuard] = useState(null)
  const [overtimeForm, setOvertimeForm] = useState({
    date: new Date().toISOString().split('T')[0],
    start_time: '',
    notes: ''
  })
  const [showOvertimeModal, setShowOvertimeModal] = useState(false)
  const [allocationResult, setAllocationResult] = useState({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  })
  const [dutyAllocation, setDutyAllocation] = useState(null)
  const [reversingFineId, setReversingFineId] = useState(null)

  useEffect(() => {
    fetchAllData()
    return undefined
  }, [])

  const fetchAllData = async () => {
    setLoading(true)
    try {
      const allocationData = await supervisorAPI.getDutyAllocation().catch(() => ({ allocations: [] }))
      const allocation = allocationData.allocations?.[0] || null
      const [activeData, missedData, overtimeData, uncoveredData] = await Promise.all([
        supervisorAPI.getActiveShifts().catch(() => ({ active_shifts: [], supervisor_clocked_in: true })),
        supervisorAPI.getMissedOffShifts().catch(() => ({ missed_off: [] })),
        supervisorAPI.getScheduledOvertime().catch(() => ({ overtime_shifts: [] })),
        supervisorAPI.getUncoveredSites().catch(() => ({ uncovered_sites: [] }))
      ])
      
      // Filter out the supervisor's own shifts and allocations
      const supervisorId = profile?.id
      const filteredActiveShifts = supervisorId
        ? (activeData.active_shifts || []).filter(item => item.guard_id !== supervisorId)
        : (activeData.active_shifts || [])
      const filteredMissedOff = supervisorId 
        ? (missedData.missed_off || []).filter(item => item.guard_id !== supervisorId)
        : (missedData.missed_off || [])
      const filteredOvertimeShifts = supervisorId
        ? (overtimeData.overtime_shifts || []).filter(shift => shift.guard_id !== supervisorId)
        : (overtimeData.overtime_shifts || [])
      const filteredUncoveredSites = supervisorId
        ? (uncoveredData.uncovered_sites || []).filter(site => 
            !(site.absent_guard_id && site.absent_guard_id === supervisorId))
        : (uncoveredData.uncovered_sites || [])

      setDutyAllocation(allocation)
      setActiveShifts(filteredActiveShifts)
      setSupervisorClockedIn(activeData.supervisor_clocked_in !== false)
      setMissedOff(filteredMissedOff)
      setOvertimeShifts(filteredOvertimeShifts)
      setUncoveredSites(filteredUncoveredSites)
    } catch (err) {
      console.error('Failed to fetch shift data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchAllData()
    setRefreshing(false)
  }

  const handleSearchGuards = async (query) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const data = await supervisorAPI.searchGuards(query)
      setSearchResults(data.guards || [])
    } catch (err) {
      console.error('Search error:', err)
    } finally {
      setSearching(false)
    }
  }

  const handleAllocateOvertime = async (e) => {
    e.preventDefault()
    if (!selectedGuard || !selectedSite) return

    setAllocating(true)
    try {
      const result = await supervisorAPI.allocateOvertime({
        guard_id: selectedGuard.id,
        site_id: selectedSite.id,
        date: overtimeForm.date,
        start_time: overtimeForm.start_time || undefined,
        notes: overtimeForm.notes || `Overtime for ${selectedSite.client} (${selectedSite.gap_reason || 'uncovered'})`
      })

      setShowOvertimeModal(false)
      setSelectedGuard(null)
      setSelectedSite(null)
      setSearchQuery('')
      setSearchResults([])
      setOvertimeForm({
        date: new Date().toISOString().split('T')[0],
        start_time: '',
        notes: ''
      })
      setAllocationResult({
        isOpen: true,
        type: 'success',
        title: 'Overtime Allocation Successful',
        message: result.message || 'The overtime shift was allocated successfully.'
      })
      await fetchAllData()
    } catch (err) {
      console.error('Allocate overtime error:', err)
      setAllocationResult({
        isOpen: true,
        type: 'error',
        title: 'Overtime Allocation Failed',
        message: err.message || 'The overtime shift could not be allocated.'
      })
    } finally {
      setAllocating(false)
    }
  }

  const handleReverseLateFine = async (shift) => {
    const confirmed = await showConfirm({
      title: 'Reverse Late Fine',
      message: `Reverse the late fine for ${shift.guard_name}?`,
      confirmText: 'Reverse',
      variant: 'warning'
    })
    if (!confirmed) return
    setReversingFineId(shift.id)
    try {
      await shiftsAPI.reverseLateFine(shift.id, 'Supervisor approved reversal')
      await fetchAllData()
    } catch (err) {
      console.error('Reverse late fine error:', err)
      showErrorToast('Late Fine Reversal Failed', err.message)
    } finally {
      setReversingFineId(null)
    }
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return '--:--'
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const getShiftTypeColor = (shiftType) => {
    switch (shiftType) {
      case 'day': return 'bg-blue-100 text-blue-800'
      case 'night': return 'bg-purple-100 text-purple-800'
      case 'overtime': return 'bg-amber-100 text-amber-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getMissedStatusColor = (statusType) => {
    switch (statusType) {
      case 'off_day': return 'bg-yellow-100 text-yellow-800'
      case 'absent_with_permission': return 'bg-orange-100 text-orange-800'
      case 'on_leave': return 'bg-purple-100 text-purple-800'
      case 'sick': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatStatusLabel = (statusType) => {
    return statusType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const tabs = [
    { id: 'active', label: 'Active Shifts', icon: Activity },
    { id: 'missed', label: 'Missed / Off', icon: AlertTriangle },
    { id: 'scheduled', label: 'Scheduled Overtime', icon: Clock },
    { id: 'unassigned', label: 'Unassigned Sites', icon: AlertTriangle }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-gray-400">Loading shift data...</div>
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
              <h1 className="text-3xl font-bold text-gray-900">Shift Management</h1>
              <p className="text-gray-600 mt-1">
                {activeTab === 'active' ? 'Guards currently clocked in and on duty' :
                 activeTab === 'missed' ? 'Guards on off-days, absent, or leave' :
                 'Scheduled overtime arrangements'}
              </p>
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
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                  activeTab === tab.id
                    ? 'bg-[#1a2a6c] text-white shadow-lg'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Shifts</p>
                <p className="text-3xl font-bold text-green-600">{activeShifts.length}</p>
              </div>
              <div className="bg-green-500 p-3 rounded-lg">
                <Activity className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Missed / Off</p>
                <p className="text-3xl font-bold text-orange-600">{missedOff.length}</p>
              </div>
              <div className="bg-orange-500 p-3 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Scheduled Overtime</p>
                <p className="text-3xl font-bold text-amber-600">{overtimeShifts.length}</p>
              </div>
              <div className="bg-amber-500 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* ========== ACTIVE SHIFTS TAB ========== */}
        {activeTab === 'active' && (
          <div className="space-y-6">
            {!supervisorClockedIn && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-8 h-8 text-red-600 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-semibold text-red-900 mb-2">Operational Access Required</h3>
                    <p className="text-sm text-red-700 mb-3">
                      You must be clocked in to view active shifts. Please clock in at your assigned site to gain operational access.
                    </p>
                    <p className="text-sm text-red-600">
                      If you are unable to clock in, contact your manager to manually clock you in from the manager portal.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {supervisorClockedIn && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-500" />
                    Active Shifts ({activeShifts.length})
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Guards currently clocked in with exact check-in and check-out times
                  </p>
                </div>

                {activeShifts.length === 0 ? (
                  <div className="p-12 text-center">
                    <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Shifts</h3>
                    <p className="text-gray-600">No guards are currently clocked in at your sites</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guard</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Site</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shift Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock In</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clock Out</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {activeShifts.map((shift) => (
                          <tr key={shift.id} className={shift.is_late ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50"}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-semibold text-sm">
                                  {shift.guard_name?.charAt(0) || 'G'}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{shift.guard_name}</div>
                                  <div className="text-xs text-gray-500">{shift.work_number}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <MapPin size={14} className="text-gray-400" />
                                <div>
                                  <div className="text-sm text-gray-900">{shift.site_name}</div>
                                  <div className="text-xs text-gray-500">{shift.location}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getShiftTypeColor(shift.shift_type)}`}>
                                {shift.shift_type?.charAt(0).toUpperCase() + shift.shift_type?.slice(1) || 'N/A'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-gray-900">{formatTime(shift.check_in_time)}</div>
                              <div className="text-xs text-gray-500">{new Date(shift.check_in_time).toLocaleDateString()}</div>
                            </td>
                            <td className="px-4 py-3">
                              {shift.check_out_time ? (
                                <div className="text-sm text-gray-900">{formatTime(shift.check_out_time)}</div>
                              ) : (
                                <span className="text-xs text-green-600 font-medium">On Duty</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {shift.is_late ? (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Late</span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Active</span>
                              )}
                              {shift.clock_in_method === 'supervisor' && (
                                <span className="ml-1 px-2 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800">By Sup.</span>
                              )}
                              {shift.clock_in_method === 'manager' && (
                                <span className="ml-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">By Mgr</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========== MISSED / OFF TAB ========== */}
        {activeTab === 'missed' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Missed / Off
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Guards on off-days, absent with permission, or on leave — potential coverage gaps
              </p>
            </div>

            {missedOff.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">All Clear</h3>
                <p className="text-gray-600">No guards are currently off duty or absent</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guard</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status / Reason</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned Site</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {missedOff.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-semibold text-sm">
                              {item.guard_name?.charAt(0) || 'G'}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{item.guard_name}</div>
                              <div className="text-xs text-gray-500">{item.work_number}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getMissedStatusColor(item.status_type)}`}>
                            {formatStatusLabel(item.status_type)}
                          </span>
                          {item.reason && (
                            <p className="text-xs text-gray-500 mt-1">{item.reason}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">
                            {new Date(item.start_date).toLocaleDateString()}
                            {item.end_date && (
                              <span> → {new Date(item.end_date).toLocaleDateString()}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <MapPin size={14} className="text-gray-400" />
                            <div>
                              <div className="text-sm text-gray-900">{item.site_name || 'N/A'}</div>
                              <div className="text-xs text-gray-500">{item.location || ''}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========== UNASSIGNED SITES TAB ========== */}
        {activeTab === 'unassigned' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Unassigned Sites
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Sites with no guard assigned or scheduled - requires immediate attention
              </p>
            </div>

            {uncoveredSites.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">All Sites Covered</h3>
                <p className="text-gray-600">All active sites have guards assigned and scheduled</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Site</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Required Guards</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gap Reason</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {uncoveredSites.map((site) => (
                      <tr key={site.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-red-500" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{site.client || site.site_name}</div>
                              <div className="text-xs text-gray-500">ID: {site.id?.slice(0, 8)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{site.location}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{site.required_guards || 1}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 capitalize">
                            {site.gap_reason?.replace(/_/g, ' ') || 'unassigned'}
                          </span>
                          {site.absent_guard_name && (
                            <p className="text-xs text-gray-500 mt-1">
                              Absent: {site.absent_guard_name}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              setSelectedSite(site)
                              setShowOvertimeModal(true)
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                          >
                            <UserPlus size={14} />
                            Assign Guard
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========== SCHEDULED OVERTIME TAB ========== */}
        {activeTab === 'scheduled' && (
          <div className="space-y-6">
            {/* Uncovered Sites Alert */}
            {uncoveredSites.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-amber-900 mb-2">
                      Coverage Gaps Detected ({uncoveredSites.length})
                    </h3>
                    <p className="text-sm text-amber-700 mb-3">
                      The following sites have guards on off-duty status. Use the search below to allocate overtime coverage.
                    </p>
                    <div className="space-y-2">
                      {uncoveredSites.map((site) => (
                        <div key={site.id} className="bg-white rounded-lg p-3 border border-amber-200 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{site.client}</p>
                            <p className="text-sm text-gray-600">
                              {site.location} — Gap: <span className="text-amber-700 font-medium capitalize">{site.gap_reason?.replace(/_/g, ' ')}</span>
                            </p>
                            <p className="text-xs text-gray-500">
                              Absent guard: {site.absent_guard_name} ({site.absent_guard_work_number})
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedSite(site)
                              setShowOvertimeModal(true)
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors"
                          >
                            <UserPlus size={14} />
                            Allocate OT
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Overtime Search & Allocate */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Search className="w-5 h-5 text-[#1a2a6c]" />
                  Overtime Search & Allocate
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Search for a guard by Work Number to allocate overtime coverage
                </p>
              </div>
              <div className="p-6">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchGuards(e.target.value)}
                    placeholder="Type guard Work Number or Name (min 2 characters)..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                  />
                  {searching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-5 h-5 border-2 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 mb-4">
                    {searchResults.map((guard) => (
                      <div
                        key={guard.id}
                        className={`p-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                          selectedGuard?.id === guard.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1a2a6c] to-[#b21f1f] flex items-center justify-center text-white font-semibold">
                            {guard.full_name?.charAt(0) || 'G'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{guard.full_name}</p>
                            <p className="text-sm text-gray-500">{guard.work_number}</p>
                          </div>
                        </div>
                        {guard.available_for_overtime === false && (
                          <span className="text-xs text-red-600 font-medium">Not Available</span>
                        )}
                        {guard.last_overtime_date && (
                          <span className="text-xs text-gray-400">
                            Last OT: {new Date(guard.last_overtime_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Overtime Allocation Form */}
                {showOvertimeModal && selectedSite && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                    <h3 className="font-semibold text-amber-900 mb-2">Allocate Overtime</h3>
                    <p className="text-sm text-amber-700 mb-3">
                      Site: <strong>{selectedSite.client}</strong> — {selectedSite.location}
                    </p>
                    {selectedGuard && (
                      <p className="text-sm text-amber-700 mb-3">
                        Guard: <strong>{selectedGuard.full_name}</strong> ({selectedGuard.work_number})
                      </p>
                    )}
                  </div>
                )}

                {showOvertimeModal && (
                  <form onSubmit={handleAllocateOvertime} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                        <input
                          type="date"
                          value={overtimeForm.date}
                          onChange={(e) => setOvertimeForm({ ...overtimeForm, date: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Start Time (Optional)</label>
                        <input
                          type="time"
                          value={overtimeForm.start_time}
                          onChange={(e) => setOvertimeForm({ ...overtimeForm, start_time: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                      <textarea
                        value={overtimeForm.notes}
                        onChange={(e) => setOvertimeForm({ ...overtimeForm, notes: e.target.value })}
                        rows="2"
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        placeholder="Reason for overtime allocation..."
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={allocating || !selectedGuard}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
                      >
                        {allocating ? 'Allocating...' : 'Confirm Overtime Allocation'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowOvertimeModal(false)
                          setSelectedGuard(null)
                          setSelectedSite(null)
                        }}
                        className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Scheduled Overtime List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#1a2a6c]" />
                  Current Overtime Arrangements ({overtimeShifts.length})
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Overtime shifts scheduled by you or other supervisors
                </p>
              </div>

              {overtimeShifts.length === 0 ? (
                <div className="p-12 text-center">
                  <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Overtime Scheduled</h3>
                  <p className="text-gray-600">No overtime shifts have been scheduled yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guard</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Site</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Allocated By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {overtimeShifts.map((shift) => (
                        <tr key={shift.id} className={shift.is_late ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50"}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-semibold text-sm">
                                {shift.guard_name?.charAt(0) || 'G'}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">{shift.guard_name}</div>
                                <div className="text-xs text-gray-500">{shift.work_number}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <MapPin size={14} className="text-gray-400" />
                              <div>
                                <div className="text-sm text-gray-900">{shift.site_name}</div>
                                <div className="text-xs text-gray-500">{shift.location}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900">
                              {new Date(shift.date).toLocaleDateString()}
                            </div>
                            {shift.start_time && (
                              <div className="text-xs text-gray-500">
                                {formatTime(shift.start_time)} - {shift.end_time ? formatTime(shift.end_time) : '12h max'}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${
                              shift.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                              shift.status === 'completed' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {shift.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-600">
                              {shift.allocated_by_name || 'System'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ModalWrapper
        isOpen={allocationResult.isOpen}
        onClose={() => setAllocationResult({ ...allocationResult, isOpen: false })}
        title={allocationResult.title}
        icon={
          <div className={`w-12 h-12 ${allocationResult.type === 'success' ? 'bg-green-100' : 'bg-red-100'} rounded-full flex items-center justify-center`}>
            {allocationResult.type === 'success' ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600" />
            )}
          </div>
        }
        size="sm"
        footer={
          <div className="flex justify-end">
            <button
              onClick={() => setAllocationResult({ ...allocationResult, isOpen: false })}
              className={`px-6 py-2.5 text-white rounded-lg font-semibold transition-colors ${allocationResult.type === 'success' ? 'bg-[#1a2a6c] hover:bg-[#1a2a6c]/90' : 'bg-red-600 hover:bg-red-700'}`}
            >
              Close
            </button>
          </div>
        }
      >
        <p className="text-gray-700 whitespace-pre-wrap">{allocationResult.message}</p>
      </ModalWrapper>
    </div>
  )
}

export default SupervisorShifts