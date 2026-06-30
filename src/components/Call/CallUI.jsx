import { useEffect, useRef, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useCall } from '../../contexts/CallContext'
import { useSpeaking } from '../../utils/useSpeaking'
import Avatar from '../Chat/Avatar'

// Single camera SVG — no double-emoji rendering issues
function CamIcon({ on, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      {on
        ? <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
        : <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
      }
    </svg>
  )
}

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
    const el = ref.current
    if (!el || !stream) return
    el.srcObject = stream
    el.play().catch(() => {
      const retry = () => { el.play().catch(() => {}); document.removeEventListener('click', retry) }
      document.addEventListener('click', retry)
    })
  }, [stream])
  return <audio ref={ref} autoPlay playsInline style={{ display: 'none' }} />
}

// Fetches user data and shows their real avatar in DM call bubble
function UserBubble({ uid, name, isYou, isMuted, stream }) {
  const [userData, setUserData] = useState(null)
  const speaking = useSpeaking(stream)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      if (snap.exists()) setUserData(snap.data())
    })
    return unsub
  }, [uid])

  const fakeUser = {
    displayName: name,
    photoURL:    userData?.photoURL    || null,
    avatarEmoji: userData?.avatarEmoji || null,
    avatarBg:    userData?.avatarBg    || null,
  }

  return (
    <div className="call-participant">
      <div className={`call-avatar-wrap ${isMuted && isYou ? 'muted' : ''} ${speaking ? 'speaking' : ''}`}>
        <Avatar user={fakeUser} size={40} />
        {isMuted && isYou && <span className="call-muted-icon">🔇</span>}
      </div>
      <div className="call-participant-name">{isYou ? `${name} (you)` : name}</div>
    </div>
  )
}

export default function CallUI() {
  const { currentUser }  = useAuth()
  const {
    activeCall, remoteStreams, localStream,
    isMuted, toggleMute,
    hasVideo, toggleVideo,
    isScreenSharing,
    endCall,
  } = useCall()

  if (!activeCall) return null

  const { type, status, participants = [], targetName, channelName, serverName } = activeCall

  // ── Server call — show a slim floating bar (VoiceChannelView is the main UI) ──
  if (type === 'server') {
    return (
      <>
        <RemoteAudio streams={remoteStreams} />
        <div className="call-ui call-ui-mini-bar">
          <span className={`call-status-dot ${status === 'active' ? 'active' : 'ringing'}`} />
          <span className="call-label" style={{ fontSize: 11 }}>
            🔊 {serverName} — #{channelName}
          </span>
          <button className={`call-ctrl-btn-sm ${isMuted ? 'muted' : ''}`} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? '🔇' : '🎤'}
          </button>
          <button className={`call-ctrl-btn-sm ${hasVideo && !isScreenSharing ? 'active' : ''}`} onClick={toggleVideo} title={hasVideo ? 'Camera off' : 'Camera on'} disabled={isScreenSharing}>
            <CamIcon on={hasVideo && !isScreenSharing} size={14} />
          </button>
          <button className="call-ctrl-btn-sm end-btn" onClick={endCall} title="Leave">📵</button>
        </div>
      </>
    )
  }

  // ── DM call — full bubble UI ──────────────────────────────────────────────
  const isRinging = status === 'ringing'
  const callLabel = `📞 Call with ${targetName || '...'}`
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
          {participants.map(p => {
            const isYou = p.uid === currentUser?.uid
            return (
              <UserBubble
                key={p.uid}
                uid={p.uid}
                name={p.name}
                isYou={isYou}
                isMuted={isYou && isMuted}
                stream={isYou ? localStream : remoteStreams[p.uid]}
              />
            )
          })}
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
            className={`call-ctrl-btn ${hasVideo && !isScreenSharing ? 'active' : ''}`}
            onClick={toggleVideo}
            title={hasVideo ? 'Camera off' : 'Camera on'}
            disabled={isScreenSharing}
          >
            <CamIcon on={hasVideo && !isScreenSharing} size={18} />
          </button>
          <button className="call-ctrl-btn end-btn" onClick={endCall} title="End call">
            📵
          </button>
        </div>
      </div>
    </>
  )
}
