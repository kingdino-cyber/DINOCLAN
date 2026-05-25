import { useEffect, useState, useRef } from 'react'
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDocs, arrayRemove } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { isAdmin } from '../../utils/admin'
import InviteToServer from '../Modals/InviteToServer'

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function ServerContextMenu({ server, currentUser, pos, onClose, onLeave, onDisband, onInvite }) {
  const ref = useRef(null)
  const isOwner = server.ownerId === currentUser?.uid
  const canDisband = isAdmin(currentUser, server)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="server-ctx-menu"
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999 }}
    >
      <button className="server-ctx-item" onClick={onInvite}>📨 Invite to Server</button>
      {!isOwner && <button className="server-ctx-item leave" onClick={onLeave}>🚪 Leave Server</button>}
      {canDisband && <button className="server-ctx-item disband" onClick={onDisband}>💥 Disband Server</button>}
    </div>
  )
}

export default function HomeServersPanel({ onSelectServer }) {
  const { currentUser } = useAuth()
  const [servers, setServers] = useState([])
  const [menu, setMenu] = useState(null) // { server, pos }
  const [inviteServer, setInviteServer] = useState(null)

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

  function openMenu(e, server) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setMenu({ server, pos: { x: rect.right + 8, y: rect.top } })
  }

  async function handleLeave(server) {
    setMenu(null)
    await updateDoc(doc(db, 'servers', server.id), {
      members: arrayRemove(currentUser.uid),
    })
  }

  async function handleDisband(server) {
    setMenu(null)
    if (!window.confirm(`Disband "${server.name}"? This cannot be undone.`)) return
    const chSnap = await getDocs(collection(db, 'servers', server.id, 'channels'))
    await Promise.all(chSnap.docs.map(d => deleteDoc(d.ref)))
    await deleteDoc(doc(db, 'servers', server.id))
  }

  return (
    <div className="home-servers-panel">
      <div className="home-servers-header">
        <span style={{ fontSize: 20 }}>🦕</span>
        <h2>Your Servers</h2>
      </div>

      <div className="home-servers-list">
        {servers.length === 0 ? (
          <div className="friends-empty">
            <span>🥚</span>
            <p>No servers yet — create or join one!</p>
          </div>
        ) : servers.map(srv => (
          <div
            key={srv.id}
            className="home-server-row"
            onClick={() => onSelectServer(srv.id)}
          >
            <div className="home-server-icon">
              {srv.photoURL
                ? <img src={srv.photoURL} alt={srv.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : getInitials(srv.name)
              }
            </div>
            <div className="home-server-name">{srv.name}</div>
            <div className="home-server-members">{srv.members?.length || 0} members</div>
            <button
              className="server-dots-btn"
              style={{ position: 'static', opacity: 0.5, width: 28, height: 28, borderRadius: 4 }}
              onClick={e => openMenu(e, srv)}
              title="Server options"
            >
              ⋯
            </button>
          </div>
        ))}
      </div>

      {menu && (
        <ServerContextMenu
          server={menu.server}
          currentUser={currentUser}
          pos={menu.pos}
          onClose={() => setMenu(null)}
          onLeave={() => handleLeave(menu.server)}
          onDisband={() => handleDisband(menu.server)}
          onInvite={() => { setInviteServer(menu.server); setMenu(null) }}
        />
      )}

      {inviteServer && (
        <InviteToServer
          serverId={inviteServer.id}
          serverName={inviteServer.name}
          onClose={() => setInviteServer(null)}
        />
      )}
    </div>
  )
}
