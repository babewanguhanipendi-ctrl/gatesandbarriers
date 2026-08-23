// Haversine formula: distance between two GPS coordinates in meters
export const haversineDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null

  const R = 6371000 // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // meters
}

// Format distance as a friendly meter string (rounds to nearest meter)
export const formatDistance = (distanceMeters) => {
  if (distanceMeters === null || distanceMeters === undefined) return '--'
  return `${Math.round(distanceMeters)}m`
}

// Build a precise validation message for a geofence check
export const buildGeofenceMessage = (distanceMeters, radiusMeters, verified) => {
  if (distanceMeters === null || distanceMeters === undefined) return null
  const rounded = Math.round(distanceMeters)
  if (verified) {
    return `Successfully clocked in: ${rounded}m from site center`
  }
  return `Clock-in failed: You are ${rounded}m away, maximum allowed is ${Math.round(radiusMeters)}m`
}