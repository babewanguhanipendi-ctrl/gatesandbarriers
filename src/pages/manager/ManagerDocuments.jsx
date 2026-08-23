import { useState, useEffect } from 'react'
import { managerAPI } from '../../services/api'
import ResponsiveTable from '../../components/ResponsiveTable'
import { FileText, User, MapPin, Calendar, Send, Download, Eye, Mail, X, Forward, Reply } from 'lucide-react'

const ManagerDocuments = () => {
  const [documents, setDocuments] = useState({
    applicationLetters: [],
    resignationLetters: [],
    receivedDocuments: [],
    emails: []
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('applicationLetters')
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [showDocumentModal, setShowDocumentModal] = useState(false)

  useEffect(() => {
    fetchDocuments()
  }, [])

  const openDocument = (doc) => {
    setSelectedDocument(doc)
    setShowDocumentModal(true)
  }

  const fetchDocuments = async () => {
    setLoading(true)
    try {
      const data = await managerAPI.getDocuments()
      setDocuments({
        applicationLetters: data.applicationLetters || [],
        resignationLetters: data.resignationLetters || [],
        receivedDocuments: data.receivedDocuments || [],
        emails: data.emails || []
      })
    } catch (error) {
      console.error('Error fetching documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const applicationColumns = [
    { key: 'full_name', label: 'Applicant', render: (row) => (
      <button 
        onClick={() => openDocument(row)}
        className="flex items-center gap-2 text-left hover:text-[#1a2a6c] transition-colors"
      >
        <User size={14} className="text-gray-400" />
        <span className="font-medium underline">{row.full_name || 'N/A'}</span>
      </button>
    )},
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'created_at', label: 'Applied On', render: (row) => row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A' },
  ]

  const resignationColumns = [
    { key: 'full_name', label: 'Guard', render: (row) => (
      <button 
        onClick={() => openDocument(row)}
        className="flex items-center gap-2 text-left hover:text-[#1a2a6c] transition-colors"
      >
        <User size={14} className="text-gray-400" />
        <span className="font-medium underline">{row.full_name || 'N/A'}</span>
      </button>
    )},
    { key: 'work_number', label: 'Work Number' },
    { key: 'resignation_date', label: 'Resignation Date', render: (row) => row.resignation_date ? new Date(row.resignation_date).toLocaleDateString() : 'N/A' },
    { key: 'resignation_reason', label: 'Reason', render: (row) => (
      <span className="truncate max-w-xs block">{row.resignation_reason || 'No reason provided'}</span>
    )},
  ]

  const receivedColumns = [
    { key: 'title', label: 'Document', render: (row) => (
      <button 
        onClick={() => openDocument(row)}
        className="flex items-center gap-2 text-left hover:text-[#1a2a6c] transition-colors"
      >
        <FileText size={14} className="text-gray-400" />
        <span className="font-medium underline">{row.title || 'N/A'}</span>
      </button>
    )},
    { key: 'sender_name', label: 'From', render: (row) => (
      <div className="flex items-center gap-2">
        <Send size={14} className="text-gray-400" />
        <span>{row.sender_name || 'Unknown'}</span>
      </div>
    )},
    { key: 'document_type', label: 'Type', render: (row) => (
      <span className="capitalize">{row.document_type?.replace('_', ' ') || 'N/A'}</span>
    )},
    { key: 'created_at', label: 'Received', render: (row) => row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A' },
    { key: 'status', label: 'Status', render: (row) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
        row.status === 'read' ? 'bg-green-100 text-green-800' :
        row.status === 'archived' ? 'bg-gray-100 text-gray-800' :
        'bg-blue-100 text-blue-800'
      }`}>
        {row.status || 'pending'}
      </span>
    )},
  ]

  const emailColumns = [
    { key: 'subject', label: 'Subject', render: (row) => (
      <button 
        onClick={() => openDocument(row)}
        className="flex items-center gap-2 text-left hover:text-[#1a2a6c] transition-colors"
      >
        <Mail size={14} className="text-gray-400" />
        <span className="font-medium underline">{row.subject || 'N/A'}</span>
      </button>
    )},
    { key: 'recipient_name', label: 'To' },
    { key: 'created_at', label: 'Sent', render: (row) => row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A' },
    { key: 'status', label: 'Status', render: (row) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
        row.status === 'sent' ? 'bg-green-100 text-green-800' :
        'bg-yellow-100 text-yellow-800'
      }`}>
        {row.status || 'queued'}
      </span>
    )},
  ]

  const getTabCounts = () => ({
    applicationLetters: documents.applicationLetters.length,
    resignationLetters: documents.resignationLetters.length,
    receivedDocuments: documents.receivedDocuments.length,
    emails: documents.emails.length
  })

  const tabCounts = getTabCounts()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Document Box</h1>
          <p className="text-gray-600 mt-1">Manage all documents and communications</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('applicationLetters')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'applicationLetters' 
                ? 'border-[#1a2a6c] text-[#1a2a6c]' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Application Letters ({tabCounts.applicationLetters})
          </button>
          <button
            onClick={() => setActiveTab('resignationLetters')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'resignationLetters' 
                ? 'border-[#1a2a6c] text-[#1a2a6c]' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Resignation Letters ({tabCounts.resignationLetters})
          </button>
          <button
            onClick={() => setActiveTab('receivedDocuments')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'receivedDocuments' 
                ? 'border-[#1a2a6c] text-[#1a2a6c]' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Received Documents ({tabCounts.receivedDocuments})
          </button>
          <button
            onClick={() => setActiveTab('emails')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'emails' 
                ? 'border-[#1a2a6c] text-[#1a2a6c]' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Emails ({tabCounts.emails})
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {activeTab === 'applicationLetters' && (
            <ResponsiveTable
              columns={applicationColumns}
              rows={documents.applicationLetters}
              loading={loading}
              emptyMessage="No application letters found"
            />
          )}
          
          {activeTab === 'resignationLetters' && (
            <ResponsiveTable
              columns={resignationColumns}
              rows={documents.resignationLetters}
              loading={loading}
              emptyMessage="No resignation letters found"
            />
          )}
          
          {activeTab === 'receivedDocuments' && (
            <ResponsiveTable
              columns={receivedColumns}
              rows={documents.receivedDocuments}
              loading={loading}
              emptyMessage="No received documents found"
            />
          )}
          
          {activeTab === 'emails' && (
            <ResponsiveTable
              columns={emailColumns}
              rows={documents.emails}
              loading={loading}
              emptyMessage="No emails found"
            />
          )}
        </div>
      </div>

      {/* Document Detail Modal */}
      {showDocumentModal && selectedDocument && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Document Details</h2>
                  <p className="text-sm text-gray-600">
                    {activeTab === 'applicationLetters' && 'Application Letter'}
                    {activeTab === 'resignationLetters' && 'Resignation Letter'}
                    {activeTab === 'receivedDocuments' && 'Received Document'}
                    {activeTab === 'emails' && 'Email'}
                  </p>
                </div>
                <button
                  onClick={() => setShowDocumentModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {activeTab === 'applicationLetters' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Applicant Name</label>
                    <p className="text-gray-900">{selectedDocument.full_name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="text-gray-900">{selectedDocument.email || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <p className="text-gray-900">{selectedDocument.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Applied On</label>
                    <p className="text-gray-900">{selectedDocument.created_at ? new Date(selectedDocument.created_at).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button className="flex-1 px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 flex items-center justify-center gap-2">
                      <Forward size={16} />
                      Forward
                    </button>
                    <button className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2">
                      <Reply size={16} />
                      Reply
                    </button>
                  </div>
                </>
              )}

              {activeTab === 'resignationLetters' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Guard Name</label>
                    <p className="text-gray-900">{selectedDocument.full_name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Work Number</label>
                    <p className="text-gray-900">{selectedDocument.work_number || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Resignation Date</label>
                    <p className="text-gray-900">{selectedDocument.resignation_date ? new Date(selectedDocument.resignation_date).toLocaleDateString() : 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Reason</label>
                    <p className="text-gray-900">{selectedDocument.resignation_reason || 'No reason provided'}</p>
                  </div>
                </>
              )}

              {activeTab === 'receivedDocuments' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Document Title</label>
                    <p className="text-gray-900">{selectedDocument.title || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">From</label>
                    <p className="text-gray-900">{selectedDocument.sender_name || 'Unknown'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <p className="text-gray-900 capitalize">{selectedDocument.document_type?.replace('_', ' ') || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Content</label>
                    <p className="text-gray-900 whitespace-pre-wrap">{selectedDocument.content || 'No content available'}</p>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button className="flex-1 px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 flex items-center justify-center gap-2">
                      <Eye size={16} />
                      Review
                    </button>
                    <button className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2">
                      <Forward size={16} />
                      Forward
                    </button>
                  </div>
                </>
              )}

              {activeTab === 'emails' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Subject</label>
                    <p className="text-gray-900">{selectedDocument.subject || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">To</label>
                    <p className="text-gray-900">{selectedDocument.recipient_name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Body</label>
                    <p className="text-gray-900 whitespace-pre-wrap">{selectedDocument.body || 'No content available'}</p>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button className="flex-1 px-4 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 flex items-center justify-center gap-2">
                      <Reply size={16} />
                      Reply
                    </button>
                    <button className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2">
                      <Forward size={16} />
                      Forward
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ManagerDocuments