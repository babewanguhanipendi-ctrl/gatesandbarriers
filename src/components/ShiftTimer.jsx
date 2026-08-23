import { useState, useEffect } from 'react'
import { Clock, CheckCircle, AlertTriangle } from 'lucide-react'

const ShiftTimer = ({ startTime, endTime, shiftType, onAutoClockOut }) => {
  const [elapsed, setElapsed] = useState({ hours: 0, minutes: 0, seconds: 0 })
  const [isWarning, setIsWarning] = useState(false)

  useEffect(() => {
    if (!startTime || endTime) return

    const calculateElapsed = () => {
      const start = new Date(startTime)
      const now = new Date()
      const diffMs = now - start
      
      const hours = Math.floor(diffMs / (1000 * 60 * 60))
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)
      
      setElapsed({ hours, minutes, seconds })
      
      // Warning when 12 hours reached
      if (hours >= 12 && !isWarning) {
        setIsWarning(true)
        if (onAutoClockOut) {
          onAutoClockOut()
        }
      }
    }

    calculateElapsed()
    const interval = setInterval(calculateElapsed, 1000)
    
    return () => clearInterval(interval)
  }, [startTime, endTime, isWarning, onAutoClockOut])

  if (!startTime) return null
  if (endTime) {
    return (
      <div className="flex items-center gap-2 text-gray-600">
        <CheckCircle className="w-4 h-4" />
        <span className="text-sm">Shift completed</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${isWarning ? 'text-red-600' : 'text-emerald-600'}`}>
      <Clock className="w-4 h-4" />
      <div className="flex flex-col">
        <span className="text-sm font-medium">
          {elapsed.hours}h {elapsed.minutes}m {elapsed.seconds}s
        </span>
        {isWarning && (
          <span className="text-xs flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            12h+ - Auto clock-out
          </span>
        )}
      </div>
    </div>
  )
}

export default ShiftTimer