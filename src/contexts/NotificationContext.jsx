import { createContext, useContext, useState, useCallback } from 'react'

/**
 * NotificationContext - Centralized notification management for the entire application.
 * Provides a unified way to show toasts, confirmations, success modals, and error dialogs
 * without managing state in individual components.
 */

const NotificationContext = createContext(null)

// Toast queue types
let toastIdCounter = 0

export const NotificationProvider = ({ children }) => {
  // Toast notifications (non-blocking, auto-dismiss)
  const [toasts, setToasts] = useState([])
  
  // Confirmation modal state (blocking, requires user action)
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'danger',
    onConfirm: null,
    onCancel: null,
    loading: false
  })

  // Success modal state
  const [successModal, setSuccessModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onClose: null
  })

  // Generic modal state
  const [genericModal, setGenericModal] = useState({
    isOpen: false,
    title: '',
    subtitle: '',
    icon: null,
    size: 'md',
    children: null,
    footer: null,
    onClose: null
  })

  /**
   * Show a toast notification (non-blocking, auto-dismiss)
   */
  const showToast = useCallback((type = 'info', title, message, duration = 5000) => {
    const id = ++toastIdCounter
    setToasts(prev => [...prev, { id, type, title, message, duration }])
    return id
  }, [])

  const showSuccessToast = useCallback((title, message, duration) => {
    return showToast('success', title, message, duration)
  }, [showToast])

  const showErrorToast = useCallback((title, message, duration) => {
    return showToast('error', title, message, duration)
  }, [showToast])

  const showWarningToast = useCallback((title, message, duration) => {
    return showToast('warning', title, message, duration)
  }, [showToast])

  const showInfoToast = useCallback((title, message, duration) => {
    return showToast('info', title, message, duration)
  }, [showToast])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  /**
   * Show a confirmation dialog (blocking, requires user action)
   * Returns a promise that resolves to true (confirmed) or false (cancelled)
   */
  const showConfirm = useCallback(({
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger'
  } = {}) => {
    return new Promise((resolve) => {
      setConfirmModal({
        isOpen: true,
        title,
        message,
        confirmText,
        cancelText,
        variant,
        loading: false,
        onConfirm: async () => {
          setConfirmModal(prev => ({ ...prev, loading: true }))
          resolve(true)
          setConfirmModal({
            isOpen: false,
            title: '',
            message: '',
            confirmText: 'Confirm',
            cancelText: 'Cancel',
            variant: 'danger',
            onConfirm: null,
            onCancel: null,
            loading: false
          })
        },
        onCancel: () => {
          resolve(false)
          setConfirmModal({
            isOpen: false,
            title: '',
            message: '',
            confirmText: 'Confirm',
            cancelText: 'Cancel',
            variant: 'danger',
            onConfirm: null,
            onCancel: null,
            loading: false
          })
        }
      })
    })
  }, [])

  /**
   * Show a success modal
   */
  const showSuccess = useCallback((title, message) => {
    return new Promise((resolve) => {
      setSuccessModal({
        isOpen: true,
        title,
        message,
        onClose: () => {
          resolve(true)
          setSuccessModal({
            isOpen: false,
            title: '',
            message: '',
            onClose: null
          })
        }
      })
    })
  }, [])

  /**
   * Show a generic modal with custom content
   */
  const showModal = useCallback(({
    title,
    subtitle,
    icon,
    size = 'md',
    children,
    footer
  }) => {
    return new Promise((resolve) => {
      setGenericModal({
        isOpen: true,
        title,
        subtitle,
        icon,
        size,
        children,
        footer,
        onClose: () => {
          resolve(true)
          setGenericModal({
            isOpen: false,
            title: '',
            subtitle: '',
            icon: null,
            size: 'md',
            children: null,
            footer: null,
            onClose: null
          })
        }
      })
    })
  }, [])

  const closeConfirm = useCallback(() => {
    setConfirmModal(prev => ({
      ...prev,
      isOpen: false,
      onConfirm: null,
      onCancel: null
    }))
  }, [])

  const closeSuccess = useCallback(() => {
    setSuccessModal(prev => ({
      ...prev,
      isOpen: false,
      onClose: null
    }))
  }, [])

  const closeGenericModal = useCallback(() => {
    setGenericModal(prev => ({
      ...prev,
      isOpen: false,
      onClose: null
    }))
  }, [])

  const value = {
    // Toast notifications
    toasts,
    showToast,
    showSuccessToast,
    showErrorToast,
    showWarningToast,
    showInfoToast,
    removeToast,

    // Confirm modal
    confirmModal,
    showConfirm,
    closeConfirm,

    // Success modal
    successModal,
    showSuccess,
    closeSuccess,

    // Generic modal
    genericModal,
    showModal,
    closeGenericModal
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

/**
 * Hook to use notifications in any component
 */
export const useNotification = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}

export default NotificationContext