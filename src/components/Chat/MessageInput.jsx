import { useState, useRef, useEffect } from 'react'
import { addDoc, collection, serverTimestamp, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { isOperator } from '../../utils/admin'

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

export default function MessageInput({ serverId, channelId, channelName, server }) {
  const { currentUser } = useAuth()

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

  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [userData, setUserData] = useState(null)
  const [pendingImage, setPendingImage] = useState(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [emojiTab, setEmojiTab] = useState(0)
  const textareaRef = useRef(null)
  const fileRef = useRef(null)
  const emojiRef = useRef(null)

  useEffect(() => {
    if (!currentUser?.uid) return
    const unsub = onSnapshot(doc(db, 'users', currentUser.uid), snap => {
      if (snap.exists()) setUserData(snap.data())
    })
    return unsub
  }, [currentUser?.uid])

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmoji) return
    function handler(e) {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmoji(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showEmoji])

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  function insertEmoji(emoji) {
    const el = textareaRef.current
    if (!el) {
      setText(t => t + emoji)
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const newText = text.slice(0, start) + emoji + text.slice(end)
    setText(newText)
    // Restore cursor after emoji
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + emoji.length, start + emoji.length)
      autoResize()
    }, 0)
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

        {/* Emoji picker button */}
        <div className="emoji-picker-wrap" ref={emojiRef}>
          <button
            className="emoji-btn"
            onClick={() => setShowEmoji(s => !s)}
            title="Emoji picker"
          >😊</button>

          {showEmoji && (
            <div className="emoji-panel">
              <div className="emoji-tabs">
                {EMOJI_CATEGORIES.map((cat, i) => (
                  <button
                    key={i}
                    className={`emoji-tab-btn ${emojiTab === i ? 'active' : ''}`}
                    onClick={() => setEmojiTab(i)}
                    title={cat.label}
                  >
                    {cat.emojis[0]}
                  </button>
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
                  >
                    {em}
                  </button>
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
  )
}
