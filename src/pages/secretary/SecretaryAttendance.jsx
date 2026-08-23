import { useState, useEffect } from 'react'
import { shiftsAPI, sitesAPI, usersAPI } from '../../services/api'
import ResponsiveTable from '../../components/ResponsiveTable'
import { Clipboard, Calendar, User, MapPin, Clock, DollarSign, RefreshCw } from 'lucide-react'

const SecretaryAttendance = () => {
  const [shifts, setShifts] = useState([])
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))

  useEffect(() => {
    fetchData()

    // Poll for shift updates every 30 seconds for real-time status propagation
    const pollInterval = setInterval(() => {
      fetchData()
    }, 30000)

    return () => clearInterval(pollInterval)
  }, [selectedMonth])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [sitesData, shiftsData] = await Promise.all([
        sitesAPI.getAll(),
        shiftsAPI.getAll({
          date_from: `${selectedMonth}-01`,
          date_to: `${selectedMonth}-31`
        })
      ])
      setSites(sitesData.sites || [])
      setShifts(shiftsData.shifts || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
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

  const getOvertimeMultiplier = (shiftType) => {
    return shiftType === 'overtime' ? 1.5 : 1
  }

  const columns = [
    { 
      key: 'guard_name', 
      label: 'Guard',
      render: (row) => (
        <div className="flex items-center gap-2">
          <User size={14} className="text-gray-400" />
          <span className="font-medium">{row.guard_name || 'Unknown'}</span>
        </div>
      )
    },
    { 
      key: 'site_name', 
      label: 'Site',
      render: (row) => (
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-gray-400" />
          <span>{row.site_client || 'Unassigned'}</span>
        </div>
      )
    },
    { 
      key: 'shift_type', 
      label: 'Shift Type',
      render: (row) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getShiftTypeColor(row.shift_type)}`}>
          {row.shift_type}
        </span>
      )
    },
    { 
      key: 'date', 
      label: 'Date',
      render: (row) => new Date(row.date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })
    },
    { 
      key: 'start_time', 
      label: 'Start Time',
      render: (row) => formatTime(row.start_time)
    },
    { 
      key: 'end_time', 
      label: 'End Time',
      render: (row) => formatTime(row.end_time)
    },
    { 
      key: 'duration', 
      label: 'Duration',
      render: (row) => formatDuration(row.start_time, row.end_time)
    },
    { 
      key: 'daily_rate', 
      label: 'Daily Rate',
      render: (row) => `KES ${(row.daily_rate || 254).toLocaleString()}`
    },
    { 
      key: 'overtime_multiplier', 
      label: 'Multiplier',
      render: (row) => (
        <span className={`font-medium ${row.shift_type === 'overtime' ? 'text-amber-600' : 'text-gray-600'}`}>
          {getOvertimeMultiplier(row.shift_type)}x
        </span>
      )
    }
  ]

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
          <h1 className="text-3xl font-bold text-gray-900">Attendance & Records</h1>
          <p className="text-gray-600 mt-1">Track guard attendance and records</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Month Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Calendar size={16} />
                Select Month:
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
              />
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

        {/* Shifts Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Clipboard className="w-5 h-5 text-[#1a2a6c]" />
              Shift Records
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {shifts.length} shifts recorded for {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <ResponsiveTable
            columns={columns}
            rows={shifts}
            loading={loading}
            emptyMessage="No shift records found for this period"
          />
        </div>
      </div>
    </div>
  )
}

export default SecretaryAttendance