import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { doc, onSnapshot, collection, query, orderBy, getDocs, getDoc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { ProfileProvider } from '../../contexts/ProfileContext'
import ServerSidebar from './ServerSidebar'
import ChannelSidebar from './ChannelSidebar'
import ChatArea from './ChatArea'
import DinoDecorations from '../DinoDecorations'
import FriendsPanel from '../Friends/FriendsPanel'
import HomeServersPanel from './HomeServersPanel'
import DiscoverPanel from './DiscoverPanel'
import DirectMessageView from '../Chat/DirectMessageView'
import CallUI from '../Call/CallUI'
import IncomingCallBanner from '../Call/IncomingCallBanner'
import UserProfileModal from '../Modals/UserProfileModal'
import NotificationToast from '../NotificationToast'

export default function MainLayout() {
  const { currentUser } = useAuth()
  const [activeServerId, setActiveServerId] = useState(null)
  const [activeServer, setActiveServer]     = useState(null)
  const [activeChannelId, setActiveChannelId] = useState(null)
  const [activeDmUid, setActiveDmUid]       = useState(null)
  const [showDiscover, setShowDiscover]     = useState(false)

  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (location.state?.dmUid) {
      setActiveDmUid(location.state.dmUid)
      setActiveServerId(null)
    }
  }, [location.state])

  // Join-by-link: visiting /app/{serverOrGroupId} adds you as a member
  // (if not already one / not banned) and drops you straight into it.
  useEffect(() => {
    const match = location.pathname.match(/^\/app\/([A-Za-z0-9_-]{15,})$/)
    if (!match || !currentUser?.uid) return
    const targetId = match[1]
    ;(async () => {
      try {
        const snap = await getDoc(doc(db, 'servers', targetId))
        if (!snap.exists()) { navigate('/app', { replace: true }); return }
        const data = snap.data()
        if (data.banned?.includes(currentUser.uid)) { navigate('/app', { replace: true }); return }
        if (!data.members?.includes(currentUser.uid)) {
          await updateDoc(doc(db, 'servers', targetId), { members: arrayUnion(currentUser.uid) })
        }
        navigate('/app', { replace: true })
        handleSelectServer(targetId)
      } catch (err) {
        console.error('Join-by-link failed:', err)
        navigate('/app', { replace: true })
      }
    })()
  }, [location.pathname, currentUser?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

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
    setShowDiscover(false)
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
    setShowDiscover(false)
  }

  function handleOpenDiscover() {
    setShowDiscover(true)
    setActiveServerId(null)
    setActiveDmUid(null)
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
          discoverActive={showDiscover}
          onOpenDiscover={handleOpenDiscover}
        />

        {showDiscover ? (
          <DiscoverPanel onSelectServer={handleSelectServer} />
        ) : !activeServerId ? (
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
