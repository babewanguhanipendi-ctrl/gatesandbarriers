import { useState, useEffect } from 'react'
import { supervisorAPI } from '../../services/api'
import { useNavigate } from 'react-router-dom'
import { Send, Upload, FileText, Users, Archive, ChevronDown, ChevronUp, Eye, Reply, Check, X } from 'lucide-react'
import { ROLES } from '../../contexts/AuthContext'
import PromptModal from '../../components/PromptModal'

const SupervisorDocuments = () => {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSendForm, setShowSendForm] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [replyDocument, setReplyDocument] = useState(null)
  const [replyContent, setReplyContent] = useState('')
  const [formData, setFormData] = useState({
    recipient_role: 'all',
    recipient_id: '',
    document_type: 'daily_instructions',
    title: '',
    content: '',
    file_url: '',
    priority: 'medium'
  })

  useEffect(() => {
    fetchDocuments()
    fetchTemplates()
  }, [])

  const fetchDocuments = async () => {
    try {
      const data = await supervisorAPI.getDocuments()
      setDocuments(data.documents || [])
    } catch (err) {
      console.error('Failed to fetch documents:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const data = await supervisorAPI.getDocumentTemplates()
      setTemplates(data.templates || [])
    } catch (err) {
      console.error('Failed to fetch templates:', err)
    }
  }

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template)
    setFormData({
      ...formData,
      document_type: template.type,
      title: template.title
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await supervisorAPI.sendDocument(formData)
      alert('Document sent successfully!')
      setShowSendForm(false)
      setFormData({
        recipient_role: 'all',
        recipient_id: '',
        document_type: 'daily_instructions',
        title: '',
        content: '',
        file_url: '',
        priority: 'medium'
      })
      setSelectedTemplate(null)
      fetchDocuments()
    } catch (err) {
      alert('Failed to send document: ' + err.message)
    }
  }

  const handleViewDocument = (doc) => {
    setSelectedDocument(doc)
  }

  const handleMarkAsRead = async (docId) => {
    try {
      await supervisorAPI.markDocumentAsRead(docId)
      alert('Document marked as read')
      fetchDocuments()
    } catch (err) {
      alert('Failed to mark as read: ' + err.message)
    }
  }

  const handleReply = (doc) => {
    setReplyDocument(doc)
    setReplyContent('')
  }

  const submitReply = () => {
    if (!replyContent.trim()) return
    setReplyDocument(null)
    alert('Reply sent successfully!')
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'read': return 'bg-green-100 text-green-800'
      case 'archived': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDocumentType = (type) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const getRoleEmoji = (role) => {
    switch (role) {
      case ROLES.ADMIN:
        return '🛡️'
      case ROLES.DIRECTOR:
        return '👔'
      case ROLES.MANAGER:
        return '📋'
      case ROLES.SUPERVISOR:
        return '👁️'
      case ROLES.SECRETARY:
        return '📝'
      case ROLES.GUARD:
        return '💂'
      default:
        return '👤'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-gray-400">Loading documents...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PromptModal
        isOpen={Boolean(replyDocument)}
        onClose={() => setReplyDocument(null)}
        title="Reply to Document"
        message="Enter your reply."
        value={replyContent}
        onChange={setReplyContent}
        onConfirm={submitReply}
        confirmText="Send Reply"
      />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Document Distribution Hub</h1>
          <p className="text-gray-600 mt-1">Push documents to managers, secretaries, and guards</p>
        </div>
        <button
          onClick={() => setShowSendForm(!showSendForm)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 transition-colors"
        >
          <Send size={18} />
          <span>Push Document</span>
        </button>
      </div>

      {/* Send Document Form */}
      {showSendForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Send New Document</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Template Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Templates
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {templates.map((template) => (
                  <button
                    key={template.type}
                    type="button"
                    onClick={() => handleTemplateSelect(template)}
                    className={`p-3 text-left border-2 rounded-lg transition-colors ${
                      selectedTemplate?.type === template.type
                        ? 'border-[#1a2a6c] bg-[#1a2a6c]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <FileText className="w-5 h-5 mb-1 text-gray-600" />
                    <p className="text-sm font-medium text-gray-900">{template.title}</p>
                    <p className="text-xs text-gray-500">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Send To
              </label>
              <select
                value={formData.recipient_role}
                onChange={(e) => setFormData({ ...formData, recipient_role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
              >
                <option value="all">All Team (Managers, Secretaries, Guards)</option>
                <option value="manager">All Managers</option>
                <option value="secretary">All Secretaries</option>
                <option value="guard">All Guards</option>
              </select>
            </div>

            {/* Document Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Document Type
              </label>
              <select
                value={formData.document_type}
                onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
              >
                <option value="incident_report">Incident Report</option>
                <option value="shift_change_sop">Shift Change SOP</option>
                <option value="handover_notes">Handover Notes</option>
                <option value="daily_instructions">Daily Instructions</option>
                <option value="training_material">Training Material</option>
                <option value="policy_update">Policy Update</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                placeholder="Enter document title"
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                placeholder="Enter document content or instructions..."
              />
            </div>

            {/* File URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                File URL (Optional)
              </label>
              <input
                type="text"
                value={formData.file_url}
                onChange={(e) => setFormData({ ...formData, file_url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                placeholder="https://example.com/document.pdf"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 transition-colors"
              >
                <Send size={18} />
                <span>Push Document</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSendForm(false)
                  setSelectedTemplate(null)
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Documents List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Sent Documents</h2>
          <p className="text-sm text-gray-600 mt-1">History of all documents pushed to team</p>
        </div>

        {documents.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Documents Yet</h3>
            <p className="text-gray-600">Start by pushing your first document to the team</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2">
                        <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="font-medium text-gray-900">{doc.title}</p>
                          {doc.content && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{doc.content}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatDocumentType(doc.document_type)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {doc.recipient_role ? getRoleEmoji(doc.recipient_role) : ''} {doc.recipient_role || 'N/A'}
                        </span>
                      </div>
                      {doc.recipient_name && (
                        <p className="text-xs text-gray-500 mt-1">{doc.recipient_name}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(doc.priority)}`}>
                        {doc.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(doc.status)}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewDocument(doc)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye size={16} />
                        </button>
                        {doc.status === 'pending' && (
                          <button
                            onClick={() => handleMarkAsRead(doc.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Mark as Read"
                          >
                            <Check size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleReply(doc)}
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Reply"
                        >
                          <Reply size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Document View Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">{selectedDocument.title}</h2>
                <button
                  onClick={() => setSelectedDocument(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Document Type</p>
                <p className="text-base text-gray-900">{formatDocumentType(selectedDocument.document_type)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Recipient</p>
                <p className="text-base text-gray-900">
                  {selectedDocument.recipient_role ? getRoleEmoji(selectedDocument.recipient_role) : ''} {selectedDocument.recipient_role}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Priority</p>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(selectedDocument.priority)}`}>
                  {selectedDocument.priority}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedDocument.status)}`}>
                  {selectedDocument.status}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Content</p>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedDocument.content || 'No content'}</p>
                </div>
              </div>
              {selectedDocument.file_url && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Attachment</p>
                  <a
                    href={selectedDocument.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    {selectedDocument.file_url}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SupervisorDocuments