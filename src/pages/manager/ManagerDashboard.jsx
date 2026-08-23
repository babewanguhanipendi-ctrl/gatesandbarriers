import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const ManagerDashboard = () => {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const features = [
    {
      emoji: '⏰',
      label: 'Active Shifts',
      path: '/manager/shifts'
    },
    {
      emoji: '⚠️',
      label: 'Incidents',
      path: '/manager/incidents'
    },
    {
      emoji: '✅',
      label: 'Attendance',
      path: '/manager/attendance'
    },
    {
      emoji: '📍',
      label: 'Site Management',
      path: '/manager/sites'
    },
    {
      emoji: '📄',
      label: 'Documents',
      path: '/manager/documents'
    },
    {
      emoji: '👥',
      label: 'Applicants',
      path: '/manager/applicants'
    },
    {
      emoji: '💰',
      label: 'Payroll',
      path: '/manager/payroll'
    },
    {
      emoji: '👥',
      label: 'Guard Management',
      path: '/manager/users'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Manager Portal</h1>
        <p className="text-gray-600 mt-1">Operational oversight & management</p>
      </div>

      {/* Features Grid - Compact Icon/Label Based */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {features.map((feature) => (
          <button
            key={feature.path}
            onClick={() => navigate(feature.path)}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-white rounded-lg border border-gray-200 hover:border-[#1a2a6c] hover:shadow-md transition-all duration-200 group"
          >
            <span className="text-3xl group-hover:scale-110 transition-transform">{feature.emoji}</span>
            <span className="text-sm font-medium text-gray-700 text-center">{feature.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default ManagerDashboard
