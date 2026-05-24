import { useEffect, useRef, useState } from 'react'
import {
  collection, query, orderBy, limit, onSnapshot,
} from 'firebase/firestore'
import { db } from '../../firebase'
import Message from './Message'

export default function MessageList({ serverId, channelId, channelName }) {
  const [messages, setMessages] = useState([])
  const bottomRef = useRef(null)
  const isFirstLoad = useRef(true)

  useEffect(() => {
    if (!serverId || !channelId) return
    isFirstLoad.current = true
    setMessages([])

    const q = query(
      collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100),
    )

    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setMessages(msgs)
      if (isFirstLoad.current) {
        isFirstLoad.current = false
        setTimeout(() => bottomRef.current?.scrollIntoView(), 50)
      } else {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    })

    return unsub
  }, [serverId, channelId])

  if (messages.length === 0) {
    return (
      <div className="messages-list" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', flex: 1 }}>
        <div className="welcome-banner">
          <div className="welcome-icon">#</div>
          <h2>Welcome to #{channelName}!</h2>
          <p>This is the start of the #{channelName} channel. Say hello!</p>
        </div>
        <div ref={bottomRef} />
      </div>
    )
  }

  return (
    <div className="messages-list">
      <div className="welcome-banner">
        <div className="welcome-icon">#</div>
        <h2>Welcome to #{channelName}!</h2>
        <p>This is the start of the #{channelName} channel.</p>
      </div>
      {messages.map((msg, i) => (
        <Message
          key={msg.id}
          message={msg}
          isFirst={i === 0}
          prevMessage={messages[i - 1]}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
