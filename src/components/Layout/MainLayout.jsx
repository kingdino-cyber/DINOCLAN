import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import ServerSidebar from './ServerSidebar'
import ChannelSidebar from './ChannelSidebar'
import ChatArea from './ChatArea'
import DinoDecorations from '../DinoDecorations'
import FriendsPanel from '../Friends/FriendsPanel'
import HomeServersPanel from './HomeServersPanel'

export default function MainLayout() {
  const [activeServerId, setActiveServerId] = useState(null)
  const [activeServer, setActiveServer] = useState(null)
  const [activeChannelId, setActiveChannelId] = useState(null)
  const [showFriends, setShowFriends] = useState(false)

  useEffect(() => {
    if (!activeServerId) { setActiveServer(null); setActiveChannelId(null); return }
    const unsub = onSnapshot(doc(db, 'servers', activeServerId), snap => {
      if (snap.exists()) setActiveServer({ id: snap.id, ...snap.data() })
      else { setActiveServer(null); setActiveChannelId(null) }
    })
    return unsub
  }, [activeServerId])

  function handleSelectServer(serverId) {
    setActiveServerId(serverId)
    setActiveChannelId(null)
    setShowFriends(false)
  }

  function handleToggleFriends() {
    setShowFriends(f => !f)
    setActiveServerId(null)
    setActiveChannelId(null)
  }

  const isHome = !activeServerId && !showFriends

  return (
    <div className="app-layout">
      <DinoDecorations />
      <ServerSidebar
        activeServerId={activeServerId}
        onSelectServer={handleSelectServer}
        showFriends={showFriends}
        onToggleFriends={handleToggleFriends}
      />

      {showFriends && <FriendsPanel />}

      {isHome && (
        <>
          <HomeServersPanel onSelectServer={handleSelectServer} />
          <FriendsPanel />
        </>
      )}

      {activeServerId && (
        <>
          <ChannelSidebar
            server={activeServer}
            activeChannelId={activeChannelId}
            onSelectChannel={setActiveChannelId}
          />
          <ChatArea
            server={activeServer}
            channelId={activeChannelId}
          />
        </>
      )}
    </div>
  )
}
