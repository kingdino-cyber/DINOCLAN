import { useEffect, useRef, useState } from 'react'
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore'
import { isStale } from '../../utils/presence'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useCall } from '../../contexts/CallContext'
import DinoLogo from '../DinoLogo'
import { useSpeaking } from '../../utils/useSpeaking'
import Avatar from './Avatar'

// ── Camera SVG icon (single icon, changes style based on state) ──────────────
function CameraIcon({ on, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      {on
        ? <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
        : <>
            <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
          </>
      }
    </svg>
  )
}

// ── Screen share SVG icon ─────────────────────────────────────────────────────
function ScreenIcon({ on, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      {on
        ? <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zm-7-3.53v-2.19c-2.78.48-4.34 1.71-5.5 3.72.14-1.4.73-4.55 4.5-5.93V8l4 3.73-3 2.74z"/>
        : <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 16V6h16v10H4z"/>
      }
    </svg>
  )
}

// ── Video tile ───────────────────────────────────────────────────────────────
function tileSizing(count) {
  if (count <= 2)  return { w: 560, h: 360, avatar: 150 }
  if (count <= 4)  return { w: 400, h: 270, avatar: 112 }
  if (count <= 6)  return { w: 310, h: 210, avatar: 92 }
  if (count <= 9)  return { w: 250, h: 175, avatar: 78 }
  return { w: 200, h: 150, avatar: 64 }
}

function VideoTile({ uid, name, stream, isLocal, hasVideoOn, isScreenShare, avatarSize = 80 }) {
  const videoRef  = useRef(null)
  const [userData, setUserData] = useState(null)
  const speaking = useSpeaking(stream)

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
  }, [stream, hasVideoOn])

  const fakeUser = {
    displayName: name,
    photoURL:    userData?.photoURL    || null,
    avatarEmoji: userData?.avatarEmoji || null,
    avatarBg:    userData?.avatarBg    || null,
  }

  return (
    <div className={`voice-tile ${speaking ? 'speaking' : ''}`}>
      {hasVideoOn && stream ? (
        <video
          ref={videoRef}
          className="voice-tile-video"
          autoPlay playsInline
          muted={isLocal}
          /* Mirror own camera feed so it feels natural */
          style={isLocal && !isScreenShare ? { transform: 'scaleX(-1)' } : {}}
        />
      ) : (
        <div className="voice-tile-placeholder">
          <div className={`speaking-ring-wrap ${speaking ? 'speaking' : ''}`}>
            <Avatar user={fakeUser} size={avatarSize} />
          </div>
        </div>
      )}
      <div className="voice-tile-label">
        {isScreenShare && <span style={{ marginRight: 4 }}>🖥️</span>}
        {name}{isLocal ? ' (you)' : ''}
      </div>
    </div>
  )
}

// ── Tile for someone in Firestore but not yet streaming ──────────────────────
function WaitingTile({ uid, name, avatarSize = 80 }) {
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
        <Avatar user={fakeUser} size={avatarSize} />
      </div>
      <div className="voice-tile-label">{name}</div>
    </div>
  )
}

