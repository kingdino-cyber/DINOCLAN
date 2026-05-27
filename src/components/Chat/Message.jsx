import { useState } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useProfile } from '../../contexts/ProfileContext'
import { isAdmin } from '../../utils/admin'
import Avatar from './Avatar'

function formatTimestamp(ts, short = false) {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  if (short) return format(date, 'HH:mm')
  if (isToday(date)) return `Today at ${format(date, 'HH:mm')}`
  if (isYesterday(date)) return `Yesterday at ${format(date, 'HH:mm')}`
  return format(date, 'dd/MM/yyyy HH:mm')
}

function MessageMenu({ message, serverId, channelId, onClose }) {
  const { currentUser } = useAuth()
  const canModerate = message.uid === currentUser?.uid || isAdmin(currentUser, null)

  async function toggleImportant() {
    await updateDoc(
      doc(db, 'servers', serverId, 'channels', channelId, 'messages', message.id),
      { important: !message.important }
    )
    onClose()
  }

  async function togglePin() {
    await updateDoc(
      doc(db, 'servers', serverId, 'channels', channelId, 'messages', message.id),
      { pinned: !message.pinned }
    )
    onClose()
  }

  return (
    <div className="msg-context-menu" onClick={e => e.stopPropagation()}>
      <button className="msg-ctx-item" onClick={toggleImportant}>
        {message.important ? '🔕 Remove Importance' : '⚠️ Mark as Important'}
      </button>
      {canModerate && (
        <button className="msg-ctx-item" onClick={togglePin}>
          {message.pinned ? '📌 Unpin' : '📌 Pin Message'}
        </button>
      )}
    </div>
  )
}

export default function Message({ message, isFirst, prevMessage, serverId, channelId }) {
  const [showMenu, setShowMenu] = useState(false)
  const { openProfile } = useProfile()

  const sameAuthor = !isFirst &&
    prevMessage?.uid === message.uid &&
    message.createdAt && prevMessage?.createdAt &&
    (message.createdAt.toDate?.() - prevMessage.createdAt.toDate?.()) < 5 * 60 * 1000

  const fakeUser = {
    displayName: message.displayName,
    photoURL: message.photoURL || null,
    avatarEmoji: message.avatarEmoji || null,
    avatarBg: message.avatarBg || null,
    uid: message.uid,
  }

  const importantClass = message.important ? 'msg-important' : ''
  const pinnedClass = message.pinned ? 'msg-pinned' : ''

  function handleClick(e) {
    e.stopPropagation()
    setShowMenu(m => !m)
  }

  const menuEl = showMenu && (
    <MessageMenu
      message={message}
      serverId={serverId}
      channelId={channelId}
      onClose={() => setShowMenu(false)}
    />
  )

  if (sameAuthor) {
    return (
      <div
        className={`message-group continued ${importantClass} ${pinnedClass}`}
        onClick={handleClick}
      >
        {message.pinned && <span className="pin-label">📌 Pinned</span>}
        <span className="msg-ts-inline">{formatTimestamp(message.createdAt, true)}</span>
        <div className="msg-avatar"><Avatar user={fakeUser} size={40} /></div>
        <div className="msg-body">
          {message.content && <p className="msg-content">{message.content}</p>}
          {message.imageURL && (
            <img src={message.imageURL} alt="attachment" className="msg-image" onClick={() => window.open(message.imageURL, '_blank')} />
          )}
        </div>
        {message.important && <span className="importance-badge">⚠️ Important</span>}
        {menuEl}
      </div>
    )
  }

  return (
    <div
      className={`message-group first ${importantClass} ${pinnedClass}`}
      onClick={handleClick}
    >
      {message.pinned && <span className="pin-label">📌 Pinned</span>}
      <div className="msg-avatar"><Avatar user={fakeUser} size={40} /></div>
      <div className="msg-body">
        <div className="msg-header">
          {message.isAdmin && <span className="admin-tag">ADMIN</span>}
          <span
            className="msg-author"
            style={{ cursor: 'pointer' }}
            onClick={e => { e.stopPropagation(); openProfile(message.uid) }}
            title={`View ${message.displayName}'s profile`}
          >
            {message.displayName}
          </span>
          <span className="msg-ts">{formatTimestamp(message.createdAt)}</span>
        </div>
        {message.content && <p className="msg-content">{message.content}</p>}
        {message.imageURL && (
          <img src={message.imageURL} alt="attachment" className="msg-image" onClick={() => window.open(message.imageURL, '_blank')} />
        )}
      </div>
      {message.important && <span className="importance-badge">⚠️ Important</span>}
      {menuEl}
    </div>
  )
}
