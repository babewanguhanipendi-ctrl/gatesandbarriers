import { useEffect, useState } from 'react'
import { shiftsAPI } from '../../services/api'
import ShiftConfirmationModal from '../../components/ShiftConfirmationModal'
import { CheckCircle, Clock, LogIn, LogOut, RefreshCw, XCircle } from 'lucide-react'

const SupervisorAttendance = () => {
  const [currentShift, setCurrentShift] = useState(null)
  const [site, setSite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showClockInModal, setShowClockInModal] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    fetchCurrentShift()
    const interval = setInterval(fetchCurrentShift, 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const fetchCurrentShift = async () => {
    try {
      setRefreshing(true)
      const data = await shiftsAPI.getCurrentShift()
      setCurrentShift(data.has_active_shift ? data.shift : null)
      setSite(data.site || null)
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to load attendance data' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleClockOut = async () => {
    try {
      setSubmitting(true)
      await shiftsAPI.clockOut()
      setCurrentShift(null)
      setMessage({ type: 'success', text: 'Successfully clocked out' })
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to clock out' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96"><div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Supervisor Attendance</h1>
            <p className="text-gray-600 mt-1">Record your own shift attendance</p>
          </div>
          <button onClick={fetchCurrentShift} disabled={refreshing} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 disabled:opacity-50">
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {message.text && <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}{message.text}
        </div>}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6"><Clock className="text-[#1a2a6c]" /><h2 className="text-xl font-bold text-gray-900">Current Shift</h2></div>
          {currentShift ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 rounded-lg p-4"><p className="text-xs text-green-700 uppercase">Status</p><p className="text-lg font-bold text-green-800">Clocked In</p></div>
                <div className="bg-gray-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Shift Type</p><p className="text-lg font-bold capitalize">{currentShift.shift_type}</p></div>
                <div className="bg-gray-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Clock In</p><p className="text-lg font-bold">{new Date(currentShift.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p></div>
              </div>
              {site && <div className="bg-blue-50 border border-blue-200 rounded-lg p-4"><p className="text-sm font-medium text-blue-900">Assigned Site</p><p className="font-bold text-blue-800">{site.site_name}</p><p className="text-sm text-blue-700">{site.location}</p></div>}
              <button onClick={handleClockOut} disabled={submitting} className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"><LogOut size={18} /> {submitting ? 'Clocking out...' : 'Clock Out'}</button>
            </div>
          ) : (
            <div className="text-center py-8"><Clock className="w-14 h-14 text-gray-300 mx-auto mb-4" /><p className="text-gray-600 mb-5">You are not currently clocked in.</p><button onClick={() => setShowClockInModal(true)} className="flex items-center gap-2 mx-auto px-5 py-3 bg-[#1a2a6c] text-white rounded-lg hover:opacity-90"><LogIn size={18} /> Clock In</button></div>
          )}
        </div>
      </div>
      <ShiftConfirmationModal isOpen={showClockInModal} onClose={() => setShowClockInModal(false)} onSuccess={(data) => { setCurrentShift(data.shift); setSite(data.site || null); setMessage({ type: 'success', text: 'Successfully clocked in' }); setShowClockInModal(false) }} onError={(error) => setMessage({ type: 'error', text: error.message || 'Failed to clock in' })} />
    </div>
  )
}

export default SupervisorAttendance
