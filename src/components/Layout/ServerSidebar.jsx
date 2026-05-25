import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import CreateServer from '../Modals/CreateServer'
import JoinServer from '../Modals/JoinServer'

export default function ServerSidebar({ activeServerId, onSelectServer, showFriends, onToggleFriends }) {
  const { currentUser } = useAuth()
  const [servers, setServers] = useState([])
  const [modal, setModal] = useState(null) // 'create' | 'join' | null

  useEffect(() => {
    const q = query(
      collection(db, 'servers'),
      where('members', 'array-contains', currentUser.uid),
    )
    const unsub = onSnapshot(q, snap => {
      setServers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [currentUser.uid])

  function getInitials(name) {
    return name
      .split(' ')
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }

  function handleServerCreated(serverId) {
    setModal(null)
    if (serverId) onSelectServer(serverId)
  }

  return (
    <div className="server-sidebar">
      {/* Home button */}
      <div
        className={`server-icon ${!activeServerId && !showFriends ? 'active' : ''}`}
        onClick={() => { onSelectServer(null); }}
        data-tooltip="Home"
      >
        🦕
      </div>

      {/* Friends button */}
      <div
        className={`server-icon ${showFriends ? 'active' : ''}`}
        onClick={onToggleFriends}
        data-tooltip="Friends"
        style={{ fontSize: 22 }}
      >
        🤝
      </div>

      <div className="server-divider" />

      {servers.map(srv => (
        <div
          key={srv.id}
          className={`server-icon ${activeServerId === srv.id ? 'active' : ''}`}
          onClick={() => onSelectServer(srv.id)}
          data-tooltip={srv.name}
          title={srv.name}
        >
          {getInitials(srv.name)}
        </div>
      ))}

      <div className="server-divider" />

      {/* Add / Join server */}
      <div
        className="server-icon server-icon-add"
        onClick={() => setModal('create')}
        data-tooltip="Create a Server"
        title="Create a Server"
      >
        +
      </div>
      <div
        className="server-icon server-icon-add"
        onClick={() => setModal('join')}
        data-tooltip="Join a Server"
        title="Join a Server"
        style={{ fontSize: 14, fontWeight: 700 }}
      >
        →
      </div>

      {modal === 'create' && (
        <CreateServer onClose={handleServerCreated} />
      )}
      {modal === 'join' && (
        <JoinServer onClose={serverId => { setModal(null); if (serverId) onSelectServer(serverId) }} />
      )}
    </div>
  )
}
