import { useEffect, useState, useRef } from 'react'
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDocs, arrayRemove } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { isAdmin } from '../../utils/admin'
import CreateServer from '../Modals/CreateServer'
import JoinServer from '../Modals/JoinServer'

function ServerMenu({ server, currentUser, onLeave, onDisband, onClose }) {
  const menuRef = useRef(null)
  const isOwner = server.ownerId === currentUser?.uid
  const canDisband = isAdmin(currentUser, server)

  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div className="server-ctx-menu" ref={menuRef}>
      {!isOwner && (
        <button className="server-ctx-item leave" onClick={onLeave}>
          🚪 Leave Server
        </button>
      )}
      {canDisband && (
        <button className="server-ctx-item disband" onClick={onDisband}>
          💥 Disband Server
        </button>
      )}
    </div>
  )
}

export default function ServerSidebar({ activeServerId, onSelectServer, showFriends, onToggleFriends }) {
  const { currentUser } = useAuth()
  const [servers, setServers] = useState([])
  const [modal, setModal] = useState(null)
  const [menuServerId, setMenuServerId] = useState(null)

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
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  }

  function handleServerCreated(serverId) {
    setModal(null)
    if (serverId) onSelectServer(serverId)
  }

  async function handleLeave(server) {
    setMenuServerId(null)
    await updateDoc(doc(db, 'servers', server.id), {
      members: arrayRemove(currentUser.uid),
    })
    if (activeServerId === server.id) onSelectServer(null)
  }

  async function handleDisband(server) {
    setMenuServerId(null)
    if (!window.confirm(`Disband "${server.name}"? This cannot be undone.`)) return
    const chSnap = await getDocs(collection(db, 'servers', server.id, 'channels'))
    await Promise.all(chSnap.docs.map(d => deleteDoc(d.ref)))
    await deleteDoc(doc(db, 'servers', server.id))
    if (activeServerId === server.id) onSelectServer(null)
  }

  const menuServer = servers.find(s => s.id === menuServerId)

  return (
    <div className="server-sidebar">
      <div
        className={`server-icon ${!activeServerId && !showFriends ? 'active' : ''}`}
        onClick={() => { onSelectServer(null) }}
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

      {servers.map(srv => (
        <div
          key={srv.id}
          className={`server-icon-wrap ${activeServerId === srv.id ? 'active' : ''}`}
        >
          <div
            className={`server-icon ${activeServerId === srv.id ? 'active' : ''}`}
            onClick={() => onSelectServer(srv.id)}
            data-tooltip={srv.name}
            title={srv.name}
          >
            {srv.photoURL
              ? <img src={srv.photoURL} alt={srv.name} />
              : getInitials(srv.name)
            }
          </div>
          <button
            className="server-dots-btn"
            title="Server options"
            onClick={e => { e.stopPropagation(); setMenuServerId(srv.id === menuServerId ? null : srv.id) }}
          >
            ⋯
          </button>

          {menuServerId === srv.id && menuServer && (
            <ServerMenu
              server={menuServer}
              currentUser={currentUser}
              onLeave={() => handleLeave(menuServer)}
              onDisband={() => handleDisband(menuServer)}
              onClose={() => setMenuServerId(null)}
            />
          )}
        </div>
      ))}

      <div className="server-divider" />

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
