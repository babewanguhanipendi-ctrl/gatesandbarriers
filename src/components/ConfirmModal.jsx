import { AlertTriangle } from 'lucide-react'
import ModalWrapper from './ModalWrapper'

/**
 * ConfirmModal - Reusable confirmation dialog with variant-based styling.
 * Uses ModalWrapper for consistent structure and behavior.
 *
 * Usage:
 *   <ConfirmModal
 *     isOpen={isOpen}
 *     onClose={() => setIsOpen(false)}
 *     onConfirm={handleConfirm}
 *     title="Delete Item"
 *     message="Are you sure you want to delete this item?"
 *     confirmText="Delete"
 *     cancelText="Cancel"
 *     variant="danger"
 *     loading={false}
 *   />
 */
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false
}) => {
  const variantStyles = {
    danger: {
      icon: 'bg-red-100',
      iconColor: 'text-red-600',
      button: 'bg-red-600 hover:bg-red-700'
    },
    primary: {
      icon: 'bg-blue-100',
      iconColor: 'text-blue-600',
      button: 'bg-[#1a2a6c] hover:bg-[#1a2a6c]/90'
    },
    warning: {
      icon: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      button: 'bg-yellow-600 hover:bg-yellow-700'
    }
  }

  const styles = variantStyles[variant] || variantStyles.danger

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={
        <div className={`w-12 h-12 ${styles.icon} rounded-full flex items-center justify-center`}>
          <AlertTriangle className={`w-6 h-6 ${styles.iconColor}`} />
        </div>
      }
      size="sm"
      showCloseButton={false}
    >
      <p className="text-gray-700 mb-6">{message}</p>
      <div className="flex gap-3">
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`flex-1 text-white py-2.5 rounded-lg font-semibold disabled:opacity-50 transition-colors ${styles.button}`}
        >
          {loading ? 'Processing...' : confirmText}
        </button>
        <button
          onClick={onClose}
          disabled={loading}
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 font-semibold"
        >
          {cancelText}
        </button>
      </div>
    </ModalWrapper>
  )
}

export default ConfirmModal