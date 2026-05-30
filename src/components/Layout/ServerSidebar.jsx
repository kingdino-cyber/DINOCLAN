import { useEffect, useRef, useState } from 'react'
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDocs, arrayRemove } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { isAdmin } from '../../utils/admin'
import InviteToServer from '../Modals/InviteToServer'
import CreateServer from '../Modals/CreateServer'
import JoinServer from '../Modals/JoinServer'

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function CtxMenu({ server, currentUser, pos, onClose, onLeave, onDisband, onInvite }) {
  const ref = useRef(null)
  const isOwner = server.ownerId === currentUser?.uid
  const canDisband = isOwner  // only the actual host can disband

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  return (
    <div ref={ref} className="server-ctx-menu" style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999 }}>
      <button className="server-ctx-item" onClick={onInvite}>📨 Invite to Server</button>
      {!isOwner && <button className="server-ctx-item leave" onClick={onLeave}>🚪 Leave Server</button>}
      {canDisband && <button className="server-ctx-item disband" onClick={onDisband}>💥 Disband Server</button>}
    </div>
  )
}

export default function ServerSidebar({ activeServerId, onSelectServer }) {
  const { currentUser } = useAuth()
  const [servers, setServers] = useState([])
  const [modal, setModal] = useState(null)
  const [menu, setMenu] = useState(null)
  const [inviteServer, setInviteServer] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'servers'), where('members', 'array-contains', currentUser.uid))
    const unsub = onSnapshot(q, snap => {
      setServers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.kind !== 'group'))
    })
    return unsub
  }, [currentUser.uid])

  function openMenu(e, srv) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setMenu({ server: srv, pos: { x: rect.right + 8, y: rect.top } })
  }

  async function handleLeave(srv) {
    setMenu(null)
    await updateDoc(doc(db, 'servers', srv.id), { members: arrayRemove(currentUser.uid) })
    if (activeServerId === srv.id) onSelectServer(null)
  }

  async function handleDisband(srv) {
    setMenu(null)
    if (!window.confirm(`Disband "${srv.name}"? This cannot be undone.`)) return
    const chSnap = await getDocs(collection(db, 'servers', srv.id, 'channels'))
    await Promise.all(chSnap.docs.map(d => deleteDoc(d.ref)))
    await deleteDoc(doc(db, 'servers', srv.id))
    if (activeServerId === srv.id) onSelectServer(null)
  }

  return (
    <div className="server-sidebar">
      {/* Home */}
      <div
        className={`server-icon ${!activeServerId ? 'active' : ''}`}
        onClick={() => onSelectServer(null)}
        data-tooltip="Home"
      >🦕</div>

      <div className="server-divider" />

      {/* Server icons */}
      {servers.map(srv => (
        <div key={srv.id} className="server-icon-wrap">
          <div
            className={`server-icon ${activeServerId === srv.id ? 'active' : ''}`}
            onClick={() => onSelectServer(srv.id)}
            data-tooltip={srv.name}
          >
            {srv.photoURL ? <img src={srv.photoURL} alt={srv.name} /> : getInitials(srv.name)}
          </div>
          <button
            className="server-dots-btn"
            onClick={e => openMenu(e, srv)}
            title="Server options"
          >⋯</button>

          {menu?.server?.id === srv.id && (
            <CtxMenu
              server={menu.server}
              currentUser={currentUser}
              pos={menu.pos}
              onClose={() => setMenu(null)}
              onLeave={() => handleLeave(menu.server)}
              onDisband={() => handleDisband(menu.server)}
              onInvite={() => { setInviteServer(menu.server); setMenu(null) }}
            />
          )}
        </div>
      ))}

      <div className="server-divider" />

      {/* Create / Join */}
      <div className="server-icon server-icon-add" onClick={() => setModal('create')} data-tooltip="Create a Server">+</div>
      <div className="server-icon server-icon-add" onClick={() => setModal('join')} data-tooltip="Join a Server" style={{ fontSize: 14, fontWeight: 700 }}>→</div>

      {modal === 'create' && <CreateServer onClose={id => { setModal(null); if (id) onSelectServer(id) }} />}
      {modal === 'join' && <JoinServer onClose={id => { setModal(null); if (id) onSelectServer(id) }} />}
      {inviteServer && <InviteToServer serverId={inviteServer.id} serverName={inviteServer.name} onClose={() => setInviteServer(null)} />}
    </div>
  )
}
