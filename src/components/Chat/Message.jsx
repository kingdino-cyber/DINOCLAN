import { useState, useRef, useEffect } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useProfile } from '../../contexts/ProfileContext'
import { isAdmin, SERVER_RANK_TAGS, GLOBAL_RANK_TAGS } from '../../utils/admin'
import Avatar from './Avatar'
import ChessPuzzle from './ChessPuzzle'
import ChessLive from './ChessLive'
import UnoGame from './UnoGame'

function parseMentions(content, currentUid) {
  if (!content || !content.includes('@[')) return content
  const parts = []
  let last = 0
  const re = /@\[([^:\]]+):([^\]]+)\]/g
  let m
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) parts.push(content.slice(last, m.index))
    const isMe = m[1] === currentUid
    parts.push(
      <span key={m.index} className={`mention-chip${isMe ? ' mention-me' : ''}`}>
        @{m[2]}
      </span>
    )
    last = m.index + m[0].length
  }
  if (last < content.length) parts.push(content.slice(last))
  return parts.length ? parts : content
}

function formatTimestamp(ts, short = false) {
  if (!ts) return ''
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  if (short) return format(date, 'HH:mm')
  if (isToday(date))     return `Today at ${format(date, 'HH:mm')}`
  if (isYesterday(date)) return `Yesterday at ${format(date, 'HH:mm')}`
  return format(date, 'dd/MM/yyyy HH:mm')
}

