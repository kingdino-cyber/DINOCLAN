import { useEffect, useRef, useState } from 'react'
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, serverTimestamp, doc, onSnapshot as fsSnap,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { isOperator } from '../../utils/admin'
import { useCall } from '../../contexts/CallContext'
import { playMessageSound } from '../../utils/sounds'
import Avatar from './Avatar'
import { format, isToday, isYesterday } from 'date-fns'

function formatTs(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  if (isToday(d)) return `Today at ${format(d, 'HH:mm')}`
  if (isYesterday(d)) return `Yesterday at ${format(d, 'HH:mm')}`
  return format(d, 'dd/MM/yyyy HH:mm')
}

function getDmId(uid1, uid2) {
  return [uid1, uid2].sort().join('_')
}

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
  const [otherUser, setOtherUser] = useState(null)
  const [myData, setMyData] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [pendingImage, setPendingImage] = useState(null)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const fileRef = useRef(null)
  const isFirstLoad = useRef(true)
  const prevCountRef = useRef(0)

  const dmId = getDmId(currentUser.uid, otherUid)

  // Load other user
  useEffect(() => {
    const unsub = fsSnap(doc(db, 'users', otherUid), snap => {
      if (snap.exists()) setOtherUser({ uid: snap.id, ...snap.data() })
    })
    return unsub
  }, [otherUid])

  // Load my data
  useEffect(() => {
    const unsub = fsSnap(doc(db, 'users', currentUser.uid), snap => {
      if (snap.exists()) setMyData(snap.data())
    })
    return unsub
  }, [currentUser.uid])

  // Load messages
  useEffect(() => {
    isFirstLoad.current = true
    setMessages([])
    const q = query(
      collection(db, 'dms', dmId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100),
    )
    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setMessages(msgs)
      if (isFirstLoad.current) {
        isFirstLoad.current = false
        prevCountRef.current = msgs.length
        setTimeout(() => bottomRef.current?.scrollIntoView(), 50)
      } else {
        if (msgs.length > prevCountRef.current) {
          const newest = msgs[msgs.length - 1]
          if (newest?.uid && newest.uid !== currentUser?.uid) playMessageSound()
        }
        prevCountRef.current = msgs.length
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    })
    return unsub
  }, [dmId])

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
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
    try {
      await addDoc(collection(db, 'dms', dmId, 'messages'), {
        content: content || '',
        uid: currentUser.uid,
        displayName: myData?.displayName || currentUser.displayName || currentUser.email,
        photoURL: myData?.photoURL || null,
        avatarEmoji: myData?.avatarEmoji || null,
        avatarBg: myData?.avatarBg || null,
        isAdmin: isOperator(currentUser),
        imageURL: imageToSend || null,
        createdAt: serverTimestamp(),
      })
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
      {/* Header */}
      <div className="dm-header">
        <button className="dm-back-btn" onClick={onClose} title="Back to Friends">←</button>
        {otherUser && <Avatar user={otherUser} size={32} showStatus />}
        <span className="dm-header-name">{otherUser?.displayName || '...'}</span>
        <span className="dm-header-status">{otherUser?.status || 'offline'}</span>
        <div style={{ flex: 1 }} />
        <button
          className="dm-call-btn"
          onClick={() => startDMCall(otherUid, otherUser?.displayName || 'them')}
          disabled={!!activeCall}
          title={activeCall ? 'Already in a call' : `Call ${otherUser?.displayName}`}
        >
          📞
        </button>
      </div>

      {/* Messages */}
      <div className="dm-messages">
        {messages.length === 0 && (
          <div className="welcome-banner">
            <div className="welcome-icon">🦕</div>
            <h2>Start of your conversation with {otherUser?.displayName}!</h2>
            <p>Say hi 👋</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const prev = messages[i - 1]
          const isSame = i > 0 && prev?.uid === msg.uid &&
            msg.createdAt && prev?.createdAt &&
            (msg.createdAt.toDate?.() - prev.createdAt.toDate?.()) < 5 * 60 * 1000
          const fakeUser = { displayName: msg.displayName, photoURL: msg.photoURL, avatarEmoji: msg.avatarEmoji, avatarBg: msg.avatarBg }
          return (
            <div key={msg.id} className={`message-group ${isSame ? 'continued' : 'first'}`}>
              {!isSame && <div className="msg-avatar"><Avatar user={fakeUser} size={40} /></div>}
              {isSame && <div className="msg-avatar" style={{ visibility: 'hidden' }}><Avatar user={fakeUser} size={40} /></div>}
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
        <div ref={bottomRef} />
      </div>

      {/* Input */}
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
            onChange={e => { setText(e.target.value); autoResize() }}
            onKeyDown={handleKey}
            onPaste={handlePaste}
            placeholder={`Message ${otherUser?.displayName || ''}…`}
            rows={1}
          />
          <button
            className={`send-btn ${canSend ? 'active' : ''}`}
            onClick={sendMessage}
            disabled={!canSend || sending}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
