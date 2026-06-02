import { useState, useRef, useEffect } from 'react'
import {
  addDoc, collection, serverTimestamp, doc, onSnapshot,
  updateDoc, setDoc, deleteField, getDocs, getDoc, increment,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { isOperator, getServerRank, getGlobalRank, countSwears } from '../../utils/admin'

const EMOJI_CATEGORIES = [
  {
    label: '🦕 Dino',
    emojis: ['🦕','🦖','🐊','🦎','🐢','🥚','🦴','🌋','🏔️','🌿','🌴','🪨','💀','🔥','⚡','🌊','🥩','🦷','👣','🪺'],
  },
  {
    label: '😄 Happy',
    emojis: ['😄','😁','😆','🥰','😍','🤩','😎','🥳','😊','😀','😂','🤣','😜','😝','🤗','😇','🙌','👏','🎉','🎊'],
  },
  {
    label: '👍 Reactions',
    emojis: ['👍','👎','❤️','💔','🔥','✅','❌','⭐','💯','💥','🎯','🤔','😮','😢','😡','👀','💀','🙏','🫡','🫶'],
  },
  {
    label: '🌿 Nature',
    emojis: ['🌴','🌿','🍃','🌺','🌸','🌻','🍄','🐾','🌙','☀️','🌈','⛈️','❄️','🌊','🏝️','🌾','🦋','🐝','🐸','🌵'],
  },
]

// Compress images before attaching (keeps Firestore docs small)
function compressImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const MAX = 800
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX }
          else { width = Math.round(width * MAX / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

// Read any file as a base64 data-URL (for non-image attachments)
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024)           return `${bytes} B`
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Max raw size for non-image attachments stored as base64 in Firestore
const MAX_FILE_BYTES = 700 * 1024   // ~700 KB raw ≈ ~930 KB base64

export default function MessageInput({ serverId, channelId, channelName, server }) {
  const { currentUser } = useAuth()

  // ── ALL hooks must come before any conditional return (Rules of Hooks) ────
  const [text,            setText]            = useState('')
  const [sending,         setSending]         = useState(false)
  const [sendError,       setSendError]       = useState('')
  const [userData,        setUserData]        = useState(null)
  const [pendingImage,    setPendingImage]    = useState(null)   // base64 data-URL
  const [pendingFile,     setPendingFile]     = useState(null)   // { dataUrl, name, size, type }
  const [showEmoji,       setShowEmoji]       = useState(false)
  const [emojiTab,        setEmojiTab]        = useState(0)
  const [typingNames,     setTypingNames]     = useState([])
  const [swearJarEnabled, setSwearJarEnabled] = useState(false)

  // Poll creation state
  const [showPoll,     setShowPoll]     = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions,  setPollOptions]  = useState(['', ''])

  const textareaRef      = useRef(null)
  const fileRef          = useRef(null)
  const emojiRef         = useRef(null)
  const typingTimeoutRef = useRef(null)

  // Load current user's profile
  useEffect(() => {
    if (!currentUser?.uid) return
    const unsub = onSnapshot(doc(db, 'users', currentUser.uid), snap => {
      if (snap.exists()) setUserData(snap.data())
    })
    return unsub
  }, [currentUser?.uid])

  // Watch channel doc for typing status + swear jar enabled
  useEffect(() => {
    if (!serverId || !channelId || !currentUser?.uid) return
    const unsub = onSnapshot(doc(db, 'servers', serverId, 'channels', channelId), snap => {
      if (!snap.exists()) { setTypingNames([]); setSwearJarEnabled(false); return }
      const data = snap.data()
      setSwearJarEnabled(!!data?.swearJarEnabled)
      const typing = data?.typing || {}
      const now = Date.now()
      const active = Object.entries(typing)
        .filter(([uid, val]) => uid !== currentUser.uid && (now - (val?.at || 0)) < 5000)
        .map(([, val]) => val?.name || 'Someone')
      setTypingNames(active)
    })
    return unsub
  }, [serverId, channelId, currentUser?.uid])

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmoji) return
    function handler(e) {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showEmoji])

  // Clear typing on channel change / unmount
  useEffect(() => {
    return () => {
      clearTyping()
      clearTimeout(typingTimeoutRef.current)
    }
  }, [serverId, channelId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Typing helpers ────────────────────────────────────────────────────────
  function broadcastTyping() {
    if (!serverId || !channelId || !currentUser?.uid) return
    const name = userData?.displayName || currentUser?.displayName || 'Someone'
    updateDoc(doc(db, 'servers', serverId, 'channels', channelId), {
      [`typing.${currentUser.uid}`]: { name, at: Date.now() },
    }).catch(() => {
      setDoc(doc(db, 'servers', serverId, 'channels', channelId), {
        typing: { [currentUser.uid]: { name, at: Date.now() } },
      }, { merge: true }).catch(() => {})
    })
    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(clearTyping, 3000)
  }

  function clearTyping() {
    if (!serverId || !channelId || !currentUser?.uid) return
    updateDoc(doc(db, 'servers', serverId, 'channels', channelId), {
      [`typing.${currentUser.uid}`]: deleteField(),
    }).catch(() => {})
  }

  // ── Permission check — AFTER all hooks ───────────────────────────────────
  const isViewing = server?.type === 'viewing'
  const canPost = !isViewing
    || isOperator(currentUser)
    || server?.ownerId === currentUser?.uid
    || server?.editors?.includes(currentUser?.uid)

  if (!canPost) {
    return (
      <div className="message-input-wrapper">
        <div className="viewing-locked">
          👁️ This is a viewing-only server. Only permitted members can post.
        </div>
      </div>
    )
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  function insertEmoji(emoji) {
    const el = textareaRef.current
    if (!el) { setText(t => t + emoji); return }
    const start = el.selectionStart
    const end   = el.selectionEnd
    const next  = text.slice(0, start) + emoji + text.slice(end)
    setText(next)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + emoji.length, start + emoji.length)
      autoResize()
    }, 0)
  }

  async function handlePaste(e) {
    const items     = Array.from(e.clipboardData?.items || [])
    const imageItem = items.find(i => i.type.startsWith('image/'))
    if (!imageItem) return
    e.preventDefault()
    const dataUrl = await compressImage(imageItem.getAsFile())
    setPendingImage(dataUrl)
    setPendingFile(null)
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (file.type.startsWith('image/')) {
      const dataUrl = await compressImage(file)
      setPendingImage(dataUrl)
      setPendingFile(null)
    } else {
      if (file.size > MAX_FILE_BYTES) {
        setSendError(`File too large — max ${Math.round(MAX_FILE_BYTES / 1024)} KB. Share a link for bigger files.`)
        setTimeout(() => setSendError(''), 5000)
        return
      }
      const dataUrl = await readFileAsDataURL(file)
      setPendingFile({ dataUrl, name: file.name, size: file.size, type: file.type })
      setPendingImage(null)
    }
  }

  // ── Notify all other server members (fire-and-forget) ────────────────────
  function notifyMembers(preview) {
    const members    = server?.members || []
    const senderName = userData?.displayName || currentUser.displayName || currentUser.email
    members
      .filter(uid => uid !== currentUser.uid)
      .forEach(uid => {
        addDoc(collection(db, 'users', uid, 'notifications'), {
          type:        'server',
          fromUid:     currentUser.uid,
          fromName:    senderName,
          serverId,
          channelId,
          serverName:  server?.name   || 'Server',
          channelName: channelName    || 'channel',
          preview,
          createdAt:   serverTimestamp(),
          read:        false,
        }).catch(() => {})
      })
  }

  // ── Post a bot message (swear jar) ────────────────────────────────────────
  async function postBotMessage(content, botName = 'swear jar') {
    await addDoc(
      collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
      {
        type:      'bot',
        botName,
        content,
        createdAt: serverTimestamp(),
      }
    )
  }

  // ── Swear jar: record swear and post bot message ──────────────────────────
  async function handleSwearJar(messageContent) {
    if (!swearJarEnabled || !messageContent) return
    const n = countSwears(messageContent)
    if (n === 0) return
    const senderName = userData?.displayName || currentUser.displayName || currentUser.email
    const countRef = doc(db, 'servers', serverId, 'channels', channelId, 'swearCounts', currentUser.uid)
    // Upsert: create doc if missing, increment count otherwise
    await setDoc(countRef, {
      uid: currentUser.uid,
      displayName: senderName,
      count: increment(n),
    }, { merge: true })
    // Read the updated total
    const snap = await getDoc(countRef)
    const total = snap.exists() ? (snap.data().count || n) : n
    await postBotMessage(
      `🫙 ${senderName} now has ${total} swear${total === 1 ? '' : 's'}.`
    )
  }

  // ── /leaderboard command ──────────────────────────────────────────────────
  async function handleLeaderboard() {
    try {
      const countsSnap = await getDocs(
        collection(db, 'servers', serverId, 'channels', channelId, 'swearCounts')
      )
      const entries = countsSnap.docs
        .map(d => d.data())
        .sort((a, b) => (b.count || 0) - (a.count || 0))

      let leaderboard
      if (entries.length === 0) {
        leaderboard = 'No swears recorded yet!'
      } else {
        const medals = ['🥇', '🥈', '🥉']
        leaderboard = entries
          .map((e, i) => `${medals[i] || `${i + 1}.`} ${e.displayName}: ${e.count || 0} swear${(e.count || 0) === 1 ? '' : 's'}`)
          .join('\n')
      }
      await postBotMessage(`🤬 Swear Jar Leaderboard 🫙\n\n${leaderboard}`)
    } catch (err) {
      console.error('Leaderboard error:', err)
    }
  }

  // ── Send regular message ──────────────────────────────────────────────────
  async function sendMessage() {
    const content = text.trim()

    // /leaderboard slash command
    if (content.toLowerCase() === '/leaderboard' && serverId && channelId) {
      setText('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      clearTyping()
      clearTimeout(typingTimeoutRef.current)
      await handleLeaderboard()
      return
    }

    if ((!content && !pendingImage && !pendingFile) || sending) return
    setSending(true)
    setSendError('')

    const savedText   = text
    const imageToSend = pendingImage
    const fileToSend  = pendingFile

    // Optimistically clear input
    setText('')
    setPendingImage(null)
    setPendingFile(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    clearTyping()
    clearTimeout(typingTimeoutRef.current)

    try {
      const senderName  = userData?.displayName || currentUser.displayName || currentUser.email
      const serverRank  = getServerRank(server, currentUser.uid)
      const globalRank  = getGlobalRank({ ...userData, email: currentUser.email })

      await addDoc(
        collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
        {
          content:     content || '',
          uid:         currentUser.uid,
          displayName: senderName,
          photoURL:    userData?.photoURL    || null,
          avatarEmoji: userData?.avatarEmoji || null,
          avatarBg:    userData?.avatarBg    || null,
          isAdmin:     isOperator(currentUser),
          serverRank,
          globalRank,
          imageURL:    imageToSend            || null,
          fileData:    fileToSend?.dataUrl   || null,
          fileName:    fileToSend?.name      || null,
          fileSize:    fileToSend?.size      || null,
          fileType:    fileToSend?.type      || null,
          createdAt:   serverTimestamp(),
        }
      )

      // Swear jar detection (fire-and-forget)
      if (content && swearJarEnabled) {
        handleSwearJar(content).catch(() => {})
      }

      // Notify other members (fire-and-forget)
      const preview = content
        ? content.slice(0, 80)
        : imageToSend
          ? '📷 Image'
          : `📎 ${fileToSend?.name}`
      notifyMembers(preview)

    } catch (err) {
      console.error('Failed to send message:', err.code, err.message)
      setText(savedText)
      setPendingImage(imageToSend)
      setPendingFile(fileToSend)
      setSendError('Failed to send — check your connection and try again.')
      setTimeout(() => setSendError(''), 4000)
    } finally {
      setSending(false)
    }
  }

  // ── Send poll ─────────────────────────────────────────────────────────────
  async function sendPoll() {
    const opts = pollOptions.map(o => o.trim()).filter(Boolean)
    if (!pollQuestion.trim() || opts.length < 2) return
    setSending(true)
    try {
      const senderName = userData?.displayName || currentUser.displayName || currentUser.email
      await addDoc(
        collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
        {
          type:         'poll',
          uid:          currentUser.uid,
          displayName:  senderName,
          photoURL:     userData?.photoURL    || null,
          avatarEmoji:  userData?.avatarEmoji || null,
          avatarBg:     userData?.avatarBg    || null,
          pollQuestion: pollQuestion.trim(),
          pollOptions:  opts,
          pollVotes:    {},
          createdAt:    serverTimestamp(),
        }
      )
      notifyMembers(`📊 ${pollQuestion.trim()}`)
      setShowPoll(false)
      setPollQuestion('')
      setPollOptions(['', ''])
    } catch (err) {
      console.error('Failed to send poll:', err)
      setSendError('Failed to create poll.')
      setTimeout(() => setSendError(''), 4000)
    } finally {
      setSending(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const canSend = text.trim().length > 0 || !!pendingImage || !!pendingFile

  // Build typing label
  let typingText = ''
  if (typingNames.length === 1)      typingText = `${typingNames[0]} is typing…`
  else if (typingNames.length === 2) typingText = `${typingNames[0]} and ${typingNames[1]} are typing…`
  else if (typingNames.length >= 3)  typingText = 'Several people are typing…'

  return (
    <>
      {/* ── Send error banner ── */}
      {sendError && (
        <div style={{
          background: 'rgba(237,66,69,.15)', border: '1px solid var(--danger)',
          borderRadius: 6, padding: '6px 14px', margin: '0 16px 4px',
          fontSize: 12, color: '#ed4245', flexShrink: 0,
        }}>
          ⚠️ {sendError}
        </div>
      )}

      {/* ── Swear jar indicator ── */}
      {swearJarEnabled && (
        <div style={{
          padding: '2px 16px', fontSize: 11, color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          🫙 Swear Jar is active · type <code style={{ background: 'var(--bg-tertiary)', padding: '0 4px', borderRadius: 3 }}>/leaderboard</code> to see the rankings
        </div>
      )}

      {/* ── Poll creation panel ── */}
      {showPoll && (
        <div className="poll-create-panel">
          <div className="poll-create-header">
            <span>📊 Create a Poll</span>
            <button className="poll-create-close" onClick={() => setShowPoll(false)}>✕</button>
          </div>
          <input
            className="poll-create-input"
            placeholder="Ask a question…"
            value={pollQuestion}
            onChange={e => setPollQuestion(e.target.value)}
            maxLength={200}
          />
          <div className="poll-options-list">
            {pollOptions.map((opt, i) => (
              <div key={i} className="poll-option-row">
                <input
                  className="poll-create-input"
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  onChange={e => {
                    const next = [...pollOptions]
                    next[i] = e.target.value
                    setPollOptions(next)
                  }}
                  maxLength={100}
                />
                {pollOptions.length > 2 && (
                  <button
                    className="poll-remove-opt"
                    onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                    title="Remove option"
                  >✕</button>
                )}
              </div>
            ))}
          </div>
          <div className="poll-create-actions">
            {pollOptions.length < 4 && (
              <button className="poll-add-opt-btn" onClick={() => setPollOptions([...pollOptions, ''])}>
                + Add option
              </button>
            )}
            <button
              className="poll-send-btn"
              onClick={sendPoll}
              disabled={sending || !pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
            >
              Create Poll
            </button>
          </div>
        </div>
      )}

      {/* ── Typing bar ── */}
      <div className="dm-typing-bar">
        {typingNames.length > 0 && (
          <>
            <div className="dm-typing-dots">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
            <span className="dm-typing-bar-text">{typingText}</span>
          </>
        )}
      </div>

      {/* ── Input area ── */}
      <div className="message-input-wrapper">
        {/* Pending image preview */}
        {pendingImage && (
          <div className="pending-image-preview">
            <img src={pendingImage} alt="attachment" />
            <button className="pending-image-remove" onClick={() => setPendingImage(null)} title="Remove">✕</button>
          </div>
        )}

        {/* Pending file preview */}
        {pendingFile && (
          <div className="pending-file-preview">
            <span className="pending-file-icon">📎</span>
            <span className="pending-file-name">{pendingFile.name}</span>
            <span className="pending-file-size">{formatFileSize(pendingFile.size)}</span>
            <button className="pending-image-remove" onClick={() => setPendingFile(null)} title="Remove">✕</button>
          </div>
        )}

        <div className="message-input-box">
          <button
            className="attach-btn"
            onClick={() => fileRef.current?.click()}
            title="Attach file"
          >+</button>
          <input
            ref={fileRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />

          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => { setText(e.target.value); autoResize(); broadcastTyping() }}
            onKeyDown={handleKey}
            onPaste={handlePaste}
            placeholder={`Message #${channelName}`}
            rows={1}
          />

          {/* Poll button */}
          <button
            className="poll-btn"
            onClick={() => { setShowPoll(s => !s); setPollQuestion(''); setPollOptions(['', '']) }}
            title="Create a poll"
          >📊</button>

          {/* Emoji picker */}
          <div className="emoji-picker-wrap" ref={emojiRef}>
            <button className="emoji-btn" onClick={() => setShowEmoji(s => !s)} title="Emoji picker">😊</button>
            {showEmoji && (
              <div className="emoji-panel">
                <div className="emoji-tabs">
                  {EMOJI_CATEGORIES.map((cat, i) => (
                    <button
                      key={i}
                      className={`emoji-tab-btn ${emojiTab === i ? 'active' : ''}`}
                      onClick={() => setEmojiTab(i)}
                      title={cat.label}
                    >{cat.emojis[0]}</button>
                  ))}
                </div>
                <div className="emoji-category-label">{EMOJI_CATEGORIES[emojiTab].label}</div>
                <div className="emoji-grid">
                  {EMOJI_CATEGORIES[emojiTab].emojis.map(em => (
                    <button
                      key={em}
                      className="emoji-item"
                      onClick={() => { insertEmoji(em); setShowEmoji(false) }}
                      title={em}
                    >{em}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            className={`send-btn ${canSend ? 'active' : ''}`}
            onClick={sendMessage}
            disabled={!canSend || sending}
            title="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}
