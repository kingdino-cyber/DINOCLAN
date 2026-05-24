import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import ServerSidebar from './ServerSidebar'
import ChannelSidebar from './ChannelSidebar'
import ChatArea from './ChatArea'

export default function MainLayout() {
  const [activeServerId, setActiveServerId] = useState(null)
  const [activeServer, setActiveServer] = useState(null)
  const [activeChannelId, setActiveChannelId] = useState(null)

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
  }

  return (
    <div className="app-layout">
      <ServerSidebar
        activeServerId={activeServerId}
        onSelectServer={handleSelectServer}
      />
      <ChannelSidebar
        server={activeServer}
        activeChannelId={activeChannelId}
        onSelectChannel={setActiveChannelId}
      />
      <ChatArea
        server={activeServer}
        channelId={activeChannelId}
      />
    </div>
  )
}
