import { useState, useEffect } from 'react'
import { directorAPI } from '../../services/api'
import { FileText, Plus, Shield, AlertTriangle, CheckCircle, X } from 'lucide-react'

const DirectorPolicies = () => {
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ title: '', content: '', category: 'security', priority: 'medium' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadPolicies()
  }, [])

  const loadPolicies = async () => {
    try {
      const data = await directorAPI.getPolicies()
      setPolicies(data.policies || [])
    } catch (error) {
      console.error('Error loading policies:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await directorAPI.createPolicy(formData)
      setShowForm(false)
      setFormData({ title: '', content: '', category: 'security', priority: 'medium' })
      loadPolicies()
    } catch (error) {
      console.error('Error creating policy:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
          <div className="text-xl text-gray-600">Loading Policies...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Policy & Compliance Engine</h1>
          <p className="text-gray-600 mt-1">Draft, update, and publish security protocols and company policies</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-gradient flex items-center gap-2">
          <Plus size={18} />
          New Policy
        </button>
      </div>

      {/* Policy Creation Form */}
      {showForm && (
        <div className="card border-2 border-[#1a2a6c]/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Create New Policy</h2>
            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Policy Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                placeholder="e.g., Night Shift Protocol Update"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                >
                  <option value="security">Security Protocol</option>
                  <option value="hr">HR Policy</option>
                  <option value="operational">Operational Procedure</option>
                  <option value="compliance">Compliance Requirement</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
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
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Policy Content</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
                placeholder="Describe the policy details, enforcement guidelines, and effective date..."
                required
              />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-gradient px-6">
                {saving ? 'Publishing...' : 'Publish Policy'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Policies List */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-6 h-6 text-[#1a2a6c]" />
          Published Policies
        </h2>
        {policies.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No policies published yet</p>
            <p className="text-gray-400 text-sm mt-1">Create your first policy to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {policies.map((policy) => (
              <div key={policy.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">{policy.title}</h3>
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                        policy.priority === 'critical' ? 'bg-red-100 text-red-800' :
                        policy.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                        policy.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {policy.priority?.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{policy.content}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <FileText size={12} />
                        {policy.category}
                      </span>
                      <span>Published: {new Date(policy.created_at).toLocaleDateString()}</span>
                      {policy.effective_date && (
                        <span>Effective: {new Date(policy.effective_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {policy.isActive ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle size={14} /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        Draft
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compliance Overview */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-yellow-600" />
          Compliance Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-600">98%</p>
            <p className="text-sm text-gray-600">Policy Compliance Rate</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{policies.length}</p>
            <p className="text-sm text-gray-600">Active Policies</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">3</p>
            <p className="text-sm text-gray-600">Pending Reviews</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DirectorPolicies