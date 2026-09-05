import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, orderBy, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useMonitor } from '../../contexts/MonitorContext'
import { ProfileProvider } from '../../contexts/ProfileContext'
import FriendsPanel from '../Friends/FriendsPanel'
import ChannelSidebar from './ChannelSidebar'
import ChatArea from './ChatArea'
import DirectMessageView from '../Chat/DirectMessageView'
import DiscoverPanel from './DiscoverPanel'
import MonitorPanel from '../Monitor/MonitorPanel'
import HelpButton from '../Monitor/HelpButton'
import MonitorNotification from '../Monitor/MonitorNotification'
import NotificationToast from '../NotificationToast'
import IncomingCallBanner from '../Call/IncomingCallBanner'
import CallUI from '../Call/CallUI'

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

// ─── BOTTOM NAV ──────────────────────────────────────────────────────────────
function BottomNav({ tab, onTab, isMonitor, isGlobalAdmin, pendingReports }) {
  return (
    <nav className="ml-bottom-nav">
      <button className={`ml-nav-btn${tab==='home'?' active':''}`} onClick={()=>onTab('home')}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span>Home</span>
      </button>
      <button className={`ml-nav-btn${tab==='servers'?' active':''}`} onClick={()=>onTab('servers')}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
        </svg>
        <span>Servers</span>
      </button>
      <button className={`ml-nav-btn${tab==='discover'?' active':''}`} onClick={()=>onTab('discover')}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M15.5 8.5L13 13L8.5 15.5L11 11L15.5 8.5Z" fill="currentColor" stroke="none"/>
        </svg>
        <span>Discover</span>
      </button>
      {(isMonitor || isGlobalAdmin) && (
        <button className={`ml-nav-btn${tab==='monitor'?' active':''}`} onClick={()=>onTab('monitor')} style={{position:'relative'}}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          {pendingReports.length > 0 && (
            <span style={{position:'absolute',top:4,right:'calc(50% - 18px)',background:'var(--danger)',color:'#fff',borderRadius:'50%',width:14,height:14,fontSize:9,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>
              {pendingReports.length}
            </span>
          )}
          <span>Monitor</span>
        </button>
      )}
    </nav>
  )
}

// ─── MOBILE HEADER ────────────────────────────────────────────────────────────
function MobileHeader({ title, onBack, right }) {
  return (
    <header className="ml-header">
      {onBack ? (
        <button className="ml-header-back" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
      ) : <div style={{width:40}}/>}
      <span className="ml-header-title">{title}</span>
      <div style={{width:40,display:'flex',justifyContent:'flex-end'}}>{right}</div>
    </header>
  )
}

// ─── SERVER LIST ──────────────────────────────────────────────────────────────
function MobileServerList({ onSelectServer }) {
  const { currentUser } = useAuth()
  const [servers, setServers] = useState([])

  useEffect(() => {
    const q = query(collection(db, 'servers'), where('members', 'array-contains', currentUser.uid))
    return onSnapshot(q, snap => {
      setServers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.kind !== 'group'))
    })
  }, [currentUser.uid])

  return (
    <div className="ml-server-list">
      {servers.length === 0 ? (
        <div className="ml-empty">
          <div style={{fontSize:48,marginBottom:12}}>🦕</div>
          <div style={{color:'var(--header-primary)',fontWeight:700,marginBottom:4}}>No servers yet</div>
          <div style={{color:'var(--text-muted)',fontSize:13}}>Join or create a server to get started.</div>
        </div>
      ) : servers.map(srv => (
        <button key={srv.id} className="ml-server-row" onClick={() => onSelectServer(srv)}>
          <div className="ml-server-icon">
            {srv.photoURL
              ? <img src={srv.photoURL} alt={srv.name} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:14}}/>
              : getInitials(srv.name)}
          </div>
          <div className="ml-server-info">
            <div className="ml-server-name">{srv.name}</div>
            <div className="ml-server-sub">{(srv.members||[]).length} member{(srv.members||[]).length !== 1 ? 's' : ''}</div>
          </div>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--text-muted)',flexShrink:0}}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      ))}
    </div>
  )
}

