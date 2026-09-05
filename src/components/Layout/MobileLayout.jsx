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
import UserPanel from './UserPanel'

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
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
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
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
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
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
            {srv.photoURL ? <img src={srv.photoURL} alt={srv.name} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:14}}/> : getInitials(srv.name)}
          </div>
          <div className="ml-server-info">
            <div className="ml-server-name">{srv.name}</div>
            <div className="ml-server-members">{(srv.members||[]).length} member{(srv.members||[]).length !== 1 ? 's' : ''}</div>
          </div>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--text-muted)',flexShrink:0}}>
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
  const [activeServer, setActiveServer] = useState(null)
  const [activeServerId, setActiveServerId] = useState(null)
  const [activeChannelId, setActiveChannelId] = useState(null)
  const [activeDmUid, setActiveDmUid]   = useState(null)
  // view stack within a tab: 'list' | 'channels' | 'chat' | 'dm'
  const [serverView, setServerView]     = useState('list') // 'list' | 'channels' | 'chat'
  const [homeView, setHomeView]         = useState('friends') // 'friends' | 'dm'

  useEffect(() => {
    if (showMonitorPanel) setTab('monitor')
  }, [showMonitorPanel])

  function handleTab(t) {
    setTab(t)
    if (t === 'monitor') setShowMonitorPanel(true)
    else setShowMonitorPanel(false)
  }

  async function handleSelectServer(srv) {
    setActiveServerId(srv.id)
    const snap = await getDocs(
      query(collection(db, 'servers', srv.id, 'channels'), orderBy('position', 'asc'))
    )
    const serverDoc = await getDoc(doc(db, 'servers', srv.id))
    setActiveServer({ id: srv.id, ...serverDoc.data() })
    if (!snap.empty) {
      const general = snap.docs.find(d => d.data().name === 'general') || snap.docs[0]
      setActiveChannelId(general.id)
    }
    setServerView('channels')
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

  function handleBackFromChat() { setServerView('channels') }
  function handleBackFromChannels() { setServerView('list') }
  function handleBackFromDM() { setHomeView('friends'); setActiveDmUid(null) }

  const currentTitle = () => {
    if (tab === 'home') return homeView === 'dm' ? 'Direct Message' : 'Home'
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
    if (tab === 'servers' && serverView === 'chat') return handleBackFromChat
    if (tab === 'servers' && serverView === 'channels') return handleBackFromChannels
    return null
  }

  return (
    <ProfileProvider>
      <style>{`
        .ml-root {
          display: flex; flex-direction: column;
          height: 100vh; height: 100dvh;
          background: var(--bg-primary); overflow: hidden;
          position: relative;
        }
        .ml-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 8px; height: 52px; flex-shrink: 0;
          background: var(--bg-tertiary);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .ml-header-back {
          width: 40px; height: 40px; border-radius: 10px; border: none;
          background: none; color: var(--text-normal); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .ml-header-back:hover { background: rgba(255,255,255,0.08); }
        .ml-header-title {
          font-size: 15px; font-weight: 700; color: var(--header-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          flex: 1; text-align: center;
        }
        .ml-content {
          flex: 1; overflow: hidden; display: flex; flex-direction: column;
        }
        .ml-bottom-nav {
          display: flex; background: var(--bg-tertiary);
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 6px 4px 10px; padding-bottom: max(10px, env(safe-area-inset-bottom));
          flex-shrink: 0;
        }
        .ml-nav-btn {
          flex: 1; display: flex; flex-direction: column; align-items: center;
          gap: 3px; border: none; background: none; color: var(--text-muted);
          cursor: pointer; padding: 6px 4px; border-radius: 10px;
          transition: color 0.15s, background 0.15s; position: relative;
          font-size: 10px; font-weight: 600;
        }
        .ml-nav-btn.active { color: var(--accent); }
        .ml-nav-btn:active { background: rgba(255,255,255,0.06); }
        .ml-server-list {
          flex: 1; overflow-y: auto; padding: 12px 16px;
          display: flex; flex-direction: column; gap: 4px;
        }
        .ml-server-row {
          display: flex; align-items: center; gap: 14px;
          padding: 12px 14px; border-radius: 14px; border: none;
          background: var(--bg-secondary); cursor: pointer; text-align: left;
          width: 100%; transition: background 0.15s;
        }
        .ml-server-row:active { background: var(--bg-tertiary); }
        .ml-server-icon {
          width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0;
          background: color-mix(in srgb,var(--accent) 15%,transparent);
          color: var(--accent); font-size: 16px; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
        }
        .ml-server-info { flex: 1; min-width: 0; }
        .ml-server-name {
          font-size: 15px; font-weight: 700; color: var(--header-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ml-server-members { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
        .ml-empty {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center; padding: 40px 24px;
          color: var(--text-muted); font-size: 14px;
        }
        .ml-panel-full {
          flex: 1; overflow: hidden; display: flex; flex-direction: column;
        }
        /* Override inner panels to fill mobile space */
        .ml-panel-full .channel-sidebar,
        .ml-panel-full .chat-area,
        .ml-panel-full .friends-panel,
        .ml-panel-full .home-panel,
        .ml-panel-full .discover-panel,
        .ml-panel-full .monitor-panel {
          flex: 1; min-height: 0; border-radius: 0 !important;
          border: none !important;
        }
        /* Hide desktop-only elements inside mobile panels */
        .ml-panel-full .user-panel { display: none !important; }
        .ml-panel-full .members-sidebar { display: none !important; }
        .ml-panel-full .channel-sidebar .user-panel { display: none !important; }
        /* Hide copyright badge in mobile (overlaps bottom nav) */
        .copyright-badge { display: none !important; }
        /* Logout button */
        .ml-logout-btn {
          width: 36px; height: 36px; border-radius: 9px; border: none;
          background: rgba(255,255,255,0.06); color: var(--text-muted);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background 0.15s, color 0.15s;
        }
        .ml-logout-btn:hover { background: rgba(237,66,69,0.18); color: var(--danger,#ed4245); }
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
          right={tab === 'home' && homeView === 'friends' ? (
            <button className="ml-logout-btn" onClick={logout} title="Log out">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          ) : null}
        />

        <div className="ml-content">
          {/* HOME TAB */}
          {tab === 'home' && homeView === 'friends' && (
            <div className="ml-panel-full">
              <FriendsPanel onStartDM={handleStartDM} />
            </div>
          )}
          {tab === 'home' && homeView === 'dm' && activeDmUid && (
            <div className="ml-panel-full">
              <DirectMessageView
                otherUid={activeDmUid}
                onClose={handleBackFromDM}
              />
            </div>
          )}

          {/* SERVERS TAB */}
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
              <ChatArea
                server={activeServer}
                channelId={activeChannelId}
                onStartDM={handleStartDM}
              />
            </div>
          )}

          {/* DISCOVER TAB */}
          {tab === 'discover' && (
            <div className="ml-panel-full">
              <DiscoverPanel onSelectServer={serverId => {
                handleSelectServer({ id: serverId })
                setTab('servers')
              }} />
            </div>
          )}

          {/* MONITOR TAB */}
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
