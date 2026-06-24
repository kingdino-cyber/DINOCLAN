import { useEffect, useState, useRef } from 'react'
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useProfile } from '../../contexts/ProfileContext'
import { getGlobalRank, GLOBAL_RANK_TAGS } from '../../utils/admin'
import Avatar from '../Chat/Avatar'

function FriendChip({ uid }) {
  const [name, setName] = useState('…')
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
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: 'var(--bg-hover)', borderRadius: 20,
      padding: '4px 11px', fontSize: 12, color: 'var(--text-normal)',
      border: '1px solid var(--bg-active)',
    }}>
      {emoji || '🦕'} {name}
    </span>
  )
}

export default function UserProfileModal({ onStartDM }) {
  const { profileUid, closeProfile } = useProfile()
  const { currentUser } = useAuth()
  const [user, setUser]         = useState(null)
  const [loading, setLoading]   = useState(false)
  const [note, setNote]         = useState('')
  const [noteSaved, setNoteSaved] = useState(false)
  const panelRef = useRef(null)

  // Load the profile user's doc (real-time so rank/about updates show)
  useEffect(() => {
    if (!profileUid) { setUser(null); return }
    setLoading(true)
    setUser(null)
    const unsub = onSnapshot(doc(db, 'users', profileUid), snap => {
      if (snap.exists()) setUser({ uid: snap.id, ...snap.data() })
      setLoading(false)
    })
    return unsub
  }, [profileUid])

  // Load private note (viewer → subject)
  useEffect(() => {
    if (!profileUid || !currentUser?.uid) return
    const noteRef = doc(db, 'users', currentUser.uid, 'notes', profileUid)
    getDoc(noteRef).then(snap => {
      if (snap.exists()) setNote(snap.data().note || '')
      else setNote('')
    })
  }, [profileUid, currentUser?.uid])

  // Close when clicking outside the panel
  useEffect(() => {
    if (!profileUid) return
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) closeProfile()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [profileUid])

  async function saveNote() {
    if (!currentUser?.uid || !profileUid) return
    const noteRef = doc(db, 'users', currentUser.uid, 'notes', profileUid)
    await setDoc(noteRef, { note, updatedAt: new Date() })
    setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 2000)
  }

  if (!profileUid) return null

  const isSelf    = profileUid === currentUser?.uid
  const friends   = user?.friends || []
  const isOnline  = user?.status === 'online'
  const globalRank = user ? getGlobalRank(user) : 'user'
  const rankTag   = globalRank !== 'user' ? GLOBAL_RANK_TAGS[globalRank] : null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div
        ref={panelRef}
        style={{
          width: 380, maxHeight: '90vh', overflowY: 'auto',
          background: 'var(--bg-secondary)',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 12px 60px rgba(0,0,0,0.6)',
          animation: 'profilePop 0.18s ease',
        }}
      >
        <style>{`
          @keyframes profilePop {
            from { opacity: 0; transform: scale(0.93) translateY(8px); }
            to   { opacity: 1; transform: scale(1)    translateY(0);   }
          }
        `}</style>

        {/* Green banner */}
        <div style={{
          height: 72,
          background: 'linear-gradient(135deg, #3a7a28 0%, #1a3a10 100%)',
          position: 'relative', flexShrink: 0,
        }}>
          <button
            onClick={closeProfile}
            style={{
              position: 'absolute', top: 10, right: 12,
              background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: 6,
              color: '#fff', cursor: 'pointer', fontSize: 15,
              padding: '2px 9px', lineHeight: 1.6,
            }}
          >✕</button>
        </div>

        <div style={{ padding: '0 20px 22px' }}>

          {/* Avatar overlapping banner */}
          <div style={{ marginTop: -36, marginBottom: 10, position: 'relative', display: 'inline-block' }}>
            {loading || !user
              ? <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--bg-tertiary)', border: '4px solid var(--bg-secondary)' }} />
              : <Avatar user={user} size={72} showStatus={false} />
            }
            {user && (
              <span style={{
                position: 'absolute', bottom: 4, right: 4,
                width: 16, height: 16, borderRadius: '50%',
                background: isOnline ? 'var(--online)' : 'var(--offline)',
                border: '3px solid var(--bg-secondary)', display: 'block',
              }} />
            )}
          </div>

          {loading && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</p>}

          {!loading && user && (<>

            {/* Name row + rank */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
              {rankTag && (
                <span style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
                  color: rankTag.color, background: rankTag.bg,
                  borderRadius: 4, padding: '2px 7px',
                  border: `1px solid ${rankTag.color}44`,
                }}>{rankTag.label}</span>
              )}
              <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--header-primary)' }}>
                {user.displayName}
              </span>
              {isSelf && (
                <span style={{
                  fontSize: 10, fontWeight: 800, background: 'var(--accent)',
                  color: '#fff', borderRadius: 4, padding: '1px 6px',
                }}>YOU</span>
              )}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: isOnline ? 'var(--online)' : 'var(--offline)', marginBottom: 14, textTransform: 'capitalize' }}>
              ● {user.status || 'offline'}
            </div>

            {/* About Me section */}
            {user.aboutMe && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6 }}>
                  📖 About Me
                </div>
                <div style={{
                  background: 'var(--bg-tertiary)', borderRadius: 8, padding: '10px 12px',
                  fontSize: 13, color: 'var(--text-normal)', lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {user.aboutMe}
                </div>
              </div>
            )}

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent)' }}>{friends.length}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Friends</div>
              </div>
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>📧 Email</div>
                <div style={{ fontSize: 11, color: 'var(--text-normal)', fontWeight: 600, wordBreak: 'break-all' }}>{user.email || '—'}</div>
              </div>
            </div>

            {/* Friends list */}
            {friends.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 8 }}>
                  🦕 Friends ({friends.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {friends.map(fuid => <FriendChip key={fuid} uid={fuid} />)}
                </div>
              </div>
            )}

            {/* Private notes (only shown when viewing someone else's profile) */}
            {!isSelf && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6 }}>
                  🔒 My Notes (only you can see this)
                </div>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add a private note about this person…"
                  rows={3}
                  style={{
                    width: '100%', background: 'var(--bg-tertiary)',
                    border: '1px solid var(--bg-modifier)', borderRadius: 8,
                    color: 'var(--text-normal)', fontSize: 13, padding: '8px 10px',
                    resize: 'vertical', fontFamily: 'inherit', outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--bg-modifier)'}
                />
                <button
                  onClick={saveNote}
                  style={{
                    marginTop: 6, padding: '4px 14px', fontSize: 12,
                    background: noteSaved ? 'var(--success)' : 'var(--bg-active)',
                    border: 'none', borderRadius: 6, color: '#fff',
                    cursor: 'pointer', fontWeight: 600, transition: 'background 0.15s',
                  }}
                >
                  {noteSaved ? '✓ Saved!' : 'Save Note'}
                </button>
              </div>
            )}

          </>)}
        </div>

        {/* Send message button — sticky so it's always reachable even with a long bio */}
        {!loading && user && !isSelf && onStartDM && (
          <div style={{
            position: 'sticky', bottom: 0,
            padding: '12px 20px', background: 'var(--bg-secondary)',
            borderTop: '1px solid var(--bg-active)',
          }}>
            <button
              onClick={() => { onStartDM(profileUid); closeProfile() }}
              style={{
                width: '100%',
                background: 'var(--accent)', border: 'none', borderRadius: 8,
                color: '#fff', fontWeight: 800, fontSize: 14,
                padding: '10px 0', cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
            >
              💬 Send Message
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
