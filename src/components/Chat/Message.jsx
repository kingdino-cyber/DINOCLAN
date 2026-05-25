import { format, isToday, isYesterday } from 'date-fns'
import Avatar from './Avatar'

function formatTimestamp(ts, short = false) {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  if (short) return format(date, 'HH:mm')
  if (isToday(date)) return `Today at ${format(date, 'HH:mm')}`
  if (isYesterday(date)) return `Yesterday at ${format(date, 'HH:mm')}`
  return format(date, 'dd/MM/yyyy HH:mm')
}

export default function Message({ message, isFirst, prevMessage }) {
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

  if (sameAuthor) {
    return (
      <div className="message-group continued">
        <span className="msg-ts-inline">{formatTimestamp(message.createdAt, true)}</span>
        <div className="msg-avatar">
          <Avatar user={fakeUser} size={40} />
        </div>
        <div className="msg-body">
          <p className="msg-content">{message.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`message-group first`}>
      <div className="msg-avatar">
        <Avatar user={fakeUser} size={40} />
      </div>
      <div className="msg-body">
        <div className="msg-header">
          <span className="msg-author">{message.displayName}</span>
          <span className="msg-ts">{formatTimestamp(message.createdAt)}</span>
        </div>
        <p className="msg-content">{message.content}</p>
      </div>
    </div>
  )
}
