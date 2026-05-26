import { useEffect, useState } from 'react'
import { doc, onSnapshot, collection, query, orderBy, limit, onSnapshot as fsSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import MessageList from '../Chat/MessageList'
import MessageInput from '../Chat/MessageInput'
import MembersSidebar from './MembersSidebar'
import { useCall } from '../../contexts/CallContext'

export default function ChatArea({ server, channelId }) {
  const [channel, setChannel] = useState(null)
  const { startServerCall, activeCall } = useCall()

  useEffect(() => {
    if (!server?.id || !channelId) { setChannel(null); return }
    const unsub = onSnapshot(
      doc(db, 'servers', server.id, 'channels', channelId),
      snap => snap.exists() ? setChannel({ id: snap.id, ...snap.data() }) : setChannel(null)
    )
    return unsub
  }, [server?.id, channelId])

  if (!server || !channelId || !channel) {
    return (
      <div className="chat-area">
        <div className="empty-state">
          <div className="empty-icon">🦕</div>
          <h2>No channel selected</h2>
          <p>Pick a channel from the sidebar and let the dinos roam! 🦖</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="chat-area">
        <div className="chat-header">
          <span className="channel-hash">#</span>
          <h3>{channel.name}</h3>
          {server.type === 'viewing' && (
            <span className="viewing-badge" title="Viewing server — only permitted members can post">👁️ Viewing</span>
          )}
          <div style={{ flex: 1 }} />
          <button
            className="voice-call-btn"
            onClick={() => startServerCall(server.id, server.name, channelId, channel.name)}
            disabled={!!activeCall}
            title={activeCall ? 'Already in a call' : `Start voice call in #${channel.name}`}
          >
            🔊 {activeCall?.channelId === channelId ? 'In Call' : 'Voice'}
          </button>
        </div>

        <div className="messages-container">
          <MessageList
            serverId={server.id}
            channelId={channelId}
            channelName={channel.name}
          />
        </div>

        <MessageInput
          serverId={server.id}
          channelId={channelId}
          channelName={channel.name}
          server={server}
        />
      </div>

      <MembersSidebar serverId={server.id} server={server} memberIds={server.members || []} />
    </>
  )
}
