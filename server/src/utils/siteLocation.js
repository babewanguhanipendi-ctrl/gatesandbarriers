// Approximate Mombasa Island boundary used to distinguish island sites from sites across Nyali Bridge.
const MOMBASA_ISLAND = [
  [-4.027, 39.670],
  [-4.034, 39.658],
  [-4.052, 39.657],
  [-4.078, 39.668],
  [-4.078, 39.681],
  [-4.057, 39.690],
  [-4.038, 39.686]
];

const isInsidePolygon = (latitude, longitude, polygon) => {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [currentLatitude, currentLongitude] = polygon[index];
    const [previousLatitude, previousLongitude] = polygon[previous];
    const intersects = ((currentLatitude > latitude) !== (previousLatitude > latitude)) &&
      (longitude < (previousLongitude - currentLongitude) * (latitude - currentLatitude) /
        (previousLatitude - currentLatitude) + currentLongitude);
    if (intersects) inside = !inside;
  }
  return inside;
};

const classifySiteLocation = (site) => {
  const latitude = Number(site.latitude);
  const longitude = Number(site.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const label = String(site.location || '').toLowerCase();
    return label.includes('town') || label.includes('island') ? 'town' : 'nyali';
  }
  return isInsidePolygon(latitude, longitude, MOMBASA_ISLAND) ? 'town' : 'nyali';
};

module.exports = { classifySiteLocation };