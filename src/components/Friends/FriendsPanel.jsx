import { useEffect, useState } from 'react'
import {
  collection, query, where, onSnapshot, addDoc,
  updateDoc, doc, serverTimestamp, getDocs, arrayUnion,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import Avatar from '../Chat/Avatar'

function FriendRow({ uid }) {
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
      <Avatar user={user} size={36} showStatus />
      <div>
        <div style={{ color: 'var(--header-primary)', fontSize: 14, fontWeight: 600 }}>{user.displayName}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'capitalize' }}>{user.status || 'offline'}</div>
      </div>
    </div>
  )
}

export default function FriendsPanel() {
  const { currentUser } = useAuth()
  const [tab, setTab] = useState('all')
  const [requests, setRequests] = useState([])
  const [friends, setFriends] = useState([])
  const [serverInvites, setServerInvites] = useState([])
  const [searchEmail, setSearchEmail] = useState('')
  const [addStatus, setAddStatus] = useState('')
  const [userData, setUserData] = useState(null)

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
    if (searchEmail.trim() === currentUser.email) {
      setAddStatus("You can't add yourself!")
      return
    }
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

  return (
    <div className="friends-panel">
      <div className="friends-header">
        <span style={{ fontSize: 20 }}>🦕</span>
        <h2>Friends</h2>
      </div>

      <div className="friends-tabs">
        <button className={`friends-tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')} data-tooltip="Your friends.">
          All Friends {friends.length > 0 && <span className="badge">{friends.length}</span>}
        </button>
        <button className={`friends-tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')} data-tooltip="Incoming requests.">
          Pending {requests.length > 0 && <span className="badge">{requests.length}</span>}
        </button>
        <button className={`friends-tab ${tab === 'add' ? 'active' : ''}`} onClick={() => setTab('add')} data-tooltip="Add a friend.">
          Add Friend
        </button>
        <button className={`friends-tab ${tab === 'invites' ? 'active' : ''}`} onClick={() => setTab('invites')} data-tooltip="Server invites.">
          Invites {serverInvites.length > 0 && <span className="badge">{serverInvites.length}</span>}
        </button>
      </div>

      <div className="friends-body">
        {tab === 'all' && (
          <>
            {friends.length === 0
              ? <div className="friends-empty"><span>🦕</span><p>No friends yet — add some dinos!</p></div>
              : friends.map(uid => <FriendRow key={uid} uid={uid} />)
            }
          </>
        )}

        {tab === 'pending' && (
          <>
            {requests.length === 0
              ? <div className="friends-empty"><span>🥚</span><p>No pending requests</p></div>
              : requests.map(req => (
                <div key={req.id} className="friend-request-row">
                  <span style={{ fontSize: 28 }}>🦖</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--header-primary)', fontWeight: 600 }}>{req.fromName}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Incoming Friend Request</div>
                  </div>
                  <button className="btn-confirm" style={{ padding: '4px 12px', fontSize: 13 }} onClick={() => acceptRequest(req)}>✓</button>
                  <button className="btn-danger" style={{ padding: '4px 12px', fontSize: 13 }} onClick={() => declineRequest(req)}>✗</button>
                </div>
              ))
            }
          </>
        )}

        {tab === 'invites' && (
          <>
            {serverInvites.length === 0
              ? <div className="friends-empty"><span>📭</span><p>No server invites</p></div>
              : serverInvites.map(inv => (
                <div key={inv.id} className="friend-request-row">
                  <span style={{ fontSize: 28 }}>🏠</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--header-primary)', fontWeight: 600 }}>{inv.serverName}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>from {inv.fromDisplayName}</div>
                  </div>
                  <button className="btn-confirm" style={{ padding: '4px 12px', fontSize: 13 }} onClick={() => acceptServerInvite(inv)}>Join</button>
                  <button className="btn-danger" style={{ padding: '4px 12px', fontSize: 13 }} onClick={() => declineServerInvite(inv)}>✗</button>
                </div>
              ))
            }
          </>
        )}

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
      </div>
    </div>
  )
}
