import { useEffect, useState } from 'react'
import {
  collection, query, where, onSnapshot, addDoc,
  updateDoc, doc, serverTimestamp, getDocs, getDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Avatar from '../Chat/Avatar'

/* ── Helpers ── */

function FriendChip({ uid }) {
  const [name, setName] = useState('…')
  useEffect(() => {
    getDoc(doc(db, 'users', uid)).then(snap => {
      if (snap.exists()) setName(snap.data().displayName || 'Unknown')
    })
  }, [uid])
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'var(--bg-active)', borderRadius: 20,
      padding: '3px 10px', fontSize: 12, color: 'var(--text-normal)',
      border: '1px solid var(--bg-modifier)',
    }}>
      🦕 {name}
    </span>
  )
}

function FriendRow({ uid, onStartDM, onRemove }) {
  const [user, setUser] = useState(null)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      if (snap.exists()) setUser({ uid: snap.id, ...snap.data() })
    })
    return unsub
  }, [uid])
  if (!user) return null
  return (
    <div className="member-item" style={{ padding: '8px 12px' }}>
      {/* Clickable area → open DM */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer', minWidth: 0 }}
        onClick={() => onStartDM(uid)}
        title={`Message ${user.displayName}`}
      >
        <Avatar user={user} size={36} showStatus />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'var(--header-primary)', fontSize: 14, fontWeight: 600 }}>
            {user.displayName}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'capitalize' }}>
            {user.status || 'offline'}
          </div>
        </div>
        <span style={{ fontSize: 18, opacity: 0.4, flexShrink: 0 }}>💬</span>
      </div>
      {/* Remove button */}
      <button
        className="friend-remove-btn"
        onClick={() => onRemove(uid)}
        title="Remove friend"
      >✕</button>
    </div>
  )
}

