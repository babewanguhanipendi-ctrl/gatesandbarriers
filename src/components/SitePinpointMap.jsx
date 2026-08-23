import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

L.Icon.Default.imagePath = 'https://unpkg.com/leaflet@1.9.4/dist/images';

const SitePinpointMap = ({ latitude, longitude, radiusMeters = 50, onClick }) => {
  const mapRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || latitude === null || longitude === null) return;

    const map = L.map(mapRef.current).setView([latitude, longitude], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Draw geofence circle
    if (radiusMeters > 0) {
      L.circle([latitude, longitude], {
        radius: radiusMeters,
        color: '#3182ce',
        weight: 2,
        fillColor: '#3182ce',
        fillOpacity: 0.1,
      }).addTo(map);
    }

    // Marker for site center
    L.marker([latitude, longitude], { icon: new L.Icon.Default() })
      .addTo(map)
      .bindPopup('<b>Site Center</b>').openPopup();

    // Click handler
    if (onClick) {
      map.on('click', (e) => onClick(e.latlng));
    }

    return () => map.remove();
  }, [latitude, longitude, radiusMeters, onClick]);

  return <div ref={mapRef} style={{ height: '400px', width: '100%' }}></div>;
};

export default SitePinpointMap;