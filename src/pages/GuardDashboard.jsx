import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getResignationCountdown } from '../services/businessLogic'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Package,
  Check,
  X,
  Clock
} from 'lucide-react'
import ShiftTimer from '../components/ShiftTimer'

const GuardDashboard = () => {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [resignationData, setResignationData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showUniformModal, setShowUniformModal] = useState(false)
  const [uniformConfirmed, setUniformConfirmed] = useState(false)
  const [currentShift, setCurrentShift] = useState(null)

  // Uniform items configuration
  const uniformItems = [
    { id: 'shirt', name: 'Shirt', compulsory: true, price: 3000, description: 'Security uniform shirt' },
    { id: 'rungu', name: 'Rungu', compulsory: true, price: 0, description: 'Traditional security baton' },
    { id: 'rungu_holder', name: 'Rungu Holder', compulsory: true, price: 0, description: 'Holder for rungu' },
    { id: 'trouser', name: 'Trouser', compulsory: true, price: 0, description: 'Security uniform trouser' },
    { id: 'belt', name: 'Belt', compulsory: true, price: 0, description: 'Security belt' },
    { id: 'whistle', name: 'Whistle', compulsory: true, price: 0, description: 'Signaling whistle' },
    { id: 'shoes', name: 'Shoes', compulsory: false, price: 3000, description: 'Security boots/shoes' },
    { id: 'raincoat', name: 'Raincoat', compulsory: false, price: 0, description: 'Issued by Manager per site requirements' },
    { id: 'torch', name: 'Torch', compulsory: false, price: 0, description: 'Flashlight for night shifts' }
  ]

  useEffect(() => {
    loadDashboardData()
    fetchCurrentShift()
  }, [])

  const fetchCurrentShift = async () => {
    try {
      const response = await fetch('/api/shifts?status=scheduled&guard_id=' + profile.id)
      const data = await response.json()
      const openShift = data.shifts?.find(s => s.status === 'scheduled' && s.start_time && !s.end_time)
      if (openShift) {
        setCurrentShift(openShift)
      }
    } catch (error) {
      console.error('Error fetching current shift:', error)
    }
  }

  const loadDashboardData = async () => {
    try {
      // Load resignation countdown if applicable
      const resignationResult = await getResignationCountdown()
      const myResignation = resignationResult.find(r => r.id === profile.id)
      if (myResignation) {
        setResignationData(myResignation)
      }
      
      // Check if guard has confirmed uniform terms (check localStorage for demo)
      const confirmed = localStorage.getItem(`uniform_confirmed_${profile.id}`)
      if (!confirmed) {
        setShowUniformModal(true)
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmUniform = () => {
    localStorage.setItem(`uniform_confirmed_${profile.id}`, 'true')
    setUniformConfirmed(true)
    setShowUniformModal(false)
  }

  const dashboardCards = [
    {
      emoji: '⏰',
      label: 'Clock In/Out',
      path: '/guard/attendance'
    },
    ...(currentShift ? [{
      emoji: '✅',
      label: 'On Shift',
      path: '/guard/attendance'
    }] : []),
    {
      emoji: '⚠️',
      label: 'Report Incident',
      path: '/guard/incidents'
    },
    {
      emoji: '📝',
      label: 'My Briefings',
      path: '/guard/briefings'
    },
    {
      emoji: '📅',
      label: 'My Schedule',
      path: '/guard/schedule'
    },
    {
      emoji: '📞',
      label: 'Emergency Contacts',
      path: '/profile'
    },
    {
      emoji: '📦',
      label: 'Uniform',
      path: '/guard/uniform'
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
          <div className="text-xl text-gray-600">Loading dashboard...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Guard Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back, {profile?.full_name}. Ready for your shift?</p>
        </div>
      </div>

      {/* Resignation Countdown Banner */}
      {resignationData && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-red-900 mb-2">Resignation Notice Period</h2>
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-red-700 font-medium">Days Remaining</span>
                        <span className="text-red-900 font-bold">{resignationData.daysRemaining} days</span>
                      </div>
                      <div className="w-full bg-red-200 rounded-full h-3">
                        <div 
                          className="bg-gradient-to-r from-red-500 to-orange-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${(resignationData.daysRemaining / 30) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-red-600" />
                    <span className="text-red-700">
                      Account will be disabled on: <strong>{resignationData.accountDisableDate}</strong>
                    </span>
                  </div>
                  {resignationData.isComplianceRisk && (
                    <div className="flex items-center gap-2 p-3 bg-red-100 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <p className="text-sm text-red-800">
                        <strong>Compliance Warning:</strong> No formal resignation letter uploaded.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Shift Timer */}
      {currentShift && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-green-500 p-3 rounded-full">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-green-900">Currently On Shift</h3>
                  <p className="text-sm text-green-700">
                    {currentShift.site_client} - {currentShift.shift_type} shift
                  </p>
                </div>
              </div>
              <ShiftTimer
                startTime={currentShift.start_time}
                endTime={currentShift.end_time}
                shiftType={currentShift.shift_type}
              />
            </div>
          </div>
        </div>
      )}

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

      {/* Uniform Terms Modal for New Guards */}
      {showUniformModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-[#1a2a6c]" />
                Uniform Allocation Terms
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Please review and confirm your uniform allocation
              </p>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Uniform Items</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Item</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Type</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Price (KES)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {uniformItems.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">{item.name}</td>
                          <td className="px-4 py-2 text-sm">
                            {item.compulsory ? (
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                                Compulsory
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">
                                Optional
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">
                            {item.price > 0 ? `KES ${item.price.toLocaleString()}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800">Important Terms & Conditions</p>
                      <ul className="text-xs text-yellow-700 mt-2 space-y-1">
                        <li>• KES 1,000 is deducted monthly from your salary for 3 months (total KES 3,000)</li>
                        <li>• The deduction covers the compulsory uniform set (Shirt, Rungu, Rungu Holder, Trouser, Belt, Whistle)</li>
                        <li>• If you resign following the correct procedure and return all company items, the KES 3,000 will be refunded</li>
                        <li>• Shoes are optional at KES 3,000 (one-time payment)</li>
                        <li>• Raincoat and Torch are issued by Manager according to site requirements</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowUniformModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <X className="w-4 h-4 inline mr-1" />
                Decline
              </button>
              <button
                onClick={handleConfirmUniform}
                className="px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90"
              >
                <Check className="w-4 h-4 inline mr-1" />
                I Confirm & Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GuardDashboard