import { useState, useEffect } from 'react'
import { shiftsAPI, usersAPI, sitesAPI } from '../../services/api'
import { DollarSign, Calendar, User, MapPin, Clock, AlertCircle, RefreshCw } from 'lucide-react'

const SecretaryPayroll = () => {
  const [shifts, setShifts] = useState([])
  const [guards, setGuards] = useState([])
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [selectedGuard, setSelectedGuard] = useState('all')

  useEffect(() => {
    fetchData()
  }, [selectedMonth, selectedGuard])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [guardsData, sitesData, shiftsData] = await Promise.all([
        usersAPI.getGuards(),
        sitesAPI.getAll(),
        shiftsAPI.getAll({
          date_from: `${selectedMonth}-01`,
          date_to: `${selectedMonth}-31`,
          ...(selectedGuard !== 'all' && { guard_id: selectedGuard })
        })
      ])
      setGuards(guardsData.users || [])
      setSites(sitesData.sites || [])
      setShifts(shiftsData.shifts || [])
    } catch (error) {
      console.error('Error fetching payroll data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (start, end) => {
    if (!start) return 0
    const startTime = new Date(start)
    const endTime = end ? new Date(end) : new Date()
    const diffMs = endTime - startTime
    return diffMs / (1000 * 60 * 60) // Return hours
  }

  const calculateShiftPay = (shift) => {
    return Number(shift.daily_rate ?? (shift.role === 'supervisor' ? 400 : 254))
  }

  const getOvertimeMultiplier = (shiftType) => {
    return shiftType === 'overtime' ? 1.5 : 1
  }

  const getShiftTypeColor = (shiftType) => {
    switch (shiftType) {
      case 'day': return 'bg-blue-100 text-blue-800'
      case 'night': return 'bg-purple-100 text-purple-800'
      case 'overtime': return 'bg-amber-100 text-amber-800'
      default: return 'bg-gray-100 text-gray-800'
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

  // Calculate totals
  const totalHours = shifts.reduce((sum, shift) => sum + formatDuration(shift.start_time, shift.end_time), 0)
  const totalPay = shifts.reduce((sum, shift) => sum + calculateShiftPay(shift), 0)
  const overtimeShifts = shifts.filter(s => s.shift_type === 'overtime')
  const overtimePay = overtimeShifts.reduce((sum, shift) => sum + calculateShiftPay(shift), 0)

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
          <h1 className="text-3xl font-bold text-gray-900">Payroll & Attendance</h1>
          <p className="text-gray-600 mt-1">Calculate and review guard payroll with overtime handling</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Month
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Guard
              </label>
              <select
                value={selectedGuard}
                onChange={(e) => setSelectedGuard(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
              >
                <option value="all">All Guards</option>
                {guards.map((guard) => (
                  <option key={guard.id} value={guard.id}>
                    {guard.full_name} ({guard.work_number})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 transition-colors"
              >
                <RefreshCw size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Hours</p>
                <p className="text-2xl font-bold text-gray-900">{totalHours.toFixed(1)}h</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Overtime Pay</p>
                <p className="text-2xl font-bold text-amber-600">KES {overtimePay.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Pay</p>
                <p className="text-2xl font-bold text-green-600">KES {totalPay.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Shifts Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#1a2a6c]" />
              Shift Records
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {shifts.length} shifts for {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>

          {shifts.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Shifts Found</h3>
              <p className="text-gray-600">No shift records found for the selected period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guard</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Site</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shift Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Multiplier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {shifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-gray-400" />
                          <span className="font-medium text-gray-900">{shift.guard_name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-gray-400" />
                          <span className="text-gray-900">
                            {(() => {
                              const site = sites.find(s => s.id === shift.site_id)
                              return site ? `${site.client_name} - ${site.location}` : 'Unassigned'
                            })()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getShiftTypeColor(shift.shift_type)}`}>
                          {shift.shift_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(shift.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatTime(shift.start_time)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatTime(shift.end_time)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatDuration(shift.start_time, shift.end_time).toFixed(1)}h
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        KES {(shift.daily_rate || 254).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-medium ${shift.shift_type === 'overtime' ? 'text-amber-600' : 'text-gray-600'}`}>
                          {getOvertimeMultiplier(shift.shift_type)}x
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-semibold ${shift.shift_type === 'overtime' ? 'text-amber-600' : 'text-gray-900'}`}>
                          KES {calculateShiftPay(shift).toLocaleString()}
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
    </div>
  )
}

export default SecretaryPayroll