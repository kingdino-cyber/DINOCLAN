import { useEffect, useState, useRef } from 'react'
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, getDocs, arrayRemove } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { isAdmin } from '../../utils/admin'
import InviteToServer from '../Modals/InviteToServer'
import CreateGroup from '../Modals/CreateGroup'
import SponsorBanner from './SponsorBanner'
import UserPanel from './UserPanel'

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function GroupCtxMenu({ group, currentUser, pos, onClose, onLeave, onDisband, onInvite }) {
  const ref = useRef(null)
  const isOwner = group.ownerId === currentUser?.uid
  const canDisband = isAdmin(currentUser, group)

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  return (
    <div ref={ref} className="server-ctx-menu" style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999 }}>
      <button className="server-ctx-item" onClick={onInvite}>📨 Invite to Group</button>
      {!isOwner && <button className="server-ctx-item leave" onClick={onLeave}>🚪 Leave Group</button>}
      {canDisband && <button className="server-ctx-item disband" onClick={onDisband}>💥 Disband Group</button>}
    </div>
  )
}

export default function HomeServersPanel({ onSelectServer }) {
  const { currentUser } = useAuth()
  const [groups, setGroups] = useState([])
  const [menu, setMenu] = useState(null)
  const [inviteGroup, setInviteGroup] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'servers'), where('members', 'array-contains', currentUser.uid))
    const unsub = onSnapshot(q, snap => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.kind === 'group'))
    })
    return unsub
  }, [currentUser.uid])

  function openMenu(e, group) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setMenu({ group, pos: { x: rect.right + 8, y: rect.top } })
  }

  async function handleLeave(group) {
    setMenu(null)
    await updateDoc(doc(db, 'servers', group.id), { members: arrayRemove(currentUser.uid) })
  }

  async function handleDisband(group) {
    setMenu(null)
    if (!window.confirm(`Disband "${group.name}"? This cannot be undone.`)) return
    const chSnap = await getDocs(collection(db, 'servers', group.id, 'channels'))
    await Promise.all(chSnap.docs.map(d => deleteDoc(d.ref)))
    await deleteDoc(doc(db, 'servers', group.id))
  }

  return (
    <div className="home-servers-panel">
      <div className="home-servers-header">
        <span style={{ fontSize: 20 }}>👥</span>
        <h2>Groups</h2>
        <button className="create-group-btn" onClick={() => setShowCreate(true)} title="Create a group">+</button>
      </div>

      <div className="home-servers-list">
        {groups.length === 0 ? (
          <div className="friends-empty">
            <span>🥚</span>
            <p>No groups yet — create one or accept an invite!</p>
          </div>
        ) : groups.map(grp => (
          <div key={grp.id} className="home-server-row" onClick={() => onSelectServer(grp.id)}>
            <div className="home-server-icon">
              {grp.photoURL
                ? <img src={grp.photoURL} alt={grp.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : getInitials(grp.name)
              }
            </div>
            <div className="home-server-name">{grp.name}</div>
            <div className="home-server-members">{grp.members?.length || 0} members</div>
            <button
              className="server-dots-btn"
              style={{ position: 'static', opacity: 0.5, width: 28, height: 28, borderRadius: 4 }}
              onClick={e => openMenu(e, grp)}
              title="Group options"
            >⋯</button>
          </div>
        ))}
      </div>

      {menu && (
        <GroupCtxMenu
          group={menu.group}
          currentUser={currentUser}
          pos={menu.pos}
          onClose={() => setMenu(null)}
          onLeave={() => handleLeave(menu.group)}
          onDisband={() => handleDisband(menu.group)}
          onInvite={() => { setInviteGroup(menu.group); setMenu(null) }}
        />
      )}

      {inviteGroup && (
        <InviteToServer
          serverId={inviteGroup.id}
          serverName={inviteGroup.name}
          kind="group"
          onClose={() => setInviteGroup(null)}
        />
      )}

      {showCreate && (
        <CreateGroup onClose={id => { setShowCreate(false); if (id) onSelectServer(id) }} />
      )}

      <SponsorBanner />
      <UserPanel />
    </div>
  )
}
