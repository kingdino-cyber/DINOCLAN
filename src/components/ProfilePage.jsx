import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import Avatar from './Chat/Avatar'
import DinoDecorations from './DinoDecorations'

function FriendChip({ uid }) {
  const [name, setName] = useState('...')
  const [emoji, setEmoji] = useState(null)
  useEffect(() => {
    getDoc(doc(db, 'users', uid)).then(snap => {
      if (snap.exists()) {
        setName(snap.data().displayName || 'Unknown')
        setEmoji(snap.data().avatarEmoji || null)
      }
    })
  }, [uid])
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'var(--bg-active)', borderRadius: 20,
      padding: '5px 12px', fontSize: 13, color: 'var(--text-normal)',
      border: '1px solid var(--bg-modifier)',
    }}>
      {emoji || '🦕'} {name}
    </span>
  )
}

export default function ProfilePage() {
  const { uid } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDoc(doc(db, 'users', uid)).then(snap => {
      if (snap.exists()) setUser({ uid: snap.id, ...snap.data() })
      setLoading(false)
    })
  }, [uid])

  const isSelf = uid === currentUser?.uid
  const friends = user?.friends || []
  const statusColour = user?.status === 'online' ? 'var(--online)' : 'var(--offline)'

  return (
    <div style={{
      position: 'relative', height: '100%', overflowY: 'auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-start', padding: '40px 24px',
      background: 'var(--bg-primary)',
    }}>
      <DinoDecorations />

      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        style={{
          position: 'fixed', top: 16, left: 16,
          background: 'var(--bg-secondary)', border: '1px solid var(--bg-active)',
          color: 'var(--text-normal)', borderRadius: 8, padding: '6px 14px',
          cursor: 'pointer', fontSize: 13, fontWeight: 600, zIndex: 10,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-active)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
      >
        ← Back
      </button>

      {loading && (
        <div style={{ textAlign: 'center', marginTop: 80 }}>
          <span style={{ fontSize: 64 }}>🦕</span>
          <p style={{ color: 'var(--text-muted)', marginTop: 16 }}>Loading profile…</p>
        </div>
      )}

      {!loading && !user && (
        <div style={{ textAlign: 'center', marginTop: 80 }}>
          <span style={{ fontSize: 64 }}>🦖</span>
          <p style={{ color: 'var(--text-muted)', marginTop: 16 }}>User not found.</p>
        </div>
      )}

      {!loading && user && (
        <div style={{
          position: 'relative', zIndex: 1,
          width: '100%', maxWidth: 480,
          background: 'var(--bg-secondary)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
          marginTop: 32,
        }}>
          {/* Banner */}
          <div style={{
            height: 100,
            background: 'linear-gradient(135deg, var(--accent) 0%, #1a4a10 100%)',
          }} />

          {/* Avatar + name */}
          <div style={{ padding: '0 28px 28px', position: 'relative' }}>
            <div style={{
              position: 'absolute', top: -44,
              display: 'flex', alignItems: 'flex-end', gap: 12,
            }}>
              <div style={{ position: 'relative' }}>
                <Avatar user={user} size={80} showStatus={false} />
                <span style={{
                  position: 'absolute', bottom: 3, right: 3,
                  width: 18, height: 18, borderRadius: '50%',
                  background: statusColour,
                  border: '3px solid var(--bg-secondary)',
                  display: 'block',
                }} />
              </div>
            </div>

            {/* Name row — offset to clear avatar */}
            <div style={{ paddingTop: 48 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
                <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--header-primary)', margin: 0 }}>
                  {user.displayName}
                </h1>
                {isSelf && (
                  <span style={{
                    fontSize: 11, background: 'var(--accent)', color: '#fff',
                    borderRadius: 4, padding: '2px 7px', fontWeight: 800,
                  }}>YOU</span>
                )}
              </div>
              <div style={{ fontSize: 13, color: statusColour, fontWeight: 700, marginBottom: 24, textTransform: 'capitalize' }}>
                ● {user.status || 'offline'}
              </div>

              {/* Stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                <div style={{
                  background: 'var(--bg-tertiary)', borderRadius: 12,
                  padding: '14px 18px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--accent)' }}>
                    {friends.length}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
                    Friends
                  </div>
                </div>
                <div style={{
                  background: 'var(--bg-tertiary)', borderRadius: 12,
                  padding: '14px 18px',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    📧 Email
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-normal)', fontWeight: 600, wordBreak: 'break-all' }}>
                    {user.email || '—'}
                  </div>
                </div>
              </div>

              {/* Friends list */}
              <div style={{ marginBottom: 8 }}>
                <div style={{
                  fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase',
                  letterSpacing: '0.06em', fontWeight: 700, marginBottom: 10,
                }}>
                  🦕 Friends ({friends.length})
                </div>
                {friends.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>🥚 No friends yet</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {friends.map(fuid => <FriendChip key={fuid} uid={fuid} />)}
                  </div>
                )}
              </div>

              {/* Message button (only if not yourself) */}
              {!isSelf && (
                <button
                  onClick={() => navigate('/app', { state: { dmUid: uid } })}
                  style={{
                    marginTop: 24, width: '100%',
                    background: 'var(--accent)', border: 'none', borderRadius: 10,
                    color: '#fff', fontWeight: 800, fontSize: 15, padding: '12px 0',
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
                >
                  💬 Send Message
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
