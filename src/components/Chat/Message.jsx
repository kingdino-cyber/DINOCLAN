import { useState, useRef, useEffect } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useProfile } from '../../contexts/ProfileContext'
import { isAdmin } from '../../utils/admin'
import Avatar from './Avatar'

function formatTimestamp(ts, short = false) {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  if (short) return format(date, 'HH:mm')
  if (isToday(date))     return `Today at ${format(date, 'HH:mm')}`
  if (isYesterday(date)) return `Yesterday at ${format(date, 'HH:mm')}`
  return format(date, 'dd/MM/yyyy HH:mm')
}

/* ── Hover action bar shown on the right of every message ── */
function MessageActions({ message, serverId, channelId, onEdit, onDelete, canEdit, canDelete }) {
  const { currentUser } = useAuth()

  async function toggleImportant() {
    await updateDoc(
      doc(db, 'servers', serverId, 'channels', channelId, 'messages', message.id),
      { important: !message.important }
    )
  }

  async function togglePin() {
    if (!isAdmin(currentUser, null)) return
    await updateDoc(
      doc(db, 'servers', serverId, 'channels', channelId, 'messages', message.id),
      { pinned: !message.pinned }
    )
  }

  return (
    <div className="msg-action-bar" onClick={e => e.stopPropagation()}>
      <button className="msg-action-btn" onClick={toggleImportant}
        title={message.important ? 'Remove importance' : 'Mark important'}>
        {message.important ? '🔕' : '⚠️'}
      </button>
      {isAdmin(currentUser, null) && (
        <button className="msg-action-btn" onClick={togglePin}
          title={message.pinned ? 'Unpin' : 'Pin'}>
          📌
        </button>
      )}
      {canEdit && (
        <button className="msg-action-btn" onClick={onEdit} title="Edit message">
          ✏️
        </button>
      )}
      {canDelete && (
        <button className="msg-action-btn msg-action-delete" onClick={onDelete} title="Delete message">
          🗑️
        </button>
      )}
    </div>
  )
}

/* ── Inline edit input ── */
function EditBox({ original, messageRef, onDone }) {
  const [value, setValue] = useState(original)
  const textareaRef = useRef(null)

  useEffect(() => {
    textareaRef.current?.focus()
    textareaRef.current?.select()
  }, [])

  async function save() {
    const trimmed = value.trim()
    if (!trimmed || trimmed === original) { onDone(); return }
    await updateDoc(messageRef, { content: trimmed, edited: true })
    onDone()
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
    if (e.key === 'Escape') onDone()
  }

  return (
    <div className="msg-edit-box" onClick={e => e.stopPropagation()}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKey}
        rows={2}
        style={{
          width: '100%', background: 'var(--bg-tertiary)',
          border: '1.5px solid var(--accent)', borderRadius: 6,
          color: 'var(--text-normal)', fontSize: 14, padding: '6px 10px',
          resize: 'vertical', fontFamily: 'inherit', outline: 'none',
        }}
      />
      <div style={{ display: 'flex', gap: 6, marginTop: 4, fontSize: 12 }}>
        <button className="btn-confirm" style={{ padding: '3px 12px', fontSize: 12 }} onClick={save}>Save</button>
        <button className="btn-danger"  style={{ padding: '3px 12px', fontSize: 12 }} onClick={onDone}>Cancel</button>
        <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>Enter to save · Esc to cancel</span>
      </div>
    </div>
  )
}

/* ── Main Message component ── */
export default function Message({ message, isFirst, prevMessage, serverId, channelId }) {
  const { currentUser } = useAuth()
  const { openProfile } = useProfile()
  const [editing, setEditing] = useState(false)
  const [hovered, setHovered] = useState(false)

  const isOwn    = message.uid === currentUser?.uid
  const canEdit   = isOwn && !!message.content  // can't edit image-only messages
  const canDelete = isOwn || isAdmin(currentUser, null)

  const sameAuthor = !isFirst &&
    prevMessage?.uid === message.uid &&
    message.createdAt && prevMessage?.createdAt &&
    (message.createdAt.toDate?.() - prevMessage.createdAt.toDate?.()) < 5 * 60 * 1000

  const fakeUser = {
    displayName: message.displayName,
    photoURL:     message.photoURL    || null,
    avatarEmoji:  message.avatarEmoji || null,
    avatarBg:     message.avatarBg    || null,
    uid:          message.uid,
  }

  const importantClass = message.important ? 'msg-important' : ''
  const pinnedClass    = message.pinned    ? 'msg-pinned'    : ''
  const messageRef     = doc(db, 'servers', serverId, 'channels', channelId, 'messages', message.id)

  async function handleDelete(e) {
    e.stopPropagation()
    if (!window.confirm('Delete this message?')) return
    await deleteDoc(messageRef)
  }

  function handleAuthorClick(e) {
    e.stopPropagation()
    if (message.uid) openProfile(message.uid)
  }

  const actions = !editing && hovered && (
    <MessageActions
      message={message}
      serverId={serverId}
      channelId={channelId}
      canEdit={canEdit}
      canDelete={canDelete}
      onEdit={e => { e?.stopPropagation(); setEditing(true) }}
      onDelete={handleDelete}
    />
  )

  const body = (
    <>
      {message.content && !editing && (
        <p className="msg-content">
          {message.content}
          {message.edited && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>(edited)</span>}
        </p>
      )}
      {editing && (
        <EditBox
          original={message.content}
          messageRef={messageRef}
          onDone={() => setEditing(false)}
        />
      )}
      {message.imageURL && (
        <img src={message.imageURL} alt="attachment" className="msg-image"
          onClick={e => { e.stopPropagation(); window.open(message.imageURL, '_blank') }} />
      )}
    </>
  )

  if (sameAuthor) {
    return (
      <div
        className={`message-group continued ${importantClass} ${pinnedClass}`}
        style={{ position: 'relative' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {message.pinned && <span className="pin-label">📌 Pinned</span>}
        <span className="msg-ts-inline">{formatTimestamp(message.createdAt, true)}</span>
        <div className="msg-avatar"><Avatar user={fakeUser} size={40} /></div>
        <div className="msg-body">{body}</div>
        {message.important && <span className="importance-badge">⚠️ Important</span>}
        {actions}
      </div>
    )
  }

  return (
    <div
      className={`message-group first ${importantClass} ${pinnedClass}`}
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {message.pinned && <span className="pin-label">📌 Pinned</span>}
      <div className="msg-avatar"><Avatar user={fakeUser} size={40} /></div>
      <div className="msg-body">
        <div className="msg-header">
          {message.isAdmin && <span className="admin-tag">ADMIN</span>}
          <span
            className="msg-author"
            style={{ cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
            onClick={handleAuthorClick}
            title={`View ${message.displayName}'s profile`}
          >
            {message.displayName}
          </span>
          <span className="msg-ts">{formatTimestamp(message.createdAt)}</span>
        </div>
        {body}
      </div>
      {message.important && <span className="importance-badge">⚠️ Important</span>}
      {actions}
    </div>
  )
}