/* ── Stats card shown after searching ── */
function StatsCard({ user, onStartDM, currentUser }) {
  const friends = user.friends || []
  const isOnline = user.status === 'online'
  const isSelf = user.uid === currentUser?.uid

  return (
    <div style={{
      margin: '16px', borderRadius: 14,
      background: 'var(--bg-tertiary)',
      overflow: 'hidden',
      border: '1px solid var(--bg-active)',
    }}>
      {/* Banner */}
      <div style={{
        height: 60,
        background: 'linear-gradient(135deg, #3a7a28 0%, #1a3a10 100%)',
      }} />

      <div style={{ padding: '0 16px 16px' }}>
        {/* Avatar */}
        <div style={{ marginTop: -30, marginBottom: 8, position: 'relative', display: 'inline-block' }}>
          <Avatar user={user} size={60} showStatus={false} />
          <span style={{
            position: 'absolute', bottom: 3, right: 3,
            width: 14, height: 14, borderRadius: '50%',
            background: isOnline ? 'var(--online)' : 'var(--offline)',
            border: '2px solid var(--bg-tertiary)', display: 'block',
          }} />
        </div>

        {/* Name + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--header-primary)' }}>
            {user.displayName}
          </span>
          {isSelf && (
            <span style={{ fontSize: 10, background: 'var(--accent)', color: '#fff', borderRadius: 4, padding: '1px 6px', fontWeight: 800 }}>
              YOU
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: isOnline ? 'var(--online)' : 'var(--offline)', marginBottom: 14, textTransform: 'capitalize' }}>
          ● {user.status || 'offline'}
        </div>

        {/* Stat boxes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)' }}>{friends.length}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Friends</div>
          </div>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px' }}>
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

        {/* Message button */}
        {!isSelf && (
          <button
            onClick={() => onStartDM(user.uid)}
            style={{
              width: '100%', background: 'var(--accent)', border: 'none',
              borderRadius: 8, color: '#fff', fontWeight: 800, fontSize: 14,
              padding: '9px 0', cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
          >
            💬 Send Message
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Main panel ── */
export default function FriendsPanel({ onStartDM }) {
  const { currentUser } = useAuth()
  const [tab, setTab] = useState('all')

  // existing state
  const [requests, setRequests]         = useState([])
  const [friends, setFriends]           = useState([])
  const [serverInvites, setServerInvites] = useState([])
  const [searchEmail, setSearchEmail]   = useState('')
  const [addStatus, setAddStatus]       = useState('')
  const [userData, setUserData]         = useState(null)

  // stats tab state
  const [statsQuery, setStatsQuery]     = useState('')
  const [statsResult, setStatsResult]   = useState(null)
  const [statsStatus, setStatsStatus]   = useState('')
  const [statsLoading, setStatsLoading] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', currentUser.uid), snap => {
      if (snap.exists()) setUserData({ uid: snap.id, ...snap.data() })
    })
    return unsub
  }, [currentUser.uid])

  useEffect(() => {
    const q = query(
      collection(db, 'friendRequests'),
      where('toUid', '==', currentUser.uid),
      where('status', '==', 'pending'),
    )
    const unsub = onSnapshot(q, snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [currentUser.uid])

  useEffect(() => {
    setFriends(userData?.friends || [])
  }, [userData])

  useEffect(() => {
    const q = query(
      collection(db, 'serverInvites'),
      where('toUid', '==', currentUser.uid),
      where('status', '==', 'pending'),
    )
    const unsub = onSnapshot(q, snap => {
      setServerInvites(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [currentUser.uid])

  async function acceptServerInvite(inv) {
    await updateDoc(doc(db, 'serverInvites', inv.id), { status: 'accepted' })
    await updateDoc(doc(db, 'servers', inv.serverId), { members: arrayUnion(currentUser.uid) })
  }
  async function declineServerInvite(inv) {
    await updateDoc(doc(db, 'serverInvites', inv.id), { status: 'declined' })
  }

  async function sendRequest() {
    setAddStatus('')
    if (!searchEmail.trim()) return
    if (searchEmail.trim() === currentUser.email) { setAddStatus("You can't add yourself!"); return }
    const q = query(collection(db, 'users'), where('email', '==', searchEmail.trim().toLowerCase()))
    const snap = await getDocs(q)
    if (snap.empty) { setAddStatus('No user found with that email.'); return }
    const target = snap.docs[0]
    if (friends.includes(target.id)) { setAddStatus('Already friends!'); return }
    const existing = await getDocs(query(
      collection(db, 'friendRequests'),
      where('fromUid', '==', currentUser.uid),
      where('toUid', '==', target.id),
    ))
    if (!existing.empty) { setAddStatus('Request already sent!'); return }
    await addDoc(collection(db, 'friendRequests'), {
      fromUid: currentUser.uid,
      fromName: currentUser.displayName,
      toUid: target.id,
      status: 'pending',
      createdAt: serverTimestamp(),
    })
    setAddStatus('Friend request sent! 🦕')
    setSearchEmail('')
  }

  async function acceptRequest(req) {
    await updateDoc(doc(db, 'friendRequests', req.id), { status: 'accepted' })
    await updateDoc(doc(db, 'users', currentUser.uid), {
      friends: [...(userData?.friends || []), req.fromUid],
    })
    await getDocs(query(collection(db, 'users'), where('uid', '==', req.fromUid))).then(async snap => {
      if (!snap.empty) {
        const them = snap.docs[0].data()
        await updateDoc(doc(db, 'users', req.fromUid), {
          friends: [...(them.friends || []), currentUser.uid],
        })
      }
    })
  }
  async function declineRequest(req) {
    await updateDoc(doc(db, 'friendRequests', req.id), { status: 'declined' })
  }

  async function removeFriend(friendUid) {
    if (!window.confirm('Remove this friend? You can always add them back later.')) return
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        friends: arrayRemove(friendUid),
      })
      // Best-effort: also remove us from their list
      updateDoc(doc(db, 'users', friendUid), {
        friends: arrayRemove(currentUser.uid),
      }).catch(() => {})
    } catch (err) {
      console.error('Remove friend failed:', err)
    }
  }

  async function searchStats() {
    const q = statsQuery.trim()
    if (!q) return
    setStatsLoading(true)
    setStatsResult(null)
    setStatsStatus('')

    // Search by displayName prefix (case-sensitive Firestore range query)
    const snap = await getDocs(query(
      collection(db, 'users'),
      where('displayName', '>=', q),
      where('displayName', '<=', q + ''),
    ))

    setStatsLoading(false)
    if (snap.empty) {
      setStatsStatus('No user found with that username. 🦕')
    } else {
      // pick the closest match (exact first, then first result)
      const exact = snap.docs.find(d => d.data().displayName === q)
      const chosen = exact || snap.docs[0]
      setStatsResult({ uid: chosen.id, ...chosen.data() })
    }
  }

  return (
    <div className="friends-panel">
      <div className="friends-header">
        <span style={{ fontSize: 20 }}>🦕</span>
        <h2>Friends</h2>
      </div>

      <div className="friends-tabs">
        <button className={`friends-tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
          All Friends {friends.length > 0 && <span className="badge">{friends.length}</span>}
        </button>
        <button className={`friends-tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
          Pending {requests.length > 0 && <span className="badge">{requests.length}</span>}
        </button>
        <button className={`friends-tab ${tab === 'add' ? 'active' : ''}`} onClick={() => setTab('add')}>
          Add Friend
        </button>
        <button className={`friends-tab ${tab === 'invites' ? 'active' : ''}`} onClick={() => setTab('invites')}>
          Invites {serverInvites.length > 0 && <span className="badge">{serverInvites.length}</span>}
        </button>
        <button className={`friends-tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>
          🔍 Stats
        </button>
      </div>

      <div className="friends-body">

        {/* ── All friends ── */}
        {tab === 'all' && (
          friends.length === 0
            ? <div className="friends-empty"><span>🦕</span><p>No friends yet — add some dinos!</p></div>
            : friends.map(uid => <FriendRow key={uid} uid={uid} onStartDM={onStartDM} onRemove={removeFriend} />)
        )}

        {/* ── Pending requests ── */}
        {tab === 'pending' && (
          requests.length === 0
            ? <div className="friends-empty"><span>🥚</span><p>No pending requests</p></div>
            : requests.map(req => (
              <div key={req.id} className="friend-request-row">
                <span style={{ fontSize: 28 }}>🦖</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--header-primary)', fontWeight: 600 }}>{req.fromName}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Incoming Friend Request</div>
                </div>
                <button className="btn-confirm" style={{ padding: '4px 12px', fontSize: 13 }} onClick={() => acceptRequest(req)}>✓</button>
                <button className="btn-danger"  style={{ padding: '4px 12px', fontSize: 13 }} onClick={() => declineRequest(req)}>✗</button>
              </div>
            ))
        )}

        {/* ── Invites ── */}
        {tab === 'invites' && (
          serverInvites.length === 0
            ? <div className="friends-empty"><span>📭</span><p>No pending invites</p></div>
            : serverInvites.map(inv => (
              <div key={inv.id} className="friend-request-row">
                <span style={{ fontSize: 28 }}>{inv.kind === 'group' ? '👥' : '🏠'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--header-primary)', fontWeight: 600 }}>{inv.serverName}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {inv.kind === 'group' ? 'Group' : 'Server'} invite from {inv.fromDisplayName}
                  </div>
                </div>
                <button className="btn-confirm" style={{ padding: '4px 12px', fontSize: 13 }} onClick={() => acceptServerInvite(inv)}>
                  {inv.kind === 'group' ? 'Join Group' : 'Join'}
                </button>
                <button className="btn-danger" style={{ padding: '4px 12px', fontSize: 13 }} onClick={() => declineServerInvite(inv)}>✗</button>
              </div>
            ))
        )}

        {/* ── Add friend ── */}
        {tab === 'add' && (
          <div style={{ padding: 16 }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 12 }}>
              Add a friend using their email address!
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="settings-input"
                style={{ flex: 1 }}
                value={searchEmail}
                onChange={e => setSearchEmail(e.target.value)}
                placeholder="Enter email address"
                onKeyDown={e => e.key === 'Enter' && sendRequest()}
              />
              <button className="btn-confirm" onClick={sendRequest}>Send 🦕</button>
            </div>
            {addStatus && (
              <p style={{ marginTop: 8, fontSize: 13, color: addStatus.includes('sent') ? 'var(--success)' : 'var(--danger)' }}>
                {addStatus}
              </p>
            )}
          </div>
        )}

        {/* ── Stats search ── */}
        {tab === 'stats' && (
          <div>
            <div style={{ padding: 16 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 12 }}>
                Search a username to view their stats 🦕
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="settings-input"
                  style={{ flex: 1 }}
                  value={statsQuery}
                  onChange={e => { setStatsQuery(e.target.value); setStatsResult(null); setStatsStatus('') }}
                  placeholder="Enter username…"
                  onKeyDown={e => e.key === 'Enter' && searchStats()}
                  autoFocus
                />
                <button
                  className="btn-confirm"
                  onClick={searchStats}
                  disabled={statsLoading || !statsQuery.trim()}
                >
                  {statsLoading ? '…' : 'Search'}
                </button>
              </div>
              {statsStatus && (
                <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>{statsStatus}</p>
              )}
            </div>

            {statsResult && (
              <StatsCard
                user={statsResult}
                onStartDM={onStartDM}
                currentUser={currentUser}
              />
            )}
          </div>
        )}

      </div>
    </div>
  )
}
