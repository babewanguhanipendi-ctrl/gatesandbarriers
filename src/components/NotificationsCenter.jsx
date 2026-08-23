import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, ROLES } from '../contexts/AuthContext'
import { notificationsAPI } from '../services/api'
import { useNotification } from '../contexts/NotificationContext'
import {
  X,
  ExternalLink,
  Check,
  Clock,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  FileText,
  Users,
  DollarSign,
  Shield,
  Calendar,
  Package,
  Trash2
} from 'lucide-react'

/**
 * NotificationsCenter - Dropdown notification center with clickable items
 * Shows recent notifications with action buttons based on notification type and user role
 */
const NotificationsCenter = ({ isOpen, onClose }) => {
  const navigate = useNavigate()
  const { profile, hasRole } = useAuth()
  const { showModal, closeGenericModal } = useNotification()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)

  const parseMetadata = (notification) => {
    if (!notification?.metadata) return {}
    if (typeof notification.metadata === 'object') return notification.metadata
    try {
      return JSON.parse(notification.metadata)
    } catch (error) {
      console.error('Invalid notification metadata:', error)
      return {}
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadNotifications()
    }
  }, [isOpen])

  const loadNotifications = async () => {
    try {
      setLoading(true)
      const data = await notificationsAPI.getAll()
      setNotifications(data.notifications || [])
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNotificationClick = async (notification) => {
    // Mark as read
    try {
      await notificationsAPI.markAsRead(notification.id)
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      )
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }

    // Parse metadata
    const metadata = parseMetadata(notification)

    const { entity_type, entity_id, action_type, link_url } = metadata

    // Handle different notification types based on user role
    if (hasRole(ROLES.DIRECTOR) || hasRole(ROLES.ADMIN)) {
      handleDirectorNotification(notification, metadata)
    } else if (hasRole(ROLES.MANAGER)) {
      handleManagerNotification(notification, metadata)
    } else if (hasRole(ROLES.SECRETARY)) {
      handleSecretaryNotification(notification, metadata)
    } else if (hasRole(ROLES.SUPERVISOR)) {
      handleSupervisorNotification(notification, metadata)
    } else {
      // Default: navigate to link_url if available
      if (link_url) {
        navigate(link_url)
        onClose()
      }
    }
  }

  const handleDirectorNotification = (notification, metadata) => {
    const { entity_type, entity_id, action_type, link_url } = metadata

    if (entity_type === 'application' || entity_type === 'guard_application') {
      // Director action modal for guard applications
      showModal({
        title: 'Guard Application Action',
        subtitle: notification.title,
        icon: <Users className="w-6 h-6 text-blue-600" />,
        size: 'md',
        children: (
          <div className="space-y-4">
            <p className="text-gray-700">{notification.message}</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium mb-2">Available Actions:</p>
              <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                <li><strong>Hire / Final Sign-Off</strong> - Approve and hire the candidate</li>
                <li><strong>Put to Pending</strong> - Hold for further review</li>
                <li><strong>Reject Application</strong> - Decline the application</li>
              </ul>
            </div>
          </div>
        ),
        footer: (
          <div className="flex gap-3">
            <button
              onClick={() => {
                closeGenericModal()
                navigate(`/director/applicants`)
                onClose()
              }}
              className="flex-1 px-4 py-2.5 bg-[#1a2a6c] text-white rounded-lg font-semibold hover:bg-[#1a2a6c]/90 transition-colors"
            >
              View & Hire
            </button>
            <button
              onClick={() => {
                closeGenericModal()
                navigate(`/director/requests`)
                onClose()
              }}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              Contracts
            </button>
          </div>
        )
      })
    } else if (entity_type === 'payroll_run' || entity_type === 'payroll') {
      // Director action modal for payroll
      showModal({
        title: 'Payroll Action Required',
        subtitle: notification.title,
        icon: <DollarSign className="w-6 h-6 text-green-600" />,
        size: 'md',
        children: (
          <div className="space-y-4">
            <p className="text-gray-700">{notification.message}</p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800 font-medium mb-2">Available Actions:</p>
              <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
                <li><strong>Final Sign-Off</strong> - Approve payroll calculations</li>
                <li><strong>Put to Pending</strong> - Request revisions</li>
                <li><strong>Authorize Treasury Release</strong> - Release funds (after sign-off)</li>
              </ul>
            </div>
          </div>
        ),
        footer: (
          <div className="flex gap-3">
            <button
              onClick={() => {
                closeGenericModal()
                navigate(`/director/payroll`)
                onClose()
              }}
              className="flex-1 px-4 py-2.5 bg-[#1a2a6c] text-white rounded-lg font-semibold hover:bg-[#1a2a6c]/90 transition-colors"
            >
              Review Payroll
            </button>
            <button
              onClick={() => {
                closeGenericModal()
                navigate(`/director/financial-reports`)
                onClose()
              }}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              Financial Reports
            </button>
          </div>
        )
      })
    } else if (entity_type === 'treasury_disbursement') {
      // Director action modal for treasury
      showModal({
        title: 'Treasury Disbursement',
        subtitle: notification.title,
        icon: <DollarSign className="w-6 h-6 text-purple-600" />,
        size: 'md',
        children: (
          <div className="space-y-4">
            <p className="text-gray-700">{notification.message}</p>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm text-purple-800 font-medium mb-2">Available Actions:</p>
              <ul className="text-sm text-purple-700 space-y-1 list-disc list-inside">
                <li><strong>Authorize Release</strong> - Approve fund disbursement</li>
                <li><strong>Reject</strong> - Return for revision</li>
              </ul>
            </div>
          </div>
        ),
        footer: (
          <div className="flex gap-3">
            <button
              onClick={() => {
                closeGenericModal()
                navigate(`/director/payroll`)
                onClose()
              }}
              className="flex-1 px-4 py-2.5 bg-[#1a2a6c] text-white rounded-lg font-semibold hover:bg-[#1a2a6c]/90 transition-colors"
            >
              Authorize Disbursement
            </button>
            <button
              onClick={closeGenericModal}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              Close
            </button>
          </div>
        )
      })
    } else if (link_url) {
      navigate(link_url)
      onClose()
    }
  }

  const handleManagerNotification = (notification, metadata) => {
    const { entity_type, entity_id, link_url } = metadata

    if (entity_type === 'incident' || entity_type === 'audit') {
      showModal({
        title: 'Incident Report Action',
        subtitle: notification.title,
        icon: <AlertTriangle className="w-6 h-6 text-red-600" />,
        size: 'md',
        children: (
          <div className="space-y-4">
            <p className="text-gray-700">{notification.message}</p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium mb-2">Available Actions:</p>
              <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                <li><strong>Resolve Incident</strong> - Mark as resolved</li>
                <li><strong>Escalate</strong> - Forward to director</li>
                <li><strong>Add Notes</strong> - Update incident details</li>
              </ul>
            </div>
          </div>
        ),
        footer: (
          <div className="flex gap-3">
            <button
              onClick={() => {
                closeGenericModal()
                navigate(`/manager/incidents`)
                onClose()
              }}
              className="flex-1 px-4 py-2.5 bg-[#1a2a6c] text-white rounded-lg font-semibold hover:bg-[#1a2a6c]/90 transition-colors"
            >
              View Incidents
            </button>
            <button
              onClick={closeGenericModal}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              Close
            </button>
          </div>
        )
      })
    } else if (entity_type === 'roster' || entity_type === 'shift') {
      showModal({
        title: 'Roster Management',
        subtitle: notification.title,
        icon: <Calendar className="w-6 h-6 text-blue-600" />,
        size: 'md',
        children: (
          <div className="space-y-4">
            <p className="text-gray-700">{notification.message}</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium mb-2">Available Actions:</p>
              <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                <li><strong>View Schedule</strong> - Review shift assignments</li>
                <li><strong>Reallocate</strong> - Reassign guards to sites</li>
                <li><strong>Coverage Report</strong> - Check site coverage</li>
              </ul>
            </div>
          </div>
        ),
        footer: (
          <div className="flex gap-3">
            <button
              onClick={() => {
                closeGenericModal()
                navigate(`/manager/shifts`)
                onClose()
              }}
              className="flex-1 px-4 py-2.5 bg-[#1a2a6c] text-white rounded-lg font-semibold hover:bg-[#1a2a6c]/90 transition-colors"
            >
              Manage Shifts
            </button>
            <button
              onClick={closeGenericModal}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              Close
            </button>
          </div>
        )
      })
    } else if (link_url) {
      navigate(link_url)
      onClose()
    }
  }

  const handleSecretaryNotification = (notification, metadata) => {
    const { entity_type, entity_id, link_url } = metadata

    if (entity_type === 'uniform_request' || entity_type === 'gear_request') {
      showModal({
        title: 'Uniform/Gear Request',
        subtitle: notification.title,
        icon: <Package className="w-6 h-6 text-orange-600" />,
        size: 'md',
        children: (
          <div className="space-y-4">
            <p className="text-gray-700">{notification.message}</p>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-orange-800 font-medium mb-2">Available Actions:</p>
              <ul className="text-sm text-orange-700 space-y-1 list-disc list-inside">
                <li><strong>Allocate Inventory</strong> - Assign uniform items</li>
                <li><strong>Schedule Delivery</strong> - Set delivery date</li>
                <li><strong>Update Status</strong> - Mark as disbursed/rejected</li>
              </ul>
            </div>
          </div>
        ),
        footer: (
          <div className="flex gap-3">
            <button
              onClick={() => {
                closeGenericModal()
                navigate(`/secretary/uniform`)
                onClose()
              }}
              className="flex-1 px-4 py-2.5 bg-[#1a2a6c] text-white rounded-lg font-semibold hover:bg-[#1a2a6c]/90 transition-colors"
            >
              Manage Uniforms
            </button>
            <button
              onClick={closeGenericModal}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              Close
            </button>
          </div>
        )
      })
    } else if (entity_type === 'contract' || entity_type === 'document') {
      showModal({
        title: 'Contract Document',
        subtitle: notification.title,
        icon: <FileText className="w-6 h-6 text-purple-600" />,
        size: 'md',
        children: (
          <div className="space-y-4">
            <p className="text-gray-700">{notification.message}</p>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm text-purple-800 font-medium mb-2">Available Actions:</p>
              <ul className="text-sm text-purple-700 space-y-1 list-disc list-inside">
                <li><strong>Review Contract</strong> - View and edit details</li>
                <li><strong>Send Email</strong> - Email to contractor</li>
                <li><strong>Archive</strong> - Move to completed</li>
              </ul>
            </div>
          </div>
        ),
        footer: (
          <div className="flex gap-3">
            <button
              onClick={() => {
                closeGenericModal()
                navigate(`/secretary/contracts`)
                onClose()
              }}
              className="flex-1 px-4 py-2.5 bg-[#1a2a6c] text-white rounded-lg font-semibold hover:bg-[#1a2a6c]/90 transition-colors"
            >
              View Contracts
            </button>
            <button
              onClick={closeGenericModal}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              Close
            </button>
          </div>
        )
      })
    } else if (link_url) {
      navigate(link_url)
      onClose()
    }
  }

  const handleSupervisorNotification = (notification, metadata) => {
    const { entity_type, entity_id, link_url } = metadata

    if (entity_type === 'incident' || entity_type === 'audit') {
      showModal({
        title: 'Incident Report',
        subtitle: notification.title,
        icon: <AlertTriangle className="w-6 h-6 text-red-600" />,
        size: 'md',
        children: (
          <div className="space-y-4">
            <p className="text-gray-700">{notification.message}</p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium mb-2">Available Actions:</p>
              <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                <li><strong>Resolve</strong> - Mark incident as resolved</li>
                <li><strong>Escalate</strong> - Forward to manager</li>
                <li><strong>View Details</strong> - Full incident report</li>
              </ul>
            </div>
          </div>
        ),
        footer: (
          <div className="flex gap-3">
            <button
              onClick={() => {
                closeGenericModal()
                navigate(`/supervisor/incidents`)
                onClose()
              }}
              className="flex-1 px-4 py-2.5 bg-[#1a2a6c] text-white rounded-lg font-semibold hover:bg-[#1a2a6c]/90 transition-colors"
            >
              View Incidents
            </button>
            <button
              onClick={closeGenericModal}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              Close
            </button>
          </div>
        )
      })
    } else if (entity_type === 'uniform_request' || entity_type === 'delivery') {
      showModal({
        title: 'Uniform Delivery',
        subtitle: notification.title,
        icon: <Package className="w-6 h-6 text-orange-600" />,
        size: 'md',
        children: (
          <div className="space-y-4">
            <p className="text-gray-700">{notification.message}</p>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-orange-800 font-medium mb-2">Available Actions:</p>
              <ul className="text-sm text-orange-700 space-y-1 list-disc list-inside">
                <li><strong>Confirm Delivery</strong> - Mark as delivered</li>
                <li><strong>Schedule Delivery</strong> - Set delivery date</li>
                <li><strong>Update Status</strong> - Mark as delayed</li>
              </ul>
            </div>
          </div>
        ),
        footer: (
          <div className="flex gap-3">
            <button
              onClick={() => {
                closeGenericModal()
                navigate(`/supervisor/uniform-delivery`)
                onClose()
              }}
              className="flex-1 px-4 py-2.5 bg-[#1a2a6c] text-white rounded-lg font-semibold hover:bg-[#1a2a6c]/90 transition-colors"
            >
              Manage Deliveries
            </button>
            <button
              onClick={closeGenericModal}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              Close
            </button>
          </div>
        )
      })
    } else if (link_url) {
      navigate(link_url)
      onClose()
    }
  }

  const getNotificationIcon = (notification) => {
    const metadata = parseMetadata(notification)

    const { entity_type, priority } = metadata

    if (priority === 'critical') return <AlertTriangle className="w-5 h-5 text-red-600" />
    if (priority === 'high') return <AlertTriangle className="w-5 h-5 text-orange-600" />
    
    if (entity_type === 'application' || entity_type === 'guard_application') return <Users className="w-5 h-5 text-blue-600" />
    if (entity_type === 'payroll_run' || entity_type === 'payroll') return <DollarSign className="w-5 h-5 text-green-600" />
    if (entity_type === 'incident' || entity_type === 'audit') return <AlertTriangle className="w-5 h-5 text-red-600" />
    if (entity_type === 'uniform_request' || entity_type === 'gear_request') return <Package className="w-5 h-5 text-orange-600" />
    if (entity_type === 'contract' || entity_type === 'document') return <FileText className="w-5 h-5 text-purple-600" />
    if (entity_type === 'treasury_disbursement') return <DollarSign className="w-5 h-5 text-purple-600" />
    
    return <Info className="w-5 h-5 text-blue-600" />
  }

  const getPriorityBadge = (notification) => {
    const metadata = parseMetadata(notification)
    
    const priority = metadata.priority || notification.priority || 'medium'
    
    const styles = {
      low: 'bg-gray-100 text-gray-700',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      critical: 'bg-red-100 text-red-700'
    }

    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[priority] || styles.medium}`}>
        {priority}
      </span>
    )
  }

  const formatTime = (dateString) => {
    if (!dateString) return 'Unknown time'
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return 'Unknown time'
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  const formatNotificationDate = (dateString) => {
    if (!dateString) return null
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const isAttendanceNotification = (notification, metadata) => {
    return notification.type === 'attendance' || metadata.clock_in_type || metadata.clock_out_type || /clocked in|clocked out/i.test(notification.title || '')
  }

  const getActionLabel = (metadata) => {
    if (metadata.action_type === 'request_service') return 'Request Service'
    if (metadata.action_type === 'reply') return 'Reply'
    if (metadata.action_type === 'confirm_receipt') return 'Confirm Receipt'
    if (metadata.action_type === 'allocate') return 'Process Request'
    return 'Open'
  }

  const handleNotificationDelete = async (notificationId) => {
    try {
      await notificationsAPI.delete(notificationId)
      setNotifications(prev => prev.filter(notification => notification.id !== notificationId))
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  }

  const handleNotificationAction = (metadata) => {
    const actionUrl = metadata.action_url || metadata.link_url
    if (actionUrl) {
      navigate(actionUrl)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-[70]"
        onClick={onClose}
      />

      {/* Notifications Panel */}
      <div className="fixed top-14 right-4 z-[80] w-96 max-h-[600px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sky-900 bg-sky-950">
          <div>
            <h3 className="text-lg font-bold text-white">Notifications</h3>
            <p className="text-xs text-sky-100">
              {notifications.filter(n => !n.read).length} unread
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Notifications List */}
        <div className="overflow-y-auto max-h-[500px]">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="w-6 h-6 border-3 border-[#1a2a6c] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Info className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') handleNotificationClick(notification)
                  }}
                  role="button"
                  tabIndex={0}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                    !notification.read ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-gray-900 truncate">{notification.title}</h4>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!notification.read && <span className="w-2 h-2 bg-blue-600 rounded-full mt-1.5"></span>}
                          <button
                            type="button"
                            aria-label="Delete notification"
                            title="Delete notification"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleNotificationDelete(notification.id)
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                        {notification.message}
                      </p>

                      {(() => {
                        const metadata = parseMetadata(notification)
                        const requestDate = formatNotificationDate(metadata.requested_at || metadata.event_date || metadata.created_at)
                        const displayName = metadata.guard_name || metadata.requester_name || metadata.applicant_name
                        return (displayName || requestDate) ? (
                          <p className="text-xs text-gray-500 mb-2">
                            {displayName ? `Name: ${displayName}` : ''}
                            {displayName && requestDate ? ' | ' : ''}
                            {requestDate ? `Date: ${requestDate}` : ''}
                          </p>
                        ) : null
                      })()}

                      <div className="flex items-center gap-2">
                        {getPriorityBadge(notification)}
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock size={12} />
                          {formatTime(notification.created_at)}
                        </span>
                      </div>

                      {(() => {
                        const metadata = parseMetadata(notification)
                        const hasAction = !isAttendanceNotification(notification, metadata) && (metadata.action_url || metadata.link_url)
                        const canReply = !isAttendanceNotification(notification, metadata) && metadata.reply_allowed === true
                        return (hasAction || canReply) ? (
                          <div className="mt-2 flex items-center gap-2">
                            {hasAction && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleNotificationAction(metadata)
                                }}
                                className="inline-flex items-center gap-1 text-xs text-[#1a2a6c] font-medium hover:underline"
                              >
                                <ExternalLink size={12} /> {getActionLabel(metadata)}
                              </button>
                            )}
                            {canReply && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleNotificationAction({ ...metadata, action_url: metadata.reply_url || metadata.link_url })
                                }}
                                className="inline-flex items-center gap-1 text-xs text-[#1a2a6c] font-medium hover:underline"
                              >
                                Reply
                              </button>
                            )}
                          </div>
                        ) : null
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <button
              onClick={async () => {
                try {
                  await notificationsAPI.markAllAsRead()
                  setNotifications(prev => prev.map(n => ({ ...n, read: true })))
                } catch (error) {
                  console.error('Failed to mark all as read:', error)
                }
              }}
              className="w-full text-xs text-[#1a2a6c] hover:text-[#1a2a6c]/80 font-medium py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Mark all as read
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default NotificationsCenter