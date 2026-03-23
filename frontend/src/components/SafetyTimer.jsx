import { useState, useEffect, useRef, useCallback } from 'react'

const STORAGE_KEY = 'saferoute_guardian'

const DURATION_OPTIONS = [
  { label: '15 min', value: 15 * 60 },
  { label: '30 min', value: 30 * 60 },
  { label: '1 hour', value: 60 * 60 },
  { label: '2 hours', value: 120 * 60 },
]

function formatCountdown(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function createAlarm(audioCtx) {
  const oscillator = audioCtx.createOscillator()
  const gainNode = audioCtx.createGain()
  oscillator.connect(gainNode)
  gainNode.connect(audioCtx.destination)
  oscillator.type = 'sawtooth'

  const now = audioCtx.currentTime
  gainNode.gain.setValueAtTime(0, now)

  // Urgent alarm pattern — rising siren
  for (let i = 0; i < 30; i++) {
    const t = now + i * 1.2
    gainNode.gain.setValueAtTime(0.25, t)
    oscillator.frequency.setValueAtTime(600, t)
    oscillator.frequency.linearRampToValueAtTime(1000, t + 0.5)
    gainNode.gain.setValueAtTime(0, t + 0.6)
    gainNode.gain.setValueAtTime(0.25, t + 0.7)
    oscillator.frequency.setValueAtTime(1000, t + 0.7)
    oscillator.frequency.linearRampToValueAtTime(600, t + 1.1)
    gainNode.gain.setValueAtTime(0, t + 1.15)
  }

  oscillator.start(now)
  return { oscillator, gainNode, _ctx: audioCtx }
}

function loadSaved() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch (_) {}
  return null
}

