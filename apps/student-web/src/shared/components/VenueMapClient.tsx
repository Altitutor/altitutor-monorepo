'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useTheme } from 'next-themes';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { VENUE_COORDINATES, VENUE_ADDRESS } from '../constants';

// Fix for default marker icons in Next.js
const createIcon = (iconUrl: string) => {
  return L.icon({
    iconUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    shadowSize: [41, 41],
  });
};

// Default marker icon
const defaultIcon = createIcon('https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png');

interface VenueMapProps {
  className?: string;
  height?: string;
}

export function VenueMapClient({ className, height = '400px' }: VenueMapProps) {
  const { theme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark' || theme === 'dark';

  useEffect(() => {
    // Set default icon for all markers
    L.Marker.prototype.options.icon = defaultIcon;
  }, []);

  // Use dark tiles for dark mode, light tiles for light mode
  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const attribution = isDark
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  return (
    <div className={className} style={{ height }}>
      <MapContainer
        center={[VENUE_COORDINATES.lat, VENUE_COORDINATES.lng]}
        zoom={17}
        style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url={tileUrl}
          attribution={attribution}
        />
        <Marker position={[VENUE_COORDINATES.lat, VENUE_COORDINATES.lng]}>
          <Popup>
            <div className="text-sm font-medium">{VENUE_ADDRESS}</div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
