import { useState, useEffect } from 'react'

export default function SafetyBriefing({ route, featuresFound }) {
  const [briefing, setBriefing] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!route) { setBriefing(null); return }
    setLoading(true)
    fetch('/api/safety-briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ route, features_found: featuresFound }),
    })
      .then(r => r.json())
      .then(data => setBriefing(data.briefing || 'Unable to generate briefing.'))
      .catch(() => setBriefing('AI briefing unavailable.'))
      .finally(() => setLoading(false))
  }, [route?.id])

  if (!route) return null

  return (
    <div className="ai-briefing">
      <div className="ai-briefing-header">
        <span className="ai-icon">🤖</span>
        <span className="ai-label">AI Safety Briefing</span>
        <span className="ai-badge">Gemini</span>
      </div>
      <div className="ai-briefing-body">
        {loading ? (
          <div className="ai-loading">
            <span className="ai-dots">Analyzing route safety</span>
          </div>
        ) : (
          <p>{briefing}</p>
        )}
      </div>
    </div>
  )
}
