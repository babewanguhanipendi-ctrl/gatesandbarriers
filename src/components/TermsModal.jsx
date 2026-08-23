import { useState } from 'react'
import { X, Shield, CheckCircle } from 'lucide-react'

const TermsModal = ({ isOpen, onClose, onAccept }) => {
  const [accepted, setAccepted] = useState(false)
  const [scrollComplete, setScrollComplete] = useState(false)

  if (!isOpen) return null

  const handleScroll = (e) => {
    const el = e.target
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10
    if (isAtBottom) setScrollComplete(true)
  }

  const handleAccept = () => {
    if (accepted && scrollComplete) {
      onAccept()
      setAccepted(false)
      setScrollComplete(false)
    }
  }

  const handleClose = () => {
    setAccepted(false)
    setScrollComplete(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1a2a6c]/10 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#1a2a6c]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Terms & Conditions</h2>
              <p className="text-xs text-gray-500">Gates & Barriers Security Services</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          className="flex-1 overflow-y-auto p-5 space-y-4 text-sm text-gray-700 leading-relaxed"
          onScroll={handleScroll}
        >
          <section>
            <h3 className="font-bold text-gray-900 mb-2">1. Acceptance of Terms</h3>
            <p>
              By registering for a Gates & Barriers Security Services account, you acknowledge that
              you have read, understood, and agree to be bound by these Terms and Conditions.
              If you do not agree, you may not register or use the system.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2">2. Account Registration & Obligations</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must provide accurate, current, and complete registration information.</li>
              <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
              <li>You must notify the system administrator immediately of any unauthorized use of your account.</li>
              <li>You must not share your password or work number with unauthorized personnel.</li>
              <li>All account activities under your credentials are your responsibility.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2">3. Data Collection & Sharing Agreement</h3>
            <p className="mb-2">
              As part of your employment and system usage, the following personal data may be collected,
              stored, and processed:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Full name, contact information (email, phone number), and work number.</li>
              <li>Employment history, role assignments, site allocations, and shift records.</li>
              <li>Attendance logs, check-in/check-out times, and location data during shifts.</li>
              <li>Uniform issuance records, financial deductions, and payroll information.</li>
              <li>Performance records, incident reports, and disciplinary actions.</li>
              <li>Resignation and exit records if applicable.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2">4. Data Sharing</h3>
            <p className="mb-2">
              Your data may be shared with the following parties for legitimate business purposes:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Internal Management:</strong> Supervisors, managers, directors, and administrators for operational and supervisory purposes.</li>
              <li><strong>Clients:</strong> Client organizations may receive attendance records and shift data relevant to their contracted security services.</li>
              <li><strong>Regulatory Authorities:</strong> Where required by law, data may be disclosed to government or law enforcement agencies.</li>
              <li><strong>Payroll Processing:</strong> Financial institutions or payroll processors for salary disbursement.</li>
            </ul>
            <p className="mt-2 text-gray-500 text-xs italic">
              Your data will never be sold to third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2">5. Data Retention & Security</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your data will be retained for the duration of your employment and for a legally mandated period thereafter.</li>
              <li>We implement industry-standard security measures to protect your personal data.</li>
              <li>You have the right to request access to, correction of, or deletion of your personal data, subject to legal retention requirements.</li>
              <li>Data access is restricted on a role-based need-to-know basis.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2">6. System Usage Policies</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>The system is to be used solely for legitimate business purposes related to your role.</li>
              <li>Unauthorized access, tampering, or misuse of the system is strictly prohibited.</li>
              <li>All actions performed within the system are logged and monitored for compliance.</li>
              <li>Violation of system policies may result in disciplinary action, including termination.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2">7. Limitation of Liability</h3>
            <p>
              Gates & Barriers Security Services shall not be liable for any indirect, incidental,
              special, or consequential damages arising from your use of the system. The system
              is provided "as is" without warranty of any kind, either express or implied.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2">8. Changes to Terms</h3>
            <p>
              We reserve the right to modify these terms at any time. Registered users will be
              notified of material changes via email or system notification. Continued use of
              the system after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-gray-900 mb-2">9. Contact</h3>
            <p>
              For questions about these terms or your data, please contact the system administrator
              or the HR department at <strong>hr@gatesandbarriers.co.ke</strong>.
            </p>
          </section>

          {!scrollComplete && (
            <div className="sticky bottom-0 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800 text-center">
              Please scroll to the bottom to enable acceptance
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-5 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-[#1a2a6c] border-gray-300 rounded focus:ring-[#1a2a6c]"
            />
            <span className="text-sm text-gray-700">
              I have read and agree to the Terms and Conditions and Data Sharing Agreement outlined above.
            </span>
          </label>

          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAccept}
              disabled={!accepted || !scrollComplete}
              className="flex-1 py-2.5 bg-gradient-to-r from-[#1a2a6c] to-[#b21f1f] text-white font-medium rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle size={18} />
              Accept & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TermsModal