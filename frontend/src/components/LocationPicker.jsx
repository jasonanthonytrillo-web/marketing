import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Search, Navigation, CheckCircle, Maximize2, Minimize2 } from 'lucide-react';

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

// Helper to invalidate map size when container changes (e.g. fullscreen toggle)
function MapResizer({ isFullscreen }) {
  const map = useMap();
  useEffect(() => {
    // Small delay to let the DOM settle after the portal mount/unmount
    const timeout = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timeout);
  }, [isFullscreen, map]);
  return null;
}

async function reverseGeocode(lat, lng, setAddress) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
    const data = await res.json();
    if (data && data.address) {
      const a = data.address;
      // Build a smart, short address: (Building or Road) + (City or Town)
      const primary = a.building || a.amenity || a.house_name || a.road || a.suburb || '';
      const secondary = a.city || a.town || a.village || a.city_district || 'Butuan City';
      
      const shortAddress = primary && primary !== secondary ? `${primary}, ${secondary}` : secondary;
      setAddress(shortAddress);
    } else if (data && data.display_name) {
      // Fallback: Just take the first and last (city) part
      const parts = data.display_name.split(',');
      if (parts.length > 2) {
        setAddress(`${parts[0].trim()}, ${parts[parts.length - 3].trim()}`);
      } else {
        setAddress(data.display_name.split(',')[0].trim());
      }
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
}

