import { useEffect, useState, useRef } from 'react'
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, arrayRemove, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { isAdmin } from '../../utils/admin'
import CreateChannel from '../Modals/CreateChannel'
import UserPanel from './UserPanel'
import SponsorBanner from './SponsorBanner'

export default function ChannelSidebar({ server, activeChannelId, onSelectChannel, onLeaveServer }) {
  const { currentUser } = useAuth()
  const [channels, setChannels] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)

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

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleChannelCreated(channelId) {
    setShowCreate(false)
    if (channelId) onSelectChannel(channelId)
  }

  async function handleLeave() {
    if (!server || !currentUser) return
    setShowMenu(false)
    await updateDoc(doc(db, 'servers', server.id), {
      members: arrayRemove(currentUser.uid),
    })
    onLeaveServer?.()
  }

  async function handleDelete() {
    if (!server) return
    setShowMenu(false)
    // delete all channels first
    const chSnap = await getDocs(collection(db, 'servers', server.id, 'channels'))
    await Promise.all(chSnap.docs.map(d => deleteDoc(d.ref)))
    await deleteDoc(doc(db, 'servers', server.id))
    onLeaveServer?.()
  }

  const canAdmin = isAdmin(currentUser, server)
  const isOwner = server?.ownerId === currentUser?.uid

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
      <div className="channel-sidebar-header" style={{ position: 'relative' }} ref={menuRef}>
        <h2 style={{ cursor: 'pointer', flex: 1 }} onClick={() => setShowMenu(m => !m)}>
          {server.name} <span style={{ fontSize: 11, opacity: 0.6 }}>▾</span>
        </h2>

        {showMenu && (
          <div className="server-dropdown">
            {!isOwner && (
              <button className="server-dropdown-item leave" onClick={handleLeave}>
                🚪 Leave Server
              </button>
            )}
            {(isOwner || canAdmin) && (
              <button className="server-dropdown-item delete" onClick={() => {
                if (window.confirm(`Delete "${server.name}"? This cannot be undone.`)) handleDelete()
              }}>
                🗑️ Delete Server
              </button>
            )}
            <button className="server-dropdown-item" onClick={() => setShowMenu(false)}>
              ✕ Close
            </button>
          </div>
        )}
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
