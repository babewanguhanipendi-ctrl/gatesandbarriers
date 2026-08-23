import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  DollarSign,
  Users,
  AlertTriangle,
  Clock,
  TrendingUp,
  Award,
  Activity,
  Shield
} from 'lucide-react'
import { directorAPI } from '../../services/api'

const DirectorDashboard = () => {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const response = await directorAPI.getDashboard()
      setDashboardData(response)
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const features = [
    {
      emoji: '📈',
      label: 'Financial Reports & Analytics',
      path: '/director/financial-reports'
    },
    {
      emoji: '📜',
      label: 'Policies',
      path: '/director/policies'
    },
    {
      emoji: '💼',
      label: 'Resources',
      path: '/director/resources'
    },
    {
      emoji: '📍',
      label: 'Site Management',
      path: '/director/sites'
    },
    {
      emoji: '💰',
      label: 'Payroll Sign-off & Treasury',
      path: '/director/payroll'
    },
    {
      emoji: '📝',
      label: 'Contract Approvals',
      path: '/director/requests'
    },
    {
      emoji: '📅',
      label: 'Company Schedules',
      path: '/director/portal'
    },
    {
      emoji: '👥',
      label: 'User Management',
      path: '/director/users'
    }
  ]

  const getStats = () => {
    if (!dashboardData) {
      return [
        { label: 'Total Revenue', value: 'KES 0', change: null, icon: DollarSign, color: 'text-green-600', bgColor: 'bg-green-100' },
        { label: 'Active Contracts', value: '0', icon: Shield, color: 'text-blue-600', bgColor: 'bg-blue-100' },
        { label: 'Total Clients', value: '0', icon: Users, color: 'text-purple-600', bgColor: 'bg-purple-100' },
        { label: 'Guards Deployed', value: '0', icon: Activity, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
        { label: 'AWOL Guards', value: '0', icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100' },
        { label: 'Pending Resignations', value: '0', icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
        { label: 'Client Retention', value: '0%', icon: TrendingUp, color: 'text-teal-600', bgColor: 'bg-teal-100' },
        { label: 'Recruitment Pipeline', value: '0', icon: Award, color: 'text-orange-600', bgColor: 'bg-orange-100' }
      ]
    }

    const awolCount = dashboardData.deployment?.filter(s => (s.guard_count || 0) === 0).length || 0
    
    return [
      {
        label: 'Total Revenue',
        value: `KES ${(dashboardData.financial?.totalRevenue / 1000000).toFixed(1)}M`,
        change: null,
        icon: DollarSign,
        color: 'text-green-600',
        bgColor: 'bg-green-100'
      },
      {
        label: 'Active Contracts',
        value: dashboardData.financial?.activeContracts?.toString() || '0',
        icon: Shield,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100'
      },
      {
        label: 'Total Clients',
        value: dashboardData.totalClients?.toString() || '0',
        icon: Users,
        color: 'text-purple-600',
        bgColor: 'bg-purple-100'
      },
      {
        label: 'Guards Deployed',
        value: dashboardData.deployment?.reduce((sum, s) => sum + (s.guard_count || 0), 0).toString() || '0',
        icon: Activity,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-100'
      },
      {
        label: 'Sites Without Guards',
        value: awolCount.toString(),
        icon: AlertTriangle,
        color: 'text-red-600',
        bgColor: 'bg-red-100'
      },
      {
        label: 'Pending Resignations',
        value: '0',
        icon: Clock,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100'
      },
      {
        label: 'Client Retention',
        value: `${dashboardData.retentionRate || 0}%`,
        icon: TrendingUp,
        color: 'text-teal-600',
        bgColor: 'bg-teal-100'
      },
      {
        label: 'Recruitment Pipeline',
        value: dashboardData.pipelineCount?.toString() || '0',
        icon: Award,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100'
      }
    ]
  }

  const stats = getStats()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Director Portal</h1>
        <p className="text-gray-600 mt-1">Strategic oversight & company-wide analytics</p>
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
          <button onClick={loadDashboardData} className="ml-4 underline">Retry</button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="w-8 h-8 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* Features Grid - Compact Icon/Label Based */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {features.map((feature) => (
          <button
            key={feature.path}
            onClick={() => navigate(feature.path)}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-gradient-to-br from-white to-gray-50 rounded-lg border-2 border-gray-200 hover:border-[#1a2a6c] hover:shadow-lg transition-all duration-200 group"
          >
            <span className="text-4xl group-hover:scale-110 transition-transform drop-shadow-sm">{feature.emoji}</span>
            <span className="text-sm font-semibold text-gray-800 text-center leading-tight">{feature.label}</span>
          </button>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              {stat.change && (
                <p className="text-xs text-green-600 mt-1 font-medium">{stat.change} from last month</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default DirectorDashboard