import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { shiftsAPI } from '../../services/api'
import ShiftConfirmationModal from '../../components/ShiftConfirmationModal'
import { Clock, CheckCircle, XCircle, RefreshCw, LogOut, FileText, User, AlertTriangle, Timer, Sun, Moon, Shield, AlertOctagon, Navigation, MapPinOff, MapPin } from 'lucide-react'

const GuardAttendance = () => {
  const { profile } = useAuth()
  const [showClockInModal, setShowClockInModal] = useState(false)
  const [showHandoverModal, setShowHandoverModal] = useState(false)
  const [currentShift, setCurrentShift] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [handoverNotes, setHandoverNotes] = useState('')
  const [nextGuard, setNextGuard] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [currentShiftData, setCurrentShiftData] = useState(null)
  const [hoursWorked, setHoursWorked] = useState(0)
  const [clockOutSummary, setClockOutSummary] = useState(null)
  const [siteDetails, setSiteDetails] = useState(null)
  const [exceededMaxHours, setExceededMaxHours] = useState(false)
  const [isLate, setIsLate] = useState(false)
  const [lateCheckInTime, setLateCheckInTime] = useState(null)
  const [graceEndTime, setGraceEndTime] = useState(null)
  const [geofence, setGeofence] = useState(null)
  
  // 6AM/6PM countdown state
  const [milestone, setMilestone] = useState(null)
  const [milestoneCountdown, setMilestoneCountdown] = useState('')

  // GPS Location state
  const [gpsStatus, setGpsStatus] = useState('idle')
  const [gpsCoords, setGpsCoords] = useState(null)
  const [gpsError, setGpsError] = useState('')

  useEffect(() => {
    fetchCurrentShift()
    fetchMilestone()

    // Poll for shift status updates every 15 seconds for real-time propagation
    const pollInterval = setInterval(() => {
      fetchCurrentShift()
      fetchMilestone()
    }, 15000)

    return () => clearInterval(pollInterval)
  }, [])

  // Live hours worked countdown when clocked in
  useEffect(() => {
    if (!currentShift?.start_time) return

    const updateHours = () => {
      const start = new Date(currentShift.start_time)
      const now = new Date()
      const diffMs = now - start
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000)
      setHoursWorked(`${diffHrs}h ${diffMins}m ${diffSecs}s`)
      setExceededMaxHours(diffHrs >= 12)
    }

    updateHours()
    const interval = setInterval(updateHours, 1000)
    return () => clearInterval(interval)
  }, [currentShift?.start_time])

  // Live 6AM/6PM countdown
  useEffect(() => {
    if (!milestone) return

    const updateMilestone = () => {
      const now = new Date()
      const target = new Date(milestone.milestone_time)
      const diff = target - now

      if (diff <= 0) {
        fetchMilestone() // Re-fetch when milestone passes
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      setMilestoneCountdown(`${hours}h ${minutes}m ${seconds}s`)
    }

    updateMilestone()
    const interval = setInterval(updateMilestone, 1000)
    return () => clearInterval(interval)
  }, [milestone])

  const fetchMilestone = async () => {
    try {
      const data = await shiftsAPI.getNextMilestone()
      setMilestone(data)
    } catch (err) {
      // Silently fail - milestone is non-critical
    }
  }

  const fetchCurrentShift = async () => {
    try {
      setRefreshing(true)
      const data = await shiftsAPI.getCurrentShift()
      
      if (data.has_active_shift && data.shift) {
        setCurrentShift(data.shift)
        setSiteDetails(data.site || null)
        setExceededMaxHours(data.exceeded_max_hours || false)
        setIsLate(data.is_late || false)
        setLateCheckInTime(data.late_check_in_time || null)
        setGraceEndTime(data.grace_end_time || null)
        // Set GPS status from shift data
        setGpsStatus(data.check_in_geofence_verified !== undefined ? (data.check_in_geofence_verified ? 'found' : 'denied') : 'idle')
        setGpsCoords(data.check_in_latitude ? { latitude: data.check_in_latitude, longitude: data.check_in_longitude } : null)
        // Set geofence data from shift
        setGeofence({
          verified: data.check_in_geofence_verified || false,
          distance_meters: data.check_in_distance_meters !== null ? data.check_in_distance_meters : null,
          radius_meters: data.geofence_radius || 50,
          message: data.check_in_distance_meters !== null ? (data.check_in_geofence_verified ? 'Within geofence' : 'Outside geofence, ' + Math.round(data.check_in_distance_meters) + 'm from site center') : null
        })
      } else {
        setCurrentShift(null)
        setHoursWorked(0)
        setSiteDetails(null)
        setExceededMaxHours(false)
        setIsLate(false)
        setLateCheckInTime(null)
        setGraceEndTime(null)
        setGpsStatus('idle')
        setGpsCoords(null)
        setGeofence(null)
      }
    } catch (err) {
      console.error('Failed to fetch current shift:', err)
      setMessage({ type: 'error', text: 'Failed to load shift data' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleClockInSuccess = (data) => {
    // Set all state from the response data immediately to prevent UI from going blank
    setCurrentShift(data.shift)
    setSiteDetails(data.site || null)
    setIsLate(data.late || false)
    setLateCheckInTime(data.actual_check_in_time || null)
    setGraceEndTime(data.grace_end_time || null)
    setGpsStatus(data.site ? 'found' : 'idle')
    setGpsCoords(null)
    setHoursWorked(0)
    setExceededMaxHours(false)
    setMessage({
      type: data.late ? 'error' : 'success',
      text: data.late
        ? 'Clocked in late. A one-hour late penalty has been recorded.'
        : 'Successfully clocked in!'
    })
    setTimeout(() => setMessage({ type: '', text: '' }), 5000)
    // Delay the fetch to allow server transaction to commit, preventing race condition
    // where fetchCurrentShift returns no active shift and clears the UI
    setTimeout(() => {
      fetchCurrentShift()
    }, 1000)
  }

  const handleClockInError = (error) => {
    setMessage({ type: 'error', text: error.message || 'Failed to clock in' })
    setTimeout(() => setMessage({ type: '', text: '' }), 5000)
  }

  const handleClockOutClick = async () => {
    if (!currentShift) return

    // Fetch next guard information before showing handover modal
    try {
      setRefreshing(true)
      const data = await shiftsAPI.getNextGuard(currentShift.site_id, currentShift.date)
      setNextGuard(data.next_guard || null)
      setShowHandoverModal(true)
    } catch (err) {
      console.error('Failed to fetch next guard:', err)
      // Still show handover modal even if next guard fetch fails
      setShowHandoverModal(true)
    } finally {
      setRefreshing(false)
    }
  }

  const handleClockOut = async () => {
    if (!currentShift) return

    try {
      setSubmitting(true)
      
      const data = await shiftsAPI.clockOut({
        handover_notes: handoverNotes.trim(),
        next_guard_id: nextGuard?.id || null
      })
      const workedHours = Number(data.hours_worked || 0)
      const nextGuardName = nextGuard?.full_name || null
      setCurrentShift(null)
      setHandoverNotes('')
      setNextGuard(null)
      setShowHandoverModal(false)
      setHoursWorked(0)
      setClockOutSummary({ workedHours, nextGuardName })
      setIsLate(false)
      setLateCheckInTime(null)
      setGraceEndTime(null)
      setMessage({
        type: 'success',
        text: `Successfully clocked out. Hours worked: ${formatDuration(currentShift.check_in_time || currentShift.start_time, data.actual_check_out_time)}${nextGuardName ? `; next guard: ${nextGuardName}` : '; no next guard assigned'}.`
      })
      setTimeout(() => setMessage({ type: '', text: '' }), 5000)
    } catch (err) {
      console.error('Failed to clock out:', err)
      setMessage({ type: 'error', text: err.message || 'Failed to clock out' })
    } finally {
      setSubmitting(false)
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

  const formatDuration = (start, end) => {
    if (!start) return '--'
    const startTime = new Date(start)
    const endTime = end ? new Date(end) : new Date()
    const diffMs = endTime - startTime
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${diffHrs}h ${diffMins}m`
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
            <div className="text-lg text-gray-600">Loading...</div>
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
          <h1 className="text-3xl font-bold text-gray-900">Clock In / Clock Out</h1>
          <p className="text-gray-600 mt-1">Record your shift start and end times</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Message Alert */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            <p className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
              {message.text}
            </p>
          </div>
        )}

        {clockOutSummary && !currentShift && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-green-800">Last shift completed</p>
            <p className="text-sm text-green-700 mt-1">
              Hours worked: {clockOutSummary.workedHours.toFixed(2)}
              {clockOutSummary.nextGuardName ? ` | Next guard: ${clockOutSummary.nextGuardName}` : ' | No next guard assigned'}
            </p>
          </div>
        )}

        {/* LATE CLOCK-IN WARNING BANNER - RED */}
        {isLate && currentShift && (
          <div className="mb-6 bg-red-600 border-2 border-red-800 rounded-xl shadow-lg p-5 text-white">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-700 rounded-lg flex-shrink-0">
                <AlertOctagon className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold">LATE CLOCK-IN WARNING</p>
                <p className="text-sm text-red-100 mt-1">
                  You clocked in at <span className="font-semibold">{formatTime(lateCheckInTime || currentShift.check_in_time)}</span>, 
                  after the {formatTime(graceEndTime)} grace cutoff for your {currentShift.shift_type} shift.
                </p>
                <p className="text-sm text-red-200 mt-2">
                  A one-hour (KES {parseFloat(currentShift.hourly_rate || 234).toFixed(2)}) penalty has been deducted from
                  your pay and transferred to the covering guard. Your supervisor can reverse this if you have a valid reason.
                </p>
                <div className="mt-3 flex items-center gap-2 bg-red-700/50 rounded-lg p-2 px-3">
                  <Shield className="w-4 h-4" />
                  <p className="text-xs text-red-100">
                    If you believe this is a mistake, contact your supervisor or site supervisor immediately.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6AM/6PM Countdown Timer */}
        {milestone && (
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-sm p-6 mb-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  {milestone.milestone_type.includes('AM') ? (
                    <Sun className="w-6 h-6" />
                  ) : (
                    <Moon className="w-6 h-6" />
                  )
                }
                </div>
                <div>
                  <p className="text-sm font-medium text-white/80">Next Shift Transition</p>
                  <p className="text-lg font-bold">{milestone.milestone_type}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold font-mono tracking-wider">
                  {milestoneCountdown || milestone.display}
                </p>
                <p className="text-xs text-white/70 mt-1">
                  Until {milestone.milestone_type.split('(')[0].trim()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Current Shift Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#1a2a6c]" />
            Current Shift Status
          </h2>

          {currentShift ? (
            <div className="space-y-4">
              {/* Site Information */}
              {siteDetails && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">Assigned Site</p>
                      <p className="text-base font-bold text-blue-700 mt-1">{siteDetails.site_name}</p>
                      <p className="text-sm text-blue-600 mt-1">{siteDetails.location}</p>
                      <p className="text-xs text-blue-500 mt-1">{siteDetails.address}</p>
                      {siteDetails.contact_number && (
                        <p className="text-xs text-blue-500 mt-1">Contact: {siteDetails.contact_number}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* GPS Location Info */}
              {gpsCoords && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-3">
                  <div className="flex items-start gap-3">
                    <MapPinOff className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-900">GPS Location Verified</p>
                      <p className="text-xs text-green-700 mt-1">
                        Lat: {gpsCoords.latitude.toFixed(6)}, Lng: {gpsCoords.longitude.toFixed(6)}
                      </p>
                      <p className="text-xs text-green-600 mt-0.5">
                        Accuracy: ±{Math.round(gpsCoords.accuracy)}m
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Geofence Distance Info */}
              {geofence && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 {geofence.verified ? 'bg-green-100' : 'bg-red-100'} rounded-lg">
                      {geofence.verified ? (
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <MapPin className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Geofence Verification</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {geofence.verified ? 'Within geofence' : 'Outside geofence'}
                      </p>
                      {geofence.distance_meters !== null && (
                        <p className="text-xs text-gray-600 mt-0.5">
                          {geofence.distance_meters}m from site center{geofence.radius_meters !== null ? ', ' + (geofence.radius_meters || 50) + 'm maximum allowed' : ''}
                        </p>
                      )}
                      {geofence.message && (
                        <p className="text-xs text-gray-600 mt-0.5">{geofence.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Shift Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className={`rounded-lg p-4 ${isLate ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                  <p className="text-xs text-gray-500 uppercase">Status</p>
                  <p className={`text-lg font-bold ${isLate ? 'text-red-600' : 'text-green-600'}`}>
                    {isLate ? 'Late' : 'Active'}
                  </p>
                  {isLate && (
                    <p className="text-xs text-red-500 mt-1">Penalty applied</p>
                  )}
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase">Shift Type</p>
                  <p className="text-lg font-bold text-gray-900 capitalize">{currentShift.shift_type}</p>
                </div>
                <div className={`rounded-lg p-4 ${isLate ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                  <p className="text-xs text-gray-500 uppercase">Clock In Time</p>
                  <p className={`text-lg font-bold ${isLate ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatTime(currentShift.check_in_time || currentShift.start_time)}
                  </p>
                  {isLate && lateCheckInTime && graceEndTime && (
                    <p className="text-xs text-red-500 mt-1">
                      After {formatTime(graceEndTime)} cutoff
                    </p>
                  )}
                </div>
                <div className={`rounded-lg p-4 ${exceededMaxHours ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                  <p className="text-xs text-gray-500 uppercase">Hours Worked</p>
                  <p className={`text-lg font-bold font-mono ${exceededMaxHours ? 'text-red-600' : 'text-[#1a2a6c]'}`}>
                    {hoursWorked}
                  </p>
                  {exceededMaxHours && (
                    <p className="text-xs text-red-500 mt-1">Exceeded 12-hour limit</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleClockOutClick}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  <LogOut className="w-5 h-5" />
                  Clock Out
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Shift</h3>
              <p className="text-gray-600 mb-6">You are not currently clocked in</p>
              <button
                onClick={() => setShowClockInModal(true)}
                disabled={!!currentShift}
                className="px-6 py-3 bg-gradient-to-r from-[#1a2a6c] to-[#b21f1f] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clock In Now
              </button>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setShowClockInModal(true)}
              disabled={!!currentShift}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="p-3 bg-blue-100 rounded-lg">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Clock In</p>
                <p className="text-sm text-gray-500">Start your shift</p>
              </div>
            </button>
            <button
              onClick={handleClockOut}
              disabled={!currentShift}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="p-3 bg-red-100 rounded-lg">
                <LogOut className="w-6 h-6 text-red-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Clock Out</p>
                <p className="text-sm text-gray-500">End your shift</p>
              </div>
            </button>
          </div>
        </div>

        {/* GPS Location Verification Section */}
        {currentShift && !isLate && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#1a2a6c]" />
              GPS Location Verification
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Verify your location before clocking in to ensure you are within the site geofence.
            </p>
            
            {gpsStatus === 'idle' && (
              <button
                type="button"
                onClick={() => setGpsStatus('locating')}
                className="w-full flex items-center justify-center gap-2 p-3 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Navigation className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">Verify My Location</span>
              </button>
            )}

            {gpsStatus === 'locating' && (
              <div className="flex items-center justify-center gap-3 p-3 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-blue-700">Acquiring GPS location...</span>
              </div>
            )}

            {gpsStatus === 'found' && gpsCoords && (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-900">Location Verified</p>
                    <p className="text-xs text-green-700 mt-1">
                      Lat: {gpsCoords.latitude.toFixed(6)}, Lng: {gpsCoords.longitude.toFixed(6)}
                    </p>
                    <p className="text-xs text-green-600 mt-0.5">
                      Accuracy: ±{Math.round(gpsCoords.accuracy)}m
                    </p>
                  </div>
                </div>
              </div>
            )}

            {gpsStatus === 'denied' && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <MapPinOff className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Location Access Denied</p>
                    <p className="text-xs text-red-600 mt-1">{gpsError}</p>
                    <button
                      type="button"
                      onClick={() => setGpsStatus('locating')}
                      className="mt-1 text-xs font-medium text-red-700 underline hover:text-red-800"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            )}

            {gpsStatus === 'error' && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">GPS Error</p>
                    <p className="text-xs text-red-600 mt-1">{gpsError}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Clock In Modal */}
        <ShiftConfirmationModal
          isOpen={showClockInModal}
          onClose={() => setShowClockInModal(false)}
          onSuccess={handleClockInSuccess}
          onError={handleClockInError}
        />

        {/* Handover Notes Modal */}
        {showHandoverModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#1a2a6c]" />
                  Shift Handover Notes
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Before clocking out, please provide handover notes for the next guard
                </p>
              </div>

              <div className="p-6 space-y-4">
                {/* Next Guard Info */}
                {nextGuard && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <User className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">Next Guard Assigned</p>
                        <p className="text-sm text-blue-700 mt-1">
                          {nextGuard.full_name} ({nextGuard.work_number})
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          These notes will be sent to them automatically
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!nextGuard && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-900">No Next Guard Assigned</p>
                        <p className="text-xs text-yellow-700 mt-1">
                          No guard is currently scheduled for the next shift at this site. Your notes will be saved and can be viewed by your supervisor.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Handover Notes Textarea */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Handover Notes <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    placeholder="Please provide important information for the next guard:&#10;&#10;• Site-specific instructions or alerts&#10;• Equipment issues or requirements&#10;• Security concerns or incidents&#10;• Special instructions from supervisor&#10;• Any other relevant information"
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent resize-none"
                    rows={8}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Be thorough - this information is critical for the next guard's safety and performance
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => {
                    setShowHandoverModal(false)
                    setHandoverNotes('')
                    setNextGuard(null)
                  }}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClockOut}
                  disabled={submitting || !handoverNotes.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-[#1a2a6c] to-[#b21f1f] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <LogOut className="w-5 h-5" />
                  )}
                  <span>Submit & Clock Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GuardAttendance