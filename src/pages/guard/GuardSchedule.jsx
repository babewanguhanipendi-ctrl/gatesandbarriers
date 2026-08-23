import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { Calendar, MapPin, Clock, RefreshCw, ChevronLeft, ChevronRight, User, Check, AlertCircle, Timer, Sun, Moon } from 'lucide-react'
import { shiftsAPI } from '../../services/api'

const GuardSchedule = () => {
  const { profile } = useAuth()
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0)
  const [respondingToShift, setRespondingToShift] = useState(null)
  const [responseNote, setResponseNote] = useState('')
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [selectedShift, setSelectedShift] = useState(null)
  const [currentStatus, setCurrentStatus] = useState({ is_clocked_in: false, active_shift: null })
  const [nextShift, setNextShift] = useState(null)
  const [countdown, setCountdown] = useState(null)
  // 6AM/6PM milestone countdown
  const [milestone, setMilestone] = useState(null)
  const [milestoneCountdown, setMilestoneCountdown] = useState('')

  useEffect(() => {
    fetchSchedule()
    fetchMilestone()
    
    // Refresh automatically once per hour; manual refresh remains available.
    const pollInterval = setInterval(() => {
      fetchSchedule()
      fetchMilestone()
    }, 60 * 60 * 1000)

    return () => clearInterval(pollInterval)
  }, [currentWeekOffset])

  // Update countdown timer every second
  useEffect(() => {
    const nextStartTime = nextShift?.scheduled_start_time || nextShift?.start_time
    if (!nextStartTime) {
      setCountdown(null)
      return
    }

    const updateCountdown = () => {
      const now = new Date()
      const target = new Date(nextStartTime)
      const diff = target - now

      if (diff <= 0) {
        setCountdown({ text: 'Now', expired: true })
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      if (hours > 0) {
        setCountdown({ text: `${hours}h ${minutes}m ${seconds}s`, expired: false })
      } else if (minutes > 0) {
        setCountdown({ text: `${minutes}m ${seconds}s`, expired: false })
      } else {
        setCountdown({ text: `${seconds}s`, expired: false })
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [nextShift])

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

  const getWeekRange = () => {
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() + (currentWeekOffset * 7) - now.getDay() + 1)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    return {
      start: startOfWeek,
      end: endOfWeek
    }
  }

  const fetchSchedule = async () => {
    try {
      setRefreshing(true)
      const data = await shiftsAPI.getMySchedule(currentWeekOffset)
      setShifts(data.shifts || [])
      setCurrentStatus(data.current_status || { is_clocked_in: false, active_shift: null })
      setNextShift(data.next_shift || null)
    } catch (error) {
      console.error('Error fetching schedule:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleAcceptShift = async (shiftId) => {
    setRespondingToShift(shiftId)
    try {
      const data = await shiftsAPI.respondToShift(shiftId, 'accept')
      alert(data.message || 'Shift accepted successfully')
      setRespondingToShift(null)
      fetchSchedule()
    } catch (error) {
      alert(error.message || 'Failed to accept shift')
      setRespondingToShift(null)
    }
  }

  const handleConcernClick = (shift) => {
    setSelectedShift(shift)
    setShowNoteModal(true)
    setResponseNote('')
  }

  const handleSubmitConcern = async () => {
    if (!selectedShift) return

    setRespondingToShift(selectedShift.id)
    try {
      const data = await shiftsAPI.respondToShift(selectedShift.id, 'concern', responseNote)
      alert(data.message || 'Your concern has been noted and the supervisor has been notified.')
      setShowNoteModal(false)
      setSelectedShift(null)
      setResponseNote('')
      setRespondingToShift(null)
      fetchSchedule()
    } catch (error) {
      alert(error.message || 'Failed to submit concern')
      setRespondingToShift(null)
    }
  }

  const weekRange = getWeekRange()
  const weekLabel = `${weekRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  const formatTime = (timestamp) => {
    if (!timestamp) return '--:--'
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    try {
      // If the string already contains a time component, parse it directly;
      // otherwise append midnight so it's treated as a local date.
      const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00')
      if (isNaN(d.getTime())) return ''
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    } catch (e) {
      return ''
    }
  }

  const getStatusBadge = (shift) => {
    if (!shift.check_in_time) {
      return { label: 'Scheduled', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' }
    }
    if (shift.check_in_time && !shift.end_time) {
      return { label: 'Active', class: 'bg-green-100 text-green-800 border-green-200' }
    }
    if (shift.end_time) {
      return { label: 'Completed', class: 'bg-blue-100 text-blue-800 border-blue-200' }
    }
    return { label: shift.status, class: 'bg-gray-100 text-gray-800 border-gray-200' }
  }

  const isOvertimeOrDifferentLocation = (shift) => {
    return shift.shift_type === 'overtime' || shift.allocation_type === 'temporary'
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
            <div className="text-lg text-gray-600">Loading schedule...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-950 via-sky-800 to-cyan-700">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-8 h-8 text-[#1a2a6c]" />
                My Schedule
              </h1>
              <p className="text-gray-600 mt-1">View your assigned shifts and upcoming schedule</p>
            </div>
            <button
              onClick={fetchSchedule}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Current Status Banner - Clocked In Indicator */}
      {currentStatus.is_clocked_in && currentStatus.active_shift && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-green-900">Clocked In</p>
                <p className="text-sm text-green-700">
                  {currentStatus.active_shift.site_client} - {currentStatus.active_shift.shift_type} shift{currentStatus.active_shift.is_overtime ? ' (Overtime)' : ''}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-green-600">Since {formatTime(currentStatus.active_shift.start_time)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Next Shift Countdown Timer */}
      {!currentStatus.is_clocked_in && nextShift && countdown && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Timer className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-blue-900">Next Shift</p>
                <p className="text-sm text-blue-700">
                  {nextShift.site_client} - {nextShift.shift_type} shift
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600 font-mono">
                {countdown.text}
              </p>
              <p className="text-xs text-blue-600">
                {formatTime(nextShift.scheduled_start_time || nextShift.start_time)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 6AM/6PM Milestone Countdown */}
      {milestone && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-sm p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  {milestone.milestone_type.includes('AM') ? (
                    <Sun className="w-5 h-5" />
                  ) : (
                    <Moon className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-white/80">Next Shift Transition</p>
                  <p className="text-sm font-bold">{milestone.milestone_type}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold font-mono tracking-wider">
                  {milestoneCountdown || milestone.display}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Week Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentWeekOffset(prev => prev - 1)}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous Week
            </button>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900">{weekLabel}</p>
              <p className="text-xs text-gray-500">
                {currentWeekOffset === 0 ? 'Current Week' : currentWeekOffset < 0 ? `${Math.abs(currentWeekOffset)} weeks ago` : `${currentWeekOffset} weeks ahead`}
              </p>
            </div>
            <button
              onClick={() => setCurrentWeekOffset(prev => prev + 1)}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Next Week
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {shifts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Shifts Scheduled</h3>
            <p className="text-gray-500 mb-2">
              You have no shifts assigned for this week.
            </p>
            <p className="text-sm text-gray-400">
              Shifts will appear here when your supervisor or manager assigns them to you.
              You will be notified immediately when a shift is allocated.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {shifts.map((shift) => {
              const badge = getStatusBadge(shift)
              const showResponseButtons = isOvertimeOrDifferentLocation(shift) && !shift.start_time
              const isOvertime = shift.is_overtime || shift.shift_type === 'overtime'
              
              return (
                <div key={shift.id} className={`bg-white rounded-xl shadow-sm border-2 p-6 hover:shadow-md transition-shadow ${
                  isOvertime ? 'border-purple-300' : 'border-gray-200'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-lg ${isOvertime ? 'bg-purple-100' : 'bg-[#1a2a6c]/10'}`}>
                          <Calendar className={`w-5 h-5 ${isOvertime ? 'text-purple-600' : 'text-[#1a2a6c]'}`} />
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-gray-900">{formatDate(shift.date)}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${badge.class}`}>
                              {badge.label}
                            </span>
                            {isOvertime && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium border bg-purple-100 text-purple-800 border-purple-200">
                                Overtime
                              </span>
                            )}
                            {shift.allocation_type === 'temporary' && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium border bg-orange-100 text-orange-800 border-orange-200">
                                Temporary Assignment
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <div>
                            <span className="font-medium">{shift.site_client || 'Unknown Site'}</span>
                            {shift.site_location && <span className="text-gray-500"> - {shift.site_location}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span>
                            {formatTime(shift.start_time || shift.scheduled_start_time)} - {formatTime(shift.end_time || shift.scheduled_end_time)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="capitalize">{shift.shift_type} Shift</span>
                        </div>
                      </div>

                      {shift.notes && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-xs text-yellow-800">{shift.notes}</p>
                        </div>
                      )}

                      {/* Response Buttons for Overtime/Temporary Shifts */}
                      {showResponseButtons && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-start gap-2 mb-3">
                            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-blue-800">Action Required</p>
                              <p className="text-xs text-blue-700 mt-1">
                                This is an {shift.shift_type === 'overtime' ? 'overtime' : 'additional'} shift assignment. Please respond to acknowledge receipt.
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAcceptShift(shift.id)}
                              disabled={respondingToShift === shift.id}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
                            >
                              {respondingToShift === shift.id ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  <span>Processing...</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-4 h-4" />
                                  <span>Accept</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleConcernClick(shift)}
                              disabled={respondingToShift === shift.id}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 text-sm"
                            >
                              <AlertCircle className="w-4 h-4" />
                              <span>No (Flag Concern)</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Note Modal for Concern */}
      {showNoteModal && selectedShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Flag a Concern</h3>
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Shift:</strong> {selectedShift.site_client} - {formatDate(selectedShift.date)}
              </p>
              <p className="text-sm text-yellow-800 mt-1">
                <strong>Type:</strong> {selectedShift.shift_type === 'overtime' ? 'Overtime' : 'Temporary Assignment'}
              </p>
            </div>
            <p className="text-sm text-gray-700 mb-4">
              You cannot decline an assigned shift, but you can flag a concern. Please provide a note explaining your concern. The supervisor will be notified.
            </p>
            <textarea
              value={responseNote}
              onChange={(e) => setResponseNote(e.target.value)}
              placeholder="Enter your concern or note (optional)..."
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent mb-4"
              rows={4}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSubmitConcern}
                disabled={respondingToShift === selectedShift.id}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                {respondingToShift === selectedShift.id ? 'Submitting...' : 'Submit Concern'}
              </button>
              <button
                onClick={() => {
                  setShowNoteModal(false)
                  setSelectedShift(null)
                  setResponseNote('')
                }}
                disabled={respondingToShift === selectedShift.id}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GuardSchedule