import { useState, useEffect } from 'react'
import { settingsAPI } from '../../services/api'
import { DollarSign, Save, RefreshCw, ShieldCheck, Clock, AlertCircle, CheckCircle2, Info } from 'lucide-react'

const ManagerWageSettings = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [guardRate, setGuardRate] = useState('254.00')
  const [supervisorRate, setSupervisorRate] = useState('400.00')
  const [defaults, setDefaults] = useState({ guardShiftRate: 254.0, supervisorShiftRate: 400.0 })
  const [standardShiftHours, setStandardShiftHours] = useState(12)
  const [exemptRoles, setExemptRoles] = useState(['supervisor'])
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await settingsAPI.getWageRates()
      setGuardRate(Number(data.guardShiftRate).toFixed(2))
      setSupervisorRate(Number(data.supervisorShiftRate).toFixed(2))
      setDefaults(data.defaults || { guardShiftRate: 254.0, supervisorShiftRate: 400.0 })
      setStandardShiftHours(data.standardShiftHours || 12)
      setExemptRoles(data.deductionExemptRoles || ['supervisor'])
    } catch (err) {
      console.error('Error fetching wage settings:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    const guardValue = parseFloat(guardRate)
    const supervisorValue = parseFloat(supervisorRate)

    if (!Number.isFinite(guardValue) || guardValue < 0) {
      setError('Guard rate must be a non-negative number')
      return
    }
    if (!Number.isFinite(supervisorValue) || supervisorValue < 0) {
      setError('Supervisor rate must be a non-negative number')
      return
    }

    try {
      setSaving(true)
      setError(null)
      setMessage(null)
      const result = await settingsAPI.updateWageRates({
        guardShiftRate: guardValue,
        supervisorShiftRate: supervisorValue
      })
      setGuardRate(Number(result.guardShiftRate).toFixed(2))
      setSupervisorRate(Number(result.supervisorShiftRate).toFixed(2))
      setMessage(result.message || 'Wage baselines updated successfully')
    } catch (err) {
      console.error('Error saving wage settings:', err)
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[#1a2a6c] border-t-transparent rounded-full animate-spin" />
            <div className="text-lg text-gray-600">Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Wage Settings</h1>
          <p className="text-gray-600 mt-1">Editable daily pay for each completed shift</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800">
            These rates define exactly what one completed shift pays, regardless of the hours worked.
            Changes apply immediately to all payroll calculations and new shifts. All changes are audit logged.
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
            <p className="text-sm text-green-800">{message}</p>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Rate cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Guard rate */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Guard Rate</h2>
                <p className="text-xs text-gray-500">Per shift (KES)</p>
              </div>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Shift Baseline (KES)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={guardRate}
              onChange={(e) => setGuardRate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-2">
              Default: KES {Number(defaults.guardShiftRate).toFixed(2)} per shift
            </p>
          </div>

          {/* Supervisor rate */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Supervisor Rate</h2>
                <p className="text-xs text-gray-500">Per shift (KES)</p>
              </div>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Shift Baseline (KES)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={supervisorRate}
              onChange={(e) => setSupervisorRate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-2">
              Default: KES {Number(defaults.supervisorShiftRate).toFixed(2)} per shift
            </p>
          </div>
        </div>

        {/* Save actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={fetchSettings}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors"
          >
            <RefreshCw size={16} />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-[#1a2a6c] text-white rounded-lg hover:bg-[#1a2a6c]/90 disabled:opacity-60 flex items-center gap-2 transition-colors"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Rates'}
          </button>
        </div>

        {/* Deduction exemption rules */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Deduction Exemptions</h2>
              <p className="text-xs text-gray-500">Automatic deduction rules enforced system-wide</p>
            </div>
          </div>

          <div className="space-y-3">
            {exemptRoles.map((role) => (
              <div key={role} className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
                <ShieldCheck className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900 capitalize">{role}s</p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Strictly exempt from ALL uniform fees, gear fees, and equipment deductions.
                    Deduction calculations automatically skip {role}s entirely - zero uniform/gear deductions apply.
                  </p>
                </div>
              </div>
            ))}
            <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <Clock className="w-5 h-5 text-gray-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-gray-900">Guards</p>
                <p className="text-sm text-gray-600 mt-0.5">
                  Standard uniform deduction rules apply (3-month installment plan while uniform status is pending).
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


