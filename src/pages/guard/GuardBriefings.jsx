import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { FileText, Clock, User, MapPin, Check, X, RefreshCw, AlertTriangle } from 'lucide-react'

const GuardBriefings = () => {
  const { profile } = useAuth()
  const [briefings, setBriefings] = useState([])
  const [handovers, setHandovers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('briefings')

  useEffect(() => {
    fetchBriefings()
    fetchHandovers()
  }, [])

  const fetchBriefings = async () => {
    try {
      setRefreshing(true)
      // Fetch briefings/notices for this guard
      const response = await fetch('/api/notifications?type=briefing&user_id=' + profile.id)
      const data = await response.json()
      setBriefings(data.notifications || [])
    } catch (error) {
      console.error('Error fetching briefings:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const fetchHandovers = async () => {
    try {
      const response = await fetch('/api/shifts/handovers')
      const data = await response.json()
      setHandovers(data.handovers || [])
    } catch (error) {
      console.error('Error fetching handovers:', error)
    }
  }

  const markHandoverAsRead = async (handoverId) => {
    try {
      await fetch(`/api/shifts/handovers/${handoverId}/read`, {
        method: 'PATCH'
      })
      fetchHandovers()
    } catch (error) {
      console.error('Error marking handover as read:', error)
    }
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return '--'
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
          <div className="text-lg text-gray-600">Loading briefings...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-8 h-8 text-[#1a2a6c]" />
                My Briefings
              </h1>
              <p className="text-gray-600 mt-1">Digital logbook and shift handover notes</p>
            </div>
            <button
              onClick={() => {
                fetchBriefings()
                fetchHandovers()
              }}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
          <button
            onClick={() => setActiveTab('briefings')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'briefings'
                ? 'bg-gradient-to-r from-[#1a2a6c] to-[#b21f1f] text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Briefings ({briefings.length})
          </button>
          <button
            onClick={() => setActiveTab('handovers')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'handovers'
                ? 'bg-gradient-to-r from-[#1a2a6c] to-[#b21f1f] text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Handover Notes ({handovers.length})
          </button>
        </div>

        {/* Briefings Tab */}
        {activeTab === 'briefings' && (
          <div>
            {briefings.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No briefings yet</p>
                <p className="text-sm text-gray-400 mt-1">Briefings will appear here when your supervisor posts them</p>
              </div>
            ) : (
              <div className="space-y-4">
                {briefings.map((briefing) => (
                  <div
                    key={briefing.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{briefing.title}</h3>
                          <p className="text-sm text-gray-500 mt-1">{briefing.message}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        briefing.read ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {briefing.read ? 'Read' : 'Unread'}
                      </span>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>{formatDate(briefing.created_at)}</span>
                      </div>
                      {briefing.metadata && (
                        <>
                          {briefing.metadata.site_name && (
                            <div className="flex items-center gap-1">
                              <MapPin size={14} />
                              <span>{briefing.metadata.site_name}</span>
                            </div>
                          )}
                          {briefing.metadata.shift_type && (
                            <div className="flex items-center gap-1">
                              <User size={14} />
                              <span className="capitalize">{briefing.metadata.shift_type} shift</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {!briefing.read && (
                        <button className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors">
                          <Check size={14} />
                          Mark as Read
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Handovers Tab */}
        {activeTab === 'handovers' && (
          <div>
            {handovers.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No handover notes yet</p>
                <p className="text-sm text-gray-400 mt-1">Handover notes will appear here when you submit or receive them</p>
              </div>
            ) : (
              <div className="space-y-4">
                {handovers.map((handover) => (
                  <div
                    key={handover.id}
                    className={`bg-white rounded-xl shadow-sm border-2 p-6 hover:shadow-md transition-shadow ${
                      handover.status === 'pending' ? 'border-orange-300' : 'border-gray-200'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          handover.status === 'pending' ? 'bg-orange-100' : 'bg-green-100'
                        }`}>
                          <FileText className={`w-5 h-5 ${
                            handover.status === 'pending' ? 'text-orange-600' : 'text-green-600'
                          }`} />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {handover.from_guard_name} → {handover.to_guard_name || 'You'}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">{handover.site_name} - {handover.location}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        handover.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                        handover.status === 'read' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {handover.status}
                      </span>
                    </div>

                    {/* Handover Notes */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{handover.notes}</p>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>{formatDate(handover.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User size={14} />
                        <span>From: {handover.from_guard_work_number}</span>
                      </div>
                      {handover.to_guard_work_number && (
                        <div className="flex items-center gap-1">
                          <User size={14} />
                          <span>To: {handover.to_guard_work_number}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {handover.status === 'pending' && handover.next_guard_id === profile.id && (
                      <div className="mt-4">
                        <button
                          onClick={() => markHandoverAsRead(handover.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <Check size={14} />
                          Mark as Read
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default GuardBriefings