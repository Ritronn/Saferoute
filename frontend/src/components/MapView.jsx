import { useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, CircleMarker, Circle } from 'react-leaflet'
import L from 'leaflet'

// Fix default marker icons (Leaflet + bundler issue)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})

const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})

// Category colors for POI markers
const POI_COLORS = {
  police: '#6366f1',
  hospital: '#ef4444',
  commercial: '#10b981',
  transit: '#f59e0b',
  populated: '#06b6d4',
}

// Risk level to color/opacity for heatmap
function getHeatmapStyle(riskLevel) {
  if (riskLevel >= 8) return { color: '#dc2626', opacity: 0.35, radius: 600 }
  if (riskLevel >= 6) return { color: '#f97316', opacity: 0.28, radius: 500 }
  if (riskLevel >= 4) return { color: '#eab308', opacity: 0.22, radius: 400 }
  return { color: '#f59e0b', opacity: 0.18, radius: 350 }
}

function FitBounds({ routes, startLocation, endLocation }) {
  const map = useMap()
  useEffect(() => {
    if (!routes || routes.length === 0) {
      if (startLocation && endLocation) {
        map.fitBounds([[startLocation.lat, startLocation.lon], [endLocation.lat, endLocation.lon]], { padding: [60, 60] })
      }
      return
    }
    const allCoords = routes.flatMap(r => r.geometry.coordinates.map(([lon, lat]) => [lat, lon]))
    if (allCoords.length > 0) {
      map.fitBounds(allCoords, { padding: [60, 60] })
    }
  }, [routes, startLocation, endLocation, map])
  return null
}

export default function MapView({ routes, startLocation, endLocation, activeRoute, safetyPois, showHeatmap, crimeHotspots }) {
  const activeRouteData = routes?.[activeRoute]

  return (
    <MapContainer
      center={[20.5937, 78.9629]}
      zoom={5}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />

      <FitBounds routes={routes} startLocation={startLocation} endLocation={endLocation} />

      {/* Crime Heatmap Overlay — red circles around crime hotspots */}
      {showHeatmap && crimeHotspots && crimeHotspots.map((hs, i) => {
        const style = getHeatmapStyle(hs.risk_level || 5)
        return (
          <Circle
            key={`heatmap-${i}`}
            center={[hs.lat, hs.lon]}
            radius={style.radius}
            fillColor={style.color}
            color={style.color}
            weight={1}
            opacity={0.4}
            fillOpacity={style.opacity}
          >
            <Popup>
              <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
                <strong>⚠️ {hs.name}</strong>
                <br />
                <span style={{ color: '#dc2626' }}>Risk: {hs.risk_level}/10</span>
                <br />
                <span style={{ color: '#666', fontSize: '11px' }}>{hs.description || ''}</span>
                {hs.crime_types && (
                  <div style={{ marginTop: '4px', fontSize: '10px', color: '#888' }}>
                    {hs.crime_types.join(', ')}
                  </div>
                )}
              </div>
            </Popup>
          </Circle>
        )
      })}

      {/* Inactive routes — thin dashed lines */}
      {routes && routes.map((route, i) => i !== activeRoute && (
        <Polyline
          key={`route-bg-${i}`}
          positions={route.geometry.coordinates.map(([lon, lat]) => [lat, lon])}
          color="#94a3b8"
          weight={3}
          opacity={0.3}
          dashArray="8 6"
        />
      ))}

      {/* Active route — color-coded segments */}
      {activeRouteData?.segments ? (
        activeRouteData.segments.map((seg, j) => (
          <Polyline
            key={`seg-${j}`}
            positions={seg.coordinates}
            color={seg.color}
            weight={7}
            opacity={0.85}
            lineCap="round"
            lineJoin="round"
          />
        ))
      ) : (
        // Fallback: solid green line if no segments
        activeRouteData && (
          <Polyline
            positions={activeRouteData.geometry.coordinates.map(([lon, lat]) => [lat, lon])}
            color="#10b981"
            weight={6}
            opacity={0.9}
          />
        )
      )}

      {/* Safety POI markers — show nearby police, hospitals, etc. */}
      {safetyPois && safetyPois.map((poi, i) => (
        <CircleMarker
          key={`poi-${i}`}
          center={[poi.lat, poi.lon]}
          radius={7}
          fillColor={POI_COLORS[poi.category] || '#888'}
          color="#fff"
          weight={2}
          opacity={0.9}
          fillOpacity={0.8}
        >
          <Popup>
            <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
              <strong>{poi.icon} {poi.name}</strong>
              <br />
              <span style={{ color: '#666', textTransform: 'capitalize' }}>{poi.category}</span>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* Start & End markers */}
      {startLocation && (
        <Marker position={[startLocation.lat, startLocation.lon]} icon={startIcon}>
          <Popup>Start</Popup>
        </Marker>
      )}
      {endLocation && (
        <Marker position={[endLocation.lat, endLocation.lon]} icon={endIcon}>
          <Popup>Destination</Popup>
        </Marker>
      )}

      {/* Map Legend */}
      {routes && <MapLegend showHeatmap={showHeatmap} />}
    </MapContainer>
  )
}

function MapLegend({ showHeatmap }) {
  return (
    <div style={{
      position: 'absolute', bottom: '20px', right: '20px', zIndex: 1000,
      background: 'rgba(255,255,255,0.95)', borderRadius: '12px',
      padding: '12px 16px', boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
      fontSize: '12px', lineHeight: '1.6',
    }}>
      <div style={{ fontWeight: 700, marginBottom: '6px', fontSize: '13px' }}>Safety Legend</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: 20, height: 4, borderRadius: 2, background: '#10b981', display: 'inline-block' }} /> Safe
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: 20, height: 4, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} /> Moderate
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: 20, height: 4, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} /> Caution
      </div>
      <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '6px', paddingTop: '6px' }}>
        <div>🚔 Police &nbsp; 🏥 Hospital</div>
        <div>🏪 Commercial &nbsp; 🚌 Transit</div>
      </div>
      {showHeatmap && (
        <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '6px', paddingTop: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(220,38,38,0.3)', border: '1px solid #dc2626', display: 'inline-block' }} /> Crime Hotspot
          </div>
        </div>
      )}
    </div>
  )
}
