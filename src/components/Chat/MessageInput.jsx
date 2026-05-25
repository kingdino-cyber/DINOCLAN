import { useState, useRef, useEffect } from 'react'
import { addDoc, collection, serverTimestamp, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { isOperator } from '../../utils/admin'

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

export default function MessageInput({ serverId, channelId, channelName }) {
  const { currentUser } = useAuth()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [userData, setUserData] = useState(null)
  const [pendingImage, setPendingImage] = useState(null)
  const textareaRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!currentUser?.uid) return
    const unsub = onSnapshot(doc(db, 'users', currentUser.uid), snap => {
      if (snap.exists()) setUserData(snap.data())
    })
    return unsub
  }, [currentUser?.uid])

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
    const file = imageItem.getAsFile()
    const dataUrl = await compressImage(file)
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
      await addDoc(
        collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
        {
          content: content || '',
          uid: currentUser.uid,
          displayName: userData?.displayName || currentUser.displayName || currentUser.email,
          photoURL: userData?.photoURL || null,
          avatarEmoji: userData?.avatarEmoji || null,
          avatarBg: userData?.avatarBg || null,
          isAdmin: isOperator(currentUser),
          imageURL: imageToSend || null,
          createdAt: serverTimestamp(),
        }
      )
    } catch (err) {
      console.error('Failed to send message', err)
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

  const canSend = text.trim().length > 0 || !!pendingImage

  return (
    <div className="message-input-wrapper">
      {pendingImage && (
        <div className="pending-image-preview">
          <img src={pendingImage} alt="attachment" />
          <button className="pending-image-remove" onClick={() => setPendingImage(null)} title="Remove">✕</button>
        </div>
      )}
      <div className="message-input-box">
        <button
          className="attach-btn"
          onClick={() => fileRef.current?.click()}
          title="Upload image"
        >
          +
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => { setText(e.target.value); autoResize() }}
          onKeyDown={handleKey}
          onPaste={handlePaste}
          placeholder={`Message #${channelName}`}
          rows={1}
        />
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
  )
}
