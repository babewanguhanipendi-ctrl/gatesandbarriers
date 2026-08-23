import { useState, useEffect } from 'react'
import { managerAPI } from '../../services/api'
import ResponsiveTable from '../../components/ResponsiveTable'
import { Calendar, MapPin, User, Clock, Sun, Moon, AlertCircle, CheckCircle } from 'lucide-react'

const ManagerActiveShifts = () => {
  const [activeShifts, setActiveShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedShift, setSelectedShift] = useState(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetchActiveShifts()

    // Poll for active shifts so clock-ins appear promptly.
    const pollInterval = setInterval(() => {
      fetchActiveShifts()
    }, 10000)

    return () => clearInterval(pollInterval)
  }, [])

  const fetchActiveShifts = async () => {
    setLoading(true)
    try {
      const data = await managerAPI.getActiveShifts()
      setActiveShifts(data.activeShifts || [])
    } catch (error) {
      console.error('Error fetching active shifts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleShiftClick = (shift) => {
    setSelectedShift(shift)
    setShowModal(true)
  }

  const getShiftTypeBadge = (shiftType) => {
    const styles = {
      day: 'bg-yellow-100 text-yellow-800',
      night: 'bg-blue-100 text-blue-800',
      overtime: 'bg-purple-100 text-purple-800'
    }
    const icons = {
      day: Sun,
      night: Moon,
      overtime: AlertCircle
    }
    const Icon = icons[shiftType] || Calendar
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[shiftType] || 'bg-gray-100 text-gray-800'}`}>
        <Icon size={12} />
        {shiftType ? shiftType.charAt(0).toUpperCase() + shiftType.slice(1) : 'Unknown'}
      </span>
    )
  }

  const columns = [
    { key: 'site_name', label: 'Site', render: (row) => (
      <div>
        <div className="font-medium text-gray-900">{row.site_name || 'N/A'}</div>
        <div className="text-xs text-gray-500">{row.site_location || ''}</div>
        <div className="text-xs text-gray-400">Required: {row.required_guards} guard(s)</div>
      </div>
    )},
    { key: 'shift_status', label: 'Status', render: (row) => {
      const statusConfig = {
        clocked_in: { bg: 'bg-green-100 text-green-800', label: 'Clocked In', icon: CheckCircle },
        scheduled: { bg: 'bg-yellow-100 text-yellow-800', label: 'Scheduled (Not Clocked In)', icon: Clock },
        assigned: { bg: 'bg-blue-100 text-blue-800', label: 'Assigned (Not Clocked In)', icon: User },
        unassigned: { bg: 'bg-red-100 text-red-800', label: 'UNASSIGNED - No Guard', icon: AlertCircle }
      }
      const config = row.clock_out_method === 'auto'
        ? { bg: 'bg-orange-100 text-orange-800', label: 'Auto Clocked Out', icon: AlertCircle }
        : row.clock_in_method === 'auto'
          ? { bg: 'bg-orange-100 text-orange-800', label: 'Auto Clocked In', icon: AlertCircle }
        : row.clock_in_method === 'supervisor'
          ? { bg: 'bg-indigo-100 text-indigo-800', label: 'Clocked In by Supervisor', icon: User }
          : row.is_late
        ? { bg: 'bg-red-100 text-red-800', label: 'Late Clock-in', icon: AlertCircle }
        : (statusConfig[row.shift_status] || statusConfig.unassigned)
      const Icon = config.icon
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg}`}>
          <Icon size={12} />
          {config.label}
        </span>
      )
    }},
    { key: 'guard_name', label: 'Assigned Guard', render: (row) => (
      <div className="flex items-center gap-2">
        {row.guard_name ? (
          <>
            <div className={`w-8 h-8 rounded-full ${row.is_late ? 'bg-red-600' : 'bg-gradient-to-br from-[#1a2a6c] to-[#b21f1f]'} flex items-center justify-center text-white font-semibold text-xs`}>
              {row.guard_name?.charAt(0) || 'G'}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">{row.guard_name}</div>
              <div className="text-xs text-gray-500">{row.guard_work_number}</div>
            </div>
          </>
        ) : (
          <span className="text-red-600 font-medium">UNASSIGNED</span>
        )}
      </div>
    )},
    { key: 'supervisor_name', label: 'Supervisor', render: (row) => (
      <div className="flex items-center gap-2">
        {row.supervisor_name ? (
          <>
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white font-semibold text-xs">
              {row.supervisor_name?.charAt(0) || 'S'}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">{row.supervisor_name}</div>
              <div className="text-xs text-gray-500">{row.supervisor_work_number || 'N/A'}</div>
            </div>
          </>
        ) : (
          <span className="text-gray-400">Not assigned</span>
        )}
      </div>
    )},    { key: 'shift_type', label: 'Shift Type', render: (row) => 
      row.shift_type ? getShiftTypeBadge(row.shift_type) : <span className="text-gray-400">--</span>
    },
    { key: 'check_in_time', label: 'Check In Time', render: (row) => 
      (row.check_in_time || row.start_time) ? new Date(row.check_in_time || row.start_time).toLocaleTimeString() : <span className="text-gray-400">Not checked in</span>
    },
    { key: 'check_out_time', label: 'Check Out', render: (row) => 
      (row.check_out_time || row.end_time) ? (
        <div>
          <div>{new Date(row.check_out_time || row.end_time).toLocaleTimeString()}</div>
          {row.clock_out_method === 'auto' && <div className="text-xs text-orange-700">Auto clocked out</div>}
        </div>
      ) : <span className="text-gray-400">Not checked out</span>
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Active Shifts</h1>
          <p className="text-gray-600 mt-1">View all active shifts with guard and site information</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Legend */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Shift Status Legend:</h3>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-800">
                <CheckCircle size={12} /> Clocked In
              </span>
              <span className="text-gray-600">Guard has checked in and is on site</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                <Clock size={12} /> Scheduled
              </span>
              <span className="text-gray-600">Shift scheduled but guard hasn't clocked in yet</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-800">
                <AlertCircle size={12} /> UNASSIGNED
              </span>
              <span className="text-gray-600">No guard assigned - site needs coverage!</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <ResponsiveTable
            columns={columns}
            rows={activeShifts}
            onRowClick={handleShiftClick}
            loading={loading}
            emptyMessage="No active shifts found"
          />
        </div>
      </div>

      {/* Shift Details Modal */}
      {showModal && selectedShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Shift Details</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Site</label>
                <p className="text-gray-900">{selectedShift.site_name}</p>
                <p className="text-sm text-gray-500">{selectedShift.site_location}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Guard</label>
                <p className="text-gray-900">{selectedShift.guard_name || 'Unassigned'}</p>
                <p className="text-sm text-gray-500">Work #: {selectedShift.guard_work_number || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Supervisor</label>
                <p className="text-gray-900">{selectedShift.supervisor_name || 'Not assigned'}</p>
                <p className="text-sm text-gray-500">Work #: {selectedShift.supervisor_work_number || 'N/A'}</p>
              </div>              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Shift Type</label>
                <div className="mt-1">{getShiftTypeBadge(selectedShift.shift_type)}</div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Date</label>
                <p className="text-gray-900">{new Date(selectedShift.date).toLocaleDateString()}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Status</label>
                <p className="text-gray-900 capitalize">{(selectedShift.shift_status || selectedShift.status || 'unassigned').replace(/_/g, ' ')}</p>
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

export default ManagerActiveShifts