function saveToDB(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function clearDB() {
  localStorage.removeItem(STORAGE_KEY)
}

export default function SafetyTimer({ onClose }) {
  // Setup state
  const [destination, setDestination] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [duration, setDuration] = useState(DURATION_OPTIONS[0].value)
  const [customMin, setCustomMin] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [sosMessage, setSosMessage] = useState(
    "🚨 EMERGENCY: I haven't checked in on SafeRoute. I may be in danger. Please try to reach me or contact authorities immediately."
  )

  // Active state
  const [phase, setPhase] = useState('setup') // 'setup' | 'active' | 'alert'
  const [remaining, setRemaining] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [startTime, setStartTime] = useState(null)
  const [activeData, setActiveData] = useState(null)

  const audioRef = useRef(null)
  const timerRef = useRef(null)

  // Restore saved session on mount
  useEffect(() => {
    const saved = loadSaved()
    if (saved && saved.phase === 'active') {
      const elapsed = Math.floor((Date.now() - saved.startTime) / 1000)
      const left = saved.totalDuration - elapsed
      if (left <= 0) {
        // Timer expired while away!
        setPhase('alert')
        setActiveData(saved)
        setRemaining(0)
        setTotalDuration(saved.totalDuration)
      } else {
        setPhase('active')
        setRemaining(left)
        setTotalDuration(saved.totalDuration)
        setStartTime(saved.startTime)
        setActiveData(saved)
      }
    }
  }, [])

  // Countdown tick
  useEffect(() => {
    if (phase !== 'active') return
    timerRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          triggerAlert()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [phase])

  // Trigger alert
  const triggerAlert = useCallback(() => {
    setPhase('alert')
    saveToDB({ ...loadSaved(), phase: 'alert' })

    // Vibrate
    if (navigator.vibrate) {
      navigator.vibrate([500, 200, 500, 200, 500, 200, 500, 200, 500])
    }

    // Sound alarm
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      audioRef.current = createAlarm(ctx)
    } catch (e) {
      console.log('Audio not available')
    }

    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🚨 SafeRoute ALERT', {
        body: 'You haven\'t checked in! Your emergency contacts will be notified.',
        icon: '🚨',
        requireInteraction: true,
      })
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission()
    }
  }, [])

  const stopAlarm = () => {
    if (audioRef.current) {
      try {
        audioRef.current.oscillator.stop()
        audioRef.current._ctx.close()
      } catch (_) {}
      audioRef.current = null
    }
    if (navigator.vibrate) navigator.vibrate(0)
  }

  // Actions
  const activateGuardian = () => {
    const dur = useCustom && customMin ? parseInt(customMin) * 60 : duration
    if (!dur || dur < 60) return

    const data = {
      destination: destination.trim() || 'Unknown destination',
      contactName: contactName.trim() || 'Emergency Contact',
      contactPhone: contactPhone.trim() || '',
      sosMessage,
      totalDuration: dur,
      startTime: Date.now(),
      phase: 'active',
    }

    saveToDB(data)
    setActiveData(data)
    setTotalDuration(dur)
    setRemaining(dur)
    setStartTime(data.startTime)
    setPhase('active')

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  const checkInSafe = () => {
    clearInterval(timerRef.current)
    stopAlarm()
    clearDB()
    setPhase('setup')
    setRemaining(0)
  }

  const extendTimer = () => {
    const extra = 15 * 60
    setRemaining(prev => prev + extra)
    setTotalDuration(prev => prev + extra)
    const saved = loadSaved()
    if (saved) {
      saveToDB({ ...saved, totalDuration: (saved.totalDuration || 0) + extra })
    }
  }

  const cancelTimer = () => {
    clearInterval(timerRef.current)
    stopAlarm()
    clearDB()
    setPhase('setup')
    setRemaining(0)
  }

  const dismissAlert = () => {
    stopAlarm()
    clearDB()
    setPhase('setup')
    setRemaining(0)
  }

  const shareWhatsApp = () => {
    const data = activeData || loadSaved() || {}
    const msg = `${data.sosMessage || sosMessage}\n\n📍 Destination: ${data.destination || 'Unknown'}\n⏰ Timer expired at: ${new Date().toLocaleTimeString()}\n🗓️ Date: ${new Date().toLocaleDateString()}`
    const url = `https://wa.me/${data.contactPhone ? data.contactPhone.replace(/\D/g, '') : ''}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  const callContact = () => {
    const data = activeData || loadSaved() || {}
    if (data.contactPhone) {
      window.open(`tel:${data.contactPhone}`, '_self')
    }
  }

  // ===== Progress Ring =====
  const progress = totalDuration > 0 ? remaining / totalDuration : 1
  const circumference = 2 * Math.PI * 120
  const strokeOffset = circumference * (1 - progress)

  // Determine ring color based on remaining time
  const getTimerColor = () => {
    if (remaining < 60) return '#dc2626' // red under 1 min
    if (remaining < 300) return '#d97706' // amber under 5 min
    return '#059669' // green
  }

  // ===== ALERT MODE =====
  if (phase === 'alert') {
    const data = activeData || {}
    return (
      <div className="guardian-overlay guardian-alert">
        <div className="guardian-alert-content">
          <div className="guardian-alert-icon">🚨</div>
          <h2 className="guardian-alert-title">ALERT TRIGGERED</h2>
          <p className="guardian-alert-subtitle">You didn't check in. Emergency mode activated.</p>

          <div className="guardian-alert-info">
            <div className="guardian-alert-row">
              <span className="guardian-alert-label">📍 Destination</span>
              <span className="guardian-alert-value">{data.destination || 'Unknown'}</span>
            </div>
            <div className="guardian-alert-row">
              <span className="guardian-alert-label">⏰ Alert Time</span>
              <span className="guardian-alert-value">{new Date().toLocaleTimeString()}</span>
            </div>
            <div className="guardian-alert-row">
              <span className="guardian-alert-label">👤 Emergency Contact</span>
              <span className="guardian-alert-value">{data.contactName || '—'}</span>
            </div>
          </div>

          <div className="guardian-alert-msg">
            <p>{data.sosMessage || sosMessage}</p>
          </div>

          <div className="guardian-alert-actions">
            <button className="guardian-btn-whatsapp" onClick={shareWhatsApp}>
              💬 Share SOS via WhatsApp
            </button>
            {data.contactPhone && (
              <button className="guardian-btn-call" onClick={callContact}>
                📞 Call {data.contactName || 'Contact'}
              </button>
            )}
            <button className="guardian-btn-safe" onClick={dismissAlert}>
              ✅ I'm Safe — False Alarm
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ===== ACTIVE COUNTDOWN =====
  if (phase === 'active') {
    const data = activeData || {}
    return (
      <div className="guardian-overlay guardian-active">
        <button className="guardian-back" onClick={onClose} title="Minimize">
          ◀ Back
        </button>

        <div className="guardian-countdown-content">
          <p className="guardian-dest-label">🛡️ Guardian Mode Active</p>
          <p className="guardian-dest-name">{data.destination || 'Unknown'}</p>

          <div className="guardian-ring-container">
            <svg className="guardian-ring" viewBox="0 0 260 260">
              <circle cx="130" cy="130" r="120" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
              <circle
                cx="130" cy="130" r="120"
                fill="none"
                stroke={getTimerColor()}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                transform="rotate(-90 130 130)"
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
              />
            </svg>
            <div className="guardian-ring-time">
              <span className={`guardian-time-text ${remaining < 60 ? 'guardian-time-critical' : ''}`}>
                {formatCountdown(remaining)}
              </span>
              <span className="guardian-time-label">remaining</span>
            </div>
          </div>

          <div className="guardian-contact-badge">
            <span>👤</span>
            <span>{data.contactName || 'Emergency Contact'}</span>
            {data.contactPhone && <span className="guardian-phone-dim">({data.contactPhone})</span>}
          </div>

          <div className="guardian-active-actions">
            <button className="guardian-btn-checkin" onClick={checkInSafe}>
              ✅ I'm Safe
            </button>
            <button className="guardian-btn-extend" onClick={extendTimer}>
              ⏱️ +15 min
            </button>
            <button className="guardian-btn-cancel" onClick={cancelTimer}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ===== SETUP SCREEN =====
  return (
    <div className="guardian-overlay guardian-setup">
      <button className="guardian-back" onClick={onClose}>
        ◀ Back
      </button>

      <div className="guardian-setup-content">
        <div className="guardian-setup-header">
          <div className="guardian-setup-icon">⏱️</div>
          <h2>Guardian Mode</h2>
          <p className="guardian-setup-desc">
            Set a check-in timer before heading out. If you don't tap "I'm Safe" before time runs out,
            the app triggers an emergency alert with your details — your digital safety net.
          </p>
        </div>

        <div className="guardian-form">
          <div className="guardian-field">
            <label>📍 Where are you heading?</label>
            <input
              type="text"
              placeholder="e.g. Walking home from Koregaon Park"
              value={destination}
              onChange={e => setDestination(e.target.value)}
            />
          </div>

          <div className="guardian-field-row">
            <div className="guardian-field" style={{ flex: 1 }}>
              <label>👤 Emergency Contact</label>
              <input
                type="text"
                placeholder="Name"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
              />
            </div>
            <div className="guardian-field" style={{ flex: 1 }}>
              <label>📱 Phone</label>
              <input
                type="tel"
                placeholder="+91 9876543210"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="guardian-field">
            <label>⏳ Check-in Timer</label>
            <div className="guardian-durations">
              {DURATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`guardian-dur-btn ${!useCustom && duration === opt.value ? 'active' : ''}`}
                  onClick={() => { setDuration(opt.value); setUseCustom(false) }}
                >
                  {opt.label}
                </button>
              ))}
              <button
                className={`guardian-dur-btn ${useCustom ? 'active' : ''}`}
                onClick={() => setUseCustom(true)}
              >
                Custom
              </button>
            </div>
            {useCustom && (
              <div className="guardian-custom-input">
                <input
                  type="number"
                  placeholder="Minutes"
                  min="1"
                  max="480"
                  value={customMin}
                  onChange={e => setCustomMin(e.target.value)}
                />
                <span>minutes</span>
              </div>
            )}
          </div>

          <div className="guardian-field">
            <label>📝 SOS Message (sent if timer expires)</label>
            <textarea
              rows={3}
              value={sosMessage}
              onChange={e => setSosMessage(e.target.value)}
            />
          </div>

          <button
            className="guardian-activate-btn"
            onClick={activateGuardian}
            disabled={useCustom && (!customMin || parseInt(customMin) < 1)}
          >
            🛡️ Activate Guardian Mode
          </button>

          <p className="guardian-disclaimer">
            Your timer survives page refresh. Close and reopen SafeRoute — your countdown continues.
          </p>
        </div>
      </div>
    </div>
  )
}
