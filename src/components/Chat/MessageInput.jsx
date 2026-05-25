import { useState, useRef, useEffect } from 'react'
import { addDoc, collection, serverTimestamp, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'

export default function MessageInput({ serverId, channelId, channelName }) {
  const { currentUser } = useAuth()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [userData, setUserData] = useState(null)
  const textareaRef = useRef(null)

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

  async function sendMessage() {
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    try {
      await addDoc(
        collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
        {
          content,
          uid: currentUser.uid,
          displayName: userData?.displayName || currentUser.displayName || currentUser.email,
          photoURL: userData?.photoURL || null,
          avatarEmoji: userData?.avatarEmoji || null,
          avatarBg: userData?.avatarBg || null,
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

  const canSend = text.trim().length > 0

  return (
    <div className="message-input-wrapper">
      <div className="message-input-box">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => { setText(e.target.value); autoResize() }}
          onKeyDown={handleKey}
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
