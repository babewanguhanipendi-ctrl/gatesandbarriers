import { CheckCircle } from 'lucide-react'
import ModalWrapper from './ModalWrapper'

/**
 * SuccessModal - Reusable success confirmation modal.
 * Uses ModalWrapper for consistent structure and behavior.
 *
 * Usage:
 *   <SuccessModal
 *     isOpen={isOpen}
 *     onClose={() => setIsOpen(false)}
 *     title="Success!"
 *     message="Operation completed successfully."
 *   />
 */
const SuccessModal = ({ isOpen, onClose, title, message }) => {
  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-6 h-6 text-green-600" />
        </div>
      }
      size="sm"
      footer={
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#1a2a6c] text-white rounded-lg font-semibold hover:bg-[#1a2a6c]/90 transition-colors"
          >
            OK
          </button>
        </div>
      }
    >
      <p className="text-gray-700">{message}</p>
    </ModalWrapper>
  )
}

export default SuccessModal