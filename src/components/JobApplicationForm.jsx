import { useState } from 'react'
import { Briefcase, Send, CheckCircle, AlertCircle } from 'lucide-react'
import { apiUrl } from '../services/api'

const JobApplicationForm = () => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    experience: '',
    message: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await fetch(apiUrl('/api/applications'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Submission failed' }))
        throw new Error(err.error || 'Failed to submit application')
      }

      setSubmitted(true)
      setFormData({ full_name: '', email: '', phone: '', experience: '', message: '' })
    } catch (err) {
      setError(err.message || 'Failed to submit application. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Application Submitted!</h3>
        <p className="text-gray-600 mb-6">
          Thank you for applying as a guard. Your application has been sent to the Manager for review.
        </p>
        <button
          onClick={() => setSubmitted(false)}
          className="px-6 py-2 bg-[#1a2a6c] text-white font-semibold rounded-lg hover:bg-[#1a2a6c]/90 transition-all"
        >
          Submit Another Application
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 bg-red-100 text-red-700 border border-red-200 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 text-sm font-semibold text-[#1a2a6c]">
        <Briefcase size={18} />
        Guard position only
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
          <input type="text" name="full_name" required value={formData.full_name} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent outline-none" placeholder="John Doe" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input type="email" name="email" required value={formData.email} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent outline-none" placeholder="your@email.com" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
        <input type="tel" name="phone" required value={formData.phone} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent outline-none" placeholder="+254 7XX XXX XXX" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Previous Experience</label>
        <textarea name="experience" rows={3} value={formData.experience} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent outline-none" placeholder="Describe your relevant experience" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Additional Message</label>
        <textarea name="message" rows={3} value={formData.message} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a2a6c] focus:border-transparent outline-none" placeholder="Any additional information you'd like to share" />
      </div>

      <button type="submit" disabled={submitting} className="w-full py-3 bg-gradient-to-r from-[#1a2a6c] to-[#b21f1f] text-white font-bold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
        {submitting ? 'Submitting...' : 'Submit Guard Application'}
        {!submitting && <Send size={18} />}
      </button>
    </form>
  )
}

export default JobApplicationForm
