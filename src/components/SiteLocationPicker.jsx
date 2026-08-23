import { useState } from 'react'
import { MapPin, Navigation } from 'lucide-react'
import SitePinpointMap from './SitePinpointMap'

const SiteLocationPicker = ({ latitude, longitude, onChange, required = true }) => {
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')

  const updateCoordinates = (nextLatitude, nextLongitude) => {
    onChange({
      latitude: nextLatitude === '' ? '' : Number(nextLatitude),
      longitude: nextLongitude === '' ? '' : Number(nextLongitude),
      geofence_radius: 100
    })
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.')
      return
    }
    setLocating(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        updateCoordinates(coords.latitude, coords.longitude)
        setLocating(false)
      },
      (geolocationError) => {
        setError(geolocationError.message || 'Unable to read the current location.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const hasCoordinates = latitude !== '' && latitude !== null && longitude !== '' && longitude !== null

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-blue-900">
            <MapPin size={16} /> Exact Site Location {required && <span className="text-red-600">*</span>}
          </p>
          <p className="mt-1 text-xs text-blue-700">Set the site center used for the 100 m clock-in boundary.</p>
        </div>
        <button type="button" onClick={useCurrentLocation} disabled={locating} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50">
          <Navigation size={14} /> {locating ? 'Locating...' : 'Use Current Location'}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-blue-900">
          Latitude
          <input type="number" required={required} min="-90" max="90" step="any" value={latitude ?? ''} onChange={(event) => updateCoordinates(event.target.value, longitude ?? '')} className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-900" placeholder="e.g. -1.286389" />
        </label>
        <label className="text-xs font-medium text-blue-900">
          Longitude
          <input type="number" required={required} min="-180" max="180" step="any" value={longitude ?? ''} onChange={(event) => updateCoordinates(latitude ?? '', event.target.value)} className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-900" placeholder="e.g. 36.817223" />
        </label>
      </div>
      <p className="text-xs font-medium text-blue-800">Clock-in radius: 100 meters</p>
      {error && <p className="text-xs text-red-700">{error}</p>}
      {hasCoordinates && <SitePinpointMap latitude={Number(latitude)} longitude={Number(longitude)} radiusMeters={100} onClick={(point) => updateCoordinates(point.lat, point.lng)} />}
    </div>
  )
}

export default SiteLocationPicker