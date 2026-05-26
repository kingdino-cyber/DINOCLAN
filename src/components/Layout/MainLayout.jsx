import { useEffect, useState } from 'react'
import { doc, onSnapshot, collection, query, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import ServerSidebar from './ServerSidebar'
import ChannelSidebar from './ChannelSidebar'
import ChatArea from './ChatArea'
import DinoDecorations from '../DinoDecorations'
import FriendsPanel from '../Friends/FriendsPanel'
import HomeServersPanel from './HomeServersPanel'
import DirectMessageView from '../Chat/DirectMessageView'

export default function MainLayout() {
  const [activeServerId, setActiveServerId] = useState(null)
  const [activeServer, setActiveServer] = useState(null)
  const [activeChannelId, setActiveChannelId] = useState(null)
  const [activeDmUid, setActiveDmUid] = useState(null)

  useEffect(() => {
    if (!activeServerId) { setActiveServer(null); setActiveChannelId(null); return }
    const unsub = onSnapshot(doc(db, 'servers', activeServerId), snap => {
      if (snap.exists()) setActiveServer({ id: snap.id, ...snap.data() })
      else { setActiveServer(null); setActiveChannelId(null) }
    })
    return unsub
  }, [activeServerId])

  async function handleSelectServer(serverId) {
    setActiveServerId(serverId)
    setActiveChannelId(null)
    setActiveDmUid(null)
    if (serverId) {
      const snap = await getDocs(
        query(collection(db, 'servers', serverId, 'channels'), orderBy('position', 'asc'))
      )
      if (!snap.empty) {
        const general = snap.docs.find(d => d.data().name === 'general') || snap.docs[0]
        setActiveChannelId(general.id)
      }
    }
  }

  function handleStartDM(uid) {
    setActiveDmUid(uid)
    setActiveServerId(null)
  }

  return (
    <div className="app-layout">
      <DinoDecorations />
      <ServerSidebar
        activeServerId={activeServerId}
        onSelectServer={handleSelectServer}
      />

      {!activeServerId ? (
        <>
          <HomeServersPanel onSelectServer={handleSelectServer} />
          {activeDmUid ? (
            <DirectMessageView
              otherUid={activeDmUid}
              onClose={() => setActiveDmUid(null)}
            />
          ) : (
            <FriendsPanel onStartDM={handleStartDM} />
          )}
        </>
      ) : (
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
