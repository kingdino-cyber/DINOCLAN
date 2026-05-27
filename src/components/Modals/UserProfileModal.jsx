import { useEffect, useState } from 'react'
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Avatar from '../Chat/Avatar'

function FriendChip({ uid }) {
  const [name, setName] = useState('...')
  const [emoji, setEmoji] = useState(null)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      if (snap.exists()) {
        setName(snap.data().displayName || 'Unknown')
        setEmoji(snap.data().avatarEmoji || null)
      }
    })
    return unsub
  }, [uid])
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'var(--bg-active)', borderRadius: 20,
      padding: '3px 10px', fontSize: 13, color: 'var(--text-normal)',
    }}>
      {emoji || '🦕'} {name}
    </span>
  )
}

export default function UserProfileModal({ uid, onClose }) {
  const { currentUser } = useAuth()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      if (snap.exists()) setUser({ uid: snap.id, ...snap.data() })
      setLoading(false)
    })
    return unsub
  }, [uid])

  if (loading) return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ minWidth: 320, textAlign: 'center', padding: 40 }}>
        <span style={{ fontSize: 40 }}>🦕</span>
        <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>Loading profile…</p>
      </div>
    </div>
  )

  if (!user) return null

  const isSelf = uid === currentUser?.uid
  const friends = user.friends || []
  const statusColour = user.status === 'online' ? 'var(--online)' : 'var(--offline)'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        onClick={e => e.stopPropagation()}
        style={{ minWidth: 340, maxWidth: 440, padding: 0, overflow: 'hidden' }}
      >
        {/* Banner */}
        <div style={{
          background: 'linear-gradient(135deg, var(--accent) 0%, #2a5c1a 100%)',
          height: 80, position: 'relative',
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 10, right: 12,
              background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: 6,
              color: '#fff', cursor: 'pointer', fontSize: 16, padding: '2px 8px',
            }}
          >✕</button>
        </div>

        {/* Avatar overlapping banner */}
        <div style={{ padding: '0 20px 20px', position: 'relative' }}>
          <div style={{ position: 'relative', display: 'inline-block', marginTop: -36, marginBottom: 8 }}>
            <Avatar user={user} size={72} showStatus={false} />
            <span style={{
              position: 'absolute', bottom: 2, right: 2,
              width: 16, height: 16, borderRadius: '50%',
              background: statusColour,
              border: '2px solid var(--bg-secondary)',
              display: 'block',
            }} />
          </div>

          {/* Name + status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--header-primary)', margin: 0 }}>
              {user.displayName}
            </h2>
            {isSelf && (
              <span style={{ fontSize: 11, background: 'var(--accent)', color: '#fff', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
                YOU
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: statusColour, marginBottom: 16, textTransform: 'capitalize', fontWeight: 600 }}>
            ● {user.status || 'offline'}
          </div>

          {/* Stats row */}
          <div style={{
            display: 'flex', gap: 12, marginBottom: 20,
          }}>
            <div style={{
              flex: 1, background: 'var(--bg-tertiary)', borderRadius: 10,
              padding: '10px 14px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{friends.length}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Friends</div>
            </div>
            <div style={{
              flex: 2, background: 'var(--bg-tertiary)', borderRadius: 10,
              padding: '10px 14px',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                📧 Email
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-normal)', wordBreak: 'break-all', fontWeight: 600 }}>
                {user.email || 'Hidden'}
              </div>
            </div>
          </div>

          {/* Friends list */}
          {friends.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontWeight: 700 }}>
                🦕 Friends ({friends.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {friends.map(fuid => <FriendChip key={fuid} uid={fuid} />)}
              </div>
            </div>
          )}

          {friends.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '8px 0' }}>
              🥚 No friends yet
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
