import { useEffect, useState } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import CreateChannel from '../Modals/CreateChannel'
import UserPanel from './UserPanel'

export default function ChannelSidebar({ server, activeChannelId, onSelectChannel }) {
  const [channels, setChannels] = useState([])
  const [showCreate, setShowCreate] = useState(false)

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

  if (!server) {
    return (
      <div className="channel-sidebar">
        <div className="empty-state" style={{ flex: 1, justifyContent: 'center' }}>
          <p style={{ fontSize: 13 }}>Select a server</p>
        </div>
        <UserPanel />
      </div>
    )
  }

  return (
    <div className="channel-sidebar">
      <div className="channel-sidebar-header">
        <h2>{server.name}</h2>
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

      <UserPanel />

      {showCreate && (
        <CreateChannel serverId={server.id} onClose={handleChannelCreated} />
      )}
    </div>
  )
}