/* ── Rank tag chip ── */
function RankTag({ rank, type = 'server' }) {
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

/* ── System message (join / leave activity) ── */
function SystemMessage({ message }) {
  return (
    <div className="system-message">
      <span className="system-message-icon">📢</span>
      <span className="system-message-text">{message.content}</span>
      <span className="system-message-ts">{formatTimestamp(message.createdAt, true)}</span>
    </div>
  )
}

/* ── Bot message (swear jar) ── */
function BotMessage({ message }) {
  return (
    <div className="bot-message">
      <div className="bot-message-avatar">🤖</div>
      <div className="bot-message-body">
        <div className="bot-message-header">
          <span className="bot-message-name">{message.botName || 'Bot'}</span>
          <span className="bot-tag">APP</span>
          <span className="msg-ts">{formatTimestamp(message.createdAt)}</span>
        </div>
        <pre className="bot-message-content">{message.content}</pre>
      </div>
    </div>
  )
}

/* ── File attachment card ── */
function FileAttachment({ url, name, size, type }) {
  const [downloading, setDownloading] = useState(false)

  function formatSize(bytes) {
    if (!bytes) return ''
    if (bytes < 1024)           return `${bytes} B`
    if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function getIcon(t, n) {
    const ext = (n || '').split('.').pop().toLowerCase()
    if (ext === 'jar')  return '☕'
    if (ext === 'zip' || ext === 'rar' || ext === '7z') return '🗜️'
    if (ext === 'pdf')  return '📄'
    if (ext === 'doc' || ext === 'docx') return '📝'
    if (ext === 'xls' || ext === 'xlsx') return '📊'
    if (ext === 'ppt' || ext === 'pptx') return '📑'
    if (ext === 'mp4' || ext === 'mov' || ext === 'avi') return '🎬'
    if (ext === 'mp3' || ext === 'wav' || ext === 'ogg') return '🎵'
    if (ext === 'txt' || ext === 'md')  return '📃'
    if (!t) return '📎'
    if (t.includes('pdf'))   return '📄'
    if (t.includes('word') || t.includes('document')) return '📝'
    if (t.includes('sheet') || t.includes('excel'))   return '📊'
    if (t.includes('presentation') || t.includes('powerpoint')) return '📑'
    if (t.includes('zip') || t.includes('archive') || t.includes('java')) return '🗜️'
    if (t.includes('video'))  return '🎬'
    if (t.includes('audio'))  return '🎵'
    if (t.includes('text'))   return '📃'
    return '📎'
  }

  async function handleDownload(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!url) return
    // data: URLs work fine with <a download> — just trigger it directly
    if (url.startsWith('data:')) {
      const a = document.createElement('a')
      a.href = url
      a.download = name || 'file'
      a.click()
      return
    }
    // Cross-origin Storage URLs: fetch as blob so the browser saves instead of navigating
    setDownloading(true)
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = name || 'file'
      a.click()
      setTimeout(() => URL.revokeObjectURL(objUrl), 10000)
    } catch {
      // Fallback: open in new tab
      window.open(url, '_blank')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      className="file-attachment"
      onClick={handleDownload}
      style={{ cursor: downloading ? 'wait' : 'pointer' }}
    >
      <span className="file-attach-icon">{getIcon(type, name)}</span>
      <div className="file-attach-info">
        <span className="file-attach-name">{name || 'File'}</span>
        {size > 0 && <span className="file-attach-size">{formatSize(size)}</span>}
      </div>
      <span className="file-attach-dl" title="Download">{downloading ? '⏳' : '⬇️'}</span>
    </div>
  )
}

/* ── Poll message ── */
function PollMessage({ message, messageRef }) {
  const { currentUser } = useAuth()
  const [showResults, setShowResults] = useState(false)
  const votes      = message.pollVotes || {}
  const voterNames = message.pollVoterNames || {}
  const mode       = message.pollMode || 'single'
  const maxSelect  = message.pollMaxSelect || 1
  const isCreator  = message.uid === currentUser?.uid

  const totalVotes = Object.values(votes).reduce(
    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0
  )

  const myVotes = (message.pollOptions || [])
    .map((_, i) => i)
    .filter(i => Array.isArray(votes[String(i)]) && votes[String(i)].includes(currentUser?.uid))

  async function vote(index) {
    if (!currentUser?.uid) return
    const updates = {}
    const myName = currentUser.displayName || currentUser.email || 'Someone'
    const alreadyVoted = myVotes.includes(index)

    if (alreadyVoted) {
      updates[`pollVotes.${index}`] = arrayRemove(currentUser.uid)
    } else if (mode === 'single') {
      myVotes.forEach(i => { updates[`pollVotes.${i}`] = arrayRemove(currentUser.uid) })
      updates[`pollVotes.${index}`] = arrayUnion(currentUser.uid)
      updates[`pollVoterNames.${currentUser.uid}`] = myName
    } else {
      if (myVotes.length >= maxSelect) return // at the multi-select cap
      updates[`pollVotes.${index}`] = arrayUnion(currentUser.uid)
      updates[`pollVoterNames.${currentUser.uid}`] = myName
    }
    await updateDoc(messageRef, updates)
  }

  return (
    <div className="poll-message">
      <div className="poll-question">
        📊 {message.pollQuestion}
        {mode === 'multiple' && <span className="poll-mode-tag">pick up to {maxSelect}</span>}
      </div>
      {(message.pollOptions || []).map((option, i) => {
        const voterUids = Array.isArray(votes[String(i)]) ? votes[String(i)] : []
        const count  = voterUids.length
        const pct    = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
        const voted  = myVotes.includes(i)
        const atCap  = mode === 'multiple' && !voted && myVotes.length >= maxSelect
        return (
          <div key={i}>
            <button
              className={`poll-option-btn ${voted ? 'voted' : ''} ${atCap ? 'at-cap' : ''}`}
              onClick={() => vote(i)}
              title={atCap ? `You can only pick up to ${maxSelect} — deselect one first` : undefined}
            >
              <div className="poll-option-top">
                <span className="poll-option-text">{option}</span>
                <span className="poll-option-count">{count} {count === 1 ? 'vote' : 'votes'} · {pct}%</span>
              </div>
              <div className="poll-bar">
                <div className="poll-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </button>
            {showResults && isCreator && (
              <div className="poll-voter-list">
                {voterUids.length === 0
                  ? <span className="poll-voter-empty">No votes yet</span>
                  : voterUids.map(uid => (
                      <span key={uid} className="poll-voter-chip">{voterNames[uid] || 'Unknown'}</span>
                    ))
                }
              </div>
            )}
          </div>
        )
      })}
      <div className="poll-total">
        {totalVotes} total {totalVotes === 1 ? 'vote' : 'votes'}
        {isCreator && (
          <button className="poll-see-more" onClick={() => setShowResults(s => !s)}>
            {showResults ? 'See less' : 'See more'}
          </button>
        )}
      </div>
    </div>
  )
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

/* ── Reaction chips shown below a message — anyone (even in viewing channels) can react ── */
function ReactionBar({ message, messageRef }) {
  const { currentUser } = useAuth()
  const reactions = message.reactions || {}
  const entries = Object.entries(reactions).filter(([, uids]) => Array.isArray(uids) && uids.length > 0)
  if (entries.length === 0) return null

  async function toggle(emoji, uids) {
    const mine = uids.includes(currentUser?.uid)
    await updateDoc(messageRef, {
      [`reactions.${emoji}`]: mine ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
    })
  }

  return (
    <div className="reaction-bar" onClick={e => e.stopPropagation()}>
      {entries.map(([emoji, uids]) => (
        <button
          key={emoji}
          className={`reaction-chip ${uids.includes(currentUser?.uid) ? 'mine' : ''}`}
          onClick={() => toggle(emoji, uids)}
          title={`${uids.length} reacted`}
        >
          {emoji} <span className="reaction-count">{uids.length}</span>
        </button>
      ))}
    </div>
  )
}

/* ── Hover action bar ── */
function MessageActions({ message, serverId, channelId, onEdit, onDelete, onReply, canEdit, canDelete }) {
  const { currentUser } = useAuth()
  const [showReactPicker, setShowReactPicker] = useState(false)
  const messageRef = doc(db, 'servers', serverId, 'channels', channelId, 'messages', message.id)

  async function addReaction(emoji) {
    setShowReactPicker(false)
    const uids = message.reactions?.[emoji] || []
    const mine = uids.includes(currentUser?.uid)
    await updateDoc(messageRef, {
      [`reactions.${emoji}`]: mine ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
    })
  }

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
      <div style={{ position: 'relative' }}>
        <button className="msg-action-btn" onClick={() => setShowReactPicker(s => !s)} title="Add reaction">
          😊
        </button>
        {showReactPicker && (
          <div className="quick-react-popover" onMouseLeave={() => setShowReactPicker(false)}>
            {QUICK_REACTIONS.map(emoji => (
              <button key={emoji} className="quick-react-item" onClick={() => addReaction(emoji)}>{emoji}</button>
            ))}
          </div>
        )}
      </div>
      {onReply && (
        <button className="msg-action-btn" onClick={() => onReply(message)} title="Reply">
          ↩️
        </button>
      )}
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

/* ── Reply quote line — Discord-style connector above the message row ── */
function ReplyQuote({ replyTo, onJump }) {
  if (!replyTo) return null
  const preview = replyTo.content
    ? replyTo.content.slice(0, 120)
    : replyTo.imageURL ? '📷 Image' : '📎 Attachment'
  return (
    <div className="reply-quote-line" onClick={onJump}>
      <span className="reply-connector" />
      <span className="reply-quote-line-author">{replyTo.displayName}</span>
      <span className="reply-quote-line-text">{preview}</span>
    </div>
  )
}

/* ── Main Message component ── */
export default function Message({ message, isFirst, prevMessage, serverId, channelId, onReply }) {
  const { currentUser } = useAuth()
  const { openProfile } = useProfile()
  const [editing, setEditing] = useState(false)
  const [hovered, setHovered] = useState(false)

  // Special message types
  if (message.type === 'system') return <SystemMessage message={message} />
  if (message.type === 'bot')    return <BotMessage message={message} />

  const isPoll    = message.type === 'poll'
  const isOwn     = message.uid === currentUser?.uid
  const canEdit   = isOwn && !!message.content && !isPoll && message.type !== 'chess'
  const canDelete = isOwn || isAdmin(currentUser, null)

  const sameAuthor = !isFirst &&
    prevMessage?.uid === message.uid &&
    prevMessage?.type !== 'system' &&
    prevMessage?.type !== 'bot' &&
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

  // Rank tags — prefer new fields, fall back to legacy isAdmin flag
  const serverRankTag = message.serverRank && message.serverRank !== 'member'
    ? <RankTag rank={message.serverRank} type="server" />
    : null
  const globalRankTag = message.globalRank && message.globalRank !== 'user'
    ? <RankTag rank={message.globalRank} type="global" />
    : (!message.globalRank && message.isAdmin)
      ? <RankTag rank="admin" type="global" />
      : null

  async function handleDelete(e) {
    e.stopPropagation()
    if (!window.confirm('Delete this message?')) return
    await deleteDoc(messageRef)
  }

  function handleAuthorClick(e) {
    e.stopPropagation()
    if (message.uid) openProfile(message.uid)
  }

  const isChess     = message.type === 'chess'
  const isChessLive = message.type === 'chess-live'
  const isUno       = message.type === 'uno'

  const actions = !editing && hovered && (
    <MessageActions
      message={message}
      serverId={serverId}
      channelId={channelId}
      canEdit={canEdit}
      canDelete={canDelete}
      onReply={!isPoll && !isChess && !isChessLive && !isUno ? onReply : null}
      onEdit={e => { e?.stopPropagation(); setEditing(true) }}
      onDelete={handleDelete}
    />
  )

  function jumpToReplied(e) {
    e.stopPropagation()
    const id = message.replyTo?.messageId
    if (!id) return
    const el = document.querySelector(`[data-message-id="${id}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('msg-flash')
      setTimeout(() => el.classList.remove('msg-flash'), 1500)
    }
  }

  const body = (
    <>
      {isPoll ? (
        <PollMessage message={message} messageRef={messageRef} />
      ) : isChess ? (
        <>
          {message.content && (
            <p className="msg-content">{parseMentions(message.content, currentUser?.uid)}</p>
          )}
          <ChessPuzzle puzzle={message.chessPuzzle || {}} />
          <ReactionBar message={message} messageRef={messageRef} />
        </>
      ) : isChessLive ? (
        <ChessLive messageRef={messageRef} initialData={message} />
      ) : isUno ? (
        <UnoGame messageRef={messageRef} initialData={message} />
      ) : (
        <>
          {message.content && !editing && (
            <p className="msg-content">
              {parseMentions(message.content, currentUser?.uid)}
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
          {message.fileData && (
            <FileAttachment
              url={message.fileData}
              name={message.fileName}
              size={message.fileSize}
              type={message.fileType}
            />
          )}
          {/* Firebase Storage file */}
          {message.fileURL && !message.fileData && (
            <FileAttachment
              url={message.fileURL}
              name={message.fileName}
              size={message.fileSize}
              type={message.fileType}
            />
          )}
          <ReactionBar message={message} messageRef={messageRef} />
        </>
      )}
    </>
  )

  if (sameAuthor) {
    return (
      <div
        className={`message-group continued ${importantClass} ${pinnedClass}`}
        style={{ position: 'relative' }}
        data-message-id={message.id}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {message.pinned && <span className="pin-label">📌 Pinned</span>}
        {message.replyTo && <ReplyQuote replyTo={message.replyTo} onJump={jumpToReplied} />}
        <div className="msg-row">
          <span className="msg-ts-inline">{formatTimestamp(message.createdAt, true)}</span>
          <div className="msg-avatar"><Avatar user={fakeUser} size={40} /></div>
          <div className="msg-body">{body}</div>
          {message.important && <span className="importance-badge">⚠️ Important</span>}
          {actions}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`message-group first ${importantClass} ${pinnedClass}`}
      style={{ position: 'relative' }}
      data-message-id={message.id}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {message.pinned && <span className="pin-label">📌 Pinned</span>}
      {message.replyTo && <ReplyQuote replyTo={message.replyTo} onJump={jumpToReplied} />}
      <div className="msg-row">
        <div className="msg-avatar"><Avatar user={fakeUser} size={40} /></div>
        <div className="msg-body">
          <div className="msg-header">
            {serverRankTag}
            {globalRankTag}
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
    </div>
  )
}
