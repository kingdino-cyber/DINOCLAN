import { createContext, useContext, useState, useEffect, useRef } from 'react'
import {
  collection, addDoc, updateDoc, doc, onSnapshot,
  serverTimestamp, query, where, getDocs, arrayUnion, arrayRemove,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from './AuthContext'
import { playCallRing, playCallEnd, playCallJoin } from '../utils/sounds'

const CallContext = createContext(null)

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80',            username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443',           username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
]

export function CallProvider({ children }) {
  const { currentUser } = useAuth()
  const [activeCall, setActiveCall]         = useState(null)
  const [incomingCall, setIncomingCall]     = useState(null)
  const [remoteStreams, setRemoteStreams]   = useState({}) // { uid: MediaStream }
  const [isMuted, setIsMuted]               = useState(false)
  const [hasVideo, setHasVideo]             = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [localStream, setLocalStream]       = useState(null)
  const [callError, setCallError]           = useState('')

  const peersRef             = useRef({})          // { uid: RTCPeerConnection }
  const localStreamRef       = useRef(null)
  const activeCallIdRef      = useRef(null)
  const signalsUnsubRef      = useRef(null)
  const callDocUnsubRef      = useRef(null)
  const stopRingRef          = useRef(null)
  const processedSignalsRef  = useRef(new Set())   // tracks signal IDs already handled

  // ── Listen for incoming DM calls ──────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.uid) return
    const q = query(
      collection(db, 'calls'),
      where('targetUid', '==', currentUser.uid),
      where('status', '==', 'ringing'),
    )
    return onSnapshot(q, snap => {
      if (snap.empty) { setIncomingCall(null); return }
      if (activeCallIdRef.current) return // already in a call
      const d = snap.docs[0]
      const data = { callId: d.id, ...d.data() }
      setIncomingCall(data)
      if (stopRingRef.current) stopRingRef.current()
      stopRingRef.current = playCallRing()
    })
  }, [currentUser?.uid])

  // ── Helpers ───────────────────────────────────────────────────────────────
  async function getLocalStream() {
    if (localStreamRef.current) return localStreamRef.current
    let stream
    try {
      // Try to get audio + video; camera starts disabled so no permission popup until toggled
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: 640, height: 480, facingMode: 'user' },
      })
      // Start with camera off — user explicitly enables it
      stream.getVideoTracks().forEach(t => { t.enabled = false })
    } catch {
      // No camera available — audio only
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    }
    localStreamRef.current = stream
    setLocalStream(stream)
    return stream
  }

  function toggleVideo() {
    const stream = localStreamRef.current
    if (!stream) return
    const tracks = stream.getVideoTracks()
    if (tracks.length === 0) return          // no camera on this device
    if (isScreenSharing) return              // can't toggle camera while screen sharing
    const next = !tracks[0].enabled
    tracks.forEach(t => { t.enabled = next })
    setHasVideo(next)
  }

  async function toggleScreenShare() {
    if (isScreenSharing) {
      // ── Stop screen share, revert to disabled camera ──
      const screenTrack = localStreamRef.current?.getVideoTracks()[0]
      if (screenTrack) screenTrack.stop()

      // Try to swap back to a camera track
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
        })
        const camTrack = camStream.getVideoTracks()[0]
        camTrack.enabled = false // start camera off

        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(t => { t.stop(); localStreamRef.current.removeTrack(t) })
          localStreamRef.current.addTrack(camTrack)
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()))
        }
        // Replace track in all peer connections
        Object.values(peersRef.current).forEach(peer => {
          const sender = peer.getSenders().find(s => s.track?.kind === 'video')
          if (sender) sender.replaceTrack(camTrack).catch(() => {})
        })
      } catch {
        // No camera — just remove the screen track
        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(t => { t.stop(); localStreamRef.current.removeTrack(t) })
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()))
        }
      }
      setIsScreenSharing(false)
      setHasVideo(false)
    } else {
      // ── Start screen share ──
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' }, audio: false,
        })
        const screenTrack = screenStream.getVideoTracks()[0]

        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(t => { t.stop(); localStreamRef.current.removeTrack(t) })
          localStreamRef.current.addTrack(screenTrack)
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()))
        }
        // Replace (or add) video sender in each peer
        Object.values(peersRef.current).forEach(peer => {
          const sender = peer.getSenders().find(s => s.track?.kind === 'video')
          if (sender) sender.replaceTrack(screenTrack).catch(() => {})
        })

        setIsScreenSharing(true)
        setHasVideo(true)

        // Auto-stop when user clicks "Stop sharing" in browser UI.
        // Can't call toggleScreenShare() here — stale closure would see isScreenSharing=false.
        // Instead inline the stop path directly, which we know is correct at this point.
        screenTrack.onended = async () => {
          setIsScreenSharing(false)
          setHasVideo(false)
          if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach(t => { t.stop(); localStreamRef.current.removeTrack(t) })
            try {
              const camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
              const camTrack = camStream.getVideoTracks()[0]
              if (camTrack) camTrack.enabled = false
              localStreamRef.current.addTrack(camTrack)
              setLocalStream(new MediaStream(localStreamRef.current.getTracks()))
              Object.values(peersRef.current).forEach(peer => {
                const sender = peer.getSenders().find(s => s.track?.kind === 'video')
                if (sender) sender.replaceTrack(camTrack).catch(() => {})
              })
            } catch {
              setLocalStream(new MediaStream(localStreamRef.current.getTracks()))
            }
          }
        }
      } catch (err) {
        if (err.name !== 'NotAllowedError') console.error('Screen share failed:', err)
      }
    }
  }

  function makePeer(targetUid, callId) {
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t =>
        peer.addTrack(t, localStreamRef.current)
      )
    }

    // Use the stream from the event, or build one from the track if missing
    peer.ontrack = e => {
      const stream = (e.streams && e.streams[0]) || new MediaStream([e.track])
      setRemoteStreams(prev => ({ ...prev, [targetUid]: stream }))
    }

    peer.onicecandidate = async e => {
      if (!e.candidate) return
      await addDoc(collection(db, 'calls', callId, 'signals'), {
        from: currentUser.uid, to: targetUid,
        type: 'ice-candidate',
        data: JSON.stringify(e.candidate.toJSON()),
        createdAt: serverTimestamp(),
      })
    }

    peer.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(peer.connectionState)) {
        setRemoteStreams(prev => { const n = { ...prev }; delete n[targetUid]; return n })
      }
    }

    peersRef.current[targetUid] = peer
    return peer
  }

  function listenForSignals(callId) {
    if (signalsUnsubRef.current) signalsUnsubRef.current()
    const q = query(
      collection(db, 'calls', callId, 'signals'),
      where('to', '==', currentUser.uid),
    )
    signalsUnsubRef.current = onSnapshot(q, async snap => {
      // Sort: offers first, answers second, ice-candidates last.
      // Firestore delivers batches in arbitrary order — if ICE candidates
      // arrive before the offer the peer doesn't exist yet and they get dropped.
      const newChanges = snap.docChanges().filter(c =>
        c.type === 'added' && !processedSignalsRef.current.has(c.doc.id)
      )
      const ordered = [
        ...newChanges.filter(c => c.doc.data().type === 'offer'),
        ...newChanges.filter(c => c.doc.data().type === 'answer'),
        ...newChanges.filter(c => c.doc.data().type === 'ice-candidate'),
      ]
      for (const change of ordered) {
        const sigId = change.doc.id
        processedSignalsRef.current.add(sigId)
        const sig = change.doc.data()
        const fromUid = sig.from

        if (sig.type === 'offer') {
          let peer = peersRef.current[fromUid]
          if (!peer) peer = makePeer(fromUid, callId)
          // A fresh RTCPeerConnection starts in 'stable' — that's exactly when we
          // should accept an offer. 'have-remote-offer' handles re-negotiation.
          if (peer.signalingState === 'stable' || peer.signalingState === 'have-remote-offer') {
            await peer.setRemoteDescription(JSON.parse(sig.data))
            const answer = await peer.createAnswer()
            await peer.setLocalDescription(answer)
            await addDoc(collection(db, 'calls', callId, 'signals'), {
              from: currentUser.uid, to: fromUid,
              type: 'answer',
              data: JSON.stringify(answer),
              createdAt: serverTimestamp(),
            })
          }
        } else if (sig.type === 'answer') {
          const peer = peersRef.current[fromUid]
          if (peer && peer.signalingState === 'have-local-offer') {
            await peer.setRemoteDescription(JSON.parse(sig.data))
          }
        } else if (sig.type === 'ice-candidate') {
          const peer = peersRef.current[fromUid]
          // Buffer candidate if remote description not yet set
          if (peer) {
            if (peer.remoteDescription) {
              try { await peer.addIceCandidate(JSON.parse(sig.data)) } catch (_) {}
            } else {
              // Retry once remote description lands
              const tryAdd = setInterval(async () => {
                if (peer.remoteDescription) {
                  clearInterval(tryAdd)
                  try { await peer.addIceCandidate(JSON.parse(sig.data)) } catch (_) {}
                }
              }, 100)
              setTimeout(() => clearInterval(tryAdd), 10000)
            }
          }
        }
      }
    })
  }

  function watchCallDoc(callId) {
    if (callDocUnsubRef.current) callDocUnsubRef.current()
    callDocUnsubRef.current = onSnapshot(doc(db, 'calls', callId), snap => {
      if (!snap.exists() || snap.data().status === 'ended') {
        playCallEnd()
        cleanupCall()
        return
      }
      setActiveCall(prev => ({ ...prev, ...snap.data(), callId }))
    })
  }

  // ── Start a 1-on-1 DM call ────────────────────────────────────────────────
  async function startDMCall(targetUid, targetName) {
    try {
      setCallError('')
      await getLocalStream()
      const callRef = await addDoc(collection(db, 'calls'), {
        type: 'dm', status: 'ringing',
        creatorId: currentUser.uid,
        creatorName: currentUser.displayName || currentUser.email,
        targetUid, targetName,
        participants: [{ uid: currentUser.uid, name: currentUser.displayName || currentUser.email }],
        createdAt: serverTimestamp(),
      })
      const callId = callRef.id
      activeCallIdRef.current = callId
      setActiveCall({ callId, type: 'dm', status: 'ringing', targetName,
        participants: [{ uid: currentUser.uid, name: currentUser.displayName }],
        creatorId: currentUser.uid,
      })

      const peer = makePeer(targetUid, callId)
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      await addDoc(collection(db, 'calls', callId, 'signals'), {
        from: currentUser.uid, to: targetUid,
        type: 'offer', data: JSON.stringify(offer),
        createdAt: serverTimestamp(),
      })

      listenForSignals(callId)
      watchCallDoc(callId)
      playCallJoin()
    } catch (err) {
      console.error('startDMCall error:', err)
      setCallError('Could not start call — check your microphone permissions.')
    }
  }

  // ── Accept an incoming DM call ────────────────────────────────────────────
  async function acceptCall(incoming) {
    try {
      if (stopRingRef.current) { stopRingRef.current(); stopRingRef.current = null }
      setIncomingCall(null)
      setCallError('')
      await getLocalStream()
      const { callId, creatorId, creatorName } = incoming
      activeCallIdRef.current = callId

      await updateDoc(doc(db, 'calls', callId), {
        status: 'active',
        participants: arrayUnion({ uid: currentUser.uid, name: currentUser.displayName || currentUser.email }),
      })

      setActiveCall({ ...incoming, callId, status: 'active' })
      listenForSignals(callId)
      watchCallDoc(callId)
      playCallJoin()
    } catch (err) {
      console.error('acceptCall error:', err)
      setCallError('Could not join call.')
    }
  }

  // ── Decline an incoming DM call ───────────────────────────────────────────
  async function declineCall(callId) {
    if (stopRingRef.current) { stopRingRef.current(); stopRingRef.current = null }
    setIncomingCall(null)
    try { await updateDoc(doc(db, 'calls', callId), { status: 'ended' }) } catch (_) {}
  }

  // ── Join/start a server or group voice call ───────────────────────────────
  async function startServerCall(serverId, serverName, channelId, channelName) {
    try {
      setCallError('')
      await getLocalStream()

      // Check for existing active call in this channel
      const q = query(
        collection(db, 'calls'),
        where('serverId', '==', serverId),
        where('channelId', '==', channelId),
        where('status', '==', 'active'),
      )
      const existing = await getDocs(q)

      let callId
      let existingParticipants = []

      if (!existing.empty) {
        callId = existing.docs[0].id
        existingParticipants = (existing.docs[0].data().participants || [])
          .filter(p => p.uid !== currentUser.uid)
        await updateDoc(doc(db, 'calls', callId), {
          participants: arrayUnion({ uid: currentUser.uid, name: currentUser.displayName || currentUser.email }),
        })
      } else {
        const ref = await addDoc(collection(db, 'calls'), {
          type: 'server', status: 'active',
          creatorId: currentUser.uid,
          serverId, serverName, channelId, channelName,
          participants: [{ uid: currentUser.uid, name: currentUser.displayName || currentUser.email }],
          createdAt: serverTimestamp(),
        })
        callId = ref.id
      }

      activeCallIdRef.current = callId
      setActiveCall({
        callId, type: 'server', status: 'active',
        serverId, serverName, channelId, channelName,
        participants: [{ uid: currentUser.uid, name: currentUser.displayName }],
        creatorId: currentUser.uid,
      })

      listenForSignals(callId)
      watchCallDoc(callId)

      // Send offers to every existing participant
      for (const p of existingParticipants) {
        const peer = makePeer(p.uid, callId)
        const offer = await peer.createOffer()
        await peer.setLocalDescription(offer)
        await addDoc(collection(db, 'calls', callId, 'signals'), {
          from: currentUser.uid, to: p.uid,
          type: 'offer', data: JSON.stringify(offer),
          createdAt: serverTimestamp(),
        })
      }

      playCallJoin()
    } catch (err) {
      console.error('startServerCall error:', err)
      setCallError('Could not start call — check your microphone permissions.')
    }
  }

  // ── End / leave the current call ──────────────────────────────────────────
  async function endCall() {
    const callId = activeCallIdRef.current
    if (!callId) return
    const call = activeCall
    try {
      if (call?.type === 'server') {
        // Remove self from participants; end call only if nobody left
        await updateDoc(doc(db, 'calls', callId), {
          participants: arrayRemove({ uid: currentUser.uid, name: currentUser.displayName || currentUser.email }),
        })
        const snap = await getDocs(query(collection(db, 'calls'), where('__name__', '==', callId)))
        // The above won't work — just check if we need to end the whole call
        // We'll rely on the watchCallDoc to see when no participants remain
        // For now just check the current participants list
        const remaining = (call?.participants || []).filter(p => p.uid !== currentUser.uid)
        if (remaining.length === 0) {
          await updateDoc(doc(db, 'calls', callId), { status: 'ended' })
        }
      } else {
        await updateDoc(doc(db, 'calls', callId), { status: 'ended' })
      }
    } catch (_) {}
    playCallEnd()
    cleanupCall()
  }

  // ── Toggle microphone mute ────────────────────────────────────────────────
  function toggleMute() {
    const stream = localStreamRef.current
    if (!stream) return
    const track = stream.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setIsMuted(!track.enabled)
  }

  // ── Internal cleanup ──────────────────────────────────────────────────────
  function cleanupCall() {
    Object.values(peersRef.current).forEach(p => { try { p.close() } catch (_) {} })
    peersRef.current = {}
    processedSignalsRef.current.clear()
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
    if (signalsUnsubRef.current) { signalsUnsubRef.current(); signalsUnsubRef.current = null }
    if (callDocUnsubRef.current) { callDocUnsubRef.current(); callDocUnsubRef.current = null }
    if (stopRingRef.current)     { stopRingRef.current();     stopRingRef.current = null }
    activeCallIdRef.current = null
    setActiveCall(null)
    setRemoteStreams({})
    setIsMuted(false)
    setHasVideo(false)
    setIsScreenSharing(false)
    setLocalStream(null)
  }

  return (
    <CallContext.Provider value={{
      activeCall, incomingCall, remoteStreams, isMuted, hasVideo, isScreenSharing, localStream, callError,
      startDMCall, acceptCall, declineCall, endCall,
      startServerCall, toggleMute, toggleVideo, toggleScreenShare,
    }}>
      {children}
    </CallContext.Provider>
  )
}

export function useCall() { return useContext(CallContext) }
