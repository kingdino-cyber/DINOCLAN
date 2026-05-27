import { useEffect, useState } from 'react'
import { doc, onSnapshot, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { isAdmin, isOperator } from '../../utils/admin'
import Avatar from '../Chat/Avatar'

function MemberRow({ uid, serverId, server, canKick, isViewingServer, isHost, onStartDM }) {
  const { currentUser } = useAuth()
  const [user, setUser] = useState(null)
  const [action, setAction] = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      if (snap.exists()) setUser({ uid: snap.id, ...snap.data() })
    })
    return unsub
  }, [uid])

  async function kickMember() {
    if (action !== 'kick') { setAction('kick'); return }
    await updateDoc(doc(db, 'servers', serverId), { members: arrayRemove(uid) })
    setAction(null)
  }

  async function banMember() {
    if (action !== 'ban') { setAction('ban'); return }
    await updateDoc(doc(db, 'servers', serverId), {
      members: arrayRemove(uid),
      banned: arrayUnion(uid),
    })
    setAction(null)
  }

  async function toggleEditor() {
    const isEditor = server?.editors?.includes(uid)
    await updateDoc(doc(db, 'servers', serverId), {
      editors: isEditor ? arrayRemove(uid) : arrayUnion(uid),
    })
  }

  if (!user) return null
  const isSelf = uid === currentUser?.uid
  const isOwner = server?.ownerId === uid
  const isOp = isOperator(user)
  const isEditor = server?.editors?.includes(uid)

  return (
    <div className="member-item" style={{ justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <Avatar user={user} size={32} showStatus />
        <div style={{ minWidth: 0 }}>
          {isOp && <div className="member-admin-tag">ADMIN</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              className="member-name"
              style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                cursor: isSelf ? 'default' : 'pointer',
                textDecoration: isSelf ? 'none' : 'underline',
                textUnderlineOffset: 3,
              }}
              onClick={() => { if (!isSelf && onStartDM) onStartDM(uid) }}
              title={isSelf ? '' : `Message ${user.displayName}`}
            >
              {user.displayName}
            </span>
            {isOwner && <span style={{ fontSize: 11, color: '#faa61a' }} title="Server Owner">👑</span>}
            {isViewingServer && isEditor && !isOwner && (
              <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }} title="Can post">✏️</span>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        {isViewingServer && isHost && !isSelf && !isOwner && (
          <button
            className={`kick-btn ${isEditor ? 'confirm' : ''}`}
            onClick={toggleEditor}
            title={isEditor ? 'Revoke posting access' : 'Grant posting access'}
            style={{ fontSize: 13 }}
          >
            {isEditor ? '✏️' : '🔒'}
          </button>
        )}
        {canKick && !isSelf && !isOwner && (
          <>
            <button
              className={`kick-btn ${action === 'kick' ? 'confirm' : ''}`}
              onClick={kickMember}
              title={action === 'kick' ? 'Click again to confirm kick' : 'Kick member'}
              onBlur={() => setAction(null)}
            >
              {action === 'kick' ? '✓?' : '🥾'}
            </button>
            <button
              className={`kick-btn ${action === 'ban' ? 'confirm' : ''}`}
              onClick={banMember}
              title={action === 'ban' ? 'Click again to confirm ban' : 'Ban member'}
              onBlur={() => setAction(null)}
              style={{ fontSize: 13 }}
            >
              {action === 'ban' ? '✓?' : '🔨'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function MembersSidebar({ serverId, server, memberIds, onStartDM }) {
  const { currentUser } = useAuth()
  const canKick = isAdmin(currentUser, server)
  const isViewingServer = server?.type === 'viewing'
  const isHost = server?.ownerId === currentUser?.uid || isAdmin(currentUser, server)

  return (
    <div className="members-sidebar">
      <h3>Members — {memberIds.length}</h3>
      {canKick && <div className="admin-badge">⚡ Operator</div>}
      {isViewingServer && <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 8px 6px' }}>👁️ Viewing server</div>}
      {memberIds.map(uid => (
        <MemberRow
          key={uid}
          uid={uid}
          serverId={serverId}
          server={server}
          canKick={canKick}
          isViewingServer={isViewingServer}
          isHost={isHost}
          onStartDM={onStartDM}
        />
      ))}
    </div>
  )
}
