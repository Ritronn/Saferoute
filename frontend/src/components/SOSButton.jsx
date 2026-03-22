import { useState } from 'react'
import FakeCall, { FakeCallTrigger } from './FakeCall'

const EMERGENCY = [
  { label: 'Women Helpline', number: '1091', icon: '👩', color: '#d946ef' },
  { label: 'Police', number: '112', icon: '🚔', color: '#4f46e5' },
  { label: 'Ambulance', number: '108', icon: '🚑', color: '#dc2626' },
  { label: 'Fire', number: '101', icon: '🚒', color: '#ea580c' },
]

export default function SOSButton({ startLocation, endLocation, routes, activeRoute }) {
  const [open, setOpen] = useState(false)
  const [shared, setShared] = useState(false)
  const [tripShared, setTripShared] = useState(false)
  const [showFakeCall, setShowFakeCall] = useState(false)

  const shareLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const url = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`
        navigator.clipboard.writeText(
          `🆘 EMERGENCY! I need help. My location: ${url}`
        )
        setShared(true)
        setTimeout(() => setShared(false), 3000)
      },
      () => alert('Please enable location access to share your location.')
    )
  }

  const shareLiveTrip = () => {
    const route = routes?.[activeRoute]
    if (!startLocation || !endLocation) {
      alert('Please select start and end locations first.')
      return
    }

    const startName = startLocation.primary || 'Start'
    const endName = endLocation.primary || 'Destination'
    const eta = route ? `${route.duration_min} min` : 'Unknown'
    const safetyScore = route ? route.safety.overall : '—'

    const mapsUrl = `https://www.google.com/maps/dir/${startLocation.lat},${startLocation.lon}/${endLocation.lat},${endLocation.lon}`

    const message = `🛡️ SafeRoute - Live Trip Update\n\n` +
      `I'm traveling from *${startName}* to *${endName}*\n` +
      `📏 ETA: ~${eta}\n` +
      `🛡️ Safety Score: ${safetyScore}/100\n\n` +
      `📍 Track my route: ${mapsUrl}\n\n` +
      `If I don't arrive safely, please check on me. 🙏`

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
    setTripShared(true)
    setTimeout(() => setTripShared(false), 3000)
  }

  return (
    <>
      {/* Fake Call Component (renders overlays when active) */}
      {showFakeCall && <FakeCall />}

      <button className="sos-fab" onClick={() => setOpen(!open)} title="Emergency SOS">
        🆘
      </button>

      {open && (
        <div className="sos-panel">
          <div className="sos-header">
            <h3>🆘 Emergency SOS</h3>
            <button className="sos-close" onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className="sos-numbers">
            {EMERGENCY.map(e => (
              <a key={e.number} href={`tel:${e.number}`} className="sos-item" style={{ borderLeftColor: e.color }}>
                <span className="sos-icon">{e.icon}</span>
                <div>
                  <div className="sos-label">{e.label}</div>
                  <div className="sos-number">{e.number}</div>
                </div>
                <span className="sos-call">📞 Call</span>
              </a>
            ))}
          </div>

          <FakeCallTrigger onClick={() => { setShowFakeCall(true); setOpen(false) }} />

          <button className="sos-share-trip" onClick={shareLiveTrip}>
            {tripShared ? '✅ Shared on WhatsApp!' : '📲 Share Live Trip (WhatsApp)'}
          </button>

          <button className="sos-share" onClick={shareLocation}>
            {shared ? '✅ Location Copied!' : '📍 Copy Location to Share'}
          </button>
        </div>
      )}
    </>
  )
}
