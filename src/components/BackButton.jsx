import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/**
 * Universal Back Button Component
 * Uses browser history to navigate back to the previous page
 */
const BackButton = ({ className = '', fallback = '/' }) => {
  const navigate = useNavigate()

  const handleBack = () => {
    // Try to go back in history, if no history, go to fallback
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate(fallback)
    }
  }

  return (
    <button
      onClick={handleBack}
      className={`inline-flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 ${className}`}
      aria-label="Go back"
    >
      <ArrowLeft size={20} />
      <span className="font-medium">Back</span>
    </button>
  )
}

export default BackButton