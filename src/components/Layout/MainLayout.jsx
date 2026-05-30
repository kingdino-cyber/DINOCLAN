import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { doc, onSnapshot, collection, query, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { ProfileProvider } from '../../contexts/ProfileContext'
import ServerSidebar from './ServerSidebar'
import ChannelSidebar from './ChannelSidebar'
import ChatArea from './ChatArea'
import DinoDecorations from '../DinoDecorations'
import FriendsPanel from '../Friends/FriendsPanel'
import HomeServersPanel from './HomeServersPanel'
import DirectMessageView from '../Chat/DirectMessageView'
import CallUI from '../Call/CallUI'
import IncomingCallBanner from '../Call/IncomingCallBanner'
import UserProfileModal from '../Modals/UserProfileModal'
import NotificationToast from '../NotificationToast'

export default function MainLayout() {
  const [activeServerId, setActiveServerId] = useState(null)
  const [activeServer, setActiveServer]     = useState(null)
  const [activeChannelId, setActiveChannelId] = useState(null)
  const [activeDmUid, setActiveDmUid]       = useState(null)

  const location = useLocation()
  useEffect(() => {
    if (location.state?.dmUid) {
      setActiveDmUid(location.state.dmUid)
      setActiveServerId(null)
    }
  }, [location.state])

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

  function handleNavigateToServer(serverId, channelId) {
    setActiveServerId(serverId)
    setActiveChannelId(channelId)
    setActiveDmUid(null)
  }

  return (
    <ProfileProvider>
      <div className="app-layout">
        <DinoDecorations />
        <IncomingCallBanner />
        <CallUI />

        {/* Profile panel lives here — has access to handleStartDM */}
        <UserProfileModal onStartDM={handleStartDM} />

        {/* DM + server notifications */}
        <NotificationToast
          activeDmUid={activeDmUid}
          onStartDM={handleStartDM}
          activeServerId={activeServerId}
          activeChannelId={activeChannelId}
          onNavigateToServer={handleNavigateToServer}
        />

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
              onStartDM={handleStartDM}
            />
          </>
        )}
      </div>
    </ProfileProvider>
  )
}
