import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { directorAPI } from '../../services/api'
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  DollarSign,
  Award,
  Clock,
  Activity,
  Calendar
} from 'lucide-react'

const DirectorAnalytics = () => {
  const { profile } = useAuth()
  const [analytics, setAnalytics] = useState(null)
  const [period, setPeriod] = useState('month')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadAnalytics()
  }, [period])

  const loadAnalytics = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await directorAPI.getAnalytics(period)
      setAnalytics(data)
    } catch (error) {
      console.error('Error loading analytics:', error)
      setError(error.message || 'Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
          <div className="text-xl text-gray-600">Loading Analytics...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4 max-w-md">
          <div className="text-red-600 text-center">
            <p className="text-xl font-semibold mb-2">Unable to load analytics</p>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
          </div>
          <button
            onClick={loadAnalytics}
            className="px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-2">No analytics data available</p>
          <p className="text-sm text-gray-500">Try selecting a different time period</p>
        </div>
      </div>
    )
  }

  const summary = analytics?.summary || {}
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Advanced Analytics</h1>
          <p className="text-gray-600 mt-1">Real-time insights from live database queries</p>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1">
          {['week', 'month', 'quarter', 'year'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === p
                  ? 'bg-[#1a2a6c] text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <DollarSign size={24} />
            <span className="text-sm font-medium opacity-90">Total Revenue</span>
          </div>
          <p className="text-3xl font-bold">KES {formatCurrency(summary.totalRevenue)}</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <TrendingDown size={24} />
            <span className="text-sm font-medium opacity-90">Total Wages</span>
          </div>
          <p className="text-3xl font-bold">KES {formatCurrency(summary.totalWages)}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp size={24} />
            <span className="text-sm font-medium opacity-90">Total Bonuses</span>
          </div>
          <p className="text-3xl font-bold">KES {formatCurrency(summary.totalBonuses)}</p>
        </div>

        <div className={`bg-gradient-to-br ${summary.netProfit >= 0 ? 'from-purple-500 to-purple-600' : 'from-orange-500 to-orange-600'} rounded-xl shadow-lg p-6 text-white`}>
          <div className="flex items-center justify-between mb-2">
            <DollarSign size={24} />
            <span className="text-sm font-medium opacity-90">Net Profit</span>
          </div>
          <p className="text-3xl font-bold">KES {formatCurrency(summary.netProfit)}</p>
        </div>
      </div>

      {/* Revenue Trends by Location */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-green-600" />
          Revenue Trends by Location
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {analytics?.revenueTrends?.map((location, idx) => (
            <div key={idx} className={`border-2 rounded-lg p-6 ${location.location === 'town' ? 'border-blue-200 bg-blue-50' : 'border-orange-200 bg-orange-50'}`}>
              <h3 className="text-lg font-bold mb-4" style={{color: location.location === 'town' ? '#2563eb' : '#ea5800'}}>
                {location.location?.toUpperCase()}
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Active Sites:</span>
                  <span className="font-bold">{location.active_sites || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Daily Revenue:</span>
                  <span className="font-bold">KES {formatCurrency(location.daily_revenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Monthly Revenue:</span>
                  <span className="font-bold text-lg">KES {formatCurrency(location.monthly_revenue)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Wage Bill Analysis */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingDown className="w-6 h-6 text-red-600" />
          Wage Bill Analysis
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {analytics?.wageBill?.map((location, idx) => (
            <div key={idx} className={`border-2 rounded-lg p-6 ${location.location === 'town' ? 'border-blue-200 bg-blue-50' : 'border-orange-200 bg-orange-50'}`}>
              <h3 className="text-lg font-bold mb-4" style={{color: location.location === 'town' ? '#2563eb' : '#ea5800'}}>
                {location.location?.toUpperCase()}
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Payroll Runs:</span>
                  <span className="font-bold">{location.payroll_runs || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Guards Paid:</span>
                  <span className="font-bold">{location.guard_count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Daily Rate:</span>
                  <span className="font-bold">KES {formatCurrency(location.avg_daily_rate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Gross:</span>
                  <span className="font-bold">KES {formatCurrency(location.total_gross)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Bonuses:</span>
                  <span className="font-bold text-green-600">KES {formatCurrency(location.total_bonuses)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Deductions:</span>
                  <span className="font-bold text-red-600">KES {formatCurrency(location.total_deductions)}</span>
                </div>
                <div className="flex justify-between border-t-2 pt-2">
                  <span className="text-gray-800 font-semibold">Net Paid:</span>
                  <span className="font-bold text-lg">KES {formatCurrency(location.total_net)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Client Retention & Acquisition */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="w-6 h-6 text-purple-600" />
          Client Retention & Acquisition
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-6 bg-purple-50 rounded-lg">
            <p className="text-4xl font-bold text-purple-600">{summary.activeClients || 0}</p>
            <p className="text-sm text-gray-600 mt-2">Active Clients</p>
          </div>
          <div className="text-center p-6 bg-green-50 rounded-lg">
            <p className="text-4xl font-bold text-green-600">{summary.newClients || 0}</p>
            <p className="text-sm text-gray-600 mt-2">New This Period</p>
          </div>
          <div className="text-center p-6 bg-red-50 rounded-lg">
            <p className="text-4xl font-bold text-red-600">{summary.lostClients || 0}</p>
            <p className="text-sm text-gray-600 mt-2">Lost This Period</p>
          </div>
          <div className="text-center p-6 bg-blue-50 rounded-lg">
            <p className="text-4xl font-bold text-blue-600">{summary.retentionRate || 0}%</p>
            <p className="text-sm text-gray-600 mt-2">Retention Rate</p>
          </div>
        </div>
      </div>

      {/* Recruitment Metrics */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Award className="w-6 h-6 text-orange-600" />
          Recruitment Metrics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <p className="text-3xl font-bold text-orange-600">{summary.totalApplications || 0}</p>
            <p className="text-sm text-gray-600 mt-1">Total Applications</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-3xl font-bold text-green-600">{summary.totalHired || 0}</p>
            <p className="text-sm text-gray-600 mt-1">Hired</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-3xl font-bold text-red-600">{summary.totalRejected || 0}</p>
            <p className="text-sm text-gray-600 mt-1">Rejected</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-3xl font-bold text-yellow-600">{summary.totalPending || 0}</p>
            <p className="text-sm text-gray-600 mt-1">Pending</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-3xl font-bold text-blue-600">
              {summary.totalApplications > 0
                ? Math.round((summary.totalHired / summary.totalApplications) * 100)
                : 0}%
            </p>
            <p className="text-sm text-gray-600 mt-1">Conversion Rate</p>
          </div>
        </div>
      </div>

      {/* Site Security Trends */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Activity className="w-6 h-6 text-red-600" />
          Site Security Trends
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-3xl font-bold text-red-600">{summary.totalIncidents || 0}</p>
            <p className="text-sm text-gray-600 mt-1">Total Incidents</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-3xl font-bold text-yellow-600">{summary.pendingIncidents || 0}</p>
            <p className="text-sm text-gray-600 mt-1">Pending</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-3xl font-bold text-green-600">{summary.resolvedIncidents || 0}</p>
            <p className="text-sm text-gray-600 mt-1">Resolved</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-3xl font-bold text-blue-600">{summary.resolutionRate || 0}%</p>
            <p className="text-sm text-gray-600 mt-1">Resolution Rate</p>
          </div>
        </div>
      </div>

      {/* Payroll Trends */}
      {analytics?.payrollTrends && analytics.payrollTrends.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            Payroll Trends by Location
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Runs</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Guards</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gross (KES)</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deductions (KES)</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net (KES)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {analytics.payrollTrends.map((trend, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      {new Date(trend.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        trend.location === 'town' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                        {trend.location?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">{trend.payroll_runs || 0}</td>
                    <td className="px-4 py-3 text-sm text-right">{trend.total_guards || 0}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(trend.total_gross)}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600">{formatCurrency(trend.total_deductions)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">{formatCurrency(trend.total_net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default DirectorAnalytics