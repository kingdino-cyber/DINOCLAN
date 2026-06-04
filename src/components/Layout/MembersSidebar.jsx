import { useEffect, useState } from 'react'
import { doc, onSnapshot, updateDoc, arrayRemove, arrayUnion, deleteField } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import {
  isAdmin, isOperator,
  getServerRank, getGlobalRank,
  canManage,
  SERVER_RANK_TAGS, GLOBAL_RANK_TAGS,
} from '../../utils/admin'
import { useProfile } from '../../contexts/ProfileContext'
import Avatar from '../Chat/Avatar'

/* ── Small rank badge chip ── */
function RankChip({ rank, type = 'server' }) {
  const tags = type === 'global' ? GLOBAL_RANK_TAGS : SERVER_RANK_TAGS
  const info = tags[rank]
  if (!info) return null
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, letterSpacing: '0.04em',
      color: info.color, background: info.bg,
      borderRadius: 3, padding: '1px 5px',
      border: `1px solid ${info.color}44`,
      flexShrink: 0,
    }}>{info.label}</span>
  )
}

function MemberRow({ uid, serverId, server, myServerRank, myGlobalRank, isViewingServer }) {
  const { openProfile } = useProfile()
  const { currentUser } = useAuth()
  const [user, setUser] = useState(null)
  const [action, setAction] = useState(null)
  const [showRankMenu, setShowRankMenu] = useState(false)

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

  async function setServerRankFor(rank) {
    setShowRankMenu(false)
    if (rank === 'member') {
      await updateDoc(doc(db, 'servers', serverId), {
        [`memberRanks.${uid}`]: deleteField(),
      })
    } else {
      await updateDoc(doc(db, 'servers', serverId), {
        [`memberRanks.${uid}`]: rank,
      })
    }
  }

  if (!user) return null
  const isSelf  = uid === currentUser?.uid
  const isOwner = server?.ownerId === uid

  const theirServerRank = getServerRank(server, uid)
  const theirGlobalRank = getGlobalRank(user)

  // Can I manage this person?
  const iManage = !isSelf && !isOwner && canManage(myServerRank, myGlobalRank, theirServerRank, theirGlobalRank)

  // Can kick/ban: just need to outrank the target (canManage already enforces strict >)
  // canManage prevents same-rank or higher-rank targets from being kicked
  const canKick = iManage

  const isEditor = server?.editors?.includes(uid)
  const isHost = server?.ownerId === currentUser?.uid || isOperator(currentUser)

  return (
    <div className="member-item" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
        <Avatar user={user} size={32} showStatus />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            {/* Global rank chip */}
            {theirGlobalRank !== 'user' && <RankChip rank={theirGlobalRank} type="global" />}
            {/* Server rank chip */}
            {theirServerRank !== 'member' && <RankChip rank={theirServerRank} type="server" />}
            <span
              className="member-name"
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
              onClick={() => openProfile(uid)}
              title={`View ${user.displayName}'s profile`}
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

      <div style={{ display: 'flex', gap: 2, flexShrink: 0, position: 'relative' }}>
        {/* Rank management button (shown to anyone who can manage this person) */}
        {iManage && !isOwner && (
          <div style={{ position: 'relative' }}>
            <button
              className="kick-btn"
              onClick={() => setShowRankMenu(m => !m)}
              title="Manage rank"
              style={{ fontSize: 13 }}
            >⚙️</button>
            {showRankMenu && (
              <div className="rank-menu" onMouseLeave={() => setShowRankMenu(false)}>
                <div className="rank-menu-title">Set Server Rank</div>
                {['member', 'operator', 'moderator'].map(r => (
                  <button
                    key={r}
                    className={`rank-menu-item ${theirServerRank === r ? 'active' : ''}`}
                    onClick={() => setServerRankFor(r)}
                  >
                    {r === 'member'    && '👤 Member'}
                    {r === 'operator'  && '🔵 Operator'}
                    {r === 'moderator' && '🔴 Moderator'}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Editor toggle (for viewing servers) */}
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

        {/* Kick / ban buttons */}
        {canKick && (
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
  const [myUserData, setMyUserData] = useState(null)

  useEffect(() => {
    if (!currentUser?.uid) return
    const unsub = onSnapshot(doc(db, 'users', currentUser.uid), snap => {
      if (snap.exists()) setMyUserData({ uid: snap.id, ...snap.data() })
    })
    return unsub
  }, [currentUser?.uid])

  const myServerRank = getServerRank(server, currentUser?.uid)
  const myGlobalRank = getGlobalRank(myUserData ? { ...myUserData, email: currentUser?.email } : { email: currentUser?.email })
  const isViewingServer = server?.type === 'viewing'

  return (
    <div className="members-sidebar">
      <h3>Members — {memberIds.length}</h3>
      {myGlobalRank !== 'user' && (
        <div className="admin-badge" style={{ background: GLOBAL_RANK_TAGS[myGlobalRank]?.bg, color: GLOBAL_RANK_TAGS[myGlobalRank]?.color }}>
          ⚡ {GLOBAL_RANK_TAGS[myGlobalRank]?.label}
        </div>
      )}
      {isViewingServer && <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 8px 6px' }}>👁️ Viewing server</div>}
      {memberIds.map(uid => (
        <MemberRow
          key={uid}
          uid={uid}
          serverId={serverId}
          server={server}
          myServerRank={myServerRank}
          myGlobalRank={myGlobalRank}
          isViewingServer={isViewingServer}
        />
      ))}
    </div>
  )
}
