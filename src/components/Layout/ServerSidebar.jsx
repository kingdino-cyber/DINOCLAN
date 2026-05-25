import { useState } from 'react'
import CreateServer from '../Modals/CreateServer'
import JoinServer from '../Modals/JoinServer'

export default function ServerSidebar({ activeServerId, onSelectServer, showFriends, onToggleFriends }) {
  const [modal, setModal] = useState(null)

  function handleServerCreated(serverId) {
    setModal(null)
    if (serverId) onSelectServer(serverId)
  }

  return (
    <div className="server-sidebar">
      <div
        className={`server-icon ${!activeServerId && !showFriends ? 'active' : ''}`}
        onClick={() => onSelectServer(null)}
        data-tooltip="Home"
      >
        🦕
      </div>

      <div
        className={`server-icon ${showFriends ? 'active' : ''}`}
        onClick={onToggleFriends}
        data-tooltip="Friends"
        style={{ fontSize: 22 }}
      >
        🤝
      </div>

      <div className="server-divider" />

      <div
        className="server-icon server-icon-add"
        onClick={() => setModal('create')}
        data-tooltip="Create a Server"
      >
        +
      </div>
      <div
        className="server-icon server-icon-add"
        onClick={() => setModal('join')}
        data-tooltip="Join a Server"
        style={{ fontSize: 14, fontWeight: 700 }}
      >
        →
      </div>

      {modal === 'create' && <CreateServer onClose={handleServerCreated} />}
      {modal === 'join' && <JoinServer onClose={serverId => { setModal(null); if (serverId) onSelectServer(serverId) }} />}
    </div>
  )
}
