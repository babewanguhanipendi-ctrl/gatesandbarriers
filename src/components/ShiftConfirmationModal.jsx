import { useState, useEffect } from 'react'
import { shiftsAPI } from '../services/api'
import { X, Clock, MapPin, Check, AlertCircle, CheckCircle, Navigation, MapPinOff, ClipboardCheck } from 'lucide-react'

const ShiftConfirmationModal = ({ isOpen, onClose, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [assignedSite, setAssignedSite] = useState(null)
  const [siteLoading, setSiteLoading] = useState(true)
  const [shiftType, setShiftType] = useState('day')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedPreset, setSelectedPreset] = useState(null)
  const [gpsStatus, setGpsStatus] = useState('idle')
  const [gpsCoords, setGpsCoords] = useState(null)
  const [gpsError, setGpsError] = useState('')
  const [tiedToInspection, setTiedToInspection] = useState(false)
  const [geofence, setGeofence] = useState(null)

  // Auto-detect shift type based on current time: 6 AM - 6 PM = day, 6 PM - 6 AM = night
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 18) {
      setShiftType('day')
    } else {
      setShiftType('night')
    }
  }, [isOpen])

  // Determine if current time is past the 1-hour grace cutoff (7:00 AM or 7:00 PM)
  const isPastGraceCutoff = () => {
    const hour = new Date().getHours()
    const minutes = new Date().getMinutes()
    if (shiftType === 'day') {
      // Day shift: grace cutoff is 7:00 AM
      return hour > 7 || (hour === 7 && minutes > 0)
    } else if (shiftType === 'night') {
      // Night shift: grace cutoff is 7:00 PM
      return hour > 19 || (hour === 19 && minutes > 0)
    }
    return false
  }
  const lateWarning = isPastGraceCutoff()
  const graceTime = shiftType === 'night' ? '7:00 PM' : '7:00 AM'
  const shiftStartTime = shiftType === 'night' ? '6:00 PM' : '6:00 AM'

  const presetTimes = [
    { label: '6:00 AM', value: '06:00', icon: '🌅' },
    { label: '6:00 PM', value: '18:00', icon: '🌆' },
    { label: '7:00 AM', value: '07:00', icon: '☀️' },
    { label: '7:00 PM', value: '19:00', icon: '🌙' },
    { label: '8:00 AM', value: '08:00', icon: '🌞' },
    { label: '8:00 PM', value: '20:00', icon: '🌜' }
  ]

  useEffect(() => {
    if (isOpen) {
      fetchAssignedSite()
      // Update time every second
      const interval = setInterval(() => setCurrentTime(new Date()), 1000)
      return () => clearInterval(interval)
    }
  }, [isOpen])

  const fetchAssignedSite = async () => {
    try {
      setSiteLoading(true)
      setError('')
      const data = await shiftsAPI.getMyAssignedSite()
      setAssignedSite(data.site)
    } catch (err) {
      console.error('Failed to fetch assigned site:', err)
      setError(err.message || 'No site assignment found. Please contact your supervisor.')
      setAssignedSite(null)
    } finally {
      setSiteLoading(false)
    }
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus('error')
      setGpsError('Geolocation is not supported by this browser')
      return
    }
    setGpsStatus('locating')
    setGpsError('')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy })
        setGpsStatus('found')
      },
      (err) => {
        setGpsStatus('denied')
        setGpsError(err.message || 'Unable to get your location. Please enable GPS permissions.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const handleSubmit = async () => {
    if (!assignedSite) {
      setError('No site assigned. Please contact your supervisor.')
      return
    }

    setSubmitting(true)
    setError('')
    setGeofence(null)

    try {
      // Calculate start time based on preset or current time
      let startTime
      if (selectedPreset) {
        const [hours, minutes] = selectedPreset.split(':').map(Number)
        const now = new Date()
        startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0)
        
        // If the time is in the future, use it; otherwise assume it's for today
        if (startTime > now) {
          startTime = new Date(startTime.getTime() - 24 * 60 * 60 * 1000) // Yesterday
        }
      } else {
        startTime = new Date()
      }

      const data = await shiftsAPI.clockIn({
        site_id: assignedSite.id,
        shift_type: shiftType,
        start_time: startTime.toISOString(),
        latitude: gpsCoords?.latitude || null,
        longitude: gpsCoords?.longitude || null,
        accuracy: gpsCoords?.accuracy || null,
        tied_to_inspection: tiedToInspection
      })
      
      // Handle geofence response
      if (data.geofence) {
        setGeofence(data.geofence)
      }
      
      if (onSuccess) {
        onSuccess(data)
      }
      onClose()
    } catch (err) {
      console.error('Clock in error:', err)
      const errorMessage = err.message || 'Failed to clock in'
      setError(errorMessage)
      if (onError) {
        onError(err)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#1a2a6c]" />
              Clock In Confirmation
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Confirm your shift details before clocking in
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current Time */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-xs text-blue-600 font-medium uppercase">Current Time</p>
                <p className="text-lg font-bold text-blue-900">
                  {currentTime.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true 
                  })} 
                </p>
                <p className="text-xs text-blue-600">
                  {currentTime.toLocaleDateString('en-US', { 
                    weekday: 'long',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })} 
                </p>
              </div>
            </div>
          </div>

          {/* Preset Time Selection */}
          <div>
            <div className="grid grid-cols-3 gap-2">
              {presetTimes.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setSelectedPreset(preset.value)}
                  className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                    selectedPreset === preset.value
                      ? 'border-[#1a2a6c] bg-[#1a2a6c]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-xl">{preset.icon}</span>
                  <span className="text-sm font-medium text-gray-900">{preset.label}</span>
                  {selectedPreset === preset.value && (
                    <CheckCircle className="w-4 h-4 text-[#1a2a6c]" />
                  )}
                </button>
              ))}
            </div>
          </div>
          {/* GPS Location Verification */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              GPS Location Verification <span className="text-red-500">*</span>
            </label>
            {gpsStatus === 'idle' && (
              <button
                type="button"
                onClick={getCurrentLocation}
                className="w-full flex items-center justify-center gap-2 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Navigation className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">Verify My Location</span>
              </button>
            )}
            {gpsStatus === 'locating' && (
              <div className="flex items-center justify-center gap-3 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-blue-700">Acquiring GPS location...</span>
              </div>
            )}
            {gpsStatus === 'found' && gpsCoords && (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-green-900">Location Verified</p>
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
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <MapPinOff className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Location Access Denied</p>
                    <p className="text-xs text-red-600 mt-1">{gpsError}</p>
                    <button
                      type="button"
                      onClick={getCurrentLocation}
                      className="mt-2 text-xs font-medium text-red-700 underline hover:text-red-800"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            )}
            {gpsStatus === 'error' && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">GPS Error</p>
                    <p className="text-xs text-red-600 mt-1">{gpsError}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Geofence Distance Validation */}
          {geofence && (
            <div className={`mt-3 p-3 rounded-lg ${geofence.verified ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}${!geofence.verified && geofence.distance_meters !== null ? ' animate-pulse' : ''}`}>
              {geofence.distance_meters !== null ? (
                <div className="flex items-start gap-3">
                  {geofence.verified ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <MapPin className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold text-{geofence.verified ? 'green-900' : 'red-900'}">
                      {geofence.verified ? 'Successfully clocked in' : 'Clock-in failed'}
                    </p>
                    <p className="text-xs text-{geofence.verified ? 'green-700' : 'red-700'} mt-0.5">
                      {geofence.distance_meters}m from site center{geofence.distance_meters > 0 ? ', ' + (geofence.radius_meters || 50) + 'm maximum allowed' : ''}
                    </p>
                    {geofence.message && (
                      <p className="text-xs text-gray-700 mt-1">{geofence.message}</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Supervisor Inspection Tie-in */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="tied_to_inspection"
              checked={tiedToInspection}
              onChange={(e) => setTiedToInspection(e.target.checked)}
              className="w-4 h-4 text-[#1a2a6c] border-gray-300 rounded focus:ring-[#1a2a6c]"
            />
            <label htmlFor="tied_to_inspection" className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <ClipboardCheck size={16} />
              Tie this clock-in to my site inspection checklist
            </label>
          </div>

          {/* Auto-Fetched Site Assignment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assigned Site <span className="text-red-500">*</span>
            </label>
            {siteLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-6 h-6 border-2 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : assignedSite ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-green-900">{assignedSite.client}</p>
                    <p className="text-xs text-green-700">{assignedSite.location}</p>
                    {assignedSite.address && (
                      <p className="text-xs text-green-600 mt-0.5">{assignedSite.address}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">No Site Assignment Found</p>
                    <p className="text-xs text-red-600 mt-1">
                      You have not been assigned to any site. Please contact your supervisor or manager to get assigned before clocking in.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Shift Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Shift Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShiftType(shiftType === 'day' ? 'night' : 'day')}
                className={`p-4 rounded-lg border-2 transition-all ${shiftType === 'day' || shiftType === 'night' ? 'border-[#1a2a6c] bg-[#1a2a6c]/5' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className="text-center">
                  <p className="font-semibold text-gray-900">
                    {shiftType === 'day' ? 'Day Shift (6 AM - 6 PM)' : 'Night Shift (6 PM - 6 AM)'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {shiftType === 'day' ? 'Starts at 6:00 AM' : 'Starts at 6:00 PM'}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setShiftType('overtime')}
                className={`p-4 rounded-lg border-2 transition-all ${shiftType === 'overtime' ? 'border-[#fdbb2d] bg-[#fdbb2d]/5' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className="text-center">
                  <p className="font-semibold text-gray-900">Overtime</p>
                  <p className="text-xs text-gray-500 mt-1">Additional hours</p>
                </div>
              </button>
            </div>

            {/* Late Warning Banner - shows red when past 7:00 AM or 7:00 PM */}
            {shiftType !== 'overtime' && lateWarning && (
              <div className="mt-3 bg-red-50 border-2 border-red-400 rounded-lg p-4 flex items-start gap-3 animate-pulse">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-700">LATE CLOCK-IN WARNING</p>
                  <p className="text-xs text-red-600 mt-1">
                    The 1-hour grace period for the {shiftType} shift ended at {graceTime}.
                    Clocking in now will result in a late penalty
                    deducted from your pay and paid to the covering guard.
                  </p>
                  <p className="text-xs text-red-500 mt-2">
                    Your supervisor can reverse this penalty if you have a valid reason.
                  </p>
                </div>
              </div>
            )}

            {/* On-time info for normal shifts */}
            {shiftType !== 'overtime' && !lateWarning && (
              <p className="text-xs text-green-600 mt-3">
                ✓ You are within the 1-hour grace period. Your {shiftType} shift starts at {shiftStartTime} 
                with a grace cutoff at {graceTime}.
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Hourly Rate Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-600">
              <span className="font-medium">Pay:</span> The configured 12-hour shift rate applies.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !assignedSite}
            className={`flex-1 px-4 py-3 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 ${lateWarning && shiftType !== 'overtime' ? 'bg-red-600 hover:bg-red-700' : 'bg-gradient-to-r from-[#1a2a6c] to-[#b21f1f]'}`}
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
            <span>Confirm Clock In</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default ShiftConfirmationModal