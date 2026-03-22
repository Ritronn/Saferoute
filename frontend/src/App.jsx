import { useState, useEffect } from 'react'
import LocationInput from './components/LocationInput'
import MapView from './components/MapView'
import RoutePanel from './components/RoutePanel'
import SafetyBriefing from './components/SafetyBriefing'
import SOSButton from './components/SOSButton'
import CrimeInfo from './components/CrimeInfo'
import HeatmapToggle from './components/HeatmapToggle'
import Community from './components/Community'

export default function App() {
  const [startLocation, setStartLocation] = useState(null)
  const [endLocation, setEndLocation] = useState(null)
  const [routes, setRoutes] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeRoute, setActiveRoute] = useState(0)
  const [featuresFound, setFeaturesFound] = useState(null)
  const [safetyPois, setSafetyPois] = useState(null)
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [crimeHotspots, setCrimeHotspots] = useState([])

  // Auto-detect day/night based on current time
  const currentHour = new Date().getHours()
  const autoTimeMode = (currentHour >= 6 && currentHour < 18) ? 'day' : 'night'
  const [timeMode, setTimeMode] = useState(autoTimeMode)

  // Fetch crime hotspots for heatmap
  useEffect(() => {
    fetch('/api/crime-hotspots')
      .then(r => r.json())
      .then(data => setCrimeHotspots(data.hotspots || []))
      .catch(() => {})
  }, [])

  const findRoute = async () => {
    if (!startLocation || !endLocation) {
      setError('Please select both start and end locations')
      return
    }
    setLoading(true)
    setError(null)
    setRoutes(null)

    try {
      const resp = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_lat: startLocation.lat,
          start_lon: startLocation.lon,
          end_lat: endLocation.lat,
          end_lon: endLocation.lon,
          time_mode: timeMode,
        }),
      })
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to find routes')
      }
      const data = await resp.json()
      setRoutes(data.routes)
      setFeaturesFound(data.features_found)
      setSafetyPois(data.safety_pois || [])
      setActiveRoute(0)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleTimeMode = () => {
    setTimeMode(prev => prev === 'day' ? 'night' : 'day')
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">🛡️</div>
          <h1>SafeRoute</h1>
          <p className="tagline">Navigate safely, not just fast</p>
        </div>

        <div className="search-section">
          <LocationInput label="Start Location" placeholder="e.g. Koregaon Park, Pune" icon="📍" onSelect={setStartLocation} />
          <LocationInput label="Destination" placeholder="e.g. Hinjewadi, Pune" icon="🎯" onSelect={setEndLocation} />

          {/* Day/Night Mode Toggle */}
          <div className="time-mode-row">
            <button className={`time-toggle ${timeMode}`} onClick={toggleTimeMode} title={`Switch to ${timeMode === 'day' ? 'night' : 'day'} mode`}>
              <span className="time-icon">{timeMode === 'day' ? '☀️' : '🌙'}</span>
              <span className="time-label">{timeMode === 'day' ? 'Day Mode' : 'Night Mode'}</span>
            </button>
            <span className="time-hint">
              {timeMode === 'night' ? 'Lighting & police weighted higher' : 'Balanced safety scoring'}
            </span>
          </div>

          <button className="find-btn" onClick={findRoute} disabled={loading || !startLocation || !endLocation}>
            {loading ? (<><span className="spinner"></span> Analyzing safety...</>) : ('🔍 Find Safest Route')}
          </button>

          {error && <div className="error-msg">⚠️ {error}</div>}
        </div>

        {routes && (
          <>
            <RoutePanel routes={routes} activeRoute={activeRoute} onSelect={setActiveRoute} featuresFound={featuresFound} />
            <SafetyBriefing route={routes[activeRoute]} featuresFound={featuresFound} />
          </>
        )}

        <Community />

        <CrimeInfo areaName={startLocation?.primary || ''} />

        {!routes && !loading && (
          <div className="info-card">
            <h3>How it works</h3>
            <ul>
              <li>🔦 Street lighting coverage</li>
              <li>🚔 Police station proximity</li>
              <li>🏥 Hospital accessibility</li>
              <li>🏪 Commercial activity</li>
              <li>🔴 AI crime hotspot mapping</li>
              <li>🌙 Day/Night safety adjustment</li>
              <li>🔥 Crime heatmap overlay</li>
              <li>🤖 AI-powered safety analysis</li>
              <li>📰 Real-time crime news scraping</li>
            </ul>
            <p>We analyze <strong>real Google Places data</strong> + <strong>Gemini AI crime analysis</strong> to find the safest path for you.</p>
          </div>
        )}

        <div className="sidebar-footer">
          Powered by Google Places + Gemini AI · Built with ❤️
        </div>
      </aside>

      <main className="map-area">
        <MapView
          routes={routes}
          startLocation={startLocation}
          endLocation={endLocation}
          activeRoute={activeRoute}
          safetyPois={safetyPois}
          showHeatmap={showHeatmap}
          crimeHotspots={crimeHotspots}
        />
        <HeatmapToggle visible={showHeatmap} onToggle={setShowHeatmap} />
        <SOSButton startLocation={startLocation} endLocation={endLocation} routes={routes} activeRoute={activeRoute} />
      </main>
    </div>
  )
}
