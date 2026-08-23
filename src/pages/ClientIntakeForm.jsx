import { useState } from 'react'
import { requestsAPI } from '../services/api'
import { Shield, Send, CheckCircle, X, User, Mail, Phone, MapPin, DollarSign } from 'lucide-react'
import BrandLogo from '../components/BrandLogo'

const initialForm = {
  contractor_name: '',
  contractor_email: '',
  contractor_phone: '',
  site_location: '',
  property_type: '',
  coverage_hours: '',
  guards_needed: '',
  entry_points: '',
  risk_notes: '',
  security_type: '',
  budget_estimate: ''
}

const securityTypes = [
  'Manned Guarding',
  'Patrol Services',
  'Event Security',
  'Corporate Security',
  'Residential Security',
  'Construction Site Security',
  'Retail Security',
  'Other'
]

const ClientIntakeForm = ({ embedded = false }) => {
  const [formData, setFormData] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await requestsAPI.create(formData)
      setShowConfirmation(true)
      setFormData(initialForm)
    } catch (err) {
      setError(err.message || 'Failed to submit request')
    } finally {
      setLoading(false)
    }
  }

  const form = (
    <>
      {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2"><User className="w-4 h-4 inline mr-1" /> Contractor / Company Name *</label>
          <input type="text" required value={formData.contractor_name} onChange={(e) => setFormData({ ...formData, contractor_name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="Company or contact name" />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2"><Mail className="w-4 h-4 inline mr-1" /> Email Address *</label>
            <input type="email" required value={formData.contractor_email} onChange={(e) => setFormData({ ...formData, contractor_email: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="name@company.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2"><Phone className="w-4 h-4 inline mr-1" /> Phone Number</label>
            <input type="tel" value={formData.contractor_phone} onChange={(e) => setFormData({ ...formData, contractor_phone: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="0748 022 271" />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#1a2a6c]" />
            Site Details *
          </h3>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
              <input 
                type="text" 
                required 
                value={formData.site_location} 
                onChange={(e) => setFormData({ ...formData, site_location: e.target.value })} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" 
                placeholder="e.g., Westlands, Nairobi" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Property Type *</label>
              <select 
                required 
                value={formData.property_type} 
                onChange={(e) => setFormData({ ...formData, property_type: e.target.value })} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">Select property type</option>
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Industrial">Industrial</option>
                <option value="Mixed Use">Mixed Use</option>
                <option value="Construction Site">Construction Site</option>
                <option value="Event Venue">Event Venue</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Coverage Hours *</label>
              <input 
                type="text" 
                required 
                value={formData.coverage_hours} 
                onChange={(e) => setFormData({ ...formData, coverage_hours: e.target.value })} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" 
                placeholder="e.g., 24/7, 8am-6pm, Night only" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Number of Guards Needed *</label>
              <input 
                type="number" 
                required 
                min="1" 
                value={formData.guards_needed} 
                onChange={(e) => setFormData({ ...formData, guards_needed: e.target.value })} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" 
                placeholder="e.g., 4" 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Entry Points</label>
            <input 
              type="text" 
              value={formData.entry_points} 
              onChange={(e) => setFormData({ ...formData, entry_points: e.target.value })} 
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" 
              placeholder="e.g., Main gate, Side entrance, Loading bay (comma-separated)" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Risk Notes</label>
            <textarea 
              value={formData.risk_notes} 
              onChange={(e) => setFormData({ ...formData, risk_notes: e.target.value })} 
              rows={3} 
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" 
              placeholder="Any specific security concerns, high-risk areas, or special requirements" 
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2"><Shield className="w-4 h-4 inline mr-1" /> Security Required *</label>
            <select required value={formData.security_type} onChange={(e) => setFormData({ ...formData, security_type: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">
              <option value="">Select security type</option>
              {securityTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2"><DollarSign className="w-4 h-4 inline mr-1" /> Bid / Budget Estimate</label>
            <input type="number" value={formData.budget_estimate} onChange={(e) => setFormData({ ...formData, budget_estimate: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="0.00" min="0" step="0.01" />
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#1a2a6c] to-[#b21f1f] text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50">
          {loading ? 'Submitting...' : <><Send className="w-5 h-5" /> Submit Contractor Bid</>}
        </button>
      </form>

      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><CheckCircle className="w-6 h-6 text-green-600" /><h2 className="text-xl font-bold text-gray-900">Request Submitted!</h2></div>
              <button onClick={() => setShowConfirmation(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-gray-600 mb-4">Your contractor request has been emailed to the director and recorded for review.</p>
            <button onClick={() => setShowConfirmation(false)} className="w-full px-4 py-2 bg-gradient-to-r from-primary to-secondary text-white rounded-lg font-semibold">Close</button>
          </div>
        </div>
      )}
    </>
  )

  if (embedded) return form

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <BrandLogo className="w-14 h-14 rounded-2xl p-1" />
            <h1 className="text-3xl font-bold text-gray-900">Gates & Barriers Security Services</h1>
          </div>
          <p className="text-lg text-gray-600">Contractor Bid / Security Request</p>
          <p className="text-sm text-gray-500 mt-2">Tell us what security coverage you need and the director will review it.</p>
        </div>
        <div className="card">{form}</div>
      </div>
    </div>
  )
}

export default ClientIntakeForm

