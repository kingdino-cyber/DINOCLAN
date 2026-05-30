import { useEffect, useRef, useState } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, deleteDoc, getDocs, where,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { isAdmin } from '../../utils/admin'
import CreateChannel from '../Modals/CreateChannel'
import EditServer from '../Modals/EditServer'
import UserPanel from './UserPanel'
import SponsorBanner from './SponsorBanner'
import Avatar from '../Chat/Avatar'

// ── Compress server icon ──────────────────────────────────────────────────────
function compressImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const size = 128
        const canvas = document.createElement('canvas')
        canvas.width = size; canvas.height = size
        const ctx = canvas.getContext('2d')
        const s = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', 0.75))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

// ── Live participant row shown below a voice channel ─────────────────────────
function VoiceParticipantRow({ uid, name }) {
  const [user, setUser] = useState(null)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      if (snap.exists()) setUser({ uid: snap.id, ...snap.data() })
    })
    return unsub
  }, [uid])
  const display = user?.displayName || name
  return (
    <div className="voice-participant-row">
      <Avatar user={user || { displayName: name }} size={20} showStatus={false} />
      <span className="voice-participant-name">{display}</span>
    </div>
  )
}

// ── Voice channel item: shows channel + live participants ─────────────────────
function VoiceChannelItem({ ch, isActive, onClick, canAdmin, onDelete }) {
  const [participants, setParticipants] = useState([])

  useEffect(() => {
    const q = query(
      collection(db, 'calls'),
      where('channelId', '==', ch.id),
      where('status',    '==', 'active'),
    )
    return onSnapshot(q, snap => {
      if (snap.empty) { setParticipants([]); return }
      setParticipants(snap.docs[0].data().participants || [])
    })
  }, [ch.id])

  return (
    <div className="voice-channel-group">
      <div
        className={`channel-item voice-channel-item ${isActive ? 'active' : ''}`}
        onClick={onClick}
      >
        <span className="voice-channel-icon">🔊</span>
        <span style={{ flex: 1 }}>{ch.name}</span>
        {participants.length > 0 && (
          <span className="voice-user-count">{participants.length}</span>
        )}
        {canAdmin && (
          <button
            className="channel-delete-btn"
            onClick={e => { e.stopPropagation(); onDelete(ch) }}
            title="Delete channel"
          >🗑️</button>
        )}
      </div>
      {/* Live participant list */}
      {participants.length > 0 && (
        <div className="voice-participants-sidebar">
          {participants.map(p => (
            <VoiceParticipantRow key={p.uid} uid={p.uid} name={p.name} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main sidebar ──────────────────────────────────────────────────────────────
export default function ChannelSidebar({ server, activeChannelId, onSelectChannel }) {
  const { currentUser } = useAuth()
  const [channels,        setChannels]        = useState([])
  const [showCreate,      setShowCreate]      = useState(false)
  const [createType,      setCreateType]      = useState('text')
  const [copied,          setCopied]          = useState(false)
  const [showEditServer,  setShowEditServer]  = useState(false)
  const fileRef = useRef(null)

  const canAdmin = isAdmin(currentUser, server)

  useEffect(() => {
    if (!server?.id) return
    const q = query(
      collection(db, 'servers', server.id, 'channels'),
      orderBy('position', 'asc'),
    )
    return onSnapshot(q, snap => setChannels(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [server?.id])

  function handleChannelCreated(channelId) {
    setShowCreate(false)
    if (channelId) onSelectChannel(channelId)
  }

  async function handleServerPhoto(e) {
    const file = e.target.files?.[0]
    if (!file || !server?.id) return
    const dataUrl = await compressImage(file)
    await updateDoc(doc(db, 'servers', server.id), { photoURL: dataUrl })
    e.target.value = ''
  }

  async function handleDeleteChannel(ch) {
    if (!window.confirm(`Delete #${ch.name}? All messages will be lost.`)) return
    const msgsSnap = await getDocs(collection(db, 'servers', server.id, 'channels', ch.id, 'messages'))
    await Promise.all(msgsSnap.docs.map(d => deleteDoc(d.ref)))
    await deleteDoc(doc(db, 'servers', server.id, 'channels', ch.id))
    if (activeChannelId === ch.id) onSelectChannel(null)
  }

  function handleInvite() {
    const code = server.joinCode || server.id
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Separate text vs voice channels (default to text for old channels)
  const textChannels  = channels.filter(ch => (ch.type || 'text') === 'text')
  const voiceChannels = channels.filter(ch => ch.type === 'voice')

  if (!server) {
    return (
      <div className="channel-sidebar">
        <div className="empty-state" style={{ flex: 1, justifyContent: 'center' }}>
          <p style={{ fontSize: 13 }}>Select a server</p>
        </div>
        <SponsorBanner />
        <UserPanel />
      </div>
    )
  }

  return (
    <div className="channel-sidebar">
      {/* ── Server header ── */}
      <div className="channel-sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <div
            className={`server-header-icon ${canAdmin ? 'clickable' : ''}`}
            onClick={() => canAdmin && fileRef.current?.click()}
            title={canAdmin ? 'Change server icon' : ''}
          >
            {server.photoURL
              ? <img src={server.photoURL} alt={server.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : server.name.slice(0, 2).toUpperCase()
            }
          </div>
          <h2 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{server.name}</h2>
        </div>
        {canAdmin && (
          <button
            className="invite-btn"
            onClick={() => setShowEditServer(true)}
            title="Server settings"
            style={{ fontSize: 15 }}
          >
            ⚙️
          </button>
        )}
        <button
          className="invite-btn"
          onClick={handleInvite}
          title={server.joinCode ? `Join code: ${server.joinCode} — click to copy` : 'Copy server ID'}
        >
          {copied ? '✓' : (server.joinCode ? server.joinCode : '🔗')}
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleServerPhoto} />
      </div>

      <div className="channel-list">

        {/* ── Text Channels ── */}
        <div className="channel-category">
          <span>Text Channels</span>
          {canAdmin && (
            <button onClick={() => { setCreateType('text'); setShowCreate(true) }} title="Create text channel">+</button>
          )}
        </div>

        {textChannels.map(ch => (
          <div
            key={ch.id}
            className={`channel-item ${activeChannelId === ch.id ? 'active' : ''}`}
            onClick={() => onSelectChannel(ch.id)}
          >
            <span className="channel-hash">#</span>
            <span style={{ flex: 1 }}>{ch.name}</span>
            {canAdmin && (
              <button
                className="channel-delete-btn"
                onClick={e => { e.stopPropagation(); handleDeleteChannel(ch) }}
                title="Delete channel"
              >🗑️</button>
            )}
          </div>
        ))}
        {textChannels.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 24px' }}>No text channels yet</p>
        )}

        {/* ── Voice Channels ── */}
        <div className="channel-category" style={{ marginTop: 12 }}>
          <span>Voice Channels</span>
          {canAdmin && (
            <button onClick={() => { setCreateType('voice'); setShowCreate(true) }} title="Create voice channel">+</button>
          )}
        </div>

        {voiceChannels.map(ch => (
          <VoiceChannelItem
            key={ch.id}
            ch={ch}
            isActive={activeChannelId === ch.id}
            onClick={() => onSelectChannel(ch.id)}
            canAdmin={canAdmin}
            onDelete={handleDeleteChannel}
          />
        ))}
        {voiceChannels.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 24px' }}>No voice channels yet</p>
        )}

      </div>

      <SponsorBanner />
      <UserPanel />

      {showCreate && (
        <CreateChannel serverId={server.id} defaultType={createType} onClose={handleChannelCreated} />
      )}
      {showEditServer && (
        <EditServer server={server} onClose={() => setShowEditServer(false)} />
      )}
    </div>
  )
}