// ── Main voice-room view ─────────────────────────────────────────────────────
export default function VoiceChannelView({ server, channel }) {
  const { currentUser } = useAuth()
  const {
    activeCall, remoteStreams,
    isMuted, toggleMute,
    hasVideo, toggleVideo,
    isScreenSharing, toggleScreenShare,
    localStream,
    startServerCall, endCall,
  } = useCall()

  const [callParticipants, setCallParticipants] = useState([])
  const [callDocId, setCallDocId] = useState(null)

  useEffect(() => {
    if (!channel?.id) return
    const q = query(
      collection(db, 'calls'),
      where('channelId', '==', channel.id),
      where('status',    '==', 'active'),
    )
    return onSnapshot(q, snap => {
      if (snap.empty) { setCallParticipants([]); setCallDocId(null); return }
      setCallParticipants(snap.docs[0].data().participants || [])
      setCallDocId(snap.docs[0].id)
    })
  }, [channel?.id])

  // Remove people who left without cleanly leaving (closed the tab, crashed, lost connection):
  // their heartbeat has stopped, so drop them from the call.
  useEffect(() => {
    if (!callDocId || callParticipants.length === 0) return
    let cancelled = false
    async function sweep() {
      for (const p of callParticipants) {
        if (cancelled) return
        if (p.uid === currentUser?.uid) continue
        try {
          const snap = await getDoc(doc(db, 'users', p.uid))
          if (!snap.exists() || isStale(snap.data())) {
            await updateDoc(doc(db, 'calls', callDocId), { participants: arrayRemove(p) })
            const fresh = await getDoc(doc(db, 'calls', callDocId))
            if (fresh.exists() && (fresh.data().participants || []).length === 0) {
              await updateDoc(doc(db, 'calls', callDocId), { status: 'ended' })
            }
          }
        } catch (_) {}
      }
    }
    sweep()
    const t = setInterval(sweep, 30000)
    return () => { cancelled = true; clearInterval(t) }
  }, [callDocId, callParticipants.map(p => p.uid).join(','), currentUser?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  const isInCall       = activeCall?.channelId === channel?.id
  const streamingUids  = Object.keys(remoteStreams)
  const waitingParticipants = callParticipants.filter(
    p => p.uid !== currentUser?.uid && !streamingUids.includes(p.uid)
  )

  const tileCount = (isInCall ? 1 : 0) + streamingUids.length + waitingParticipants.length
  const sizing = tileSizing(tileCount)

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
      <div className="voice-grid" style={{ '--tile-w': `${sizing.w}px`, '--tile-h': `${sizing.h}px` }}>
        {callParticipants.length === 0 && (
          <div className="voice-empty">
            <DinoLogo style={{ width: 210, height: 210, objectFit: 'contain', filter: 'drop-shadow(0 8px 32px rgba(76,175,80,0.45))' }} />
            <p>The voice channel is empty</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Be the first one to join!</p>
          </div>
        )}

        {/* Own tile */}
        {isInCall && (
          <VideoTile
            uid={currentUser?.uid}
            name={currentUser?.displayName || 'You'}
            stream={localStream}
            isLocal
            hasVideoOn={hasVideo}
            isScreenShare={isScreenSharing}
            avatarSize={sizing.avatar}
          />
        )}

        {/* Remote streams */}
        {streamingUids.map(uid => {
          const info = callParticipants.find(p => p.uid === uid)
          const stream = remoteStreams[uid]
          const hasRemoteVideo = stream?.getVideoTracks().some(t => t.readyState === 'live')
          return (
            <VideoTile
              key={uid}
              uid={uid}
              name={info?.name || 'Unknown'}
              stream={stream}
              isLocal={false}
              hasVideoOn={hasRemoteVideo}
              isScreenShare={false}
              avatarSize={sizing.avatar}
            />
          )
        })}

        {/* Still connecting */}
        {waitingParticipants.map(p => (
          <WaitingTile key={p.uid} uid={p.uid} name={p.name} avatarSize={sizing.avatar} />
        ))}
      </div>

      {/* ── Controls ── */}
      <div className="voice-controls">
        {isInCall ? (
          <>
            {/* Mute */}
            <button
              className={`voice-ctrl-btn ${isMuted ? 'danger' : ''}`}
              onClick={toggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>

            {/* Camera — single icon, green when on */}
            <button
              className={`voice-ctrl-btn ${hasVideo && !isScreenSharing ? 'cam-active' : ''}`}
              onClick={toggleVideo}
              title={hasVideo && !isScreenSharing ? 'Turn camera off' : 'Turn camera on'}
              disabled={isScreenSharing}
            >
              <CameraIcon on={hasVideo && !isScreenSharing} />
            </button>

            {/* Screen share */}
            <button
              className={`voice-ctrl-btn ${isScreenSharing ? 'cam-active' : ''}`}
              onClick={toggleScreenShare}
              title={isScreenSharing ? 'Stop sharing screen' : 'Share your screen'}
            >
              <ScreenIcon on={isScreenSharing} />
            </button>

            {/* Leave */}
            <button className="voice-ctrl-btn voice-leave-btn" onClick={endCall} title="Leave call">
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
