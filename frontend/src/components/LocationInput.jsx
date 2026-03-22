import { useState, useEffect, useRef } from 'react'

export default function LocationInput({ label, placeholder, icon, onSelect }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Debounced autocomplete
  useEffect(() => {
    if (query.length < 3) { setSuggestions([]); return }
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        if (Array.isArray(data)) {
          setSuggestions(data)
          setOpen(true)
        }
      } catch { /* ignore */ }
      setLoading(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = (item) => {
    // Show only the short primary name to avoid overly long input text
    setQuery(item.primary)
    setSuggestions([])
    setOpen(false)
    onSelect(item)
  }

  return (
    <div className="location-input" ref={wrapperRef}>
      <label>{label}</label>
      <div className="input-wrapper">
        <span className="icon">{icon}</span>
        <input
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={(e) => { setQuery(e.target.value); onSelect(null) }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
        />
        {loading && <span className="input-spinner"></span>}
      </div>
      {open && suggestions.length > 0 && (
        <ul className="suggestions">
          {suggestions.map((s, i) => (
            <li key={i} onClick={() => handleSelect(s)}>
              <span className="suggestion-icon">{s.icon || '📍'}</span>
              <div className="suggestion-content">
                <div className="suggestion-primary">{s.primary}</div>
                <div className="suggestion-secondary">
                  {s.secondary}
                  {s.type && <span className="suggestion-type">{s.type}</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
