import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supervisorAPI } from '../../services/api'

const SupervisorDashboard = () => {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalSites: 0,
    totalGuards: 0,
    activeShifts: 0,
    pendingIncidents: 0,
    unreadNotices: 0,
    documentsSent: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      const data = await supervisorAPI.getDashboard()
      setStats({
        totalSites: data.stats?.totalSites || 0,
        totalGuards: data.stats?.totalGuards || 0,
        activeShifts: data.stats?.activeShifts || 0,
        pendingIncidents: data.stats?.pendingIncidents || 0,
        unreadNotices: data.stats?.unreadNotices || 0,
        documentsSent: data.stats?.documentsSent || 0
      })
      setError('')
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      setError('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  const dashboardCards = [
    {
      emoji: '🏢',
      label: 'Managed Sites',
      path: '/supervisor/sites',
      stat: stats.totalSites,
      statLabel: 'active sites'
    },
    {
      emoji: '👥',
      label: 'Guard Roster',
      path: '/supervisor/guards',
      stat: stats.totalGuards,
      statLabel: 'assigned guards'
    },
    {
      emoji: '📅',
      label: 'Active Shifts',
      path: '/supervisor/shifts',
      stat: stats.activeShifts,
      statLabel: 'guards currently on duty'
    },
    {
      emoji: '⏱️',
      label: 'My Attendance',
      path: '/supervisor/attendance',
      stat: 'Clock In',
      statLabel: 'record your shift'
    },
    {
      emoji: '⚠️',
      label: 'Incidents',
      path: '/supervisor/incidents',
      stat: stats.pendingIncidents,
      statLabel: 'pending review'
    },
    {
      emoji: '🔔',
      label: 'Notices',
      path: '/supervisor/notices',
      stat: stats.unreadNotices,
      statLabel: 'unread'
    },
    {
      emoji: '👕',
      label: 'My Uniform',
      path: '/supervisor/uniform',
      stat: 'View',
      statLabel: 'uniform request'
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-gray-400">Loading dashboard...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Supervisor Dashboard</h1>
          <p className="text-gray-600 mt-1">Operational bridge - Real-time task management & document distribution</p>
        </div>
      </div>

      {/* Main Content - Compact Card Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {dashboardCards.map((card, index) => (
            <button
              key={index}
              onClick={() => navigate(card.path)}
              className="flex flex-col items-center justify-center gap-2 p-4 bg-white rounded-lg border border-gray-200 hover:border-[#1a2a6c] hover:shadow-md transition-all duration-200 group"
            >
              <span className="text-3xl group-hover:scale-110 transition-transform">{card.emoji}</span>
              <span className="text-sm font-medium text-gray-700 text-center">{card.label}</span>
              <span className="text-lg font-bold text-gray-900">{card.stat}</span>
              <span className="text-xs text-gray-500">{card.statLabel}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SupervisorDashboard
