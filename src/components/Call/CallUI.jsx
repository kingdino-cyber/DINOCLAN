import { useEffect, useRef } from 'react'
import { useCall } from '../../contexts/CallContext'

// Renders hidden <audio> elements to play remote streams
function RemoteAudio({ streams }) {
  return (
    <>
      {Object.entries(streams).map(([uid, stream]) => (
        <AudioElement key={uid} stream={stream} />
      ))}
    </>
  )
}

function AudioElement({ stream }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream
    }
  }, [stream])
  return <audio ref={ref} autoPlay playsInline style={{ display: 'none' }} />
}

function ParticipantBubble({ name, isYou, isMuted }) {
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'
  return (
    <div className="call-participant">
      <div className={`call-avatar ${isMuted && isYou ? 'muted' : ''}`}>
        {initials}
        {isMuted && isYou && <span className="call-muted-icon">🔇</span>}
      </div>
      <div className="call-participant-name">{isYou ? `${name} (you)` : name}</div>
    </div>
  )
}

export default function CallUI() {
  const { activeCall, remoteStreams, isMuted, endCall, toggleMute } = useCall()
  if (!activeCall) return null

  const { type, status, participants = [], targetName, channelName, serverName } = activeCall

  const callLabel = type === 'dm'
    ? `📞 Call with ${targetName || '...'}`
    : `🔊 ${serverName || 'Server'} — #${channelName || 'voice'}`

  const isRinging = status === 'ringing'
  const participantCount = Object.keys(remoteStreams).length + 1

  return (
    <>
      <RemoteAudio streams={remoteStreams} />

      <div className="call-ui">
        <div className="call-ui-header">
          <span className={`call-status-dot ${isRinging ? 'ringing' : 'active'}`} />
          <span className="call-label">{isRinging ? `📲 Calling ${targetName}…` : callLabel}</span>
          <span className="call-participant-count">{participantCount} 🎤</span>
        </div>

        <div className="call-participants">
          {participants.map(p => (
            <ParticipantBubble
              key={p.uid}
              name={p.name}
              isYou={false}
              isMuted={false}
            />
          ))}
        </div>

        <div className="call-controls">
          <button
            className={`call-ctrl-btn ${isMuted ? 'muted' : ''}`}
            onClick={toggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>
          <button
            className="call-ctrl-btn end-btn"
            onClick={endCall}
            title="End / Leave call"
          >
            📵
          </button>
        </div>
      </div>
    </>
  )
}
