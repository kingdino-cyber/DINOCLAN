import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import Avatar from '../Chat/Avatar'

function MemberRow({ uid }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      if (snap.exists()) setUser({ uid: snap.id, ...snap.data() })
    })
    return unsub
  }, [uid])

  if (!user) return null

  return (
    <div className="member-item">
      <Avatar user={user} size={32} showStatus />
      <span className="member-name">{user.displayName}</span>
    </div>
  )
}

export default function MembersSidebar({ serverId, memberIds }) {
  return (
    <div className="members-sidebar">
      <h3>Members — {memberIds.length}</h3>
      {memberIds.map(uid => <MemberRow key={uid} uid={uid} />)}
    </div>
  )
}
