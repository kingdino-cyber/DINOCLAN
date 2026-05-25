import { useEffect, useState } from 'react'
import { doc, onSnapshot, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { isAdmin } from '../../utils/admin'
import Avatar from '../Chat/Avatar'

function MemberRow({ uid, serverId, server, canKick }) {
  const { currentUser } = useAuth()
  const [user, setUser] = useState(null)
  const [action, setAction] = useState(null) // 'kick' | 'ban' | null

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

  if (!user) return null
  const isSelf = uid === currentUser?.uid
  const isOwner = server?.ownerId === uid

  return (
    <div className="member-item" style={{ justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <Avatar user={user} size={32} showStatus />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="member-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.displayName}
            </span>
            {isOwner && <span style={{ fontSize: 11, color: '#faa61a' }} title="Server Owner">👑</span>}
          </div>
        </div>
      </div>
      {canKick && !isSelf && !isOwner && (
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
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
        </div>
      )}
    </div>
  )
}

export default function MembersSidebar({ serverId, server, memberIds }) {
  const { currentUser } = useAuth()
  const canKick = isAdmin(currentUser, server)

  return (
    <div className="members-sidebar">
      <h3>Members — {memberIds.length}</h3>
      {canKick && (
        <div className="admin-badge">⚡ Operator</div>
      )}
      {memberIds.map(uid => (
        <MemberRow
          key={uid}
          uid={uid}
          serverId={serverId}
          server={server}
          canKick={canKick}
        />
      ))}
    </div>
  )
}