// ─── GROUP LIST ───────────────────────────────────────────────────────────────
function MobileGroupList({ onSelectGroup }) {
  const { currentUser } = useAuth()
  const [groups, setGroups] = useState([])

  useEffect(() => {
    const q = query(collection(db, 'servers'), where('members', 'array-contains', currentUser.uid))
    return onSnapshot(q, snap => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.kind === 'group'))
    })
  }, [currentUser.uid])

  return (
    <div className="ml-server-list">
      {groups.length === 0 ? (
        <div className="ml-empty">
          <div style={{fontSize:40,marginBottom:10}}>💬</div>
          <div style={{color:'var(--header-primary)',fontWeight:700,marginBottom:4}}>No group chats</div>
          <div style={{color:'var(--text-muted)',fontSize:13}}>Create or join a group from the desktop app.</div>
        </div>
      ) : groups.map(grp => (
        <button key={grp.id} className="ml-server-row" onClick={() => onSelectGroup(grp)}>
          <div className="ml-server-icon" style={{borderRadius:'50%'}}>
            {grp.photoURL
              ? <img src={grp.photoURL} alt={grp.name} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}}/>
              : getInitials(grp.name)}
          </div>
          <div className="ml-server-info">
            <div className="ml-server-name">{grp.name}</div>
            <div className="ml-server-sub">{(grp.members||[]).length} member{(grp.members||[]).length !== 1 ? 's' : ''}</div>
          </div>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--text-muted)',flexShrink:0}}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      ))}
    </div>
  )
}

