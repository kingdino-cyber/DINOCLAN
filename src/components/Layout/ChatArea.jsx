import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import MessageList from '../Chat/MessageList'
import MessageInput from '../Chat/MessageInput'
import MembersSidebar from './MembersSidebar'
import VoiceChannelView from '../Chat/VoiceChannelView'

export default function ChatArea({ server, channelId, onStartDM }) {
  const [channel, setChannel] = useState(null)
  const [replyTo, setReplyTo] = useState(null)   // message being replied to

  useEffect(() => {
    if (!server?.id || !channelId) { setChannel(null); return }
    const unsub = onSnapshot(
      doc(db, 'servers', server.id, 'channels', channelId),
      snap => snap.exists() ? setChannel({ id: snap.id, ...snap.data() }) : setChannel(null)
    )
    return unsub
  }, [server?.id, channelId])

  // Clear reply when switching channels
  useEffect(() => { setReplyTo(null) }, [channelId])

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

  // ── Voice channel — show the voice room instead of text chat ──
  if (channel.type === 'voice') {
    return (
      <>
        <VoiceChannelView server={server} channel={channel} />
        <MembersSidebar serverId={server.id} server={server} memberIds={server.members || []} onStartDM={onStartDM} />
      </>
    )
  }

  // ── Text channel ──────────────────────────────────────────────
  return (
    <>
      <div className="chat-area">
        <div className="chat-header">
          <span className="channel-hash">#</span>
          <h3>{channel.name}</h3>
          {server.type === 'viewing' && (
            <span className="viewing-badge" title="Viewing server — only permitted members can post">👁️ Viewing</span>
          )}
        </div>

        <div className="messages-container">
          <MessageList
            serverId={server.id}
            channelId={channelId}
            channelName={channel.name}
            onReply={setReplyTo}
          />
        </div>

        <MessageInput
          serverId={server.id}
          channelId={channelId}
          channelName={channel.name}
          server={server}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
        />
      </div>

      <MembersSidebar serverId={server.id} server={server} memberIds={server.members || []} onStartDM={onStartDM} />
    </>
  )
}
