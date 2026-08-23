import { useState, useEffect } from 'react'
import { directorAPI, usersAPI, shiftsAPI, sitesAPI, financialAPI, businessLogicAPI } from '../../services/api'
import ResponsiveTable from '../../components/ResponsiveTable'
import { FileText, Download, Calendar, User, MapPin, Clock, DollarSign, Printer, CheckCircle, XCircle, Eye, Banknote, RefreshCw } from 'lucide-react'

const DirectorPayroll = () => {
  const [guards, setGuards] = useState([])
  const [sites, setSites] = useState([])
  const [shifts, setShifts] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [selectedGuard, setSelectedGuard] = useState('all')
  const [loading, setLoading] = useState(true)
  const [generatingReceipt, setGeneratingReceipt] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [selectedGuardPayroll, setSelectedGuardPayroll] = useState(null)
  const [payrollSummary, setPayrollSummary] = useState([])
  
  // New state for payroll sign-off
  const [payrollRuns, setPayrollRuns] = useState([])
  const [payrollFilter, setPayrollFilter] = useState('pending_approval')
  const [selectedPayrollRun, setSelectedPayrollRun] = useState(null)
  const [showPayrollDetailModal, setShowPayrollDetailModal] = useState(false)
  
  // Treasury disbursements state
  const [disbursements, setDisbursements] = useState([])
  const [disbursementFilter, setDisbursementFilter] = useState('all')
  const [loadingDisbursements, setLoadingDisbursements] = useState(false)

  useEffect(() => {
    fetchPayrollData()
    fetchPayrollRuns()
  }, [selectedMonth, selectedGuard, payrollFilter])

  const fetchPayrollData = async () => {
    try {
      setLoading(true)
      
      // Get the last day of the selected month
      const [year, month] = selectedMonth.split('-')
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
      
      const [guardsData, sitesData, shiftsData] = await Promise.all([
        usersAPI.getGuards({ status: 'active' }),
        sitesAPI.getAll(),
        shiftsAPI.getAll({
          date_from: `${selectedMonth}-01`,
          date_to: `${selectedMonth}-${lastDay.toString().padStart(2, '0')}`,
          ...(selectedGuard !== 'all' && { guard_id: selectedGuard })
        })
      ])
      
      const guardsList = guardsData.users || []
      const sitesList = sitesData.sites || []
      const shiftsList = shiftsData.shifts || []
      
      setGuards(guardsList)
      setSites(sitesList)
      setShifts(shiftsList)
      
      // Calculate payroll summary
      calculatePayrollSummary(shiftsList, guardsList, sitesList)
    } catch (error) {
      console.error('Error fetching payroll data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculatePayrollSummary = (shiftsData, guardsList, sitesList) => {
    // Create lookup maps for guards and sites
    const guardsMap = new Map()
    guardsList.forEach(guard => {
      guardsMap.set(guard.id, guard)
    })
    
    const sitesMap = new Map()
    sitesList.forEach(site => {
      sitesMap.set(site.id, site)
    })
    
    const guardMap = new Map()
    
    shiftsData.forEach(shift => {
      if (!guardMap.has(shift.guard_id)) {
        // Look up guard and site details
        const guard = guardsMap.get(shift.guard_id)
        const site = sitesMap.get(shift.site_id)
        
        guardMap.set(shift.guard_id, {
          guard_id: shift.guard_id,
          guard_name: guard?.full_name || shift.guard_name || `Guard ${shift.guard_id}`,
          guard_work_number: guard?.work_number || shift.guard_work_number || 'N/A',
          site_id: shift.site_id,
          site_client: site?.client_name || shift.site_client || 'Unassigned',
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
    
    const summary = Array.from(guardMap.values())
    setPayrollSummary(summary)
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

  const fetchPayrollRuns = async () => {
    try {
      const response = await directorAPI.getPayrollSummaries({ 
        status: payrollFilter, 
        location: 'all' 
      })
      setPayrollRuns(response.payrollRuns || [])
    } catch (error) {
      console.error('Error fetching payroll runs:', error)
    }
  }

  const fetchDisbursements = async () => {
    setLoadingDisbursements(true)
    try {
      const response = await directorAPI.getDisbursements({ 
        status: disbursementFilter 
      })
      setDisbursements(response.disbursements || [])
    } catch (error) {
      console.error('Error fetching disbursements:', error)
    } finally {
      setLoadingDisbursements(false)
    }
  }

  useEffect(() => {
    fetchDisbursements()
  }, [disbursementFilter])

  const handlePayrollSignOff = async (payrollRunId, action) => {
    try {
      await directorAPI.signOffPayroll(payrollRunId, { action, notes: '' })
      fetchPayrollRuns()
      alert(`Payroll ${action === 'approve' ? 'approved' : 'rejected'} successfully`)
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to process payroll sign-off')
      console.error('Payroll sign-off error:', error)
    }
  }

  const viewPayrollDetail = (payrollRun) => {
    setSelectedPayrollRun(payrollRun)
    setShowPayrollDetailModal(true)
  }

  const handleViewReceipt = async (guard) => {
    try {
      console.log('Fetching receipt for guard:', guard)
      
      // Use guard data from the payroll summary table
      let mergedData = { ...guard }
      
      // Try to fetch additional payroll details from API
      try {
        const payrollData = await businessLogicAPI.calculateMonthlyPay(guard.guard_id, selectedMonth)
        console.log('Payroll data:', payrollData)
        
        // Map API response fields to frontend fields
        if (payrollData.guardName) mergedData.guard_name = payrollData.guardName
        if (payrollData.siteName) mergedData.site_client = payrollData.siteName
        if (payrollData.workNumber) mergedData.guard_work_number = payrollData.workNumber
        
        mergedData = { ...mergedData, ...payrollData }
      } catch (payrollError) {
        console.warn('Could not fetch payroll details, using table data:', payrollError)
        // Continue with table data if payroll API fails
      }
      
      console.log('Final receipt data:', mergedData)
      
      setSelectedGuardPayroll(mergedData)
      setShowReceiptModal(true)
    } catch (error) {
      console.error('Error fetching payroll details:', error)
      alert(`Failed to load payroll details: ${error.message}`)
    }
  }

  const handlePrint = () => {
    // Print only the receipt modal content, not the entire page
    const printContent = document.getElementById('printable-receipt')
    if (printContent) {
      const printWindow = window.open('', '_blank', 'width=800,height=600')
      printWindow.document.write(`
        <html>
          <head>
            <title>Payroll Receipt</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              .text-center { text-align: center; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
              th { background-color: #f5f5f5; font-weight: bold; }
              .font-bold { font-weight: bold; }
              .text-xl { font-size: 1.25rem; }
              .text-2xl { font-size: 1.5rem; }
              .mb-6 { margin-bottom: 1.5rem; }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
        printWindow.close()
      }, 250)
    }
  }

  // Calculate totals
  const totalPayroll = payrollSummary.reduce((sum, guard) => sum + guard.total_pay, 0)
  const totalHours = payrollSummary.reduce((sum, guard) => sum + guard.total_hours, 0)
  const totalOvertimePay = payrollSummary.reduce((sum, guard) => sum + guard.overtime_pay, 0)

  const getStatusBadge = (status) => {
    const colors = {
      pending_approval: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      disbursed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800',
      draft: 'bg-gray-100 text-gray-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
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
          <h1 className="text-3xl font-bold text-gray-900">Payroll Management & Sign-off</h1>
          <p className="text-gray-600 mt-1">Review, approve payroll runs and manage treasury disbursements</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Payroll Runs Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#1a2a6c]" />
                Payroll Runs - Final Authorization
              </h2>
              <select
                value={payrollFilter}
                onChange={(e) => setPayrollFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
              >
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="disbursed">Disbursed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Run Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guards</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gross (KES)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deductions (KES)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Payable (KES)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payrollRuns.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-8 text-center text-gray-500">
                      No payroll runs found
                    </td>
                  </tr>
                ) : (
                  payrollRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">{run.run_date}</td>
                      <td className="px-6 py-4 text-sm">
                        {run.period_start} to {run.period_end}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          {run.location?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">{run.guard_count}</td>
                      <td className="px-6 py-4 text-sm text-right">
                        {parseFloat(run.total_gross_amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right">
                        {parseFloat(run.total_deductions).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold">
                        {parseFloat(run.total_net_amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadge(run.status)}`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {run.status === 'pending_approval' && (
                            <>
                              <button
                                onClick={() => handlePayrollSignOff(run.id, 'approve')}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Approve"
                              >
                                <CheckCircle size={18} />
                              </button>
                              <button
                                onClick={() => handlePayrollSignOff(run.id, 'reject')}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Reject"
                              >
                                <XCircle size={18} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => viewPayrollDetail(run)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="View Details"
                          >
                            <Eye size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Individual Guard Receipts Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#1a2a6c]" />
              Individual Guard Receipts
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Review and generate payroll receipts for individual guards
            </p>
          </div>
          
          {/* Filters */}
          <div className="p-6 border-b border-gray-200">
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
                  onClick={fetchPayrollData}
                  className="px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 transition-colors"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Director Features Toolbar */}
          <div className="px-6 pb-4 flex flex-col sm:flex-row gap-3 justify-between items-center">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => alert('Bulk receipt generation initiated for all guards')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
              >
                <FileText size={16} />
                Generate All Receipts
              </button>
              <button
                onClick={() => alert('Exporting payroll data to Excel...')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
              >
                <Download size={16} />
                Export to Excel
              </button>
              <button
                onClick={() => alert('Sending payroll summary to email...')}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 text-sm"
              >
                <Printer size={16} />
                Email Summary
              </button>
            </div>
            <div className="text-sm text-gray-600">
              Showing {payrollSummary.length} guard(s)
            </div>
          </div>

          {/* Payroll Summary Table */}
          <div className="px-6 pb-6">
            {payrollSummary.length === 0 ? (
              <div className="p-12 text-center">
                <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Payroll Data</h3>
                <p className="text-gray-600">No shift records found for the selected period</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
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
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewReceipt(guard)}
                              className="p-1.5 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 transition-colors"
                              title="View Receipt"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => alert('Downloading receipt for ' + guard.guard_name)}
                              className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                              title="Download Receipt"
                            >
                              <Download size={16} />
                            </button>
                            <button
                              onClick={() => alert('Printing receipt for ' + guard.guard_name)}
                              className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                              title="Print Receipt"
                            >
                              <Printer size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Treasury Disbursements Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-[#1a2a6c]" />
                Treasury Disbursements
              </h2>
              <select
                value={disbursementFilter}
                onChange={(e) => setDisbursementFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Disbursement Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payroll Run</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount (KES)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Method</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Approved By</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loadingDisbursements ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
                        <span className="text-gray-500">Loading disbursements...</span>
                      </div>
                    </td>
                  </tr>
                ) : disbursements.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                      No treasury disbursements found
                    </td>
                  </tr>
                ) : (
                  disbursements.map((disbursement) => (
                    <tr key={disbursement.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">{disbursement.disbursement_date}</td>
                      <td className="px-6 py-4 text-sm">
                        {disbursement.period_start} to {disbursement.period_end}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          {disbursement.payroll_location?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-semibold">
                        KES {parseFloat(disbursement.total_amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm capitalize">
                        {disbursement.payment_method?.replace('_', ' ') || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {disbursement.reference_number || 'Pending'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          disbursement.status === 'completed' ? 'bg-green-100 text-green-800' :
                          disbursement.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                          disbursement.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          disbursement.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {disbursement.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {disbursement.approved_by_name || 'N/A'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
                  <XCircle className="w-5 h-5 text-gray-500" />
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
                    <p className="font-medium text-gray-900">{selectedGuardPayroll.guard_name || selectedGuardPayroll.full_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Work Number</p>
                    <p className="font-medium text-gray-900">{selectedGuardPayroll.guard_work_number || selectedGuardPayroll.work_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Site</p>
                    <p className="font-medium text-gray-900">{selectedGuardPayroll.site_client || selectedGuardPayroll.site_name || 'Unassigned'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Total Shifts</p>
                    <p className="font-medium text-gray-900">{selectedGuardPayroll.totalShifts || (selectedGuardPayroll.day_shifts + selectedGuardPayroll.night_shifts + selectedGuardPayroll.overtime_shifts) || 0}</p>
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
                          <p className="font-medium text-gray-900">Base Pay</p>
                          <p className="text-xs text-gray-500">Day: {selectedGuardPayroll.dayShifts || selectedGuardPayroll.day_shifts || 0} shifts, Night: {selectedGuardPayroll.nightShifts || selectedGuardPayroll.night_shifts || 0} shifts</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        KES {(selectedGuardPayroll.basePay || selectedGuardPayroll.total_pay || 0).toLocaleString()}
                      </td>
                    </tr>
                    {(selectedGuardPayroll.offDayBonus || selectedGuardPayroll.overtime_pay) > 0 && (
                      <tr>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">Off-Day Bonus</p>
                            <p className="text-xs text-gray-500">One daily rate per shift</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-amber-600">
                          KES {(selectedGuardPayroll.offDayBonus || selectedGuardPayroll.overtime_pay || 0).toLocaleString()}
                        </td>
                      </tr>
                    )}
                    <tr className="bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="text-lg font-bold text-gray-900">Gross Pay</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-xl font-bold text-gray-900">KES {(selectedGuardPayroll.grossPay || selectedGuardPayroll.total_pay || 0).toLocaleString()}</p>
                      </td>
                    </tr>
                    {(selectedGuardPayroll.totalDeductions || selectedGuardPayroll.uniformDeduction || selectedGuardPayroll.penaltyDeduction) > 0 && (
                      <>
                        <tr>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">Deductions</p>
                            <p className="text-xs text-gray-500">Uniform & penalties</p>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-red-600">
                            - KES {(selectedGuardPayroll.totalDeductions || (selectedGuardPayroll.uniformDeduction || 0) + (selectedGuardPayroll.penaltyDeduction || 0)).toLocaleString()}
                          </td>
                        </tr>
                        <tr className="bg-green-50">
                          <td className="px-4 py-3">
                            <p className="text-lg font-bold text-gray-900">Net Pay</p>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="text-xl font-bold text-green-600">KES {(selectedGuardPayroll.netPay || selectedGuardPayroll.total_pay || 0).toLocaleString()}</p>
                          </td>
                        </tr>
                      </>
                    )}
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

      {/* Payroll Run Detail Modal */}
      {showPayrollDetailModal && selectedPayrollRun && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Payroll Run Details</h2>
              <p className="text-sm text-gray-600">
                {selectedPayrollRun.period_start} to {selectedPayrollRun.period_end} - {selectedPayrollRun.location?.toUpperCase()}
              </p>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase">Total Guards</p>
                  <p className="text-lg font-bold">{selectedPayrollRun.guard_count}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase">Gross Amount</p>
                  <p className="text-lg font-bold">KES {parseFloat(selectedPayrollRun.total_gross_amount).toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase">Total Deductions</p>
                  <p className="text-lg font-bold text-red-600">KES {parseFloat(selectedPayrollRun.total_deductions).toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase">Net Payable</p>
                  <p className="text-lg font-bold text-green-600">KES {parseFloat(selectedPayrollRun.total_net_amount).toFixed(2)}</p>
                </div>
              </div>

              <h3 className="text-lg font-semibold mb-4">Payslips</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Guard</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Work #</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Days</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Gross</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Deductions</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedPayrollRun.payslips?.map((payslip) => (
                      <tr key={payslip.id}>
                        <td className="px-4 py-3 text-sm">{payslip.guard_name}</td>
                        <td className="px-4 py-3 text-sm">{payslip.work_number}</td>
                        <td className="px-4 py-3 text-sm text-right">{payslip.days_worked}</td>
                        <td className="px-4 py-3 text-sm text-right">{parseFloat(payslip.daily_rate).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-right">{parseFloat(payslip.gross_salary).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-right text-red-600">{parseFloat(payslip.total_deductions).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">{parseFloat(payslip.net_salary).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowPayrollDetailModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DirectorPayroll