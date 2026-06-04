import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  collection, query, orderBy, limitToLast, onSnapshot,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { playMessageSound } from '../../utils/sounds'
import Message from './Message'

export default function MessageList({ serverId, channelId, channelName, onReply }) {
  const { currentUser } = useAuth()
  const [messages, setMessages] = useState([])
  const bottomRef   = useRef(null)
  const containerRef = useRef(null)
  const isFirstLoad  = useRef(true)
  const prevCountRef = useRef(0)
  // Track if user has scrolled up so we don't force-scroll while reading history
  const userScrolledUp = useRef(false)

  // Detect manual upward scrolling
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onScroll() {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
      userScrolledUp.current = !nearBottom
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!serverId || !channelId) return
    isFirstLoad.current  = true
    userScrolledUp.current = false
    setMessages([])

    const q = query(
      collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
      orderBy('createdAt', 'asc'),
      limitToLast(50),          // 50 most-recent messages — fast initial load
    )

    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setMessages(msgs)

      if (isFirstLoad.current) {
        isFirstLoad.current    = false
        prevCountRef.current   = msgs.length
        userScrolledUp.current = false
        // Scroll after the browser has painted the new messages
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            bottomRef.current?.scrollIntoView()
          })
        })
      } else {
        if (msgs.length > prevCountRef.current) {
          const newest = msgs[msgs.length - 1]
          if (newest?.uid && newest.uid !== currentUser?.uid) {
            playMessageSound()
          }
          // Auto-scroll to bottom unless the user has intentionally scrolled up
          if (!userScrolledUp.current) {
            requestAnimationFrame(() => {
              bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
            })
          }
        }
        prevCountRef.current = msgs.length
      }
    })

    return unsub
  }, [serverId, channelId])

  if (messages.length === 0) {
    return (
      <div className="messages-list" ref={containerRef} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', flex: 1 }}>
        <div className="welcome-banner">
          <div className="welcome-icon">🦕</div>
          <h2>Welcome to #{channelName}!</h2>
          <p>This is the start of #{channelName}. The dinos are ready to chat! 🦖</p>
        </div>
        <div ref={bottomRef} />
      </div>
    )
  }

  return (
    <div className="messages-list" ref={containerRef}>
      <div className="welcome-banner">
        <div className="welcome-icon">🦕</div>
        <h2>Welcome to #{channelName}!</h2>
        <p>The start of #{channelName} — where dinos gather! 🦖</p>
      </div>
      {messages.map((msg, i) => (
        <Message
          key={msg.id}
          message={msg}
          isFirst={i === 0}
          prevMessage={messages[i - 1]}
          serverId={serverId}
          channelId={channelId}
          onReply={onReply}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
