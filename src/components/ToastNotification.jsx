import { useState, useEffect, useCallback } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'

/**
 * ToastNotification - Non-blocking notification popup for success, error, warning, and info messages.
 * Auto-dismisses after a configurable duration.
 */

const TOAST_TYPES = {
  success: {
    icon: CheckCircle,
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    iconColor: 'text-green-600'
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    iconColor: 'text-red-600'
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    iconColor: 'text-yellow-600'
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    iconColor: 'text-blue-600'
  }
}

const ToastNotification = ({
  isOpen,
  onClose,
  type = 'info',
  title,
  message,
  duration = 5000,
  showCloseButton = true
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [progress, setProgress] = useState(100)

  const toastConfig = TOAST_TYPES[type] || TOAST_TYPES.info
  const IconComponent = toastConfig.icon

  const handleClose = useCallback(() => {
    setIsVisible(false)
    setTimeout(() => {
      if (onClose) onClose()
    }, 200) // Wait for fade-out animation
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      // Trigger entrance animation
      requestAnimationFrame(() => {
        setIsVisible(true)
      })

      // Auto-dismiss timer
      if (duration > 0) {
        const startTime = Date.now()
        const interval = setInterval(() => {
          const elapsed = Date.now() - startTime
          const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
          setProgress(remaining)
          if (elapsed >= duration) {
            clearInterval(interval)
            handleClose()
          }
        }, 50)

        return () => {
          clearInterval(interval)
        }
      }
    } else {
      setIsVisible(false)
    }
  }, [isOpen, duration, handleClose])

  if (!isOpen) return null

  return (
    <div
      className={`fixed top-4 right-4 z-[100] max-w-sm w-full transition-all duration-200 ease-in-out ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className={`${toastConfig.bg} ${toastConfig.border} border rounded-xl shadow-lg overflow-hidden`}>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <IconComponent className={`w-5 h-5 ${toastConfig.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              {title && (
                <p className={`text-sm font-semibold ${toastConfig.text}`}>{title}</p>
              )}
              {message && (
                <p className={`text-sm ${toastConfig.text} mt-0.5`}>{message}</p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={handleClose}
                className="flex-shrink-0 p-1 hover:bg-black/5 rounded-lg transition-colors"
                aria-label="Close notification"
              >
                <X className={`w-4 h-4 ${toastConfig.text}`} />
              </button>
            )}
          </div>
        </div>
        {/* Progress bar for auto-dismiss */}
        {duration > 0 && (
          <div className="h-1 bg-gray-200">
            <div
              className={`h-full transition-all duration-100 ease-linear rounded-full ${
                type === 'success' ? 'bg-green-500' :
                type === 'error' ? 'bg-red-500' :
                type === 'warning' ? 'bg-yellow-500' :
                'bg-blue-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default ToastNotification