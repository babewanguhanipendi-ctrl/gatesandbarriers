import { useEffect, useState } from 'react'
import { useNotification } from '../contexts/NotificationContext'
import ModalWrapper from './ModalWrapper'
import ToastNotification from './ToastNotification'
import { AlertTriangle, CheckCircle } from 'lucide-react'

/**
 * GlobalNotificationRenderer - Renders all notification modals and toasts at the app root level.
 * This component should be placed once in the app layout, typically near the root.
 * It reads state from NotificationContext and renders the appropriate modals/toasts.
 */
const GlobalNotificationRenderer = () => {
  const [siteAlert, setSiteAlert] = useState(null)
  const {
    // Toast notifications
    toasts,
    removeToast,

    // Confirm modal
    confirmModal,
    closeConfirm,

    // Success modal
    successModal,
    closeSuccess,

    // Generic modal
    genericModal,
    closeGenericModal
  } = useNotification()

  useEffect(() => {
    const handleSiteAlert = (event) => setSiteAlert(event.detail?.message || '')
    window.addEventListener('site-alert', handleSiteAlert)
    return () => window.removeEventListener('site-alert', handleSiteAlert)
  }, [])

  // Variant styles for confirm modal
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

  const styles = variantStyles[confirmModal.variant] || variantStyles.danger

  return (
    <>
      {/* Toast Notifications - rendered as a stack */}
      {toasts.map((toast) => (
        <ToastNotification
          key={toast.id}
          isOpen={true}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}

      {/* Confirmation Modal */}
      <ModalWrapper
        isOpen={siteAlert !== null}
        onClose={() => setSiteAlert(null)}
        title="Notification"
        icon={
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-blue-600" />
          </div>
        }
        size="sm"
        footer={
          <div className="flex justify-end">
            <button
              onClick={() => setSiteAlert(null)}
              className="px-6 py-2.5 bg-[#1a2a6c] text-white rounded-lg font-semibold hover:bg-[#1a2a6c]/90 transition-colors"
            >
              OK
            </button>
          </div>
        }
      >
        <p className="text-gray-700">{siteAlert}</p>
      </ModalWrapper>

      <ModalWrapper
        isOpen={confirmModal.isOpen}
        onClose={closeConfirm}
        title={confirmModal.title}
        icon={
          <div className={`w-12 h-12 ${styles.icon} rounded-full flex items-center justify-center`}>
            <AlertTriangle className={`w-6 h-6 ${styles.iconColor}`} />
          </div>
        }
        size="sm"
        showCloseButton={false}
      >
        <p className="text-gray-700 mb-6">{confirmModal.message}</p>
        <div className="flex gap-3">
          <button
            onClick={confirmModal.onConfirm}
            disabled={confirmModal.loading}
            className={`flex-1 text-white py-2.5 rounded-lg font-semibold disabled:opacity-50 transition-colors ${styles.button}`}
          >
            {confirmModal.loading ? 'Processing...' : confirmModal.confirmText}
          </button>
          <button
            onClick={confirmModal.onCancel}
            disabled={confirmModal.loading}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 font-semibold"
          >
            {confirmModal.cancelText}
          </button>
        </div>
      </ModalWrapper>

      {/* Success Modal */}
      <ModalWrapper
        isOpen={successModal.isOpen}
        onClose={successModal.onClose}
        title={successModal.title}
        icon={
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
        }
        size="sm"
        footer={
          <div className="flex justify-end">
            <button
              onClick={successModal.onClose}
              className="px-6 py-2.5 bg-[#1a2a6c] text-white rounded-lg font-semibold hover:bg-[#1a2a6c]/90 transition-colors"
            >
              OK
            </button>
          </div>
        }
      >
        <p className="text-gray-700">{successModal.message}</p>
      </ModalWrapper>

      {/* Generic Modal for custom content */}
      <ModalWrapper
        isOpen={genericModal.isOpen}
        onClose={genericModal.onClose}
        title={genericModal.title}
        subtitle={genericModal.subtitle}
        icon={genericModal.icon}
        size={genericModal.size}
        footer={genericModal.footer}
      >
        {genericModal.children}
      </ModalWrapper>
    </>
  )
}

export default GlobalNotificationRenderer