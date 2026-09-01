import { useEffect, useState, useRef } from 'react'
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
  const [show67, setShow67]                 = useState(false)
  const [showRawr, setShowRawr]             = useState(false)
  const [showMeteor, setShowMeteor]         = useState(false)
  const isMobile = localStorage.getItem('dinoclan_mobile') === 'true'
  const [mobilePanel, setMobilePanel] = useState('servers') // 'servers' | 'channels' | 'chat'

  const location = useLocation()
  const navigate = useNavigate()

  // Sync URL → state on load and back/forward navigation
  const didInitRef = useRef(false)
  useEffect(() => {
    const p = location.pathname

    // DM navigation via router state (e.g. from FriendsPanel)
    if (location.state?.dmUid) {
      setActiveDmUid(location.state.dmUid)
      setActiveServerId(null)
      navigate(`/app/@me/${location.state.dmUid}`, { replace: true, state: null })
      return
    }

    // /app/server/:serverId/:channelId
    const scMatch = p.match(/^\/app\/server\/([^/]+)\/([^/]+)$/)
    if (scMatch) {
      setActiveServerId(scMatch[1])
      setActiveChannelId(scMatch[2])
      setActiveDmUid(null)
      setShowDiscover(false)
      didInitRef.current = true
      return
    }

    // /app/server/:serverId  — auto-pick first channel
    const sMatch = p.match(/^\/app\/server\/([^/]+)$/)
    if (sMatch && !didInitRef.current) {
      didInitRef.current = true
      handleSelectServer(sMatch[1])
      return
    }

    // /app/@me/:dmUid
    const dmMatch = p.match(/^\/app\/@me\/([^/]+)$/)
    if (dmMatch) {
      setActiveDmUid(dmMatch[1])
      setActiveServerId(null)
      setShowDiscover(false)
      didInitRef.current = true
      return
    }

    // /app/discover
    if (p === '/app/discover') {
      setShowDiscover(true)
      setActiveServerId(null)
      setActiveDmUid(null)
      didInitRef.current = true
      return
    }

    // Join-by-link: /app/{firebaseId} (15+ chars, not one of the named paths above)
    const joinMatch = p.match(/^\/app\/([A-Za-z0-9_-]{15,})$/)
    if (joinMatch && currentUser?.uid) {
      const targetId = joinMatch[1]
      ;(async () => {
        try {
          const snap = await getDoc(doc(db, 'servers', targetId))
          if (!snap.exists()) { navigate('/app', { replace: true }); return }
          const data = snap.data()
          if (data.banned?.includes(currentUser.uid)) { navigate('/app', { replace: true }); return }
          if (!data.members?.includes(currentUser.uid)) {
            await updateDoc(doc(db, 'servers', targetId), { members: arrayUnion(currentUser.uid) })
          }
          handleSelectServer(targetId)
        } catch (err) {
          console.error('Join-by-link failed:', err)
          navigate('/app', { replace: true })
        }
      })()
    }
  }, [location.pathname, location.state, currentUser?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  const lastEventRef = useRef(null)
  useEffect(() => {
    if (!activeServerId) { setActiveServer(null); setActiveChannelId(null); return }
    const unsub = onSnapshot(doc(db, 'servers', activeServerId), snap => {
      if (snap.exists()) {
        const data = snap.data()
        setActiveServer({ id: snap.id, ...data })
        // screen events — only fire if the event happened in the last 6 seconds
        const ev = data.screenEvent
        if (ev?.at) {
          const ts  = ev.at.toMillis?.() ?? 0
          const age = Date.now() - ts
          if (ts !== lastEventRef.current && age < 6000) {
            lastEventRef.current = ts
            if (ev.type === '67') {
              setShow67(true)
              setTimeout(() => setShow67(false), 5000)
              try {
                const u = new SpeechSynthesisUtterance('67')
                u.rate = 0.85; u.pitch = 1.1; u.volume = 1
                window.speechSynthesis.speak(u)
              } catch (_) {}
            } else if (ev.type === 'rawr') {
              setShowRawr(true)
              setTimeout(() => setShowRawr(false), 800)
            } else if (ev.type === 'meteor') {
              setShowMeteor(true)
              setTimeout(() => setShowMeteor(false), 3500)
            }
          }
        }
      } else { setActiveServer(null); setActiveChannelId(null) }
    })
    return unsub
  }, [activeServerId])

  async function handleSelectServer(serverId) {
    setActiveServerId(serverId)
    setActiveChannelId(null)
    setActiveDmUid(null)
    setShowDiscover(false)
    if (isMobile) setMobilePanel('channels')
    if (serverId) {
      const snap = await getDocs(
        query(collection(db, 'servers', serverId, 'channels'), orderBy('position', 'asc'))
      )
      if (!snap.empty) {
        const general = snap.docs.find(d => d.data().name === 'general') || snap.docs[0]
        setActiveChannelId(general.id)
        navigate(`/app/server/${serverId}/${general.id}`, { replace: true })
      } else {
        navigate(`/app/server/${serverId}`, { replace: true })
      }
    } else {
      navigate('/app', { replace: true })
    }
  }

  function handleSelectChannel(channelId) {
    setActiveChannelId(channelId)
    if (isMobile) setMobilePanel('chat')
    if (activeServerId && channelId) {
      navigate(`/app/server/${activeServerId}/${channelId}`)
    }
  }

  function handleStartDM(uid) {
    setActiveDmUid(uid)
    setActiveServerId(null)
    setShowDiscover(false)
    if (isMobile) setMobilePanel('chat')
    navigate(`/app/@me/${uid}`)
  }

  function handleOpenDiscover() {
    setShowDiscover(true)
    setActiveServerId(null)
    setActiveDmUid(null)
    if (isMobile) setMobilePanel('channels')
    navigate('/app/discover')
  }

  function handleNavigateToServer(serverId, channelId) {
    setActiveServerId(serverId)
    setActiveChannelId(channelId)
    setActiveDmUid(null)
    if (serverId && channelId) navigate(`/app/server/${serverId}/${channelId}`)
  }

  const mobileTitle = mobilePanel === 'chat'
    ? (activeDmUid ? '💬 DM' : `# ${activeServer?.name || 'Chat'}`)
    : mobilePanel === 'channels'
    ? (activeServer?.name || 'Channels')
    : '🦕 DINOCLAN'

  return (
    <ProfileProvider>
      <div className={`app-layout${isMobile ? ' app-layout-mobile' : ''}`}>
        {isMobile && (
          <div className="mobile-topbar">
            {mobilePanel !== 'servers' && (
              <button className="mobile-back" onClick={() => setMobilePanel(mobilePanel === 'chat' ? 'channels' : 'servers')}>←</button>
            )}
            <span className="mobile-title">{mobileTitle}</span>
            {mobilePanel === 'servers' && (
              <button className="mobile-dm-btn" title="Direct Messages" onClick={() => { setActiveServerId(null); setActiveDmUid(null); setShowDiscover(false); setMobilePanel('chat') }}>💬</button>
            )}
          </div>
        )}
        {show67 && (
          <div className="overlay-67" onClick={() => setShow67(false)}>
            <span className="overlay-67-text">67</span>
          </div>
        )}
        {showRawr && (
          <div className="overlay-rawr" onClick={() => setShowRawr(false)}>
            <span className="overlay-rawr-text">🦖 RAWR!</span>
          </div>
        )}
        {showMeteor && (
          <div className="overlay-meteor" onClick={() => setShowMeteor(false)}>
            {Array.from({ length: 18 }, (_, i) => (
              <div key={i} className="meteor-piece" style={{
                left:              `${Math.random() * 100}%`,
                animationDelay:    `${Math.random() * 1.5}s`,
                animationDuration: `${0.6 + Math.random() * 0.8}s`,
              }} />
            ))}
            <span className="overlay-meteor-text">☄️</span>
          </div>
        )}
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

        {/* Server sidebar — always shown on desktop; only on 'servers' panel on mobile */}
        {(!isMobile || mobilePanel === 'servers') && (
          <ServerSidebar
            activeServerId={activeServerId}
            onSelectServer={handleSelectServer}
            discoverActive={showDiscover}
            onOpenDiscover={handleOpenDiscover}
          />
        )}

        {showDiscover ? (
          (!isMobile || mobilePanel === 'channels') && <DiscoverPanel onSelectServer={handleSelectServer} />
        ) : !activeServerId ? (
          <>
            {(!isMobile || mobilePanel === 'channels') && <HomeServersPanel onSelectServer={handleSelectServer} />}
            {(!isMobile || mobilePanel === 'chat') && (
              activeDmUid
                ? <DirectMessageView otherUid={activeDmUid} onClose={() => { setActiveDmUid(null); setMobilePanel('servers'); navigate('/app') }} />
                : <FriendsPanel onStartDM={handleStartDM} />
            )}
          </>
        ) : (
          <>
            {(!isMobile || mobilePanel === 'channels') && (
              <ChannelSidebar server={activeServer} activeChannelId={activeChannelId} onSelectChannel={handleSelectChannel} />
            )}
            {(!isMobile || mobilePanel === 'chat') && (
              <ChatArea server={activeServer} channelId={activeChannelId} onStartDM={handleStartDM} />
            )}
          </>
        )}
      </div>
    </ProfileProvider>
  )
}
