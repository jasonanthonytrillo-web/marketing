import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Search, Navigation } from 'lucide-react';

// Fix for default marker icons in Leaflet + React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function LocationMarker({ position, setPosition, setAddress }) {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
      reverseGeocode(e.latlng.lat, e.latlng.lng, setAddress);
    },
  });

  return position === null ? null : (
    <Marker position={position} />
  );
}

// Helper to center map when position changes
function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 16);
    }
  }, [center]);
  return null;
}

async function reverseGeocode(lat, lng, setAddress) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
    const data = await res.json();
    if (data && data.display_name) {
      setAddress(data.display_name);
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
}

export default function LocationPicker({ onLocationSelect, initialAddress = '' }) {
  const [position, setPosition] = useState(null);
  const [address, setAddress] = useState(initialAddress);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (position) {
      onLocationSelect({
        address,
        lat: position.lat,
        lng: position.lng
      });
    }
  }, [position, address]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        const newPos = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        setPosition(newPos);
        setAddress(data[0].display_name);
      } else {
        alert('Location not found');
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return alert('Geolocation is not supported by your browser');
    setLoading(true);
    navigator.geolocation.getCurrentPosition((pos) => {
      const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setPosition(newPos);
      reverseGeocode(newPos.lat, newPos.lng, setAddress);
      setLoading(false);
    }, () => {
      alert('Unable to retrieve your location');
      setLoading(false);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <form onSubmit={handleSearch}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for your street or area..."
              className="input-field pl-10 pr-4 py-2.5 text-sm"
            />
          </form>
        </div>
        <button
          type="button"
          onClick={useMyLocation}
          className="p-2.5 bg-white border border-surface-200 rounded-xl hover:bg-surface-50 text-primary-600 transition-all shadow-sm"
          title="Use my current location"
        >
          <Navigation className="w-5 h-5" />
        </button>
      </div>

      <div className="h-64 rounded-2xl overflow-hidden border-2 border-surface-100 shadow-inner relative z-10">
        <MapContainer
          center={[14.5995, 120.9842]} // Default to Manila
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker position={position} setPosition={setPosition} setAddress={setAddress} />
          {position && <ChangeView center={position} />}
        </MapContainer>
        {!position && (
          <div className="absolute inset-0 bg-black/5 pointer-events-none flex items-center justify-center">
            <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-white/20 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-500 animate-bounce" />
              <span className="text-xs font-bold text-surface-600 uppercase tracking-wider">Tap Map to Pin Location</span>
            </div>
          </div>
        )}
      </div>

      {address && (
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 animate-fade-in">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Pinned Address</p>
          <p className="text-xs text-emerald-800 font-medium leading-relaxed">{address}</p>
        </div>
      )}
    </div>
  );
}
