const LABELS = {
  lighting: { name: 'Street Lighting', icon: '🔦', color: '#fbbf24' },
  police: { name: 'Police Coverage', icon: '🚔', color: '#6366f1' },
  medical: { name: 'Medical Access', icon: '🏥', color: '#ef4444' },
  commercial: { name: 'Commercial Area', icon: '🏪', color: '#10b981' },
  populated: { name: 'Populated Area', icon: '🏘️', color: '#06b6d4' },
  crime_risk: { name: 'Crime Safety', icon: '🔴', color: '#f43f5e' },
}

const ROUTE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

function ScoreRing({ score, size = 64, strokeWidth = 5 }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 60 ? '#10b981' : score >= 35 ? '#f59e0b' : '#ef4444'

  return (
    <svg width={size} height={size} className="score-ring">
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dy="0.35em"
        fill={color} fontSize="16" fontWeight="700">{score}</text>
    </svg>
  )
}

function SafetyBar({ label, value }) {
  const info = LABELS[label]
  if (!info) return null
  const barColor = value >= 60 ? '#10b981' : value >= 35 ? '#f59e0b' : '#ef4444'

  return (
    <div className="safety-bar">
      <div className="safety-bar-header">
        <span>{info.icon} {info.name}</span>
        <span className="safety-bar-value" style={{ color: barColor }}>{value}%</span>
      </div>
      <div className="safety-bar-track">
        <div className="safety-bar-fill" style={{ width: `${value}%`, background: barColor, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

export default function RoutePanel({ routes, activeRoute, onSelect, featuresFound }) {
  return (
    <div className="route-panel">
      <h3 className="panel-title">Routes Found</h3>

      <div className="route-cards">
        {routes.map((route, i) => (
          <div
            key={i}
            className={`route-card ${activeRoute === i ? 'active' : ''}`}
            onClick={() => onSelect(i)}
            style={{ borderLeftColor: ROUTE_COLORS[i] || '#888' }}
          >
            <div className="route-card-top">
              <div className="route-card-info">
                {route.label && (
                  <span className={`badge badge-${route.label.toLowerCase()}`}>{route.label === 'SAFEST' ? '🛡️' : '⚡'} {route.label}</span>
                )}
                <div className="route-meta">
                  <span>📏 {route.distance_km} km</span>
                  <span>⏱️ {route.duration_min} min</span>
                </div>
              </div>
              <ScoreRing score={route.safety.overall} />
            </div>

            {activeRoute === i && (
              <div className="route-card-details">
                {Object.keys(LABELS).map(key => (
                  <SafetyBar key={key} label={key} value={route.safety[key]} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {featuresFound && (
        <div className="features-summary">
          <h4>Safety Data Found</h4>
          <div className="feature-chips">
            {Object.entries(featuresFound).map(([k, v]) => (
              <span key={k} className="chip">{k}: <strong>{v}</strong></span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
