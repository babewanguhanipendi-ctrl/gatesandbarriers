import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { directorAPI } from '../../services/api'
import {
  DollarSign,
  Shield,
  TrendingUp,
  Users,
  Briefcase,
  AlertTriangle,
  CheckCircle,
  FileText
} from 'lucide-react'

const DirectorResources = () => {
  const { profile } = useAuth()
  const [resources, setResources] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadResources()
  }, [])

  const loadResources = async () => {
    try {
      const data = await directorAPI.getResources()
      setResources(data)
    } catch (error) {
      console.error('Error loading resources:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
          <div className="text-xl text-gray-600">Loading Resources...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Resource Allocation</h1>
        <p className="text-gray-600 mt-1">Manage company budget, insurance compliance, and client acquisition goals</p>
      </div>

      {/* Budget Overview */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-green-600" />
          Budget Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600">Annual Budget</p>
            <p className="text-2xl font-bold text-green-600">
              KES {resources?.budget?.annual?.toLocaleString() || '0'}
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600">Allocated</p>
            <p className="text-2xl font-bold text-blue-600">
              KES {resources?.budget?.allocated?.toLocaleString() || '0'}
            </p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600">Remaining</p>
            <p className="text-2xl font-bold text-yellow-600">
              KES {resources?.budget?.remaining?.toLocaleString() || '0'}
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600">Utilization</p>
            <p className="text-2xl font-bold text-purple-600">
              {resources?.budget?.utilization || 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Insurance Compliance */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-600" />
          Insurance Compliance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Liability Insurance</p>
              <p className="text-xs text-green-600">
                {resources?.insurance?.liability?.isValid ? 'Valid until ' + new Date(resources.insurance.liability.expiryDate).toLocaleDateString() : 'Expired'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Worker's Compensation</p>
              <p className="text-xs text-green-600">
                {resources?.insurance?.workersComp?.isValid ? 'Valid until ' + new Date(resources.insurance.workersComp.expiryDate).toLocaleDateString() : 'Expired'}
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-3 p-4 rounded-lg ${resources?.insurance?.vehicle?.isValid ? 'bg-green-50' : 'bg-red-50'}`}>
            {resources?.insurance?.vehicle?.isValid ? (
              <CheckCircle className="w-8 h-8 text-green-600" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-red-600" />
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900">Vehicle Insurance</p>
              <p className={`text-xs ${resources?.insurance?.vehicle?.isValid ? 'text-green-600' : 'text-red-600'}`}>
                {resources?.insurance?.vehicle?.isValid ? 'Valid until ' + new Date(resources.insurance.vehicle.expiryDate).toLocaleDateString() : 'Expired - Action Required'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Client Acquisition Goals */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-purple-600" />
          Client Acquisition Goals
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-purple-600" />
              <div>
                <p className="font-semibold text-gray-900">Q{Math.ceil((new Date().getMonth() + 1) / 3)} Target</p>
                <p className="text-sm text-gray-600">New client acquisition goal</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-purple-600">
                {resources?.acquisition?.progress || 0}/{resources?.acquisition?.target || 0}
              </p>
              <p className="text-sm text-gray-600">clients acquired</p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-purple-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${resources?.acquisition?.target > 0 ? Math.min((resources.acquisition.progress / resources.acquisition.target) * 100, 100) : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-gray-500">
            <span>Progress: {resources?.acquisition?.target > 0 ? Math.round((resources.acquisition.progress / resources.acquisition.target) * 100) : 0}%</span>
            <span>Deadline: {resources?.acquisition?.deadline ? new Date(resources.acquisition.deadline).toLocaleDateString() : 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Department Budget Allocation */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-orange-600" />
          Department Budget Allocation
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Department</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Allocated</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Spent</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Remaining</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {resources?.departments?.map((dept) => (
                <tr key={dept.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{dept.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">KES {dept.allocated.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">KES {dept.spent.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`font-semibold ${dept.remaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      KES {dept.remaining.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      dept.utilization > 90 ? 'bg-red-100 text-red-800' :
                      dept.utilization > 75 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {dept.utilization}% used
                    </span>
                  </td>
                </tr>
              ))}
              {(!resources?.departments || resources.departments.length === 0) && (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                    No department data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default DirectorResources