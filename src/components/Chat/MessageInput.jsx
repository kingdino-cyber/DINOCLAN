import { useState, useRef, useEffect } from 'react'
import {
  addDoc, collection, serverTimestamp, doc, onSnapshot,
  updateDoc, setDoc, deleteField, getDocs, getDoc, increment,
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../firebase'
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

// Read any file as a base64 data-URL (for small non-image files stored in Firestore)
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
  if (bytes < 1024)            return `${bytes} B`
  if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024*1024*1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024*1024*1024)).toFixed(2)} GB`
}

// Firestore document limit (~1 MB). Files smaller than this use base64 directly.
// Larger files are uploaded to Firebase Storage.
const BASE64_MAX_BYTES = 700 * 1024   // 700 KB → ~930 KB base64 (safe under 1 MB doc limit)

export default function MessageInput({ serverId, channelId, channelName, server, channel, replyTo, onClearReply }) {
  const { currentUser } = useAuth()

  // ── ALL hooks must come before any conditional return (Rules of Hooks) ────
  const [text,            setText]            = useState('')
  const [sending,         setSending]         = useState(false)
  const [sendError,       setSendError]       = useState('')
  const [userData,        setUserData]        = useState(null)
  const [pendingImage,    setPendingImage]    = useState(null)   // base64 data-URL
  const [pendingFile,     setPendingFile]     = useState(null)   // { file, name, size, type, dataUrl? }
  const [uploadProgress,  setUploadProgress]  = useState(null)  // null | 'uploading'
  const [showEmoji,       setShowEmoji]       = useState(false)
  const [emojiTab,        setEmojiTab]        = useState(0)
  const [typingNames,     setTypingNames]     = useState([])
  const [swearJarEnabled, setSwearJarEnabled] = useState(false)
  const [hiRayJarEnabled, setHiRayJarEnabled] = useState(false)
  const [hiRayCount,      setHiRayCount]      = useState(0)

  // GIF picker state
  const [showGif,    setShowGif]    = useState(false)
  const [gifQuery,   setGifQuery]   = useState('')
  const [gifResults, setGifResults] = useState([])
  const [gifLoading, setGifLoading] = useState(false)
  const gifRef = useRef(null)
  const gifSearchTimeoutRef = useRef(null)
  const gifRequestIdRef = useRef(0)

  // Poll creation state
  const [showPoll,        setShowPoll]        = useState(false)
  const [pollQuestion,    setPollQuestion]    = useState('')
  const [pollOptions,     setPollOptions]     = useState(['', ''])
  const [pollMode,        setPollMode]        = useState('single')   // 'single' | 'multiple'
  const [pollMaxSelect,   setPollMaxSelect]   = useState(2)

  // @mention state
  const [mentionQuery, setMentionQuery] = useState(null)  // null = closed
  const [mentionUsers, setMentionUsers] = useState([])
  const [mentionIndex, setMentionIndex] = useState(0)

  // slash command menu
  const [slashCmds,  setSlashCmds]  = useState([])
  const [slashIndex, setSlashIndex] = useState(0)
  const [showSlash,  setShowSlash]  = useState(false)

  // /chess panel state
  const [showChess,     setShowChess]     = useState(false)
  const [chessTitle,    setChessTitle]    = useState('')
  const [chessFen,      setChessFen]      = useState('')
  const [chessSolution, setChessSolution] = useState('')
  const [chessCaption,  setChessCaption]  = useState('')
  const [chessUciMoves, setChessUciMoves] = useState('')
  const chessRef = useRef(null)

  const textareaRef      = useRef(null)
  const fileRef          = useRef(null)
  const emojiRef         = useRef(null)
  const typingTimeoutRef = useRef(null)
  const memberCacheRef   = useRef(null)

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
      if (!snap.exists()) { setTypingNames([]); setSwearJarEnabled(false); setHiRayJarEnabled(false); setHiRayCount(0); return }
      const data = snap.data()
      setSwearJarEnabled(!!data?.swearJarEnabled)
      setHiRayJarEnabled(!!data?.hiRayJarEnabled)
      setHiRayCount(data?.hiRayCount || 0)
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

  // Close GIF picker on outside click
  useEffect(() => {
    if (!showGif) return
    function handler(e) {
      if (gifRef.current && !gifRef.current.contains(e.target)) setShowGif(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showGif])

  // Close chess panel on outside click
  useEffect(() => {
    if (!showChess) return
    function handler(e) {
      if (chessRef.current && !chessRef.current.contains(e.target)) setShowChess(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showChess])

  // Load trending GIFs when the picker first opens
  useEffect(() => {
    if (showGif && gifResults.length === 0 && !gifQuery) fetchTrendingGifs()
  }, [showGif]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchTrendingGifs() {
    const key = import.meta.env.VITE_GIPHY_API_KEY
    if (!key) return
    const myRequestId = ++gifRequestIdRef.current
    setGifLoading(true)
    try {
      const res = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=24&rating=pg-13`)
      const data = await res.json()
      if (myRequestId !== gifRequestIdRef.current) return // a newer search/fetch superseded this one
      setGifResults(data.data || [])
    } catch (_) {
      if (myRequestId === gifRequestIdRef.current) setGifResults([])
    } finally {
      if (myRequestId === gifRequestIdRef.current) setGifLoading(false)
    }
  }

  function handleGifSearch(value) {
    setGifQuery(value)
    clearTimeout(gifSearchTimeoutRef.current)
    gifSearchTimeoutRef.current = setTimeout(async () => {
      const key = import.meta.env.VITE_GIPHY_API_KEY
      if (!key) return
      if (!value.trim()) { fetchTrendingGifs(); return }
      const myRequestId = ++gifRequestIdRef.current
      setGifLoading(true)
      try {
        const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(value)}&limit=24&rating=pg-13`)
        const data = await res.json()
        if (myRequestId !== gifRequestIdRef.current) return // a newer search superseded this one
        setGifResults(data.data || [])
      } catch (_) {
        if (myRequestId === gifRequestIdRef.current) setGifResults([])
      } finally {
        if (myRequestId === gifRequestIdRef.current) setGifLoading(false)
      }
    }, 400)
  }

  async function sendGif(gifUrl) {
    if (!serverId || !channelId || sending) return
    setShowGif(false)
    setGifQuery('')
    try {
      const senderName = userData?.displayName || currentUser.displayName || currentUser.email
      const serverRank = getServerRank(server, currentUser.uid)
      const globalRank = getGlobalRank({ ...userData, email: currentUser.email })
      const replyToDoc = replyTo ? {
        messageId:   replyTo.id,
        uid:         replyTo.uid,
        displayName: replyTo.displayName || 'Unknown',
        content:     replyTo.content ? replyTo.content.slice(0, 150) : '',
        imageURL:    !!replyTo.imageURL,
        type:        replyTo.type || null,
      } : null
      if (onClearReply) onClearReply()
      await addDoc(
        collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
        {
          content:     '',
          uid:         currentUser.uid,
          displayName: senderName,
          photoURL:    userData?.photoURL    || null,
          avatarEmoji: userData?.avatarEmoji || null,
          avatarBg:    userData?.avatarBg    || null,
          isAdmin:     isOperator(currentUser),
          serverRank,
          globalRank,
          replyTo:     replyToDoc,
          imageURL:    gifUrl,
          isGif:       true,
          createdAt:   serverTimestamp(),
        }
      )
      notifyMembers('🎬 GIF')
    } catch (err) {
      console.error('Failed to send GIF:', err)
    }
  }

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

  // Invalidate member cache when switching servers
  useEffect(() => { memberCacheRef.current = null }, [serverId])

  // Lazy-load + cache server members for @mention
  async function fetchMentionMembers() {
    if (memberCacheRef.current) return memberCacheRef.current
    const uids = server?.members || []
    const results = []
    await Promise.all(uids.map(async uid => {
      try {
        const snap = await getDoc(doc(db, 'users', uid))
        if (snap.exists()) results.push({ uid, displayName: snap.data().displayName || uid })
      } catch (_) {}
    }))
    memberCacheRef.current = results
    return results
  }

  function handleMentionSelect(user) {
    const el = textareaRef.current
    if (!el) return
    const cursor = el.selectionStart
    const newBefore = text.slice(0, cursor).replace(/@(\w*)$/, `@[${user.uid}:${user.displayName}] `)
    const after = text.slice(cursor)
    const next = newBefore + after
    setText(next)
    setMentionQuery(null)
    setMentionUsers([])
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(newBefore.length, newBefore.length)
      autoResize()
    }, 0)
  }

  // ── Slash command registry ────────────────────────────────────────────────
  function getAvailableCommands() {
    if (!serverId) return []
    const cmds = [
      { cmd: '/chess puzzle', icon: '♟️', desc: 'Post an interactive chess puzzle' },
      { cmd: '/chess live',   icon: '⚔️', desc: 'Start a live multiplayer chess game' },
      { cmd: '/67',           icon: '6️⃣',  desc: 'Flash 67 on everyone\'s screen for 5 seconds' },
      { cmd: '/uno',          icon: '🃏', desc: 'Start a game of UNO' },
      { cmd: '/announce',     icon: '📣', desc: 'Post a big announcement banner — /announce [message]' },
      { cmd: '/countdown',    icon: '⏱️', desc: 'Start a countdown timer — /countdown [minutes]' },
      { cmd: '/dice',         icon: '🎲', desc: 'Roll a dice — result posted for everyone' },
      { cmd: '/rawr',         icon: '🦖', desc: 'RAWR! Shake everyone\'s screen' },
      { cmd: '/meteor',       icon: '☄️', desc: 'Unleash a meteor shower on everyone\'s screen' },
      { cmd: '/dino-type',    icon: '🦕', desc: 'Open Dino Typer game in a new tab' },
      { cmd: '/dino-tycoon',  icon: '🦖', desc: 'Open Dino Tycoon game in a new tab' },
      { cmd: '/panda-games',  icon: '🐼', desc: 'Open Panda Games in a new tab' },
    ]
    if (swearJarEnabled)
      cmds.push({ cmd: '/leaderboard', icon: '🫙', desc: 'Show swear jar rankings' })
    return cmds
  }

  // Commands that need arguments — selecting from menu prefills text
  const PREFILL_CMDS = new Set(['/announce', '/countdown'])

  async function broadcastScreenEvent(type) {
    await updateDoc(doc(db, 'servers', serverId), {
      screenEvent: { type, at: serverTimestamp() }
    })
    setTimeout(() => {
      updateDoc(doc(db, 'servers', serverId), { screenEvent: deleteField() }).catch(() => {})
    }, 8000)
  }

  async function runSlashCommand(cmd) {
    setShowSlash(false)
    if (PREFILL_CMDS.has(cmd)) {
      // Keep text input open so user can type the argument
      setText(cmd + ' ')
      if (textareaRef.current) { textareaRef.current.focus(); autoResize() }
      return
    }
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    if (cmd === '/chess puzzle') {
      setShowChess(true)
    } else if (cmd === '/chess live') {
      await sendChessLive()
    } else if (cmd === '/67') {
      await broadcastScreenEvent('67')
    } else if (cmd === '/uno') {
      await sendUnoGame()
    } else if (cmd === '/dice') {
      await sendDice()
    } else if (cmd === '/rawr') {
      await broadcastScreenEvent('rawr')
    } else if (cmd === '/meteor') {
      await broadcastScreenEvent('meteor')
    } else if (cmd === '/dino-type') {
      window.open('https://dino-typer.netlify.app', '_blank')
    } else if (cmd === '/dino-tycoon') {
      window.open('https://dinotycoon-lynr.onrender.com', '_blank')
    } else if (cmd === '/panda-games') {
      window.open('https://panda-games.vercel.app', '_blank')
    } else if (cmd === '/leaderboard') {
      clearTyping()
      await handleLeaderboard()
    }
  }

  async function sendChessLive() {
    if (sending || !serverId) return
    setSending(true)
    try {
      const senderName = userData?.displayName || currentUser.displayName || currentUser.email
      const serverRank = getServerRank(server, currentUser.uid)
      const globalRank = getGlobalRank({ ...userData, email: currentUser.email })
      await addDoc(
        collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
        {
          type:      'chess-live',
          content:   '',
          chessLive: {
            moves:     [],
            whiteUid:  null, whiteName: null,
            blackUid:  null, blackName: null,
            status:    'waiting',
            winner:    null,
          },
          uid:         currentUser.uid,
          displayName: senderName,
          photoURL:    userData?.photoURL    || null,
          avatarEmoji: userData?.avatarEmoji || null,
          avatarBg:    userData?.avatarBg    || null,
          serverRank,
          globalRank,
          createdAt:   serverTimestamp(),
        }
      )
    } catch (err) {
      console.error('Failed to start chess live game:', err)
    } finally {
      setSending(false)
    }
  }

  async function sendUnoGame() {
    if (sending || !serverId) return
    setSending(true)
    try {
      const senderName = userData?.displayName || currentUser.displayName || currentUser.email
      const serverRank = getServerRank(server, currentUser.uid)
      const globalRank = getGlobalRank({ ...userData, email: currentUser.email })
      await addDoc(
        collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
        {
          type:    'uno',
          content: '',
          unoGame: {
            players:      [],
            hands:        {},
            deck:         [],
            discard:      [],
            discardColor: null,
            currentPlayerIndex: 0,
            direction:    1,
            status:       'waiting',
            winner:       null,
            drawStack:    0,
          },
          uid:         currentUser.uid,
          displayName: senderName,
          photoURL:    userData?.photoURL    || null,
          avatarEmoji: userData?.avatarEmoji || null,
          avatarBg:    userData?.avatarBg    || null,
          serverRank,
          globalRank,
          createdAt:   serverTimestamp(),
        }
      )
    } catch (err) {
      console.error('Failed to start UNO game:', err)
    } finally {
      setSending(false)
    }
  }

  // ── Suspension check ─────────────────────────────────────────────────────
  const suspendedUntilDate = userData?.suspendedUntil?.toDate?.()
  const isSuspended = suspendedUntilDate && suspendedUntilDate > new Date()

  // ── Permission check — AFTER all hooks ───────────────────────────────────
  // Per-channel viewType takes priority; falls back to the legacy server-level
  // type for channels created before this field existed.
  const isViewing = (channel?.viewType || (server?.type === 'viewing' ? 'viewing' : 'editing')) === 'viewing'
  const canPost = !isViewing
    || isOperator(currentUser)
    || server?.ownerId === currentUser?.uid
    || server?.editors?.includes(currentUser?.uid)

  if (isSuspended) {
    return (
      <div className="message-input-wrapper">
        <div className="viewing-locked">
          🚫 You are suspended until {suspendedUntilDate.toLocaleDateString()}. You cannot send messages.
        </div>
      </div>
    )
  }

  if (!canPost) {
    return (
      <div className="message-input-wrapper">
        <div className="viewing-locked">
          👁️ This is a viewing-only channel. Only permitted members can post — but you can still react and vote on polls.
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
      // Any file size is acceptable — small ones use base64, large ones use Firebase Storage
      setPendingFile({ file, name: file.name, size: file.size, type: file.type })
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
      { type: 'bot', botName, content, createdAt: serverTimestamp() }
    )
  }

  // ── Hi Ray jar: detect "hi ray" and increment collective count ────────────
  async function handleHiRayJar(messageContent) {
    if (!hiRayJarEnabled || !messageContent) return
    if (!/hi[\s,]*ray/i.test(messageContent)) return
    await updateDoc(doc(db, 'servers', serverId, 'channels', channelId), {
      hiRayCount: increment(1),
    })
  }

  // ── Swear jar: record swear and post bot message ──────────────────────────
  async function handleSwearJar(messageContent) {
    if (!swearJarEnabled || !messageContent) return
    const n = countSwears(messageContent)
    if (n === 0) return
    const senderName = userData?.displayName || currentUser.displayName || currentUser.email
    const countRef = doc(db, 'servers', serverId, 'channels', channelId, 'swearCounts', currentUser.uid)
    await setDoc(countRef, { uid: currentUser.uid, displayName: senderName, count: increment(n) }, { merge: true })
    const snap = await getDoc(countRef)
    const total = snap.exists() ? (snap.data().count || n) : n
    await postBotMessage(`🫙 ${senderName} now has ${total} swear${total === 1 ? '' : 's'}.`)
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

      const medals = ['🥇', '🥈', '🥉']
      const leaderboard = entries.length === 0
        ? 'No swears recorded yet!'
        : entries.map((e, i) => `${medals[i] || `${i + 1}.`} ${e.displayName}: ${e.count || 0} swear${(e.count || 0) === 1 ? '' : 's'}`).join('\n')
      await postBotMessage(`🤬 Swear Jar Leaderboard 🫙\n\n${leaderboard}`)
    } catch (err) {
      console.error('Leaderboard error:', err)
    }
  }

  // ── Upload file to Firebase Storage (for large files) ────────────────────
  async function uploadToStorage(file) {
    const path = `attachments/${serverId}/${channelId}/${Date.now()}_${file.name}`
    const fileRef = storageRef(storage, path)
    await uploadBytes(fileRef, file)
    return await getDownloadURL(fileRef)
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

    // /announce [message]
    const announceMatch = content.match(/^\/announce\s+(.+)/is)
    if (announceMatch && serverId && channelId) {
      setText('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      clearTyping()
      await sendAnnounce(announceMatch[1].trim())
      return
    }

    // /countdown [minutes]
    const countdownMatch = content.match(/^\/countdown\s+(\d+(?:\.\d+)?)/i)
    if (countdownMatch && serverId && channelId) {
      setText('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      clearTyping()
      await sendCountdown(parseFloat(countdownMatch[1]))
      return
    }

    // Catch incomplete argument commands — show usage instead of sending as plain text
    const USAGE_HINTS = [
      [/^\/announce\s*$/i,                '📣  /announce [message]  — type what to announce after the command'],
      [/^\/countdown\s*$/i,               '⏱️  /countdown [minutes]  — e.g.  /countdown 5'],
      [/^\/countdown\s+\D/i,              '⏱️  /countdown [minutes]  — needs a number, e.g.  /countdown 5'],
    ]
    for (const [re, hint] of USAGE_HINTS) {
      if (re.test(content)) {
        setSendError(hint)
        setTimeout(() => setSendError(''), 6000)
        return
      }
    }

    if ((!content && !pendingImage && !pendingFile) || sending) return
    setSending(true)
    setSendError('')

    const savedText   = text
    const imageToSend = pendingImage
    const fileToSend  = pendingFile
    const replyToSend = replyTo

    // Optimistically clear input
    setText('')
    setPendingImage(null)
    setPendingFile(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    clearTyping()
    clearTimeout(typingTimeoutRef.current)
    if (onClearReply) onClearReply()

    try {
      const senderName = userData?.displayName || currentUser.displayName || currentUser.email
      const serverRank = getServerRank(server, currentUser.uid)
      const globalRank = getGlobalRank({ ...userData, email: currentUser.email })

      // Handle file attachment
      let fileURL    = null   // Firebase Storage URL (large files)
      let fileData   = null   // base64 (small files)
      let fileName   = null
      let fileSize   = null
      let fileType   = null

      if (fileToSend) {
        fileName = fileToSend.name
        fileSize = fileToSend.size
        fileType = fileToSend.type

        if (fileToSend.size <= BASE64_MAX_BYTES) {
          // Small file → store as base64 in Firestore (no Storage needed)
          fileData = await readFileAsDataURL(fileToSend.file)
        } else {
          // Large file → upload to Firebase Storage
          setUploadProgress('uploading')
          try {
            fileURL = await uploadToStorage(fileToSend.file)
          } catch (storageErr) {
            console.error('Storage upload failed:', storageErr)
            setSendError(
              'File upload failed — please set Firebase Storage rules in the Firebase Console: ' +
              'Storage → Rules → paste: allow read, write: if request.auth != null; → Publish.'
            )
            setTimeout(() => setSendError(''), 10000)
            // Restore state
            setText(savedText)
            setPendingFile(fileToSend)
            setSending(false)
            setUploadProgress(null)
            return
          } finally {
            setUploadProgress(null)
          }
        }
      }

      // Build reply reference (store minimal info for the quote block)
      const replyToDoc = replyToSend ? {
        messageId:   replyToSend.id,
        uid:         replyToSend.uid,
        displayName: replyToSend.displayName || 'Unknown',
        content:     replyToSend.content ? replyToSend.content.slice(0, 150) : '',
        imageURL:    !!replyToSend.imageURL,
        type:        replyToSend.type || null,
      } : null

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
          replyTo:     replyToDoc,
          imageURL:    imageToSend           || null,
          fileData:    fileData              || null,
          fileURL:     fileURL               || null,
          fileName:    fileName              || null,
          fileSize:    fileSize              || null,
          fileType:    fileType              || null,
          createdAt:   serverTimestamp(),
        }
      )

      // Swear jar detection (fire-and-forget)
      if (content && swearJarEnabled) handleSwearJar(content).catch(() => {})
      // Hi Ray jar detection (fire-and-forget)
      if (content && hiRayJarEnabled) handleHiRayJar(content).catch(() => {})

      // Notify other members (fire-and-forget)
      const preview = content
        ? content.slice(0, 80)
        : imageToSend
          ? '📷 Image'
          : `📎 ${fileToSend?.name}`
      notifyMembers(preview)

      // Notify mentioned users
      if (content) {
        const mentionRe = /@\[([^:\]]+):([^\]]+)\]/g
        let mMatch
        const notified = new Set()
        while ((mMatch = mentionRe.exec(content)) !== null) {
          const mUid = mMatch[1]
          if (mUid !== currentUser.uid && !notified.has(mUid)) {
            notified.add(mUid)
            addDoc(collection(db, 'users', mUid, 'notifications'), {
              type:        'mention',
              fromUid:     currentUser.uid,
              fromName:    senderName,
              serverId,
              channelId,
              serverName:  server?.name   || 'Server',
              channelName: channelName    || 'channel',
              preview:     content.replace(/@\[([^:\]]+):([^\]]+)\]/g, '@$2').slice(0, 80),
              createdAt:   serverTimestamp(),
              read:        false,
            }).catch(() => {})
          }
        }
      }

    } catch (err) {
      console.error('Failed to send message:', err.code, err.message)
      setText(savedText)
      setPendingImage(imageToSend)
      setPendingFile(fileToSend)
      setSendError('Failed to send — check your connection and try again.')
      setTimeout(() => setSendError(''), 4000)
    } finally {
      setSending(false)
      setUploadProgress(null)
    }
  }

  // ── /announce ─────────────────────────────────────────────────────────────
  async function sendAnnounce(message) {
    const senderName = userData?.displayName || currentUser.displayName || currentUser.email
    await addDoc(collection(db, 'servers', serverId, 'channels', channelId, 'messages'), {
      type:        'announce',
      content:     message,
      uid:         currentUser.uid,
      displayName: senderName,
      photoURL:    userData?.photoURL    || null,
      avatarEmoji: userData?.avatarEmoji || null,
      avatarBg:    userData?.avatarBg    || null,
      createdAt:   serverTimestamp(),
    }).catch(err => console.error('announce failed:', err))
    notifyMembers(`📣 ${message.slice(0, 60)}`)
  }

  // ── /countdown ────────────────────────────────────────────────────────────
  async function sendCountdown(minutes) {
    const senderName = userData?.displayName || currentUser.displayName || currentUser.email
    const endsAt = new Date(Date.now() + minutes * 60 * 1000)
    await addDoc(collection(db, 'servers', serverId, 'channels', channelId, 'messages'), {
      type:        'countdown',
      content:     '',
      endsAt:      endsAt.toISOString(),
      minutes,
      uid:         currentUser.uid,
      displayName: senderName,
      photoURL:    userData?.photoURL    || null,
      avatarEmoji: userData?.avatarEmoji || null,
      avatarBg:    userData?.avatarBg    || null,
      createdAt:   serverTimestamp(),
    }).catch(err => console.error('countdown failed:', err))
  }

  // ── /dice ────────────────────────────────────────────────────────────────
  async function sendDice() {
    if (!serverId || !channelId) return
    const senderName = userData?.displayName || currentUser.displayName || currentUser.email
    const result = Math.ceil(Math.random() * 6)
    await addDoc(collection(db, 'servers', serverId, 'channels', channelId, 'messages'), {
      type:        'dice',
      result,
      content:     '',
      uid:         currentUser.uid,
      displayName: senderName,
      photoURL:    userData?.photoURL    || null,
      avatarEmoji: userData?.avatarEmoji || null,
      avatarBg:    userData?.avatarBg    || null,
      createdAt:   serverTimestamp(),
    }).catch(err => console.error('dice failed:', err))
  }

  // ── Send chess puzzle ─────────────────────────────────────────────────────
  async function sendChessPuzzle() {
    if (!chessFen.trim() || sending || !serverId) return
    setSending(true)
    try {
      const senderName = userData?.displayName || currentUser.displayName || currentUser.email
      const serverRank = getServerRank(server, currentUser.uid)
      const globalRank = getGlobalRank({ ...userData, email: currentUser.email })
      await addDoc(
        collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
        {
          type:        'chess',
          content:     chessCaption.trim(),
          chessPuzzle: (() => {
            const uciArr = chessUciMoves.trim().split(/\s+/).filter(m => /^[a-h][1-8][a-h][1-8]$/.test(m))
            return {
              title:         chessTitle.trim(),
              fen:           chessFen.trim(),
              solution:      chessSolution.trim(),
              solutionMoves: uciArr,
              movesToSolve:  uciArr.length > 0 ? Math.ceil(uciArr.length / 2) : null,
            }
          })(),
          uid:         currentUser.uid,
          displayName: senderName,
          photoURL:    userData?.photoURL    || null,
          avatarEmoji: userData?.avatarEmoji || null,
          avatarBg:    userData?.avatarBg    || null,
          serverRank,
          globalRank,
          createdAt:   serverTimestamp(),
        }
      )
      notifyMembers(chessTitle.trim() || '♟️ Chess Puzzle')
      setShowChess(false)
      setChessTitle(''); setChessFen(''); setChessSolution(''); setChessCaption(''); setChessUciMoves('')
    } catch (err) {
      console.error('Failed to post chess puzzle:', err)
      setSendError('Failed to post chess puzzle.')
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
          pollMode,
          pollMaxSelect: pollMode === 'multiple' ? Math.max(1, Math.min(pollMaxSelect, opts.length)) : 1,
          pollVotes:    {},
          pollVoterNames: {},
          createdAt:    serverTimestamp(),
        }
      )
      notifyMembers(`📊 ${pollQuestion.trim()}`)
      setShowPoll(false)
      setPollQuestion('')
      setPollOptions(['', ''])
      setPollMode('single')
      setPollMaxSelect(2)
    } catch (err) {
      console.error('Failed to send poll:', err)
      setSendError('Failed to create poll.')
      setTimeout(() => setSendError(''), 4000)
    } finally {
      setSending(false)
    }
  }

  function handleKey(e) {
    // Slash command menu navigation
    if (showSlash && slashCmds.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex(i => Math.min(i + 1, slashCmds.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSlashIndex(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); runSlashCommand(slashCmds[slashIndex].cmd); return }
      if (e.key === 'Escape')    { setShowSlash(false); return }
    }
    // @mention navigation
    if (mentionQuery !== null && mentionUsers.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionUsers.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); handleMentionSelect(mentionUsers[mentionIndex]); return }
      if (e.key === 'Escape')    { setMentionQuery(null); setMentionUsers([]); return }
    }
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
      {/* ── Send error / usage hint banner ── */}
      {sendError && (() => {
        const isHint = /^[📣⏱️🗳️🦴]/.test(sendError)
        return (
          <div style={{
            background: isHint ? 'rgba(88,101,242,0.1)' : 'rgba(237,66,69,.15)',
            border: `1px solid ${isHint ? 'rgba(88,101,242,0.4)' : 'var(--danger)'}`,
            borderRadius: 6, padding: '7px 14px', margin: '0 16px 4px',
            fontSize: 12, color: isHint ? 'var(--accent)' : '#ed4245',
            flexShrink: 0, lineHeight: 1.5,
          }}>
            {isHint ? sendError : `⚠️ ${sendError}`}
          </div>
        )
      })()}

      {/* ── Hi Ray Jar counter ── */}
      {hiRayJarEnabled && (
        <div style={{
          margin: '0 16px 6px', borderRadius: 7,
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--bg-modifier)',
          padding: '6px 11px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 14 }}>👋</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--header-primary)' }}>Hi Ray Jar</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Team "hi ray" count</div>
            </div>
          </div>
          <div style={{
            fontSize: 19, fontWeight: 900, color: 'var(--accent)',
            minWidth: 32, textAlign: 'right',
          }}>
            {hiRayCount}
          </div>
        </div>
      )}

      {/* ── Swear jar indicator ── */}
      {swearJarEnabled && (
        <div style={{
          padding: '2px 16px', fontSize: 11, color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          🫙 Swear Jar active · type <code style={{ background: 'var(--bg-tertiary)', padding: '0 4px', borderRadius: 3 }}>/leaderboard</code> to see rankings
        </div>
      )}

      {/* ── Reply preview bar ── */}
      {replyTo && (
        <div className="reply-preview-bar">
          <div className="reply-preview-inner">
            <span className="reply-preview-label">↩️ Replying to <strong>{replyTo.displayName}</strong></span>
            <span className="reply-preview-text">
              {replyTo.content
                ? replyTo.content.slice(0, 80)
                : replyTo.imageURL ? '📷 Image'
                : replyTo.type === 'announce' ? '📣 Announcement'
                : replyTo.type === 'countdown' ? '⏱️ Countdown'
                : replyTo.type === 'dice' ? '🎲 Dice Roll'
                : replyTo.type === 'chess-puzzle' ? '♟️ Chess Puzzle'
                : replyTo.type === 'chess-live' ? '♟️ Chess Live'
                : replyTo.type === 'uno' ? '🃏 UNO'
                : replyTo.type === 'poll' ? '📊 Poll'
                : '📎 File'}
            </span>
          </div>
          <button className="reply-preview-close" onClick={onClearReply} title="Cancel reply">✕</button>
        </div>
      )}

      {/* ── Chess puzzle panel ── */}
      {showChess && (
        <div className="poll-create-panel chess-create-panel" ref={chessRef}>
          <div className="poll-create-header">
            <span>♟️ Post Chess Puzzle</span>
            <button className="poll-create-close" onClick={() => setShowChess(false)}>✕</button>
          </div>

          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Title</label>
          <input
            className="poll-create-input"
            placeholder="Puzzle 24: Deliver checkmate"
            value={chessTitle}
            onChange={e => setChessTitle(e.target.value)}
            autoFocus
            style={{ marginBottom: 10 }}
          />

          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
            FEN Position
            <span style={{ fontWeight: 400, marginLeft: 4 }}>
              — get from chess.com or lichess by right-clicking any position
            </span>
          </label>
          <input
            className="poll-create-input"
            placeholder="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
            value={chessFen}
            onChange={e => setChessFen(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: 11, marginBottom: 10 }}
          />

          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
            Solution Moves
            <span style={{ fontWeight: 400, marginLeft: 4 }}>— UCI format, alternating your moves &amp; opponent's, e.g. <code style={{ background: 'var(--bg-tertiary)', padding: '0 3px', borderRadius: 3 }}>b3e6 f8e7 e6e8</code></span>
          </label>
          <input
            className="poll-create-input"
            placeholder="b3e6 f8e7 e6e8"
            value={chessUciMoves}
            onChange={e => setChessUciMoves(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 4 }}
          />
          {chessUciMoves.trim() && (() => {
            const arr = chessUciMoves.trim().split(/\s+/).filter(m => /^[a-h][1-8][a-h][1-8]$/.test(m))
            const total = arr.length
            const solverCount = Math.ceil(total / 2)
            return total > 0
              ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                  {solverCount} solver move{solverCount !== 1 ? 's' : ''} · {total} total — move count auto-set
                </div>
              : <div style={{ fontSize: 11, color: '#f04747', marginBottom: 10 }}>⚠️ No valid UCI moves detected</div>
          })()}

          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Answer hint <span style={{ fontWeight: 400 }}>— optional, shown when someone clicks "Answer"</span></label>
          <textarea
            className="poll-create-input"
            placeholder="1. Qxe6+ Be7 2. Qe8#"
            value={chessSolution}
            onChange={e => setChessSolution(e.target.value)}
            rows={2}
            style={{ resize: 'vertical', marginBottom: 10 }}
          />

          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Message <span style={{ fontWeight: 400 }}>— optional caption above the board</span></label>
          <input
            className="poll-create-input"
            placeholder="Can anyone solve this one?"
            value={chessCaption}
            onChange={e => setChessCaption(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendChessPuzzle() }}
            style={{ marginBottom: 10 }}
          />

          <div className="poll-create-actions">
            <button
              className="poll-send-btn"
              onClick={sendChessPuzzle}
              disabled={sending || !chessFen.trim()}
            >
              Post Puzzle
            </button>
          </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0', fontSize: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="radio" checked={pollMode === 'single'} onChange={() => setPollMode('single')} />
              Single answer
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="radio" checked={pollMode === 'multiple'} onChange={() => setPollMode('multiple')} />
              Multiple choice
            </label>
            {pollMode === 'multiple' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                Pick up to
                <input
                  type="number" min={1} max={pollOptions.length}
                  value={pollMaxSelect}
                  onChange={e => setPollMaxSelect(Number(e.target.value) || 1)}
                  style={{ width: 40, background: 'var(--bg-tertiary)', border: '1px solid var(--bg-modifier)', borderRadius: 4, color: 'var(--text-normal)', padding: '2px 4px' }}
                />
              </label>
            )}
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
            {uploadProgress === 'uploading' && (
              <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 4 }}>Uploading…</span>
            )}
            <button className="pending-image-remove" onClick={() => setPendingFile(null)} title="Remove">✕</button>
          </div>
        )}

        {/* Slash command menu */}
        {showSlash && slashCmds.length > 0 && (
          <div className="slash-menu">
            <div className="slash-menu-header">Commands — ↑↓ to navigate · Enter to select</div>
            <div className="slash-menu-list">
              {slashCmds.map((c, i) => (
                <button
                  key={c.cmd}
                  className={`slash-menu-item${i === slashIndex ? ' active' : ''}`}
                  onMouseDown={e => { e.preventDefault(); runSlashCommand(c.cmd) }}
                  onMouseEnter={() => setSlashIndex(i)}
                >
                  <span className="slash-menu-icon">{c.icon}</span>
                  <div className="slash-menu-text">
                    <span className="slash-menu-cmd">{c.cmd}</span>
                    <span className="slash-menu-desc">{c.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* @mention dropdown */}
        {mentionQuery !== null && mentionUsers.length > 0 && (
          <div className="mention-dropdown">
            <div className="mention-dropdown-header">Members — Tab or Enter to select</div>
            {mentionUsers.map((user, i) => (
              <button
                key={user.uid}
                className={`mention-dropdown-item${i === mentionIndex ? ' active' : ''}`}
                onMouseDown={e => { e.preventDefault(); handleMentionSelect(user) }}
                onMouseEnter={() => setMentionIndex(i)}
              >
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>@</span>
                <span>{user.displayName}</span>
              </button>
            ))}
          </div>
        )}

        {/* Inline hint strip for argument commands */}
        {(() => {
          const CMD_HINTS = [
            ['/announce ',  '📣 Type your announcement after /announce, then press Enter'],
            ['/countdown ', '⏱️ Type the number of minutes after /countdown — e.g. /countdown 5, then Enter'],
          ]
          const lc = text.toLowerCase()
          for (const [prefix, hint] of CMD_HINTS) {
            if (lc.startsWith(prefix)) {
              return <div className="cmd-hint-strip">{hint}</div>
            }
          }
          return null
        })()}

        <div className="message-input-box">
          <button
            className="attach-btn"
            onClick={() => fileRef.current?.click()}
            title="Attach file (any size)"
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
            onChange={e => {
              const val = e.target.value
              setText(val); autoResize(); broadcastTyping()
              // Slash command menu
              if (val.startsWith('/') && serverId) {
                const query = val.slice(1).toLowerCase()
                const all   = getAvailableCommands()
                const hits  = all.filter(c => c.cmd.slice(1).startsWith(query))
                if (hits.length > 0) {
                  setSlashCmds(hits); setSlashIndex(0); setShowSlash(true)
                } else {
                  setShowSlash(false)
                }
              } else {
                setShowSlash(false)
              }
              // Detect @word before cursor
              const cursor = e.target.selectionStart
              const match = val.slice(0, cursor).match(/@(\w*)$/)
              if (match && serverId) {
                const q = match[1].toLowerCase()
                setMentionIndex(0)
                fetchMentionMembers().then(all => {
                  const filtered = all
                    .filter(u => u.uid !== currentUser.uid && u.displayName.toLowerCase().includes(q))
                    .slice(0, 8)
                  setMentionUsers(filtered)
                  setMentionQuery(q)
                })
              } else {
                setMentionQuery(null)
                setMentionUsers([])
              }
            }}
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

          {/* GIF picker */}
          <div className="emoji-picker-wrap" ref={gifRef}>
            <button className="emoji-btn" onClick={() => setShowGif(s => !s)} title="Send a GIF">🎬</button>
            {showGif && (
              <div className="emoji-panel" style={{ width: 280 }}>
                <input
                  className="poll-create-input"
                  placeholder="Search GIFs…"
                  value={gifQuery}
                  onChange={e => handleGifSearch(e.target.value)}
                  autoFocus
                  style={{ marginBottom: 8 }}
                />
                {!import.meta.env.VITE_GIPHY_API_KEY && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: 6 }}>
                    GIF search isn't configured yet.
                  </div>
                )}
                {gifLoading && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 6 }}>Loading…</div>
                )}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  gap: 6, maxHeight: 260, overflowY: 'auto',
                }}>
                  {gifResults.map(g => (
                    <img
                      key={g.id}
                      src={g.images?.fixed_width_small?.url || g.images?.preview_gif?.url}
                      alt={g.title}
                      style={{ width: '100%', borderRadius: 6, cursor: 'pointer', display: 'block' }}
                      onClick={() => sendGif(g.images?.original?.url || g.images?.fixed_width?.url)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

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
            {uploadProgress === 'uploading'
              ? <span style={{ fontSize: 12 }}>⏳</span>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
                </svg>
            }
          </button>
        </div>
      </div>
    </>
  )
}
