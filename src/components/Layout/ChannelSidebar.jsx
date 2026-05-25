import { useEffect, useRef, useState } from 'react'
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { isAdmin } from '../../utils/admin'
import CreateChannel from '../Modals/CreateChannel'
import UserPanel from './UserPanel'
import SponsorBanner from './SponsorBanner'

function compressImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const size = 128
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        const s = Math.min(img.width, img.height)
        const ox = (img.width - s) / 2
        const oy = (img.height - s) / 2
        ctx.drawImage(img, ox, oy, s, s, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', 0.75))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

export default function ChannelSidebar({ server, activeChannelId, onSelectChannel }) {
  const { currentUser } = useAuth()
  const [channels, setChannels] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef(null)

  const canAdmin = isAdmin(currentUser, server)

  useEffect(() => {
    if (!server?.id) return
    const q = query(
      collection(db, 'servers', server.id, 'channels'),
      orderBy('position', 'asc'),
    )
    const unsub = onSnapshot(q, snap => {
      setChannels(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
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

  function handleInvite() {
    navigator.clipboard.writeText(server.id).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

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
            onClick={handleInvite}
            title="Copy invite code"
          >
            {copied ? '✓' : '🔗'}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleServerPhoto} />
      </div>

      <div className="channel-list">
        <div className="channel-category">
          <span>Text Channels</span>
          <button onClick={() => setShowCreate(true)} title="Create channel">+</button>
        </div>

        {channels.map(ch => (
          <div
            key={ch.id}
            className={`channel-item ${activeChannelId === ch.id ? 'active' : ''}`}
            onClick={() => onSelectChannel(ch.id)}
            data-tooltip={`#${ch.name}`}
          >
            <span className="channel-hash">#</span>
            {ch.name}
          </div>
        ))}

        {channels.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 24px' }}>
            No channels yet
          </p>
        )}
      </div>

      <SponsorBanner />
      <UserPanel />

      {showCreate && (
        <CreateChannel serverId={server.id} onClose={handleChannelCreated} />
      )}
    </div>
  )
}
