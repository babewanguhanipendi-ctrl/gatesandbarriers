import { useState, useEffect, useCallback } from 'react'
import { managerAPI, usersAPI } from '../../services/api'
import ResponsiveTable from '../../components/ResponsiveTable'
import { User, MapPin, Sun, Moon, AlertCircle, Users, X, Save, Bike, Shield, LayoutGrid, AlertTriangle, Clock, FileText, Download, CheckCircle, Activity, TrendingUp, Calendar, RefreshCw, MapPinOff, ClipboardCheck, Printer } from 'lucide-react'

const ManagerAttendance = () => {
  const [guards, setGuards] = useState([])
  const [supervisors, setSupervisors] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('live-board')
  const [selectedSupervisor, setSelectedSupervisor] = useState(null)
  const [showAllocationModal, setShowAllocationModal] = useState(false)
  const [selectedPersonDetails, setSelectedPersonDetails] = useState(null)
  const [personDetailsLoading, setPersonDetailsLoading] = useState(false)
  const [allocationFeedback, setAllocationFeedback] = useState(null)
  const [allocationForm, setAllocationForm] = useState({ area: 'town', shift_type: 'day', motorcycle: false, motor_gear: false })
  const [showRateModal, setShowRateModal] = useState(false)
  const [selectedGuardForRate, setSelectedGuardForRate] = useState(null)
  const [newRate, setNewRate] = useState('')
  const [updatingRate, setUpdatingRate] = useState(false)
  const [liveBoard, setLiveBoard] = useState({ guards: [], supervisors: [], stats: {} })
  const [liveBoardLoading, setLiveBoardLoading] = useState(false)
  const [exceptions, setExceptions] = useState([])
  const [exceptionsLoading, setExceptionsLoading] = useState(false)
  const [exceptionFilter, setExceptionFilter] = useState('open')
  const [resolveModal, setResolveModal] = useState(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const [resolving, setResolving] = useState(false)
  const [compliance, setCompliance] = useState({ summary: {}, compliance: [] })
  const [complianceLoading, setComplianceLoading] = useState(false)
  const [auditLogs, setAuditLogs] = useState([])
  const [auditLogsLoading, setAuditLogsLoading] = useState(false)
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [exportStartDate, setExportStartDate] = useState('')
  const [exportEndDate, setExportEndDate] = useState('')
  const [exportData, setExportData] = useState(null)
  const [exportLoading, setExportLoading] = useState(false)
  const [clockInModal, setClockInModal] = useState(null)
  const [clockInShiftType, setClockInShiftType] = useState('day')
  const [clockingIn, setClockingIn] = useState(false)

  const handleSaveAllocation = async () => {
    if (!selectedSupervisor) return
    try {
      const data = await managerAPI.createAllocation({ supervisor_id: selectedSupervisor.id, ...allocationForm })
      setShowAllocationModal(false)
      setAllocationForm({ area: 'town', shift_type: 'day', motorcycle: false, motor_gear: false })
      await fetchAttendanceData()
      setAllocationFeedback({
        type: 'success',
        title: 'Allocation Saved',
        message: data.message || `Duty allocation saved for ${selectedSupervisor.full_name}.`
      })
    } catch (error) {
      setAllocationFeedback({
        type: 'error',
        title: 'Allocation Failed',
        message: error.message || 'The duty allocation could not be saved.'
      })
    }
  }

  const openPersonDetails = async (person) => {
    setPersonDetailsLoading(true)
    setSelectedPersonDetails({ person, loading: true })
    try {
      const details = await managerAPI.getAttendancePersonDetails(person.id)
      setSelectedPersonDetails(details)
    } catch (error) {
      setSelectedPersonDetails(null)
      setAllocationFeedback({ type: 'error', title: 'Details Unavailable', message: error.message || 'Unable to load person details.' })
    } finally {
      setPersonDetailsLoading(false)
    }
  }

  const handleSupervisorClick = (supervisor) => {
    if (supervisor.assignment_status === 'Assigned') {
      openPersonDetails(supervisor)
      return
    }
    setSelectedSupervisor(supervisor)
    setShowAllocationModal(true)
  }

  const printPayslip = (payslip, person) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900')
    if (!printWindow) return
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' }[character]))
    printWindow.document.write(`<!doctype html><html><head><title>Payslip - ${escapeHtml(person.full_name)}</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#111}h1{margin-bottom:4px}p{color:#555}.row{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:10px 0}.total{font-size:20px;font-weight:bold;margin-top:16px}</style></head><body><h1>Gates and Barriers Payslip</h1><p>${escapeHtml(person.full_name)} | ${escapeHtml(person.work_number)}</p><p>${escapeHtml(payslip.period_start)} to ${escapeHtml(payslip.period_end)}</p><div class="row"><span>Days worked</span><strong>${escapeHtml(payslip.days_worked)}</strong></div><div class="row"><span>Gross salary</span><strong>KES ${Number(payslip.gross_salary || 0).toLocaleString()}</strong></div><div class="row"><span>Deductions</span><strong>KES ${Number(payslip.total_deductions || 0).toLocaleString()}</strong></div><div class="row total"><span>Net salary</span><strong>KES ${Number(payslip.net_salary || 0).toLocaleString()}</strong></div><script>window.onload=function(){window.print()}</script></body></html>`)
    printWindow.document.close()
  }

  useEffect(() => {
    fetchAttendanceData()
    fetchLiveBoard()
    fetchExceptions()
    fetchCompliance()
    fetchAuditLogs()
    fetchSummary()
    const pollInterval = setInterval(() => { fetchLiveBoard(); fetchExceptions() }, 60 * 60 * 1000)
    return () => clearInterval(pollInterval)
  }, [])

  const fetchAttendanceData = async () => {
    setLoading(true)
    try {
      const [data, allocationData] = await Promise.all([
        managerAPI.getAttendance(),
        managerAPI.getSupervisorAllocations().catch(() => ({ allocations: [] }))
      ])
      const allocationBySupervisor = new Map((allocationData.allocations || []).map(allocation => [allocation.supervisor_id, allocation]))
      setGuards(data.guards || [])
      setSupervisors((data.supervisors || []).map(supervisor => ({
        ...supervisor,
        assignment_status: allocationBySupervisor.has(supervisor.id) ? 'Assigned' : supervisor.assignment_status,
        allocation: allocationBySupervisor.get(supervisor.id) || null
      })))
    } catch (error) { console.error('Error fetching attendance data:', error) } finally { setLoading(false) }
  }

  const fetchLiveBoard = useCallback(async () => {
    setLiveBoardLoading(true)
    try { const data = await managerAPI.getLiveBoard(); setLiveBoard(data) }
    catch (error) { console.error('Error fetching live board:', error) } finally { setLiveBoardLoading(false) }
  }, [])

  const fetchExceptions = useCallback(async (status = exceptionFilter) => {
    setExceptionsLoading(true)
    try { const data = await managerAPI.getExceptions(status); setExceptions(data.exceptions || []) }
    catch (error) { console.error('Error fetching exceptions:', error) } finally { setExceptionsLoading(false) }
  }, [exceptionFilter])

  const fetchCompliance = useCallback(async () => {
    setComplianceLoading(true)
    try { const data = await managerAPI.getCompliance(); setCompliance(data) }
    catch (error) { console.error('Error fetching compliance:', error) } finally { setComplianceLoading(false) }
  }, [])

  const fetchAuditLogs = useCallback(async () => {
    setAuditLogsLoading(true)
    try { const data = await managerAPI.getAttendanceAuditLogs(); setAuditLogs(data.audit_logs || []) }
    catch (error) { console.error('Error fetching audit logs:', error) } finally { setAuditLogsLoading(false) }
  }, [])

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true)
    try { const data = await managerAPI.getAttendanceSummary('daily'); setSummary(data.summary) }
    catch (error) { console.error('Error fetching summary:', error) } finally { setSummaryLoading(false) }
  }, [])

  const handleResolveException = async () => {
    if (!resolveModal) return
    setResolving(true)
    try {
      await managerAPI.resolveException(resolveModal.id, { resolution_note: resolutionNote })
      setResolveModal(null); setResolutionNote(''); fetchExceptions(); fetchLiveBoard()
    } catch (error) { console.error('Error resolving exception:', error) } finally { setResolving(false) }
  }

  const handleExportPayroll = async () => {
    if (!exportStartDate || !exportEndDate) return
    setExportLoading(true)
    try { const data = await managerAPI.exportPayrollAttendance(exportStartDate, exportEndDate); setExportData(data) }
    catch (error) { console.error('Error exporting payroll:', error) } finally { setExportLoading(false) }
  }

  const downloadCSV = () => {
    if (!exportData?.payroll_entries?.length) return
    const headers = ['Guard Name', 'Work Number', 'Site', 'Days Worked', 'Total Hours', 'Overtime Hours', 'Daily Rate', 'Gross Pay', 'Penalties', 'Bonuses']
    const rows = exportData.payroll_entries.map(e => [e.guard_name, e.work_number, e.site_name, e.days_worked, parseFloat(e.total_hours).toFixed(2), parseFloat(e.overtime_hours).toFixed(2), parseFloat(e.daily_rate).toFixed(2), parseFloat(e.gross_pay).toFixed(2), parseFloat(e.penalties).toFixed(2), parseFloat(e.bonuses).toFixed(2)])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `payroll-attendance-${exportStartDate}-to-${exportEndDate}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const getShiftTypeBadge = (shiftType) => {
    const styles = { day: 'bg-yellow-100 text-yellow-800', night: 'bg-blue-100 text-blue-800', overtime: 'bg-purple-100 text-purple-800' }
    const icons = { day: Sun, night: Moon, overtime: AlertCircle }
    const Icon = icons[shiftType] || User
    return <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[shiftType] || 'bg-gray-100 text-gray-800'}`}><Icon size={12} />{shiftType ? shiftType.charAt(0).toUpperCase() + shiftType.slice(1) : 'N/A'}</span>
  }

  const getStatusBadge = (status, isLate = false) => {
    const config = {
      active: { label: 'Active', class: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
      late: { label: 'Late', class: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
      pending: { label: 'Pending', class: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
      absent: { label: 'Absent', class: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
      scheduled: { label: 'Scheduled', class: 'bg-gray-100 text-gray-800', dot: 'bg-gray-400' },
      patrol: { label: 'Patrol', class: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' }
    }
    const key = isLate && status === 'active' ? 'late' : status
    const cfg = config[key] || config.scheduled
    return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.class}`}><span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}</span>
  }

  const getExceptionTypeLabel = (type) => {
    const labels = { geofence_violation: 'Geofence Violation', missed_punch_out: 'Missed Punch-Out', supervisor_override: 'Supervisor Override', late_clock_in: 'Late Clock-In', early_clock_out: 'Early Clock-Out', unauthorized_overtime: 'Unauthorized Overtime', consecutive_shift_violation: 'Consecutive Shift Violation', manual_adjustment: 'Manual Adjustment' }
    return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  const getSeverityBadge = (severity) => {
    const styles = { critical: 'bg-red-100 text-red-800', high: 'bg-orange-100 text-orange-800', medium: 'bg-yellow-100 text-yellow-800', low: 'bg-gray-100 text-gray-800' }
    return <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${styles[severity] || 'bg-gray-100 text-gray-800'}`}>{severity ? severity.charAt(0).toUpperCase() + severity.slice(1) : 'N/A'}</span>
  }

  const getComplianceBadge = (status) => {
    const styles = { compliant: 'bg-green-100 text-green-800', warning: 'bg-yellow-100 text-yellow-800', violation: 'bg-orange-100 text-orange-800', critical: 'bg-red-100 text-red-800' }
    return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>{status ? status.charAt(0).toUpperCase() + status.slice(1) : 'N/A'}</span>
  }

  const calculateSiteRate = (row) => {
    if (row.shift_type === 'day' && row.day_rate) return parseFloat(row.day_rate)
    else if (row.shift_type === 'night' && row.night_rate) return parseFloat(row.night_rate)
    else if (row.day_rate) return parseFloat(row.day_rate)
    else if (row.night_rate) return parseFloat(row.night_rate)
    const tenureYears = parseFloat(row.tenure_years) || 0
    if (row.role === 'supervisor') return 400
    return tenureYears >= 3 ? 300 : 254
  }

  const guardColumns = [
    { key: 'full_name', label: 'Guard Name', render: (row) => <button onClick={() => openPersonDetails(row)} className="flex items-center gap-2 text-left hover:text-[#1a2a6c] transition-colors"><User size={14} className="text-gray-400" /><div><span className="font-medium underline">{row.full_name || 'N/A'}</span><div className="text-xs text-gray-500">{row.work_number}</div></div></button> },
    { key: 'site_name', label: 'Site', render: (row) => <div><div className="font-medium">{row.site_name || 'Unassigned'}</div><div className="text-xs text-gray-500">{row.site_location || ''}</div>{row.supervisor_name && <div className="text-xs text-[#1a2a6c]">Supervisor: {row.supervisor_name}</div>}</div> },
    { key: 'shift_type', label: 'Shift Type', render: (row) => getShiftTypeBadge(row.shift_type) },
    { key: 'rate', label: 'Daily Rate', render: (row) => `KES ${calculateSiteRate(row).toLocaleString()}` },
    { key: 'tenure', label: 'Tenure', render: (row) => `${(parseFloat(row.tenure_years) || 0).toFixed(1)} yrs` },
    { key: 'actions', label: 'Actions', render: (row) => <button onClick={() => openRateModal(row)} className="px-3 py-1 text-xs bg-[#1a2a6c] text-white rounded hover:bg-[#1a2a6c]/90 transition-colors">Edit Rate</button> },
  ]

  const openRateModal = (guard) => { setSelectedGuardForRate(guard); setNewRate(guard.daily_rate?.toString() || '254'); setShowRateModal(true) }

  const handleUpdateRate = async () => {
    if (!selectedGuardForRate || !newRate) return
    setUpdatingRate(true)
    try { await usersAPI.updateRate(selectedGuardForRate.id, parseFloat(newRate)); alert(`Rate updated to KES ${newRate} for ${selectedGuardForRate.full_name}`); setShowRateModal(false); fetchAttendanceData() }
    catch (error) { alert(error.message || 'Failed to update rate') } finally { setUpdatingRate(false) }
  }

  const handleClockInSupervisor = async () => {
    if (!clockInModal) return
    setClockingIn(true)
    try {
      const result = await managerAPI.clockInSupervisor({
        supervisor_id: clockInModal.id,
        shift_type: clockInShiftType
      })
      setClockInModal(null)
      setClockInShiftType('day')
      setAllocationFeedback({
        type: 'success',
        title: 'Supervisor Clocked In',
        message: result.message || `${clockInModal.full_name} has been clocked in successfully.`
      })
      fetchAttendanceData()
      fetchLiveBoard()
    } catch (error) {
      setAllocationFeedback({
        type: 'error',
        title: 'Clock-In Failed',
        message: error.message || 'Failed to clock in supervisor.'
      })
    } finally {
      setClockingIn(false)
    }
  }

  const supervisorColumns = [
    { key: 'full_name', label: 'Supervisor Name', render: (row) => <button onClick={() => handleSupervisorClick(row)} className="flex items-center gap-2 text-left hover:text-[#1a2a6c] transition-colors"><Users size={14} className="text-gray-400" /><span className="font-medium underline">{row.full_name || 'N/A'}</span></button> },
    { key: 'work_number', label: 'Work Number' },
    { key: 'site_name', label: 'Site', render: (row) => <div><div className="font-medium">{row.site_name || row.assignment_status || 'Unassigned'}</div><div className="text-xs text-gray-500">{row.site_location || row.allocation_area || ''}</div>{row.assignment_status === 'Assigned' && <div className="text-xs text-[#1a2a6c]">Assigned</div>}</div> },
    { key: 'shift_type', label: 'Shift Type', render: (row) => getShiftTypeBadge(row.shift_type) },
    { key: 'rate', label: 'Rate', render: (row) => `KES ${calculateSiteRate(row).toLocaleString()}` },
    { key: 'actions', label: 'Actions', render: (row) => (
      <button
        onClick={() => { setClockInModal(row); setClockInShiftType('day') }}
        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
      >
        <Clock size={14} />
        Clock In
      </button>
    )},
  ]

  const tabs = [
    { id: 'live-board', label: 'Live Operations', icon: LayoutGrid },
    { id: 'exceptions', label: 'Exception Queue', icon: AlertTriangle },
    { id: 'compliance', label: 'Compliance & Overtime', icon: TrendingUp },
    { id: 'audit-logs', label: 'Audit Logs', icon: FileText },
    { id: 'reports', label: 'Reports & Export', icon: Download },
    { id: 'guards', label: 'Guards', icon: Users },
    { id: 'supervisors', label: 'Supervisors', icon: Shield },
  ]

  const renderLiveBoard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"><div className="flex items-center gap-3"><div className="p-2 bg-green-100 rounded-lg"><Activity className="w-5 h-5 text-green-600" /></div><div><p className="text-xs text-gray-500">Active On Duty</p><p className="text-2xl font-bold text-gray-900">{liveBoard.stats?.active || 0}</p></div></div></div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"><div className="flex items-center gap-3"><div className="p-2 bg-yellow-100 rounded-lg"><Clock className="w-5 h-5 text-yellow-600" /></div><div><p className="text-xs text-gray-500">Late / Pending</p><p className="text-2xl font-bold text-gray-900">{(liveBoard.stats?.late || 0) + (liveBoard.stats?.pending || 0)}</p></div></div></div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"><div className="flex items-center gap-3"><div className="p-2 bg-red-100 rounded-lg"><AlertCircle className="w-5 h-5 text-red-600" /></div><div><p className="text-xs text-gray-500">Open Exceptions</p><p className="text-2xl font-bold text-gray-900">{liveBoard.stats?.open_exceptions || 0}</p></div></div></div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"><div className="flex items-center gap-3"><div className="p-2 bg-blue-100 rounded-lg"><MapPin className="w-5 h-5 text-blue-600" /></div><div><p className="text-xs text-gray-500">Geofence Violations</p><p className="text-2xl font-bold text-gray-900">{liveBoard.stats?.geofence_violations_today || 0}</p></div></div></div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div><h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><LayoutGrid className="w-5 h-5 text-[#1a2a6c]" />Live Operations Board</h2><p className="text-sm text-gray-500 mt-1">Real-time status of all guards and supervisors</p></div>
          <button onClick={fetchLiveBoard} className="flex items-center gap-2 px-3 py-2 text-sm bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 transition-colors"><RefreshCw size={14} className={liveBoardLoading ? 'animate-spin' : ''} />Refresh</button>
        </div>
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-4">
          <span className="flex items-center gap-1.5 text-xs text-gray-600"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Active / On-time</span>
          <span className="flex items-center gap-1.5 text-xs text-gray-600"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Late / Pending</span>
          <span className="flex items-center gap-1.5 text-xs text-gray-600"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Absent / Missed</span>
          <span className="flex items-center gap-1.5 text-xs text-gray-600"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Off-site / Patrol</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guard</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Site</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shift</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Geofence</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-200">
              {liveBoardLoading ? <tr><td colSpan={6} className="px-6 py-8 text-center"><div className="flex items-center justify-center gap-3"><div className="w-6 h-6 border-2 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" /><span className="text-gray-500">Loading live board...</span></div></td></tr>
              : liveBoard.guards?.length === 0 ? <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No guards found</td></tr>
              : liveBoard.guards?.map((guard) => (
                <tr key={guard.guard_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4"><div className="flex items-center gap-2"><User size={14} className="text-gray-400" /><div><span className="font-medium text-gray-900">{guard.guard_name}</span><div className="text-xs text-gray-500">{guard.work_number}</div></div></div></td>
                  <td className="px-6 py-4"><div className="font-medium text-gray-900">{guard.site_name}</div><div className="text-xs text-gray-500">{guard.site_location}</div></td>
                  <td className="px-6 py-4">{getShiftTypeBadge(guard.shift_type)}</td>
                  <td className="px-6 py-4">{getStatusBadge(guard.status, guard.is_late)}</td>
                  <td className="px-6 py-4"><span className="text-sm font-medium text-gray-900">{guard.hours_worked ? `${parseFloat(guard.hours_worked).toFixed(1)}h` : '--'}</span></td>
                  <td className="px-6 py-4">{guard.check_in_geofence_verified ? <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle size={14} /> Verified</span> : guard.check_in_time ? <span className="inline-flex items-center gap-1 text-xs text-red-600"><MapPinOff size={14} /> Violation</span> : <span className="text-xs text-gray-400">--</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200"><h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Shield className="w-5 h-5 text-[#1a2a6c]" />Supervisors On Duty</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supervisor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Site</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shift</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inspection</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-200">
              {liveBoard.supervisors?.length === 0 ? <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No supervisors found</td></tr>
              : liveBoard.supervisors?.map((sup) => (
                <tr key={sup.supervisor_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4"><div className="flex items-center gap-2"><Users size={14} className="text-gray-400" /><div><span className="font-medium text-gray-900">{sup.supervisor_name}</span><div className="text-xs text-gray-500">{sup.work_number}</div></div></div></td>
                  <td className="px-6 py-4"><span className="font-medium text-gray-900">{sup.site_name}</span></td>
                  <td className="px-6 py-4">{getShiftTypeBadge(sup.shift_type)}</td>
                  <td className="px-6 py-4">{getStatusBadge(sup.status)}</td>
                  <td className="px-6 py-4">{sup.tied_to_inspection ? <span className="inline-flex items-center gap-1 text-xs text-green-600"><ClipboardCheck size={14} /> Tied to Inspection</span> : <span className="text-xs text-gray-400">--</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderExceptions = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div><h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-[#1a2a6c]" />Exception Queue</h2><p className="text-sm text-gray-500 mt-1">Aggregated anomalies requiring attention</p></div>
        <div className="flex gap-2">{['open', 'reviewing', 'resolved', 'dismissed'].map(status => <button key={status} onClick={() => { setExceptionFilter(status); fetchExceptions(status) }} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${exceptionFilter === status ? 'bg-[#1a2a6c] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</button>)}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="bg-gray-50">
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guard</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Site</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-200">
            {exceptionsLoading ? <tr><td colSpan={7} className="px-6 py-8 text-center"><div className="flex items-center justify-center gap-3"><div className="w-6 h-6 border-2 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" /><span className="text-gray-500">Loading exceptions...</span></div></td></tr>
            : exceptions.length === 0 ? <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No exceptions found</td></tr>
            : exceptions.map((exc) => (
              <tr key={exc.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4"><span className="text-sm font-medium text-gray-900">{getExceptionTypeLabel(exc.exception_type)}</span></td>
                <td className="px-6 py-4"><div className="font-medium text-gray-900">{exc.guard_name}</div><div className="text-xs text-gray-500">{exc.guard_work_number}</div></td>
                <td className="px-6 py-4 text-sm text-gray-600">{exc.site_name || '--'}</td>
                <td className="px-6 py-4">{getSeverityBadge(exc.severity)}</td>
                <td className="px-6 py-4"><span className="text-sm text-gray-600 line-clamp-2">{exc.description}</span></td>
                <td className="px-6 py-4 text-sm text-gray-500">{new Date(exc.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-6 py-4">{exc.status === 'open' && <button onClick={() => setResolveModal(exc)} className="px-3 py-1.5 text-xs bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 transition-colors">Resolve</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderCompliance = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"><p className="text-xs text-gray-500">Compliant</p><p className="text-2xl font-bold text-green-600">{compliance.summary?.compliant || 0}</p></div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"><p className="text-xs text-gray-500">Warning</p><p className="text-2xl font-bold text-yellow-600">{compliance.summary?.warning || 0}</p></div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"><p className="text-xs text-gray-500">Violation</p><p className="text-2xl font-bold text-orange-600">{compliance.summary?.violation || 0}</p></div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"><p className="text-xs text-gray-500">Critical</p><p className="text-2xl font-bold text-red-600">{compliance.summary?.critical || 0}</p></div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-[#1a2a6c]" />Weekly Compliance Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><p className="text-xs text-gray-500">Total Hours</p><p className="text-xl font-bold text-gray-900">{parseFloat(compliance.summary?.total_hours || 0).toFixed(1)}h</p></div>
          <div><p className="text-xs text-gray-500">Overtime Hours</p><p className="text-xl font-bold text-gray-900">{parseFloat(compliance.summary?.total_overtime_hours || 0).toFixed(1)}h</p></div>
          <div><p className="text-xs text-gray-500">Unauthorized OT</p><p className="text-xl font-bold text-red-600">{parseFloat(compliance.summary?.unauthorized_overtime_hours || 0).toFixed(1)}h</p></div>
          <div><p className="text-xs text-gray-500">Week</p><p className="text-xl font-bold text-gray-900">{compliance.week_start} - {compliance.week_end}</p></div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200"><h2 className="text-lg font-bold text-gray-900">Guard Compliance Details</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guard</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shifts</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Consecutive</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Late</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Geofence</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-200">
              {complianceLoading ? <tr><td colSpan={7} className="px-6 py-8 text-center"><div className="flex items-center justify-center gap-3"><div className="w-6 h-6 border-2 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" /><span className="text-gray-500">Loading compliance...</span></div></td></tr>
              : compliance.compliance?.length === 0 ? <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No compliance data found</td></tr>
              : compliance.compliance?.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4"><div className="font-medium text-gray-900">{row.guard_name}</div><div className="text-xs text-gray-500">{row.work_number}</div></td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{parseFloat(row.total_hours_worked).toFixed(1)}h</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{row.total_shifts}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{row.max_consecutive_shifts}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{row.late_clock_ins}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{row.geofence_violations}</td>
                  <td className="px-6 py-4">{getComplianceBadge(row.compliance_status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderAuditLogs = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200"><h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><FileText className="w-5 h-5 text-[#1a2a6c]" />Attendance Audit Logs</h2><p className="text-sm text-gray-500 mt-1">Complete audit trail of all attendance actions</p></div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="bg-gray-50">
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-200">
            {auditLogsLoading ? <tr><td colSpan={4} className="px-6 py-8 text-center"><div className="flex items-center justify-center gap-3"><div className="w-6 h-6 border-2 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" /><span className="text-gray-500">Loading audit logs...</span></div></td></tr>
            : auditLogs.length === 0 ? <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No audit logs found</td></tr>
            : auditLogs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4"><div className="font-medium text-gray-900">{log.user_name}</div><div className="text-xs text-gray-500">{log.user_email}</div></td>
                <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{log.action}</span></td>
                <td className="px-6 py-4 text-sm text-gray-600">{log.description}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderReports = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-[#1a2a6c]" />Today's Attendance Summary</h2>
        {summaryLoading ? <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" /></div>
        : summary ? <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4"><p className="text-xs text-green-600 font-medium">Active</p><p className="text-2xl font-bold text-green-700">{summary.active_guards || 0}</p></div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"><p className="text-xs text-yellow-600 font-medium">Late</p><p className="text-2xl font-bold text-yellow-700">{summary.late || 0}</p></div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4"><p className="text-xs text-red-600 font-medium">Absent</p><p className="text-2xl font-bold text-red-700">{summary.absent || 0}</p></div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4"><p className="text-xs text-blue-600 font-medium">Geofence Violations</p><p className="text-2xl font-bold text-blue-700">{summary.geofence_violations || 0}</p></div>
        </div> : null}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Download className="w-5 h-5 text-[#1a2a6c]" />Payroll Attendance Export</h2>
        <p className="text-sm text-gray-500 mb-4">Export approved attendance hours directly for payroll processing</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label><input type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-2">End Date</label><input type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent" /></div>
          <div className="flex items-end"><button onClick={handleExportPayroll} disabled={!exportStartDate || !exportEndDate || exportLoading} className="flex items-center gap-2 px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 transition-colors disabled:opacity-50">{exportLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Download size={16} />}Export Payroll Data</button></div>
        </div>
        {exportData?.payroll_entries?.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{exportData.payroll_entries.length} guards exported for {exportData.period_start} to {exportData.period_end}</h3>
              <button onClick={downloadCSV} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><Download size={16} />Download CSV</button>
            </div>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead><tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guard</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Site</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OT Hours</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gross Pay</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Penalties</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bonuses</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-200">
                  {exportData.payroll_entries.map((entry) => (
                    <tr key={entry.guard_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><div className="font-medium text-gray-900">{entry.guard_name}</div><div className="text-xs text-gray-500">{entry.work_number}</div></td>
                      <td className="px-4 py-3 text-sm text-gray-600">{entry.site_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{entry.days_worked}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{parseFloat(entry.total_hours).toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{parseFloat(entry.overtime_hours).toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">KES {parseFloat(entry.daily_rate).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">KES {parseFloat(entry.gross_pay).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-red-600">KES {parseFloat(entry.penalties).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-green-600">KES {parseFloat(entry.bonuses).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Attendance Management</h1>
          <p className="text-gray-600 mt-1">Monitor live operations, manage exceptions, and track compliance</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 font-medium text-sm rounded-lg transition-colors whitespace-nowrap ${activeTab === tab.id ? 'bg-[#1a2a6c] text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}><Icon size={16} />{tab.label}</button>
          })}
        </div>

        {activeTab === 'live-board' && renderLiveBoard()}
        {activeTab === 'exceptions' && renderExceptions()}
        {activeTab === 'compliance' && renderCompliance()}
        {activeTab === 'audit-logs' && renderAuditLogs()}
        {activeTab === 'reports' && renderReports()}
        {activeTab === 'guards' && <div className="bg-white rounded-xl shadow-sm border border-gray-200"><ResponsiveTable columns={guardColumns} rows={guards} loading={loading} emptyMessage="No guards found" /></div>}
        {activeTab === 'supervisors' && <div className="bg-white rounded-xl shadow-sm border border-gray-200"><ResponsiveTable columns={supervisorColumns} rows={supervisors} loading={loading} emptyMessage="No supervisors found" /></div>}
      </div>

      {showRateModal && selectedGuardForRate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div><h2 className="text-xl font-bold text-gray-900">Edit Guard Rate</h2><p className="text-sm text-gray-600">{selectedGuardForRate.full_name} - {selectedGuardForRate.work_number}</p></div>
                <button onClick={() => setShowRateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Rate: KES {selectedGuardForRate.daily_rate?.toLocaleString() || '254'}</label>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Daily Rate (KES)</label>
                <input type="number" value={newRate} onChange={(e) => setNewRate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent" placeholder="e.g. 254" min="0" step="0.01" />
                <p className="text-xs text-gray-500 mt-1">Standard rates: 254 KES (less than 3 years), 300 KES (3 and more years)</p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowRateModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleUpdateRate} disabled={updatingRate || !newRate} className="flex-1 px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">{updatingRate ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Updating...</> : 'Update Rate'}</button>
            </div>
          </div>
        </div>
      )}

      {selectedPersonDetails && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div><h2 className="text-xl font-bold text-gray-900">{selectedPersonDetails.person?.full_name}</h2><p className="text-sm text-gray-600 capitalize">{selectedPersonDetails.person?.role} | {selectedPersonDetails.person?.work_number}</p></div>
              <button onClick={() => setSelectedPersonDetails(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            {personDetailsLoading ? <div className="p-10 text-center text-gray-500">Loading details...</div> : (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Location</p><p className="font-semibold text-gray-900 mt-1">{selectedPersonDetails.person?.site_location || selectedPersonDetails.allocation?.area || 'Not assigned'}</p></div>
                  <div className="bg-gray-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Allocated sites</p><p className="font-semibold text-gray-900 mt-1">{selectedPersonDetails.allocated_sites?.length || 0}</p></div>
                  <div className="bg-gray-50 rounded-lg p-4"><p className="text-xs text-gray-500 uppercase">Accumulated amount</p><p className="font-semibold text-gray-900 mt-1">KES {Number(selectedPersonDetails.accumulated_amount || 0).toLocaleString()}</p></div>
                </div>

                <section><h3 className="font-semibold text-gray-900 mb-2">Allocated sites</h3><div className="border border-gray-200 rounded-lg divide-y divide-gray-200">{selectedPersonDetails.allocated_sites?.length ? selectedPersonDetails.allocated_sites.map(site => <div key={site.id} className="p-3 flex items-center justify-between"><div><p className="font-medium text-gray-900">{site.site_name}</p><p className="text-xs text-gray-500">{site.location || site.address || 'Location not provided'}</p></div><span className="text-xs text-gray-500">Supervisor: {site.supervisor_name || 'Unassigned'}</span></div>) : <p className="p-3 text-sm text-gray-500">No sites allocated.</p>}</div></section>

                <section><h3 className="font-semibold text-gray-900 mb-2">Sites visited</h3><div className="border border-gray-200 rounded-lg divide-y divide-gray-200">{selectedPersonDetails.visited_sites?.length ? selectedPersonDetails.visited_sites.map(site => <div key={site.id} className="p-3 flex items-center justify-between"><div><p className="font-medium text-gray-900">{site.site_name}</p><p className="text-xs text-gray-500">{site.location || 'Location not provided'}</p></div><span className="text-xs text-gray-500">Supervisor: {site.supervisor_name || 'Unassigned'}</span></div>) : <p className="p-3 text-sm text-gray-500">No site visits recorded.</p>}</div></section>

                <section><div className="flex items-center justify-between mb-2"><h3 className="font-semibold text-gray-900">Payslips</h3><span className="text-sm text-gray-500">{selectedPersonDetails.payslips?.length || 0} available</span></div><div className="border border-gray-200 rounded-lg divide-y divide-gray-200">{selectedPersonDetails.payslips?.length ? selectedPersonDetails.payslips.map(payslip => <div key={payslip.id} className="p-3 flex items-center justify-between gap-3"><div><p className="font-medium text-gray-900">{payslip.period_start} to {payslip.period_end}</p><p className="text-sm text-gray-600">Net: KES {Number(payslip.net_salary || 0).toLocaleString()} | {payslip.payment_status}</p></div><button onClick={() => printPayslip(payslip, selectedPersonDetails.person)} className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90"><Printer size={14} />Print</button></div>) : <p className="p-3 text-sm text-gray-500">No payslips generated yet.</p>}</div></section>
              </div>
            )}
          </div>
        </div>
      )}

      {showAllocationModal && selectedSupervisor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div><h2 className="text-xl font-bold text-gray-900">Supervisor Allocation</h2><p className="text-sm text-gray-600">{selectedSupervisor.full_name} - {selectedSupervisor.work_number}</p></div>
                <button onClick={() => setShowAllocationModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-2">Area</label><select value={allocationForm.area} onChange={(e) => setAllocationForm({ ...allocationForm, area: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"><option value="town">Town</option><option value="nyali">Nyali</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-2">Shift Type</label><select value={allocationForm.shift_type} onChange={(e) => setAllocationForm({ ...allocationForm, shift_type: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"><option value="day">Day</option><option value="night">Night</option></select></div>
              <div className="flex items-center gap-2"><input type="checkbox" id="motorcycle" checked={allocationForm.motorcycle} onChange={(e) => setAllocationForm({ ...allocationForm, motorcycle: e.target.checked })} className="w-4 h-4 text-[#1a2a6c] border-gray-300 rounded focus:ring-[#1a2a6c]" /><label htmlFor="motorcycle" className="flex items-center gap-2 text-sm font-medium text-gray-700"><Bike size={16} />Motorcycle</label></div>
              <div className="flex items-center gap-2"><input type="checkbox" id="motor_gear" checked={allocationForm.motor_gear} onChange={(e) => setAllocationForm({ ...allocationForm, motor_gear: e.target.checked })} className="w-4 h-4 text-[#1a2a6c] border-gray-300 rounded focus:ring-[#1a2a6c]" /><label htmlFor="motor_gear" className="flex items-center gap-2 text-sm font-medium text-gray-700"><Shield size={16} />Motor Gear</label></div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowAllocationModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleSaveAllocation} className="flex-1 px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 transition-colors flex items-center justify-center gap-2"><Save size={16} />Save Allocation</button>
            </div>
          </div>
        </div>
      )}

      {allocationFeedback && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3">
              {allocationFeedback.type === 'success' ? <CheckCircle className="w-6 h-6 text-green-600" /> : <AlertTriangle className="w-6 h-6 text-red-600" />}
              <div>
                <h2 className="text-lg font-bold text-gray-900">{allocationFeedback.title}</h2>
                <p className="text-sm text-gray-600 mt-1">{allocationFeedback.message}</p>
              </div>
            </div>
            <button onClick={() => setAllocationFeedback(null)} className="mt-6 w-full px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90">Close</button>
          </div>
        </div>
      )}

      {clockInModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Clock In Supervisor</h2>
                  <p className="text-sm text-gray-600">{clockInModal.full_name} - {clockInModal.work_number}</p>
                </div>
                <button onClick={() => setClockInModal(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  This will clock in <strong>{clockInModal.full_name}</strong> and grant them operational access to view active shifts.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Shift Type</label>
                <select
                  value={clockInShiftType}
                  onChange={(e) => setClockInShiftType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                >
                  <option value="day">Day Shift</option>
                  <option value="night">Night Shift</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setClockInModal(null)} disabled={clockingIn} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleClockInSupervisor} disabled={clockingIn} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {clockingIn ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Clocking In...</> : <><Clock size={16} />Clock In Supervisor</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {resolveModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div><h2 className="text-xl font-bold text-gray-900">Resolve Exception</h2><p className="text-sm text-gray-600">{getExceptionTypeLabel(resolveModal.exception_type)} - {resolveModal.guard_name}</p></div>
                <button onClick={() => setResolveModal(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4"><p className="text-sm text-gray-700">{resolveModal.description}</p></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-2">Resolution Note</label><textarea value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent resize-none" rows={4} placeholder="Describe how this exception was resolved..." /></div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setResolveModal(null)} disabled={resolving} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleResolveException} disabled={resolving} className="flex-1 px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">{resolving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Resolving...</> : <><CheckCircle size={16} />Resolve Exception</>}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ManagerAttendance