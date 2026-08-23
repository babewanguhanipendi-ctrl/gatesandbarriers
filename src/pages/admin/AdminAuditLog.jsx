import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { auditsAPI } from '../../services/api'
import {
  Search,
  Filter,
  Download,
  Eye,
  AlertTriangle,
  User,
  Clock,
  FileText,
  Settings,
  Shield
} from 'lucide-react'

const AdminAuditLog = () => {
  const { profile } = useAuth()
  const [auditLogs, setAuditLogs] = useState([])
  const [filteredLogs, setFilteredLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [selectedLog, setSelectedLog] = useState(null)

  useEffect(() => {
    loadAuditLogs()
  }, [])

  useEffect(() => {
    filterLogs()
  }, [searchTerm, filterType, auditLogs])

  const loadAuditLogs = async () => {
    try {
      // Fetch all audit logs from the API
      const data = await auditsAPI.getAll()

      setAuditLogs(data.audits || [])
      setFilteredLogs(data.audits || [])
    } catch (error) {
      console.error('Error loading audit logs:', error)
      // For demo purposes, create sample data if table doesn't exist
      setAuditLogs([])
      setFilteredLogs([])
    } finally {
      setLoading(false)
    }
  }

  const filterLogs = () => {
    let filtered = auditLogs

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(log => log.type === filterType)
    }

    setFilteredLogs(filtered)
  }

  const getActionIcon = (type) => {
    switch (type) {
      case 'user_management':
        return <User className="w-5 h-5" />
      case 'financial':
        return <DollarSign className="w-5 h-5" />
      case 'audit':
        return <FileText className="w-5 h-5" />
      case 'system':
        return <Settings className="w-5 h-5" />
      case 'security':
        return <Shield className="w-5 h-5" />
      default:
        return <FileText className="w-5 h-5" />
    }
  }

  const getActionColor = (type) => {
    switch (type) {
      case 'user_management':
        return 'bg-blue-100 text-blue-800'
      case 'financial':
        return 'bg-green-100 text-green-800'
      case 'audit':
        return 'bg-yellow-100 text-yellow-800'
      case 'system':
        return 'bg-purple-100 text-purple-800'
      case 'security':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'User', 'Action', 'Type', 'Description', 'IP Address'].join(','),
      ...filteredLogs.map(log => [
        log.created_at,
        log.user_name,
        log.action,
        log.type,
        log.description,
        log.ip_address
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-xl text-gray-600">Loading audit logs...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Global Audit Log</h1>
          <p className="text-gray-600 mt-1">
            Complete event history • {filteredLogs.length} records
          </p>
        </div>
        <button onClick={exportLogs} className="btn-gradient flex items-center gap-2">
          <Download className="w-5 h-5" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by action, user, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Type Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent appearance-none bg-white"
            >
              <option value="all">All Types</option>
              <option value="user_management">User Management</option>
              <option value="financial">Financial</option>
              <option value="audit">Audit</option>
              <option value="system">System</option>
              <option value="security">Security</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No audit logs found</p>
            <p className="text-sm text-gray-400 mt-1">
              All system actions will be logged here
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    IP Address
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {log.user_name || 'System'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {log.action}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full flex items-center gap-1 w-fit ${getActionColor(log.type)}`}>
                        {getActionIcon(log.type)}
                        {log.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {log.description}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                      {log.ip_address || 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4 text-primary" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Audit Log Details</h2>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Timestamp</label>
                <p className="text-gray-900">{new Date(selectedLog.created_at).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">User</label>
                <p className="text-gray-900">{selectedLog.user_name || 'System'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Action</label>
                <p className="text-gray-900">{selectedLog.action}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Type</label>
                <p className="text-gray-900">{selectedLog.type}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Description</label>
                <p className="text-gray-900">{selectedLog.description}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">IP Address</label>
                <p className="text-gray-900 font-mono">{selectedLog.ip_address || 'N/A'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Metadata</label>
                <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto">
                  {JSON.stringify(selectedLog.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminAuditLog