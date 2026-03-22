import { useState, useEffect, useRef } from 'react'

const CALLERS = [
  { name: 'Mom', emoji: '👩', color: '#d946ef' },
  { name: 'Dad', emoji: '👨', color: '#4f46e5' },
  { name: 'Boss', emoji: '👔', color: '#0891b2' },
  { name: 'Best Friend', emoji: '👯', color: '#059669' },
]

const DELAY_OPTIONS = [
  { label: '15 sec', value: 15 },
  { label: '30 sec', value: 30 },
  { label: '1 min', value: 60 },
]

// Generate a ringtone using Web Audio API
function createRingtone(audioCtx) {
  const oscillator = audioCtx.createOscillator()
  const gainNode = audioCtx.createGain()
  oscillator.connect(gainNode)
  gainNode.connect(audioCtx.destination)
  oscillator.type = 'sine'
  oscillator.frequency.value = 440

  // Ring pattern: beep-beep, pause, beep-beep
  const now = audioCtx.currentTime
  gainNode.gain.setValueAtTime(0, now)

  for (let i = 0; i < 20; i++) {
    const t = now + i * 2
    // Ring on
    gainNode.gain.setValueAtTime(0.3, t)
    oscillator.frequency.setValueAtTime(440, t)
    gainNode.gain.setValueAtTime(0.3, t + 0.15)
    oscillator.frequency.setValueAtTime(480, t + 0.15)
    gainNode.gain.setValueAtTime(0, t + 0.4)
    // Second ring
    gainNode.gain.setValueAtTime(0.3, t + 0.6)
    oscillator.frequency.setValueAtTime(440, t + 0.6)
    gainNode.gain.setValueAtTime(0.3, t + 0.75)
    oscillator.frequency.setValueAtTime(480, t + 0.75)
    gainNode.gain.setValueAtTime(0, t + 1.0)
  }

  oscillator.start(now)
  return { oscillator, gainNode }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function FakeCall() {
  const [showSetup, setShowSetup] = useState(false)
  const [selectedCaller, setSelectedCaller] = useState(CALLERS[0])
  const [delay, setDelay] = useState(15)
  const [countdown, setCountdown] = useState(null)
  const [ringing, setRinging] = useState(false)
  const [inCall, setInCall] = useState(false)
  const [callTime, setCallTime] = useState(0)
  const audioRef = useRef(null)
  const timerRef = useRef(null)

  // Countdown to ring
  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) {
      setCountdown(null)
      triggerCall()
      return
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // Call timer
  useEffect(() => {
    if (!inCall) return
    const t = setInterval(() => setCallTime(c => c + 1), 1000)
    return () => clearInterval(t)
  }, [inCall])

  const triggerCall = () => {
    setRinging(true)
    // Vibrate if supported
    if (navigator.vibrate) {
      navigator.vibrate([300, 200, 300, 200, 300, 1000, 300, 200, 300, 200, 300])
    }
    // Play ringtone
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      audioRef.current = createRingtone(ctx)
      audioRef.current._ctx = ctx
    } catch (e) {
      console.log('Audio not available')
    }
  }

  const acceptCall = () => {
    stopAudio()
    setRinging(false)
    setInCall(true)
    setCallTime(0)
  }

  const declineCall = () => {
    stopAudio()
    setRinging(false)
    setInCall(false)
    setShowSetup(false)
    if (navigator.vibrate) navigator.vibrate(0)
  }

  const endCall = () => {
    setInCall(false)
    setShowSetup(false)
    setCallTime(0)
  }

  const stopAudio = () => {
    if (audioRef.current) {
      try {
        audioRef.current.oscillator.stop()
        audioRef.current._ctx.close()
      } catch (_) {}
      audioRef.current = null
    }
    if (navigator.vibrate) navigator.vibrate(0)
  }

  const startCountdown = () => {
    setShowSetup(false)
    setCountdown(delay)
  }

  const cancelCountdown = () => {
    setCountdown(null)
  }

  // Full-screen ringing overlay
  if (ringing) {
    return (
      <div className="fakecall-overlay ringing">
        <div className="fakecall-incoming">
          <div className="fakecall-caller-emoji">{selectedCaller.emoji}</div>
          <div className="fakecall-caller-name">{selectedCaller.name}</div>
          <div className="fakecall-status">Incoming Call...</div>
          <div className="fakecall-phone-icon">📱</div>
        </div>
        <div className="fakecall-actions">
          <button className="fakecall-decline" onClick={declineCall}>
            <span>✕</span>
            <span className="fakecall-action-label">Decline</span>
          </button>
          <button className="fakecall-accept" onClick={acceptCall}>
            <span>📞</span>
            <span className="fakecall-action-label">Accept</span>
          </button>
        </div>
      </div>
    )
  }

  // Full-screen in-call overlay
  if (inCall) {
    return (
      <div className="fakecall-overlay incall">
        <div className="fakecall-incoming">
          <div className="fakecall-caller-emoji">{selectedCaller.emoji}</div>
          <div className="fakecall-caller-name">{selectedCaller.name}</div>
          <div className="fakecall-timer">{formatTime(callTime)}</div>
        </div>
        <div className="fakecall-actions">
          <button className="fakecall-end" onClick={endCall}>
            <span>📵</span>
            <span className="fakecall-action-label">End Call</span>
          </button>
        </div>
      </div>
    )
  }

  // Countdown indicator (non-blocking)
  if (countdown !== null) {
    return (
      <div className="fakecall-countdown" onClick={cancelCountdown}>
        <span className="fakecall-countdown-icon">📱</span>
        <span>Call from <strong>{selectedCaller.name}</strong> in <strong>{countdown}s</strong></span>
        <span className="fakecall-cancel">✕ Cancel</span>
      </div>
    )
  }

  // Setup panel — shown when user clicks the trigger
  if (showSetup) {
    return (
      <div className="fakecall-setup">
        <div className="fakecall-setup-header">
          <h4>📱 Fake Call</h4>
          <button className="fakecall-setup-close" onClick={() => setShowSetup(false)}>✕</button>
        </div>
        <p className="fakecall-setup-desc">Set up a fake incoming call to help you leave an uncomfortable situation safely.</p>

        <label className="fakecall-label">Who's calling?</label>
        <div className="fakecall-callers">
          {CALLERS.map(c => (
            <button
              key={c.name}
              className={`fakecall-caller-btn ${selectedCaller.name === c.name ? 'active' : ''}`}
              onClick={() => setSelectedCaller(c)}
              style={{ '--caller-color': c.color }}
            >
              <span>{c.emoji}</span> {c.name}
            </button>
          ))}
        </div>

        <label className="fakecall-label">Ring in...</label>
        <div className="fakecall-delays">
          {DELAY_OPTIONS.map(d => (
            <button
              key={d.value}
              className={`fakecall-delay-btn ${delay === d.value ? 'active' : ''}`}
              onClick={() => setDelay(d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>

        <button className="fakecall-start" onClick={startCountdown}>
          📞 Schedule Call
        </button>
      </div>
    )
  }

  // Trigger button (shown in SOS area)
  return null
}

// Export the trigger separately so SOSButton can use it
export function FakeCallTrigger({ onClick }) {
  return (
    <button className="sos-fakecall" onClick={onClick}>
      📱 Fake Incoming Call
    </button>
  )
}
