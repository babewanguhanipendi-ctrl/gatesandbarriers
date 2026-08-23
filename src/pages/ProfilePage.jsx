import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { notificationsAPI, authAPI, usersAPI } from '../services/api'
import {
  User, Shield, Bell, AlertTriangle, Mail, Phone, Calendar,
  MapPin, BadgeCheck, Camera, Save, LogOut, X, CheckCircle,
  ChevronRight, Clock, FileText, Building2, Briefcase, Lock, Reply, Send
} from 'lucide-react'
import EmergencyContactModal from '../components/EmergencyContactModal'
import { useNotification } from '../contexts/NotificationContext'

const ROLES_CONFIG = {
  admin: { label: '🛡️ Administrator', color: 'bg-red-100 text-red-700', icon: Shield, emoji: '🛡️' },
  director: { label: '👔 Director', color: 'bg-purple-100 text-purple-700', icon: Shield, emoji: '👔' },
  manager: { label: '📋 Manager', color: 'bg-blue-100 text-blue-700', icon: Briefcase, emoji: '📋' },
  supervisor: { label: '👁️ Supervisor', color: 'bg-cyan-100 text-cyan-700', icon: BadgeCheck, emoji: '👁️' },
  secretary: { label: '📝 Secretary', color: 'bg-amber-100 text-amber-700', icon: FileText, emoji: '📝' },
  guard: { label: '💂 Security Guard', color: 'bg-green-100 text-green-700', icon: Building2, emoji: '💂' }
}

const getRoleGradient = (role) => {
  const gradients = {
    admin: 'from-red-600 to-red-800',
    director: 'from-purple-600 to-purple-800',
    manager: 'from-blue-600 to-blue-800',
    supervisor: 'from-cyan-600 to-cyan-800',
    secretary: 'from-amber-600 to-amber-800',
    guard: 'from-emerald-600 to-emerald-800'
  }
  return gradients[role] || 'from-[#1a2a6c] to-[#b21f1f]'
}

