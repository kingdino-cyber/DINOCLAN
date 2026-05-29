import { useEffect, useRef, useState } from 'react'
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useCall } from '../../contexts/CallContext'
import Avatar from './Avatar'

// ── Video tile for a single participant ──────────────────────────────────────
function VideoTile({ uid, name, stream, isLocal, hasVideoOn }) {
  const videoRef  = useRef(null)
  const [userData, setUserData] = useState(null)

  useEffect(() => {
    if (!uid) return
    getDoc(doc(db, 'users', uid)).then(snap => {
      if (snap.exists()) setUserData(snap.data())
    })
  }, [uid])

  useEffect(() => {
    const el = videoRef.current
    if (!el || !stream) return
    el.srcObject = stream
    el.play().catch(() => {})
  }, [stream])

  const fakeUser = {
    displayName: name,
    photoURL:    userData?.photoURL    || null,
    avatarEmoji: userData?.avatarEmoji || null,
    avatarBg:    userData?.avatarBg    || null,
  }

  return (
    <div className="voice-tile">
      {hasVideoOn && stream ? (
        <video
          ref={videoRef}
          className="voice-tile-video"
          autoPlay playsInline
          muted={isLocal}
        />
      ) : (
        <div className="voice-tile-placeholder">
          <Avatar user={fakeUser} size={80} />
        </div>
      )}
      <div className="voice-tile-label">
        {name}{isLocal ? ' (you)' : ''}
      </div>
    </div>
  )
}

// ── Tile for someone visible in Firestore but not yet streaming ───────────────
function WaitingTile({ uid, name }) {
  const [userData, setUserData] = useState(null)
  useEffect(() => {
    if (!uid) return
    getDoc(doc(db, 'users', uid)).then(snap => {
      if (snap.exists()) setUserData(snap.data())
    })
  }, [uid])
  const fakeUser = {
    displayName: name,
    photoURL:    userData?.photoURL    || null,
    avatarEmoji: userData?.avatarEmoji || null,
    avatarBg:    userData?.avatarBg    || null,
  }
  return (
    <div className="voice-tile">
      <div className="voice-tile-placeholder">
        <Avatar user={fakeUser} size={80} />
      </div>
      <div className="voice-tile-label">{name}</div>
    </div>
  )
}

// ── Main voice-room view ─────────────────────────────────────────────────────
export default function VoiceChannelView({ server, channel }) {
  const { currentUser }  = useAuth()
  const {
    activeCall, remoteStreams,
    isMuted, toggleMute,
    hasVideo, toggleVideo,
    localStream,
    startServerCall, endCall,
  } = useCall()

  // Live participant list from Firestore call document
  const [callParticipants, setCallParticipants] = useState([])

  useEffect(() => {
    if (!channel?.id) return
    const q = query(
      collection(db, 'calls'),
      where('channelId', '==', channel.id),
      where('status',    '==', 'active'),
    )
    return onSnapshot(q, snap => {
      if (snap.empty) { setCallParticipants([]); return }
      setCallParticipants(snap.docs[0].data().participants || [])
    })
  }, [channel?.id])

  const isInCall = activeCall?.channelId === channel?.id

  // Participants we're actively streaming with (have remote streams)
  const streamingUids = Object.keys(remoteStreams)

  // Participants in call but not yet in our remoteStreams (still connecting or no stream)
  const waitingParticipants = callParticipants.filter(
    p => p.uid !== currentUser?.uid && !streamingUids.includes(p.uid)
  )

  return (
    <div className="voice-room">

      {/* ── Header ── */}
      <div className="voice-room-header">
        <span className="voice-room-icon">🔊</span>
        <h2 className="voice-room-name">{channel?.name}</h2>
        {callParticipants.length > 0 && (
          <span className="voice-room-count">{callParticipants.length} in call</span>
        )}
      </div>

      {/* ── Participant grid ── */}
      <div className="voice-grid">
        {/* Empty room message */}
        {callParticipants.length === 0 && (
          <div className="voice-empty">
            <div style={{ fontSize: 56 }}>🦕</div>
            <p>The voice channel is empty</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Be the first one to join!
            </p>
          </div>
        )}

        {/* Local tile (shown only when in the call) */}
        {isInCall && (
          <VideoTile
            uid={currentUser?.uid}
            name={currentUser?.displayName || 'You'}
            stream={localStream}
            isLocal
            hasVideoOn={hasVideo}
          />
        )}

        {/* Remote streams */}
        {streamingUids.map(uid => {
          const info = callParticipants.find(p => p.uid === uid)
          const stream = remoteStreams[uid]
          const hasRemoteVideo = stream?.getVideoTracks().some(t => t.enabled && t.readyState === 'live')
          return (
            <VideoTile
              key={uid}
              uid={uid}
              name={info?.name || 'Unknown'}
              stream={stream}
              isLocal={false}
              hasVideoOn={hasRemoteVideo}
            />
          )
        })}

        {/* People in call but not yet streaming */}
        {waitingParticipants.map(p => (
          <WaitingTile key={p.uid} uid={p.uid} name={p.name} />
        ))}
      </div>

      {/* ── Controls ── */}
      <div className="voice-controls">
        {isInCall ? (
          <>
            <button
              className={`voice-ctrl-btn ${isMuted ? 'danger' : ''}`}
              onClick={toggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>
            <button
              className={`voice-ctrl-btn ${hasVideo ? 'active' : ''}`}
              onClick={toggleVideo}
              title={hasVideo ? 'Turn camera off' : 'Turn camera on'}
            >
              {hasVideo ? '📷' : '🚫📷'}
            </button>
            <button
              className="voice-ctrl-btn voice-leave-btn"
              onClick={endCall}
              title="Leave call"
            >
              📵 Leave
            </button>
          </>
        ) : (
          <button
            className="voice-join-btn"
            onClick={() => startServerCall(server.id, server.name, channel.id, channel.name)}
          >
            🔊 Join Voice
          </button>
        )}
      </div>
    </div>
  )
}
