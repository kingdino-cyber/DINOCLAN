import { useEffect, useRef, useState } from 'react'
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { getGlobalRank } from '../../utils/admin'
import UserPanel from './UserPanel'

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const DISCOVER_TAGS = {
  recommended: { label: '⭐ DinoClan Recommended', color: '#faa61a' },
  official:    { label: '✅ Official Server',       color: '#5865f2' },
}

function TagMenu({ current, onPick, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  return (
    <div ref={ref} className="discover-tag-menu">
      <button className={`discover-tag-item ${current === 'none' ? 'active' : ''}`} onClick={() => onPick('none')}>None</button>
      <button className={`discover-tag-item ${current === 'recommended' ? 'active' : ''}`} onClick={() => onPick('recommended')}>⭐ DinoClan Recommended</button>
      <button className={`discover-tag-item ${current === 'official' ? 'active' : ''}`} onClick={() => onPick('official')}>✅ Official Server</button>
    </div>
  )
}

export default function DiscoverPanel({ onSelectServer }) {
  const { currentUser, myProfile } = useAuth()
  const [servers, setServers] = useState([])
  const [joining, setJoining] = useState(null)
  const [tagMenuFor, setTagMenuFor] = useState(null)

  const globalRank = getGlobalRank({ ...myProfile, email: currentUser?.email })
  const canManageDiscover = globalRank === 'admin' || globalRank === 'moderator'

  useEffect(() => {
    const q = query(collection(db, 'servers'), where('isPublic', '==', true))
    const unsub = onSnapshot(q, snap => {
      setServers(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => s.kind !== 'group')
      )
    })
    return unsub
  }, [])

  async function handleJoin(srv) {
    if (srv.members?.includes(currentUser.uid)) { onSelectServer(srv.id); return }
    setJoining(srv.id)
    try {
      await updateDoc(doc(db, 'servers', srv.id), { members: arrayUnion(currentUser.uid) })
      onSelectServer(srv.id)
    } finally {
      setJoining(null)
    }
  }

  async function handleSetTag(srvId, tag) {
    setTagMenuFor(null)
    await updateDoc(doc(db, 'servers', srvId), { discoverTag: tag })
  }

  return (
    <div className="discover-panel">
      <div className="home-servers-header">
        <span style={{ fontSize: 20 }}>🧭</span>
        <h2>Discover</h2>
      </div>

      <div className="discover-grid">
        {servers.length === 0 ? (
          <div className="friends-empty">
            <span>🥚</span>
            <p>No public servers yet — be the first to make one!</p>
          </div>
        ) : servers.map(srv => {
          const isMember = srv.members?.includes(currentUser.uid)
          const tag = srv.discoverTag && srv.discoverTag !== 'none' ? DISCOVER_TAGS[srv.discoverTag] : null
          return (
            <div key={srv.id} className="discover-card">
              <div className="discover-card-banner">
                {srv.photoURL
                  ? <img src={srv.photoURL} alt={srv.name} />
                  : <span className="discover-card-initials">{getInitials(srv.name)}</span>
                }
                <button
                  className="discover-card-join-btn"
                  onClick={() => handleJoin(srv)}
                  disabled={joining === srv.id}
                >
                  {isMember ? 'Open' : (joining === srv.id ? 'Joining…' : 'Join')}
                </button>
              </div>
              <div className="discover-card-info">
                <div className="discover-card-name">{srv.name}</div>
                <div className="discover-card-members">{srv.members?.length || 0} members</div>
                {tag && (
                  <div className="discover-card-tag" style={{ color: tag.color }}>{tag.label}</div>
                )}
              </div>

              {canManageDiscover && (
                <button
                  className="discover-card-gear-btn"
                  title="Set Discover tag"
                  onClick={e => { e.stopPropagation(); setTagMenuFor(tagMenuFor === srv.id ? null : srv.id) }}
                >⚙️</button>
              )}
              {tagMenuFor === srv.id && (
                <TagMenu
                  current={srv.discoverTag || 'none'}
                  onPick={tagVal => handleSetTag(srv.id, tagVal)}
                  onClose={() => setTagMenuFor(null)}
                />
              )}
            </div>
          )
        })}
      </div>

      <div style={{ width: 240, borderTop: '1px solid var(--bg-tertiary)' }}>
        <UserPanel />
      </div>
    </div>
  )
}
