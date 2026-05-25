import { useEffect, useState } from 'react'
import { doc, onSnapshot, updateDoc, arrayRemove } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { isAdmin } from '../../utils/admin'
import Avatar from '../Chat/Avatar'

function MemberRow({ uid, serverId, server, canKick }) {
  const { currentUser } = useAuth()
  const [user, setUser] = useState(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      if (snap.exists()) setUser({ uid: snap.id, ...snap.data() })
    })
    return unsub
  }, [uid])

  async function kickMember() {
    if (!confirming) { setConfirming(true); return }
    await updateDoc(doc(db, 'servers', serverId), {
      members: arrayRemove(uid),
    })
    setConfirming(false)
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
        <button
          className={`kick-btn ${confirming ? 'confirm' : ''}`}
          onClick={kickMember}
          title={confirming ? 'Click again to confirm' : 'Kick member'}
          onBlur={() => setConfirming(false)}
        >
          {confirming ? '✓?' : '🥾'}
        </button>
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
