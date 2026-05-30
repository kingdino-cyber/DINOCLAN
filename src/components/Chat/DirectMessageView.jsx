import { useEffect, useRef, useState } from 'react'
import {
  collection, query, orderBy, limitToLast, onSnapshot,
  addDoc, serverTimestamp, doc, onSnapshot as fsSnap,
  setDoc, updateDoc, deleteField,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { isOperator } from '../../utils/admin'
import { useCall } from '../../contexts/CallContext'
import { playMessageSound } from '../../utils/sounds'
import Avatar from './Avatar'
import { format, isToday, isYesterday } from 'date-fns'

const EMOJI_CATEGORIES = [
  { label: '🦕 Dino',     emojis: ['🦕','🦖','🐊','🦎','🐢','🥚','🦴','🌋','🏔️','🌿','🌴','🪨','💀','🔥','⚡','🌊','🥩','🦷','👣','🪺'] },
  { label: '😄 Happy',    emojis: ['😄','😁','😆','🥰','😍','🤩','😎','🥳','😊','😀','😂','🤣','😜','😝','🤗','😇','🙌','👏','🎉','🎊'] },
  { label: '👍 React',    emojis: ['👍','👎','❤️','💔','🔥','✅','❌','⭐','💯','💥','🎯','🤔','😮','😢','😡','👀','💀','🙏','🫡','🫶'] },
  { label: '🌿 Nature',   emojis: ['🌴','🌿','🍃','🌺','🌸','🌻','🍄','🐾','🌙','☀️','🌈','⛈️','❄️','🌊','🏝️','🌾','🦋','🐝','🐸','🌵'] },
]

function formatTs(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  if (isToday(d))     return `Today at ${format(d, 'HH:mm')}`
  if (isYesterday(d)) return `Yesterday at ${format(d, 'HH:mm')}`
  return format(d, 'dd/MM/yyyy HH:mm')
}

function getDmId(uid1, uid2) { return [uid1, uid2].sort().join('_') }

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
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

export default function DirectMessageView({ otherUid, onClose }) {
  const { currentUser } = useAuth()
  const { startDMCall, activeCall } = useCall()

  const [otherUser,    setOtherUser]    = useState(null)
  const [myData,       setMyData]       = useState(null)
  const [messages,     setMessages]     = useState([])
  const [text,         setText]         = useState('')
  const [sending,      setSending]      = useState(false)
  const [pendingImage, setPendingImage] = useState(null)
  const [showEmoji,    setShowEmoji]    = useState(false)
  const [emojiTab,     setEmojiTab]     = useState(0)
  const [otherTyping,  setOtherTyping]  = useState(false)

  const messagesRef   = useRef(null)   // scroll container
  const textareaRef   = useRef(null)
  const fileRef       = useRef(null)
  const emojiRef      = useRef(null)
  const isFirstLoad   = useRef(true)
  const prevCount     = useRef(0)
  const typingTimeout = useRef(null)

  const dmId = getDmId(currentUser.uid, otherUid)

  // ── Load other user ──
  useEffect(() => {
    const unsub = fsSnap(doc(db, 'users', otherUid), snap => {
      if (snap.exists()) setOtherUser({ uid: snap.id, ...snap.data() })
    })
    return unsub
  }, [otherUid])

  // ── Load my data ──
  useEffect(() => {
    const unsub = fsSnap(doc(db, 'users', currentUser.uid), snap => {
      if (snap.exists()) setMyData(snap.data())
    })
    return unsub
  }, [currentUser.uid])

  // ── Messages + auto-scroll ──
  useEffect(() => {
    isFirstLoad.current = true
    setMessages([])
    const q = query(
      collection(db, 'dms', dmId, 'messages'),
      orderBy('createdAt', 'asc'),
      limitToLast(200),
    )
    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setMessages(msgs)
      const isNew = msgs.length > prevCount.current
      prevCount.current = msgs.length

      if (isFirstLoad.current) {
        isFirstLoad.current = false
        // Instant scroll on first load
        setTimeout(() => scrollToBottom(), 60)
      } else {
        if (isNew) {
          const newest = msgs[msgs.length - 1]
          if (newest?.uid !== currentUser.uid) playMessageSound()
        }
        scrollToBottom(true)
      }
    })
    return unsub
  }, [dmId])

  function scrollToBottom(smooth = false) {
    const el = messagesRef.current
    if (!el) return
    if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    else        el.scrollTop = el.scrollHeight
  }

  // ── Typing indicator — watch other user ──
  useEffect(() => {
    const unsub = fsSnap(doc(db, 'dms', dmId), snap => {
      if (!snap.exists()) { setOtherTyping(false); return }
      const ts = snap.data()?.typing?.[otherUid]
      if (!ts) { setOtherTyping(false); return }
      const age = Date.now() - (ts.toDate ? ts.toDate() : new Date(ts)).getTime()
      setOtherTyping(age < 5000)
    })
    return unsub
  }, [dmId, otherUid])

  // ── Typing indicator — write mine ──
  function broadcastTyping() {
    setDoc(doc(db, 'dms', dmId), { typing: { [currentUser.uid]: serverTimestamp() } }, { merge: true }).catch(() => {})
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(clearTyping, 3000)
  }
  function clearTyping() {
    updateDoc(doc(db, 'dms', dmId), { [`typing.${currentUser.uid}`]: deleteField() }).catch(() => {})
  }
  // Clean up typing on unmount
  useEffect(() => () => { clearTyping(); clearTimeout(typingTimeout.current) }, [dmId])

  // ── Close emoji picker on outside click ──
  useEffect(() => {
    if (!showEmoji) return
    const handler = e => { if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showEmoji])

  // ── Helpers ──
  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  function insertEmoji(emoji) {
    const el = textareaRef.current
    if (!el) { setText(t => t + emoji); return }
    const start = el.selectionStart, end = el.selectionEnd
    const next = text.slice(0, start) + emoji + text.slice(end)
    setText(next)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + emoji.length, start + emoji.length)
      autoResize()
    }, 0)
    setShowEmoji(false)
  }

  async function handlePaste(e) {
    const items = Array.from(e.clipboardData?.items || [])
    const imageItem = items.find(i => i.type.startsWith('image/'))
    if (!imageItem) return
    e.preventDefault()
    const dataUrl = await compressImage(imageItem.getAsFile())
    setPendingImage(dataUrl)
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await compressImage(file)
    setPendingImage(dataUrl)
    e.target.value = ''
  }

  async function sendMessage() {
    const content = text.trim()
    if ((!content && !pendingImage) || sending) return
    setSending(true)
    const imageToSend = pendingImage
    setText('')
    setPendingImage(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    clearTyping()
    clearTimeout(typingTimeout.current)

    try {
      const senderName = myData?.displayName || currentUser.displayName || currentUser.email
      await addDoc(collection(db, 'dms', dmId, 'messages'), {
        content: content || '',
        uid: currentUser.uid,
        displayName: senderName,
        photoURL: myData?.photoURL || null,
        avatarEmoji: myData?.avatarEmoji || null,
        avatarBg: myData?.avatarBg || null,
        isAdmin: isOperator(currentUser),
        imageURL: imageToSend || null,
        createdAt: serverTimestamp(),
      })
      addDoc(collection(db, 'users', otherUid, 'notifications'), {
        fromUid: currentUser.uid,
        fromName: senderName,
        preview: content ? content.slice(0, 80) : '📷 Image',
        createdAt: serverTimestamp(),
        read: false,
      }).catch(() => {})
    } catch (err) {
      console.error('DM send failed', err)
    } finally {
      setSending(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const canSend = text.trim().length > 0 || !!pendingImage

  return (
    <div className="dm-view">
      {/* ── Header ── */}
      <div className="dm-header">
        <button className="dm-back-btn" onClick={onClose} title="Back">←</button>
        {otherUser && <Avatar user={otherUser} size={32} showStatus />}
        <span className="dm-header-name">{otherUser?.displayName || '...'}</span>
        <span className="dm-header-status">{otherUser?.status || 'offline'}</span>
        <div style={{ flex: 1 }} />
        <button
          className="dm-call-btn"
          onClick={() => startDMCall(otherUid, otherUser?.displayName || 'them')}
          disabled={!!activeCall}
          title={activeCall ? 'Already in a call' : `Call ${otherUser?.displayName}`}
        >📞</button>
      </div>

      {/* ── Messages ── */}
      <div className="dm-messages" ref={messagesRef}>
        {messages.length === 0 && (
          <div className="welcome-banner">
            <div className="welcome-icon">🦕</div>
            <h2>Start of your conversation with {otherUser?.displayName}!</h2>
            <p>Say hi 👋</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const prev   = messages[i - 1]
          const isSame = i > 0 && prev?.uid === msg.uid &&
            msg.createdAt && prev?.createdAt &&
            (msg.createdAt.toDate?.() - prev.createdAt.toDate?.()) < 5 * 60 * 1000
          const fakeUser = { displayName: msg.displayName, photoURL: msg.photoURL, avatarEmoji: msg.avatarEmoji, avatarBg: msg.avatarBg }
          return (
            <div key={msg.id} className={`message-group ${isSame ? 'continued' : 'first'}`}>
              {!isSame
                ? <div className="msg-avatar"><Avatar user={fakeUser} size={40} /></div>
                : <div className="msg-avatar" style={{ visibility: 'hidden' }}><Avatar user={fakeUser} size={40} /></div>
              }
              <div className="msg-body">
                {!isSame && (
                  <div className="msg-header">
                    {msg.isAdmin && <span className="admin-tag">ADMIN</span>}
                    <span className="msg-author">{msg.displayName}</span>
                    <span className="msg-ts">{formatTs(msg.createdAt)}</span>
                  </div>
                )}
                {msg.content && <p className="msg-content">{msg.content}</p>}
                {msg.imageURL && (
                  <img src={msg.imageURL} alt="attachment" className="msg-image"
                    onClick={() => window.open(msg.imageURL, '_blank')} />
                )}
              </div>
            </div>
          )
        })}

      </div>

      {/* ── Typing bar — sits between messages and input, always reserves space ── */}
      <div className="dm-typing-bar">
        {otherTyping && (
          <>
            <div className="dm-typing-dots">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
            <span className="dm-typing-bar-text">
              <strong>{otherUser?.displayName}</strong> is typing…
            </span>
          </>
        )}
      </div>

      {/* ── Input ── */}
      <div className="message-input-wrapper">
        {pendingImage && (
          <div className="pending-image-preview">
            <img src={pendingImage} alt="attachment" />
            <button className="pending-image-remove" onClick={() => setPendingImage(null)}>✕</button>
          </div>
        )}
        <div className="message-input-box">
          <button className="attach-btn" onClick={() => fileRef.current?.click()} title="Upload image">+</button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />

          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => { setText(e.target.value); autoResize(); broadcastTyping() }}
            onKeyDown={handleKey}
            onPaste={handlePaste}
            placeholder={`Message ${otherUser?.displayName || ''}…`}
            rows={1}
          />

          {/* Emoji picker */}
          <div className="emoji-picker-wrap" ref={emojiRef}>
            <button className="emoji-btn" onClick={() => setShowEmoji(s => !s)} title="Emoji">😊</button>
            {showEmoji && (
              <div className="emoji-panel">
                <div className="emoji-tabs">
                  {EMOJI_CATEGORIES.map((cat, i) => (
                    <button key={i} className={`emoji-tab-btn ${emojiTab === i ? 'active' : ''}`}
                      onClick={() => setEmojiTab(i)} title={cat.label}>
                      {cat.emojis[0]}
                    </button>
                  ))}
                </div>
                <div className="emoji-category-label">{EMOJI_CATEGORIES[emojiTab].label}</div>
                <div className="emoji-grid">
                  {EMOJI_CATEGORIES[emojiTab].emojis.map(em => (
                    <button key={em} className="emoji-item" onClick={() => insertEmoji(em)} title={em}>{em}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button className={`send-btn ${canSend ? 'active' : ''}`} onClick={sendMessage} disabled={!canSend || sending}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