// ─── MAIN MOBILE LAYOUT ───────────────────────────────────────────────────────
export default function MobileLayout() {
  const { currentUser, logout } = useAuth()
  const { isMonitor, isGlobalAdmin, pendingReports, showMonitorPanel, setShowMonitorPanel } = useMonitor()

  const [tab, setTab]                   = useState('home')
  const [homeSubTab, setHomeSubTab]     = useState('friends') // 'friends' | 'groups'
  const [homeView, setHomeView]         = useState('main')    // 'main' | 'dm' | 'groupchat'
  const [activeDmUid, setActiveDmUid]  = useState(null)
  const [activeGroup, setActiveGroup]  = useState(null)
  const [activeGroupChannelId, setActiveGroupChannelId] = useState(null)

  const [activeServer, setActiveServer]       = useState(null)
  const [activeServerId, setActiveServerId]   = useState(null)
  const [activeChannelId, setActiveChannelId] = useState(null)
  const [serverView, setServerView]           = useState('list') // 'list' | 'channels' | 'chat'

  useEffect(() => {
    if (showMonitorPanel) setTab('monitor')
  }, [showMonitorPanel])

  function handleTab(t) {
    setTab(t)
    if (t === 'monitor') setShowMonitorPanel(true)
    else setShowMonitorPanel(false)
  }

  async function handleSelectServer(srv) {
    const snap = await getDocs(
      query(collection(db, 'servers', srv.id, 'channels'), orderBy('position', 'asc'))
    )
    const serverDoc = await getDoc(doc(db, 'servers', srv.id))
    const fullServer = { id: srv.id, ...serverDoc.data() }
    setActiveServer(fullServer)
    setActiveServerId(srv.id)
    const textChannels = snap.docs.filter(d => d.data().type !== 'voice')
    const first = textChannels.find(d => d.data().name === 'general') || textChannels[0] || snap.docs[0]
    if (first) setActiveChannelId(first.id)
    // If only one text channel, skip channel list and go straight to chat
    if (textChannels.length <= 1) {
      setServerView('chat')
    } else {
      setServerView('channels')
    }
  }

  async function handleSelectGroup(grp) {
    const snap = await getDocs(
      query(collection(db, 'servers', grp.id, 'channels'), orderBy('position', 'asc'))
    )
    const grpDoc = await getDoc(doc(db, 'servers', grp.id))
    const fullGrp = { id: grp.id, ...grpDoc.data() }
    setActiveGroup(fullGrp)
    const first = snap.docs[0]
    if (first) setActiveGroupChannelId(first.id)
    setHomeView('groupchat')
  }

  function handleSelectChannel(channelId) {
    setActiveChannelId(channelId)
    setServerView('chat')
  }

  function handleStartDM(uid) {
    setActiveDmUid(uid)
    setHomeView('dm')
    setTab('home')
  }

  function handleBackFromGroupChat() { setHomeView('main'); setActiveGroup(null) }
  function handleBackFromDM()        { setHomeView('main'); setActiveDmUid(null) }
  function handleBackFromChat()      { setServerView(activeServer?.members?.length > 0 ? 'channels' : 'list') }
  function handleBackFromChannels()  { setServerView('list') }

  const currentTitle = () => {
    if (tab === 'home') {
      if (homeView === 'dm') return 'Direct Message'
      if (homeView === 'groupchat') return activeGroup?.name || 'Group Chat'
      return 'Home'
    }
    if (tab === 'servers') {
      if (serverView === 'chat') return activeServer?.name || 'Chat'
      if (serverView === 'channels') return activeServer?.name || 'Channels'
      return 'Servers'
    }
    if (tab === 'discover') return 'Discover'
    if (tab === 'monitor') return 'Monitor'
    return 'DINOCLAN'
  }

  const currentBack = () => {
    if (tab === 'home' && homeView === 'dm') return handleBackFromDM
    if (tab === 'home' && homeView === 'groupchat') return handleBackFromGroupChat
    if (tab === 'servers' && serverView === 'chat') return handleBackFromChat
    if (tab === 'servers' && serverView === 'channels') return handleBackFromChannels
    return null
  }

  const showLogout = tab === 'home' && homeView === 'main'

  return (
    <ProfileProvider>
      <style>{`
        .ml-root {
          display: flex; flex-direction: column;
          height: 100vh; height: 100dvh;
          background: var(--bg-primary); overflow: hidden;
        }
        .ml-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 10px; height: 52px; flex-shrink: 0;
          background: var(--bg-tertiary);
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .ml-header-back {
          width: 40px; height: 40px; border-radius: 10px; border: none;
          background: none; color: var(--text-normal); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
        }
        .ml-header-title {
          font-size: 15px; font-weight: 700; color: var(--header-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          flex: 1; text-align: center;
        }
        .ml-content { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
        .ml-bottom-nav {
          display: flex; background: var(--bg-tertiary);
          border-top: 1px solid rgba(255,255,255,0.07);
          padding: 6px 4px; padding-bottom: max(10px, env(safe-area-inset-bottom));
          flex-shrink: 0;
        }
        .ml-nav-btn {
          flex: 1; display: flex; flex-direction: column; align-items: center;
          gap: 3px; border: none; background: none; color: var(--text-muted);
          cursor: pointer; padding: 6px 4px; border-radius: 10px;
          transition: color 0.15s; position: relative;
          font-size: 10px; font-weight: 600; -webkit-tap-highlight-color: transparent;
        }
        .ml-nav-btn.active { color: var(--accent); }
        /* Sub-tab pills for Home */
        .ml-home-tabs {
          display: flex; gap: 6px; padding: 10px 14px 6px;
          flex-shrink: 0;
        }
        .ml-home-tab {
          flex: 1; padding: 8px 0; border-radius: 10px; border: none;
          font-size: 13px; font-weight: 700; cursor: pointer;
          transition: background 0.15s, color 0.15s;
          background: var(--bg-secondary); color: var(--text-muted);
          -webkit-tap-highlight-color: transparent;
        }
        .ml-home-tab.active {
          background: color-mix(in srgb,var(--accent) 18%,transparent);
          color: var(--accent);
        }
        /* Server / group rows */
        .ml-server-list {
          flex: 1; overflow-y: auto; padding: 8px 14px 14px;
          display: flex; flex-direction: column; gap: 6px;
        }
        .ml-server-row {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px; border-radius: 14px; border: none;
          background: var(--bg-secondary); cursor: pointer; text-align: left;
          width: 100%; transition: background 0.12s;
          -webkit-tap-highlight-color: transparent;
        }
        .ml-server-row:active { background: var(--bg-tertiary); }
        .ml-server-icon {
          width: 46px; height: 46px; border-radius: 14px; flex-shrink: 0;
          background: color-mix(in srgb,var(--accent) 15%,transparent);
          color: var(--accent); font-size: 15px; font-weight: 800;
          display: flex; align-items: center; justify-content: center; overflow: hidden;
        }
        .ml-server-info { flex: 1; min-width: 0; }
        .ml-server-name {
          font-size: 14px; font-weight: 700; color: var(--header-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ml-server-sub { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
        .ml-empty {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center; padding: 40px 24px;
          color: var(--text-muted); font-size: 14px;
        }
        .ml-panel-full { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
        /* Override inner panels */
        .ml-panel-full .channel-sidebar,
        .ml-panel-full .chat-area,
        .ml-panel-full .friends-panel,
        .ml-panel-full .home-panel,
        .ml-panel-full .discover-panel,
        .ml-panel-full .monitor-panel {
          flex: 1; min-height: 0; border-radius: 0 !important; border: none !important;
        }
        /* Hide desktop-only sidebars */
        .ml-panel-full .user-panel { display: none !important; }
        .ml-panel-full .members-sidebar { display: none !important; }
        /* Hide copyright badge (overlaps bottom nav on mobile) */
        .copyright-badge { display: none !important; }
        /* Logout / icon buttons in header */
        .ml-icon-btn {
          width: 36px; height: 36px; border-radius: 9px; border: none;
          background: rgba(255,255,255,0.06); color: var(--text-muted);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; -webkit-tap-highlight-color: transparent;
        }
      `}</style>

      <HelpButton />
      <MonitorNotification onOpenDM={handleStartDM} />
      <IncomingCallBanner />
      <CallUI />
      <NotificationToast
        activeDmUid={activeDmUid}
        onStartDM={handleStartDM}
        activeServerId={activeServerId}
        activeChannelId={activeChannelId}
        onNavigateToServer={(sid, cid) => {
          setActiveServerId(sid); setActiveChannelId(cid)
          setServerView('chat'); setTab('servers')
        }}
      />

      <div className="ml-root">
        <MobileHeader
          title={currentTitle()}
          onBack={currentBack()}
          right={showLogout ? (
            <button className="ml-icon-btn" onClick={logout} title="Log out">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          ) : null}
        />

        <div className="ml-content">

          {/* ── HOME TAB ───────────────────────────────────────────────── */}
          {tab === 'home' && homeView === 'main' && (
            <>
              <div className="ml-home-tabs">
                <button className={`ml-home-tab${homeSubTab==='friends'?' active':''}`} onClick={()=>setHomeSubTab('friends')}>
                  Friends
                </button>
                <button className={`ml-home-tab${homeSubTab==='groups'?' active':''}`} onClick={()=>setHomeSubTab('groups')}>
                  Groups
                </button>
              </div>
              <div className="ml-panel-full">
                {homeSubTab === 'friends'
                  ? <FriendsPanel onStartDM={handleStartDM} />
                  : <MobileGroupList onSelectGroup={handleSelectGroup} />
                }
              </div>
            </>
          )}
          {tab === 'home' && homeView === 'dm' && activeDmUid && (
            <div className="ml-panel-full">
              <DirectMessageView otherUid={activeDmUid} onClose={handleBackFromDM} />
            </div>
          )}
          {tab === 'home' && homeView === 'groupchat' && activeGroup && activeGroupChannelId && (
            <div className="ml-panel-full">
              <ChatArea server={activeGroup} channelId={activeGroupChannelId} onStartDM={handleStartDM} />
            </div>
          )}

          {/* ── SERVERS TAB ────────────────────────────────────────────── */}
          {tab === 'servers' && serverView === 'list' && (
            <MobileServerList onSelectServer={handleSelectServer} />
          )}
          {tab === 'servers' && serverView === 'channels' && activeServerId && (
            <div className="ml-panel-full">
              <ChannelSidebar
                server={activeServer}
                activeChannelId={activeChannelId}
                onSelectChannel={handleSelectChannel}
              />
            </div>
          )}
          {tab === 'servers' && serverView === 'chat' && (
            <div className="ml-panel-full">
              <ChatArea server={activeServer} channelId={activeChannelId} onStartDM={handleStartDM} />
            </div>
          )}

          {/* ── DISCOVER TAB ───────────────────────────────────────────── */}
          {tab === 'discover' && (
            <div className="ml-panel-full">
              <DiscoverPanel onSelectServer={serverId => {
                handleSelectServer({ id: serverId })
                setTab('servers')
              }} />
            </div>
          )}

          {/* ── MONITOR TAB ────────────────────────────────────────────── */}
          {tab === 'monitor' && (
            <div className="ml-panel-full">
              <MonitorPanel onStartDM={handleStartDM} />
            </div>
          )}
        </div>

        <BottomNav
          tab={tab}
          onTab={handleTab}
          isMonitor={isMonitor}
          isGlobalAdmin={isGlobalAdmin}
          pendingReports={pendingReports}
        />
      </div>
    </ProfileProvider>
  )
}