export default function LocationPicker({ onLocationSelect, initialAddress = '', compact = false }) {
  const [position, setPosition] = useState(null);
  const [address, setAddress] = useState(initialAddress);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const expandMap = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setIsFullscreen(true);
  };

  useEffect(() => {
    if (position) {
      onLocationSelect({
        address,
        lat: position.lat,
        lng: position.lng
      });
    }
  }, [position, address]);

  // Suggestions fetching
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.length > 2 && showSuggestions) {
        fetchSuggestions(searchQuery);
      } else {
        setSuggestions([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const fetchSuggestions = async (query) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
      const data = await res.json();
      setSuggestions(data);
    } catch (error) {
      console.error('Suggestions error:', error);
    }
  };

  const handleSelectSuggestion = (s) => {
    const newPos = { lat: parseFloat(s.lat), lng: parseFloat(s.lon) };
    setPosition(newPos);
    reverseGeocode(newPos.lat, newPos.lng, setAddress);
    setSearchQuery(s.display_name);
    setSuggestions([]);
    setShowSuggestions(false);
    if (compact) setIsFullscreen(true);
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    setShowSuggestions(false);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        const newPos = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        setPosition(newPos);
        reverseGeocode(newPos.lat, newPos.lng, setAddress);
        if (compact) setIsFullscreen(true);
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
    
    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(newPos);
        reverseGeocode(newPos.lat, newPos.lng, setAddress);
        setLoading(false);
      }, 
      (err) => {
        let msg = 'Unable to retrieve your location';
        if (err.code === 1) msg = 'Please enable Location permissions in your browser.';
        else if (err.code === 2) msg = 'Location unavailable. Try searching for your address instead.';
        else if (err.code === 3) msg = 'Location request timed out. Please try again.';
        
        alert(msg);
        setLoading(false);
      },
      options
    );
  };

  return (
    <div className="space-y-4">
      {!compact && <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <div onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}>
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setShowSuggestions(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              placeholder="Search for your street or area..."
              className="input-field pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 transition-all shadow-sm"
            />
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-[200] mt-1 bg-white border border-surface-200 rounded-2xl shadow-xl overflow-hidden animate-fade-in-up">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSuggestion(s)}
                  className="w-full px-4 py-3 text-left text-xs hover:bg-surface-50 border-b border-surface-100 last:border-0 flex items-start gap-3 transition-colors"
                >
                  <MapPin className="w-4 h-4 text-surface-400 mt-0.5 flex-shrink-0" />
                  <span className="text-surface-700 line-clamp-2">{s.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={useMyLocation}
          disabled={loading}
          className="p-3 bg-white border-2 border-surface-200 rounded-2xl shadow-sm hover:border-primary-500 hover:bg-primary-50 text-primary-600 transition-all active:scale-95 group flex-shrink-0"
          title="Pin My Current Location"
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Navigation className="w-6 h-6 group-hover:animate-pulse" />
          )}
        </button>
      </div>}

      {compact && !isFullscreen && (
        <div className="flex gap-1.5">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setShowSuggestions(true)}
              onChange={e => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="Search a place..."
              className="w-full rounded-lg border border-surface-200 bg-white py-1.5 pl-8 pr-2 text-[11px] font-semibold text-surface-800 outline-none focus:border-primary-500"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-[200] mt-1 overflow-hidden rounded-lg border border-surface-200 bg-white shadow-xl">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSuggestion(s)}
                    className="flex w-full items-start gap-2 border-b border-surface-100 px-2.5 py-2 text-left text-[11px] text-surface-700 last:border-0 hover:bg-surface-50"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-surface-400" />
                    <span className="line-clamp-2">{s.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={expandMap}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-black transition-all active:scale-95 ${position
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
            title="Pin delivery location"
          >
            <MapPin className="h-3.5 w-3.5" />
            {position ? 'Update Pin' : 'Pin Location'}
          </button>
        </div>
      )}

      {/* Non-fullscreen inline map */}
      {!compact && !isFullscreen && (
        <div className="h-64 rounded-3xl overflow-hidden border-2 border-surface-100 shadow-inner relative z-10">
          <div
            className="relative h-full w-full cursor-pointer"
            onClick={expandMap}
          >
            <MapContainer
              center={[14.5995, 120.9842]}
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
              <MapResizer isFullscreen={false} />
            </MapContainer>

            {!position && (
              <div className="absolute inset-0 bg-slate-50/70 pointer-events-none flex items-center justify-center">
                <div className="bg-white/95 backdrop-blur-sm px-5 py-3 rounded-full shadow-lg border border-white/20 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white animate-bounce shadow-lg shadow-red-500/20">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black text-surface-800 uppercase tracking-tight">
                    Tap map to expand and pin location
                  </span>
                </div>
              </div>
            )}

            <div className="absolute bottom-3 right-3 z-[20] flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 shadow-lg backdrop-blur">
              <Maximize2 className="h-4 w-4 text-slate-600" />
              <span className="text-[11px] font-black uppercase tracking-tight text-slate-700">Tap to expand</span>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen map rendered via Portal to escape stacking context */}
      {isFullscreen && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/30 p-3 sm:p-4" style={{ zIndex: 9999 }}>
          <div className="relative h-full w-full rounded-[2rem] overflow-hidden bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="absolute right-4 top-4 z-[10000] flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg backdrop-blur"
              title="Exit fullscreen"
            >
              <Minimize2 className="h-5 w-5" />
            </button>

            {compact && (
              <div className="absolute left-4 right-20 top-4 z-[10000] flex gap-2 sm:left-6 sm:right-24">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onFocus={() => setShowSuggestions(true)}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearch();
                      }
                    }}
                    placeholder="Search a place..."
                    className="w-full rounded-xl border border-surface-200 bg-white/95 py-3 pl-9 pr-3 text-sm font-semibold text-surface-800 shadow-lg outline-none backdrop-blur focus:border-primary-500"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-[10001] mt-1 overflow-hidden rounded-xl border border-surface-200 bg-white shadow-xl">
                      {suggestions.map((s, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectSuggestion(s)}
                          className="flex w-full items-start gap-2 border-b border-surface-100 px-3 py-2 text-left text-xs text-surface-700 last:border-0 hover:bg-surface-50"
                        >
                          <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-surface-400" />
                          <span className="line-clamp-2">{s.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={loading}
                  className="rounded-xl bg-primary-600 px-4 text-white shadow-lg hover:bg-primary-700 disabled:opacity-60"
                  title="Search location"
                >
                  <Search className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={useMyLocation}
                  disabled={loading}
                  className="rounded-xl bg-white/95 px-3 text-primary-600 shadow-lg backdrop-blur hover:bg-primary-50 disabled:opacity-60"
                  title="Use my current location"
                >
                  <Navigation className="h-5 w-5" />
                </button>
              </div>
            )}

            <MapContainer
              center={position ? [position.lat, position.lng] : [14.5995, 120.9842]}
              zoom={position ? 16 : 13}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <LocationMarker position={position} setPosition={setPosition} setAddress={setAddress} />
              {position && <ChangeView center={position} />}
              <MapResizer isFullscreen={true} />
            </MapContainer>

            {!position && (
              <div className="absolute inset-0 bg-slate-50/70 pointer-events-none flex items-center justify-center">
                <div className="bg-white/95 backdrop-blur-sm px-5 py-3 rounded-full shadow-lg border border-white/20 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white animate-bounce shadow-lg shadow-red-500/20">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black text-surface-800 uppercase tracking-tight">
                    Tap to pin location
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {address && !compact && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl p-4 animate-fade-in shadow-sm">
          <div className="mt-0.5 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white flex-shrink-0">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-0.5">Location Pinned</p>
            <p className="text-[14px] text-emerald-950 font-black leading-tight break-words">{address}</p>
          </div>
        </div>
      )}
    </div>
  );
}