const getGravatarUrl = (email, size = 200) => {
  const hash = btoa(email.trim().toLowerCase()).replace(/\+/g, '-').replace(/\//g, '_')
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`
}

const ProfileTab = ({ profile, onUpdate }) => {
  const { showConfirm } = useNotification()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [form, setForm] = useState({
    phone_number: '',
    emergency_contact: '',
    emergency_phone: '',
    profile_picture_url: ''
  })
  const [showEmergencyContactModal, setShowEmergencyContactModal] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        phone_number: profile.phone_number || '',
        emergency_contact: profile.emergency_contact || '',
        emergency_phone: profile.emergency_phone || '',
        profile_picture_url: profile.profile_picture_url || ''
      })
    }
  }, [profile])


  const handleSave = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      const data = await authAPI.updateProfile(form)
      if (data.user) {
        onUpdate(data.user)
      }
      setSaveMsg('Profile updated successfully')
      setEditing(false)
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err) {
      setSaveMsg(err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const RoleConfig = ROLES_CONFIG[profile?.role] || ROLES_CONFIG.guard
  const RoleIcon = RoleConfig.icon
  const RoleEmoji = RoleConfig.emoji
  const avatarUrl = form.profile_picture_url || getGravatarUrl(profile?.email || '')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className={`bg-gradient-to-r ${getRoleGradient(profile?.role)} px-6 py-8 text-white`}>
          <div className="flex items-center gap-6">
            {/* Avatar */}
            <div className="relative group">
              <div className="w-24 h-24 rounded-full border-4 border-white/50 overflow-hidden bg-white/20 flex items-center justify-center">
                {form.profile_picture_url ? (
                  <img src={form.profile_picture_url} alt="" className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
                ) : null}
                <div className={`w-full h-full ${form.profile_picture_url ? 'hidden' : 'flex'} items-center justify-center text-4xl font-bold text-white/80`}>
                  {profile?.full_name?.charAt(0) || 'U'}
                </div>
              </div>
              {editing && (
                <label className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors">
                  <Camera size={14} className="text-gray-700" />
                  <input type="text" className="hidden" placeholder="Paste image URL"
                    onChange={(e) => setForm({ ...form, profile_picture_url: e.target.value })} />
                </label>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{profile?.full_name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold ${RoleConfig.color}`}>
                  <span className="text-sm">{RoleEmoji}</span>
                  <RoleIcon size={12} />
                  {RoleConfig.label.replace(/^[^\s]+\s/, '')}
                </span>
                <span className="text-white/70 text-sm">#{profile?.work_number}</span>
              </div>
              <p className="text-white/60 text-sm mt-1">{profile?.email}</p>
            </div>
            <button
              onClick={() => setEditing(!editing)}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {editing ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>
        </div>

        {/* Profile Details */}
        <div className="p-6 space-y-4">
          {saveMsg && (
            <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
              saveMsg.includes('success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {saveMsg.includes('success') ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              {saveMsg}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</label>
              <p className="text-gray-900 flex items-center gap-2">
                <Mail size={16} className="text-gray-400" />
                {profile?.email || 'N/A'}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Work Number</label>
              <p className="text-gray-900 flex items-center gap-2">
                <BadgeCheck size={16} className="text-gray-400" />
                {profile?.work_number || 'N/A'}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Phone Number</label>
              {editing ? (
                <input type="tel" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent outline-none" />
              ) : (
                <p className="text-gray-900 flex items-center gap-2">
                  <Phone size={16} className="text-gray-400" />
                  {profile?.phone_number || 'Not set'}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Join Date</label>
              <p className="text-gray-900 flex items-center gap-2">
                <Calendar size={16} className="text-gray-400" />
                {profile?.join_date ? new Date(profile.join_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Emergency Contact</label>
              {editing ? (
                <div className="space-y-2">
                  <input type="text" value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent outline-none" placeholder="Full name" />
                  <input type="tel" value={form.emergency_phone} onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent outline-none" placeholder="+254 7XX XXX XXX" />
                </div>
              ) : (
                <div className="space-y-2">
                  {profile?.emergency_contact ? (
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-gray-900 font-medium">{profile.emergency_contact}</p>
                        {profile.emergency_phone && (
                          <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5">
                            <Phone size={12} />
                            {profile.emergency_phone}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setShowEmergencyContactModal(true)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Update
                        </button>
                        <button
                          onClick={async () => {
                            const confirmed = await showConfirm({
                              title: 'Remove Emergency Contact',
                              message: 'Remove this emergency contact from your profile?',
                              confirmText: 'Remove',
                              variant: 'danger'
                            })
                            if (confirmed) {
                              await authAPI.updateProfile({ emergency_contact: '', emergency_phone: '' })
                              onUpdate(profile)
                            }
                          }}
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowEmergencyContactModal(true)}
                      className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
                    >
                      <Phone size={12} />
                      Add Emergency Contact
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {editing && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Profile Picture URL</label>
              <input type="url" value={form.profile_picture_url} onChange={(e) => setForm({ ...form, profile_picture_url: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent outline-none"
                placeholder="https://example.com/photo.jpg (or leave blank for Gravatar)" />
              <p className="text-xs text-gray-400 mt-1">Leave blank to use Gravatar (based on your email).</p>
            </div>
          )}

          {editing && (
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-gradient-to-r from-[#1a2a6c] to-[#b21f1f] text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Account Info Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Shield size={18} className="text-[#1a2a6c]" />
          Account Information
        </h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-500">Status</span>
            <p className={`font-semibold mt-1 ${profile?.account_status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
              {profile?.account_status?.charAt(0).toUpperCase() + profile?.account_status?.slice(1)}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-500">Uniform</span>
            <p className={`font-semibold mt-1 ${profile?.uniform_status === 'complete' ? 'text-green-600' : 'text-amber-600'}`}>
              {profile?.uniform_status?.charAt(0).toUpperCase() + profile?.uniform_status?.slice(1)}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-500">Last Active</span>
            <p className="font-semibold mt-1 text-gray-700">
              {profile?.last_active_date ? new Date(profile.last_active_date).toLocaleDateString('en-GB') : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

const NotificationsTab = () => {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, unread
  const [selectedNotification, setSelectedNotification] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const params = filter === 'unread' ? { read: false } : {}
      const data = await notificationsAPI.getAll(params)
      setNotifications(data.notifications || [])
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleMarkRead = async (id) => {
    try {
      await notificationsAPI.markAsRead(id)
      setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n))
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllAsRead()
      setNotifications(notifications.map(n => ({ ...n, read: true })))
    } catch (err) {
      console.error('Failed to mark all as read:', err)
    }
  }

  const handleNotificationClick = (notification) => {
    setSelectedNotification(notification)
    if (!notification.read) {
      handleMarkRead(notification.id)
    }
  }

  const handleReply = async () => {
    if (!replyText.trim() || !selectedNotification) return
    
    setActionLoading(true)
    try {
      await notificationsAPI.reply(selectedNotification.id, { message: replyText })
      alert('Reply sent successfully!')
      setReplyText('')
      setSelectedNotification(null)
      fetchNotifications()
    } catch (err) {
      alert('Failed to send reply: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRequestService = async () => {
    if (!selectedNotification) return
    
    setActionLoading(true)
    try {
      await notificationsAPI.requestService(selectedNotification.id)
      alert('Service request submitted successfully!')
      setSelectedNotification(null)
      fetchNotifications()
    } catch (err) {
      alert('Failed to request service: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleNavigateToService = () => {
    if (selectedNotification?.action_url) {
      // Use React Router navigation instead of window.location.href
      navigate(selectedNotification.action_url)
      setSelectedNotification(null)
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'border-l-red-500 bg-red-50'
      case 'high': return 'border-l-orange-500 bg-orange-50'
      case 'medium': return 'border-l-blue-500 bg-blue-50'
      default: return 'border-l-gray-400 bg-gray-50'
    }
  }

  const getPriorityDot = (priority) => {
    switch (priority) {
      case 'critical': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-blue-500'
      default: return 'bg-gray-400'
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell size={20} className="text-[#1a2a6c]" />
            <h2 className="text-lg font-bold text-gray-900">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full">{unreadCount} new</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setFilter('all')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filter === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>All</button>
              <button onClick={() => setFilter('unread')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filter === 'unread' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Unread</button>
            </div>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-[#1a2a6c] hover:underline font-medium">Mark all read</button>
            )}
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell size={40} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium">No notifications</p>
              <p className="text-gray-400 text-sm mt-1">You're all caught up!</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div 
                key={n.id} 
                className={`p-4 border-l-4 transition-colors cursor-pointer ${n.read ? 'border-l-transparent hover:bg-gray-50' : getPriorityColor(n.priority)}`}
                onClick={() => handleNotificationClick(n)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {!n.read && <span className={`w-2 h-2 rounded-full ${getPriorityDot(n.priority)}`} />}
                      <h4 className={`text-sm ${n.read ? 'text-gray-600' : 'text-gray-900 font-semibold'}`}>{n.title}</h4>
                      <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${n.priority === 'critical' ? 'bg-red-100 text-red-600' : n.priority === 'high' ? 'bg-orange-100 text-orange-600' : n.priority === 'medium' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>{n.priority}</span>
                    </div>
                    <p className="text-sm text-gray-500">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString('en-GB')}</p>
                    {n.action_url && (
                      <p className="text-xs text-blue-600 mt-1 font-medium">Click to view details →</p>
                    )}
                  </div>
                  {!n.read && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMarkRead(n.id)
                      }} 
                      className="p-1.5 hover:bg-white rounded-lg transition-colors shrink-0" 
                      title="Mark as read"
                    >
                      <CheckCircle size={16} className="text-gray-400 hover:text-green-500" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">{selectedNotification.title}</h2>
                <button
                  onClick={() => {
                    setSelectedNotification(null)
                    setReplyText('')
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">{new Date(selectedNotification.created_at).toLocaleString('en-GB')}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Message</p>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedNotification.message}</p>
                </div>
              </div>

              {selectedNotification.action_url && (
                <div className="flex gap-3">
                  <button
                    onClick={handleNavigateToService}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 transition-colors"
                  >
                    <ChevronRight size={18} />
                    View Details
                  </button>
                </div>
              )}

              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reply to this notification
                </label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                  placeholder="Type your reply here..."
                />
                <div className="flex gap-3 mt-3">
                  <button
                    onClick={handleReply}
                    disabled={actionLoading || !replyText.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <Reply size={18} />
                    Send Reply
                  </button>
                  <button
                    onClick={handleRequestService}
                    disabled={actionLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Send size={18} />
                    Request Service
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const SecurityTab = ({ profile, onUpdate }) => {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }
    
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      await authAPI.changePassword(currentPassword, newPassword)
      setMessage('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Lock size={20} className="text-[#1a2a6c]" />
            <h2 className="text-lg font-bold text-gray-900">Change Password</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">Update your password to keep your account secure</p>
        </div>

        <div className="p-6">
          {message && (
            <div className="mb-4 p-3 rounded-lg text-sm flex items-center gap-2 bg-green-100 text-green-700">
              <CheckCircle size={16} />
              {message}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm flex items-center gap-2 bg-red-100 text-red-700">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent outline-none"
                placeholder="Enter current password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent outline-none"
                placeholder="Minimum 6 characters"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent outline-none"
                placeholder="Re-enter new password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-[#1a2a6c] to-[#b21f1f] text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

const PendingIssuesTab = ({ profile }) => {
  const issues = []

  // Check for pending items based on user role and profile data
  if (!profile?.phone_number) {
    issues.push({
      icon: Phone,
      color: 'text-orange-500',
      bg: 'bg-orange-50',
      title: 'Phone number not set',
      description: 'Add your phone number in your profile settings.',
      severity: 'warning'
    })
  }

  if (!profile?.emergency_contact || !profile?.emergency_phone) {
    issues.push({
      icon: User,
      color: 'text-amber-500',
      bg: 'bg-amber-50',
      title: 'Emergency contact missing',
      description: 'Set an emergency contact and phone number.',
      severity: 'warning'
    })
  }

  if (profile?.uniform_status === 'pending') {
    issues.push({
      icon: Shield,
      color: 'text-purple-500',
      bg: 'bg-purple-50',
      title: 'Uniform pending',
      description: 'Your uniform status is marked as pending. Contact your manager.',
      severity: 'info'
    })
  }

  if (profile?.account_status === 'resigning') {
    issues.push({
      icon: AlertTriangle,
      color: 'text-red-500',
      bg: 'bg-red-50',
      title: 'Resignation in process',
      description: 'Your resignation is being processed.',
      severity: 'critical'
    })
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <AlertTriangle size={20} className="text-[#1a2a6c]" />
          <h2 className="text-lg font-bold text-gray-900">Pending Issues</h2>
          {issues.length > 0 && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-600 text-xs font-bold rounded-full">{issues.length} items</span>
          )}
        </div>

        <div className="p-6">
          {issues.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-500" />
              </div>
              <p className="text-gray-900 font-semibold">All Clear!</p>
              <p className="text-gray-500 text-sm mt-1">No pending issues require your attention.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {issues.map((issue, i) => {
                const Icon = issue.icon
                return (
                  <div key={i} className={`flex items-start gap-4 p-4 rounded-xl ${issue.bg} border border-transparent`}>
                    <div className={`w-10 h-10 rounded-lg ${issue.bg} flex items-center justify-center shrink-0`}>
                      <Icon size={20} className={issue.color} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 text-sm">{issue.title}</h4>
                      <p className="text-gray-500 text-sm mt-0.5">{issue.description}</p>
                    </div>
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                      issue.severity === 'critical' ? 'bg-red-100 text-red-600' :
                      issue.severity === 'warning' ? 'bg-amber-100 text-amber-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>{issue.severity}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const ProfilePage = () => {
  const { profile, fetchProfile } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [showEmergencyContactModal, setShowEmergencyContactModal] = useState(false)

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'issues', label: 'Pending Issues', icon: AlertTriangle },
  ]

  return (
    <div className="min-h-[calc(100vh-6rem)] mobile-bottom-padding">
      {/* Page Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">Manage your account settings and view notifications</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 sm:mb-6 bg-white rounded-xl p-1 shadow-sm border border-gray-100 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-gradient-to-r from-[#1a2a6c] to-[#b21f1f] text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && <ProfileTab profile={profile} onUpdate={(updated) => fetchProfile()} />}
      {activeTab === 'security' && <SecurityTab profile={profile} onUpdate={(updated) => fetchProfile()} />}
      {activeTab === 'notifications' && <NotificationsTab />}
      {activeTab === 'issues' && <PendingIssuesTab profile={profile} />}

      {/* Emergency Contact Modal */}
      {showEmergencyContactModal && profile && (
        <EmergencyContactModal
          isOpen={showEmergencyContactModal}
          onClose={() => setShowEmergencyContactModal(false)}
          userId={profile.id}
          userData={profile}
          onSuccess={(updatedUser) => {
            fetchProfile() // Refresh profile data
          }}
        />
      )}
    </div>
  )
}

export default ProfilePage