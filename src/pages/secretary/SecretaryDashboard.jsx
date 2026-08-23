import { useNavigate } from 'react-router-dom'

const SecretaryDashboard = () => {
  const navigate = useNavigate()

  const dashboardCards = [
    {
      emoji: '👔',
      label: 'Uniform Management',
      path: '/secretary/uniform'
    },
    {
      emoji: '💰',
      label: 'Payroll Management',
      path: '/secretary/payroll'
    },
    {
      emoji: '📋',
      label: 'Client Contracts',
      path: '/secretary/contracts'
    },
    {
      emoji: '✅',
      label: 'Attendance & Records',
      path: '/secretary/attendance'
    },
    {
      emoji: '📥',
      label: 'Document Inbox',
      path: '/secretary/documents'
    },
    {
      emoji: '👤',
      label: 'Recruitment/Applications',
      path: '/secretary/applications'
    },
    {
      emoji: '📅',
      label: 'Company Schedule',
      path: '/secretary/schedule'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Secretary Dashboard</h1>
          <p className="text-gray-600 mt-1">Central hub for administrative operations</p>
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
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SecretaryDashboard
