import { useState, useEffect } from 'react'

export default function CrimeInfo({ areaName }) {
  const [articles, setArticles] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchArea, setSearchArea] = useState('')
  const [detectedArea, setDetectedArea] = useState('')
  const [expanded, setExpanded] = useState(false)

  // Auto-detect location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            // Reverse geocode to get city name
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json&zoom=10`,
              { headers: { 'User-Agent': 'SafeRoute-HackathonMVP/1.0' } }
            )
            const data = await res.json()
            const city = data.address?.city || data.address?.town || data.address?.county || data.address?.state || ''
            if (city) {
              setDetectedArea(city)
              fetchNews(city)
            }
          } catch { /* ignore reverse geocode failure */ }
        },
        () => { /* location denied — user can search manually */ },
        { enableHighAccuracy: false, timeout: 8000 }
      )
    }
  }, [])

  const fetchNews = (area) => {
    if (!area) return
    setLoading(true)
    setError(null)
    setArticles(null)
    setDetectedArea(area)
    fetch(`/api/crime-news?area=${encodeURIComponent(area)}`)
      .then(r => r.json())
      .then(data => {
        if (data.articles && data.articles.length > 0) {
          setArticles(data.articles)
        } else {
          setError('No recent crime news found for this area.')
        }
      })
      .catch(() => setError('Failed to fetch crime news.'))
      .finally(() => setLoading(false))
  }

  return (
    <div className="crime-info">
      <div className="crime-header" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
        <span>📰</span>
        <span className="crime-title">
          Area Crime News {detectedArea && <span className="crime-area-tag">· {detectedArea}</span>}
        </span>
        <span className="ai-badge">LIVE</span>
        <span className="community-toggle">{expanded ? '▾' : '▸'}</span>
      </div>

      {expanded && (
        <>
          <div className="crime-search">
            <input
              type="text"
              className="crime-input"
              placeholder={detectedArea || areaName || 'Enter area (e.g. Pune)'}
              value={searchArea}
              onChange={(e) => setSearchArea(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchNews(searchArea || detectedArea || areaName)}
            />
            <button className="crime-btn" onClick={() => fetchNews(searchArea || detectedArea || areaName)} disabled={loading}>
              {loading ? '⏳' : '🔍'}
            </button>
          </div>

          {loading && <div className="crime-loading">Fetching latest crime reports...</div>}
          {error && <div className="crime-error">{error}</div>}

          {articles && (
            <div className="crime-articles">
              {articles.map((a, i) => (
                <a key={i} href={a.link} target="_blank" rel="noopener noreferrer" className="crime-article">
                  <div className="crime-article-title">{a.title}</div>
                  <div className="crime-article-meta">
                    {a.source && <span className="crime-source">{a.source}</span>}
                    {a.published && <span className="crime-date">{a.published}</span>}
                  </div>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
