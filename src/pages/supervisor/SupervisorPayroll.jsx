import { useState, useEffect } from 'react'
import { shiftsAPI, usersAPI, sitesAPI, businessLogicAPI, supervisorAPI } from '../../services/api'
import { DollarSign, Calendar, User, MapPin, Clock, AlertCircle, RefreshCw, Download, Printer, Eye } from 'lucide-react'

const SupervisorPayroll = () => {
  const [shifts, setShifts] = useState([])
  const [guards, setGuards] = useState([])
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [selectedGuard, setSelectedGuard] = useState('all')
  const [payrollSummary, setPayrollSummary] = useState([])
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [selectedGuardPayroll, setSelectedGuardPayroll] = useState(null)

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
      
      // Calculate payroll summary for all guards
      calculatePayrollSummary(shiftsData.shifts || [])
    } catch (error) {
      console.error('Error fetching payroll data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculatePayrollSummary = (shiftsData) => {
    const guardMap = new Map()
    
    shiftsData.forEach(shift => {
      if (!guardMap.has(shift.guard_id)) {
        guardMap.set(shift.guard_id, {
          guard_id: shift.guard_id,
          guard_name: shift.guard_name,
          guard_work_number: shift.guard_work_number,
          site_id: shift.site_id,
          site_client: shift.site_client,
          total_hours: 0,
          total_pay: 0,
          day_shifts: 0,
          night_shifts: 0,
          overtime_shifts: 0,
          overtime_pay: 0
        })
      }
      
      const guard = guardMap.get(shift.guard_id)
      const hours = calculateHours(shift.start_time, shift.end_time)
      const pay = calculateShiftPay(shift)
      
      guard.total_hours += hours
      guard.total_pay += pay
      
      if (shift.shift_type === 'day') guard.day_shifts++
      else if (shift.shift_type === 'night') guard.night_shifts++
      else if (shift.shift_type === 'overtime') {
        guard.overtime_shifts++
        guard.overtime_pay += pay
      }
    })
    
    setPayrollSummary(Array.from(guardMap.values()))
  }

  const calculateHours = (start, end) => {
    if (!start) return 0
    const startTime = new Date(start)
    const endTime = end ? new Date(end) : new Date()
    const diffMs = endTime - startTime
    return diffMs / (1000 * 60 * 60)
  }

  const calculateShiftPay = (shift) => {
    return Number(shift.daily_rate ?? (shift.role === 'supervisor' ? 400 : 254))
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

  const handleViewReceipt = async (guard) => {
    try {
      const payrollData = await businessLogicAPI.calculateMonthlyPay(guard.guard_id, selectedMonth)
      setSelectedGuardPayroll({ ...guard, ...payrollData })
      setShowReceiptModal(true)
    } catch (error) {
      console.error('Error fetching payroll details:', error)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  // Calculate totals
  const totalPayroll = payrollSummary.reduce((sum, guard) => sum + guard.total_pay, 0)
  const totalHours = payrollSummary.reduce((sum, guard) => sum + guard.total_hours, 0)
  const totalOvertimePay = payrollSummary.reduce((sum, guard) => sum + guard.overtime_pay, 0)

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
          <h1 className="text-3xl font-bold text-gray-900">Payroll Overview</h1>
          <p className="text-gray-600 mt-1">Monitor guard payroll and attendance for your sites</p>
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
                <p className="text-2xl font-bold text-amber-600">KES {totalOvertimePay.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Payroll</p>
                <p className="text-2xl font-bold text-green-600">KES {totalPayroll.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Payroll Summary Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#1a2a6c]" />
              Payroll Summary
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {payrollSummary.length} guards for {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>

          {payrollSummary.length === 0 ? (
            <div className="p-12 text-center">
              <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Payroll Data</h3>
              <p className="text-gray-600">No shift records found for the selected period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guard</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Site</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Day Shifts</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Night Shifts</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Overtime</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Pay</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payrollSummary.map((guard) => (
                    <tr key={guard.guard_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-gray-400" />
                          <div>
                            <span className="font-medium text-gray-900">{guard.guard_name}</span>
                            <p className="text-xs text-gray-500">{guard.guard_work_number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <MapPin size={14} className="text-gray-400" />
                          <span className="text-sm text-gray-900">{guard.site_client || 'Unassigned'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{guard.day_shifts}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{guard.night_shifts}</td>
                      <td className="px-6 py-4">
                        {guard.overtime_shifts > 0 && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                            {guard.overtime_shifts} shifts
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{guard.total_hours.toFixed(1)}h</td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-900">KES {guard.total_pay.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleViewReceipt(guard)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-[#1a2a6c] text-white text-sm rounded-lg hover:bg-[#1a2a6c]/90 transition-colors"
                        >
                          <Eye size={14} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Payroll Receipt Modal */}
      {showReceiptModal && selectedGuardPayroll && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:static print:bg-white">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto print:shadow-none print:max-w-none">
            <div className="p-6 border-b border-gray-200 print:hidden">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Payroll Receipt</h2>
                  <p className="text-sm text-gray-600">
                    {selectedGuardPayroll.guard_name} - {selectedGuardPayroll.guard_work_number}
                  </p>
                </div>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <AlertCircle className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Printable Receipt */}
            <div className="p-8" id="printable-receipt">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">GATES & BARRIERS SECURITY</h1>
                <p className="text-gray-600">Payroll Receipt</p>
                <p className="text-sm text-gray-500">
                  Month: {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              </div>

              <div className="border-2 border-gray-200 rounded-lg p-6 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Employee Name</p>
                    <p className="font-medium text-gray-900">{selectedGuardPayroll.guard_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Work Number</p>
                    <p className="font-medium text-gray-900">{selectedGuardPayroll.guard_work_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Site</p>
                    <p className="font-medium text-gray-900">{selectedGuardPayroll.site_client || 'Unassigned'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Total Hours</p>
                    <p className="font-medium text-gray-900">{selectedGuardPayroll.total_hours.toFixed(1)}h</p>
                  </div>
                </div>
              </div>

              <div className="border-2 border-gray-200 rounded-lg overflow-hidden mb-6">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Amount (KES)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">Day Shifts ({selectedGuardPayroll.day_shifts})</p>
                          <p className="text-xs text-gray-500">Regular day shift payments</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        KES {(selectedGuardPayroll.day_shifts * 1200).toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">Night Shifts ({selectedGuardPayroll.night_shifts})</p>
                          <p className="text-xs text-gray-500">Regular night shift payments</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        KES {(selectedGuardPayroll.night_shifts * 1400).toLocaleString()}
                      </td>
                    </tr>
                    {selectedGuardPayroll.overtime_shifts > 0 && (
                      <tr>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">Overtime ({selectedGuardPayroll.overtime_shifts} shifts)</p>
                            <p className="text-xs text-gray-500">One daily rate per shift</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-amber-600">
                          KES {selectedGuardPayroll.overtime_pay.toLocaleString()}
                        </td>
                      </tr>
                    )}
                    <tr className="bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="text-lg font-bold text-gray-900">Gross Pay</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-xl font-bold text-gray-900">KES {selectedGuardPayroll.total_pay.toLocaleString()}</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This receipt is auto-generated based on completed shifts for the selected month.
                  Deductions (uniform, penalties) will be applied separately.
                </p>
              </div>

              <div className="flex justify-end gap-3 print:hidden">
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 flex items-center gap-2"
                >
                  <Printer size={16} />
                  Print Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SupervisorPayroll