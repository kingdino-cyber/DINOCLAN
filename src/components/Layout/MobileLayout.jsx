import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, orderBy, getDocs, doc, getDoc, updateDoc, deleteDoc, arrayRemove } from 'firebase/firestore'
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
import Settings from '../Modals/Settings'
import LeaveIcon from '../LeaveIcon'
import DinoLogo from '../DinoLogo'
import DinoDecorations from '../DinoDecorations'

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
      <div style={{minWidth:40,display:'flex',justifyContent:'flex-end'}}>{right}</div>
    </header>
  )
}

// ─── SERVER/GROUP ACTION SHEET (Leave / Disband) ──────────────────────────────
function MobileActionSheet({ item, currentUser, isGroup, onClose, onLeave, onDisband }) {
  const isOwner = item.ownerId === currentUser?.uid
  return (
    <div className="ml-sheet-overlay" onClick={onClose}>
      <div className="ml-sheet" onClick={e => e.stopPropagation()}>
        <div className="ml-sheet-title">{item.name}</div>
        {!isOwner && (
          <button className="ml-sheet-item leave" onClick={onLeave}>
            <LeaveIcon size={16} style={{marginRight:8}}/> Leave {isGroup ? 'Group' : 'Server'}
          </button>
        )}
        {isOwner && (
          <button className="ml-sheet-item disband" onClick={onDisband}>
            💥 Disband {isGroup ? 'Group' : 'Server'}
          </button>
        )}
        <button className="ml-sheet-item cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

// ─── SERVER LIST ──────────────────────────────────────────────────────────────
function MobileServerList({ onSelectServer, onOpenMenu }) {
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
          <DinoLogo style={{width:56,height:56,objectFit:'contain',marginBottom:12}} />
          <div style={{color:'var(--header-primary)',fontWeight:700,marginBottom:4}}>No servers yet</div>
          <div style={{color:'var(--text-muted)',fontSize:13}}>Join or create a server to get started.</div>
        </div>
      ) : servers.map(srv => (
        <div key={srv.id} className="ml-server-row">
          <button className="ml-server-row-main" onClick={() => onSelectServer(srv)}>
            <div className="ml-server-icon">
              {srv.photoURL
                ? <img src={srv.photoURL} alt={srv.name} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:14}}/>
                : getInitials(srv.name)}
            </div>
            <div className="ml-server-info">
              <div className="ml-server-name">{srv.name}</div>
              <div className="ml-server-sub">{(srv.members||[]).length} member{(srv.members||[]).length !== 1 ? 's' : ''}</div>
            </div>
          </button>
          <button className="ml-server-dots" onClick={() => onOpenMenu(srv, false)} title="Server options">⋯</button>
        </div>
      ))}
    </div>
  )
}

// ─── GROUP LIST ───────────────────────────────────────────────────────────────
function MobileGroupList({ onSelectGroup, onOpenMenu }) {
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
        <div key={grp.id} className="ml-server-row">
          <button className="ml-server-row-main" onClick={() => onSelectGroup(grp)}>
            <div className="ml-server-icon" style={{borderRadius:'50%'}}>
              {grp.photoURL
                ? <img src={grp.photoURL} alt={grp.name} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'}}/>
                : getInitials(grp.name)}
            </div>
            <div className="ml-server-info">
              <div className="ml-server-name">{grp.name}</div>
              <div className="ml-server-sub">{(grp.members||[]).length} member{(grp.members||[]).length !== 1 ? 's' : ''}</div>
            </div>
          </button>
          <button className="ml-server-dots" onClick={() => onOpenMenu(grp, true)} title="Group options">⋯</button>
        </div>
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
  const [groupView, setGroupView]      = useState('chat') // 'channels' | 'chat'
  const [groupHasChannelList, setGroupHasChannelList] = useState(false)

  const [activeServer, setActiveServer]       = useState(null)
  const [activeServerId, setActiveServerId]   = useState(null)
  const [activeChannelId, setActiveChannelId] = useState(null)
  const [serverView, setServerView]           = useState('list') // 'list' | 'channels' | 'chat'
  const [showSettings, setShowSettings]       = useState(false)
  const [actionSheet, setActionSheet]         = useState(null) // { item, isGroup }

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
    // If there's more than one channel, let the user pick which one to open
    if (snap.docs.length > 1) {
      setGroupHasChannelList(true)
      setGroupView('channels')
    } else {
      setGroupHasChannelList(false)
      setGroupView('chat')
    }
  }

  function handleSelectChannel(channelId) {
    setActiveChannelId(channelId)
    setServerView('chat')
  }

  function handleSelectGroupChannel(channelId) {
    setActiveGroupChannelId(channelId)
    setGroupView('chat')
  }

  function handleStartDM(uid) {
    setActiveDmUid(uid)
    setHomeView('dm')
    setTab('home')
  }

  function handleBackFromDM()        { setHomeView('main'); setActiveDmUid(null) }
  function handleBackFromChat()      { setServerView(activeServer?.members?.length > 0 ? 'channels' : 'list') }
  function handleBackFromChannels()  { setServerView('list') }
  function handleBackFromGroupChannels() { setHomeView('main'); setActiveGroup(null) }
  function handleBackFromGroupChat() {
    if (groupHasChannelList) setGroupView('channels')
    else { setHomeView('main'); setActiveGroup(null) }
  }

  async function handleLeaveServerOrGroup() {
    const { item, isGroup } = actionSheet
    setActionSheet(null)
    await updateDoc(doc(db, 'servers', item.id), { members: arrayRemove(currentUser.uid) })
    if (isGroup && activeGroup?.id === item.id) { setActiveGroup(null); setHomeView('main') }
    if (!isGroup && activeServerId === item.id) { setActiveServer(null); setActiveServerId(null); setServerView('list') }
  }

  async function handleDisbandServerOrGroup() {
    const { item, isGroup } = actionSheet
    setActionSheet(null)
    if (!window.confirm(`Disband "${item.name}"? This cannot be undone.`)) return
    const chSnap = await getDocs(collection(db, 'servers', item.id, 'channels'))
    await Promise.all(chSnap.docs.map(d => deleteDoc(d.ref)))
    await deleteDoc(doc(db, 'servers', item.id))
    if (isGroup && activeGroup?.id === item.id) { setActiveGroup(null); setHomeView('main') }
    if (!isGroup && activeServerId === item.id) { setActiveServer(null); setActiveServerId(null); setServerView('list') }
  }

  const currentTitle = () => {
    if (tab === 'home') {
      if (homeView === 'dm') return 'Direct Message'
      if (homeView === 'groupchat') {
        if (groupView === 'channels') return activeGroup?.name || 'Channels'
        return activeGroup?.name || 'Group Chat'
      }
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
    if (tab === 'home' && homeView === 'groupchat' && groupView === 'channels') return handleBackFromGroupChannels
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
          background: transparent; overflow: hidden;
        }
        .ml-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 10px; height: 52px; flex-shrink: 0;
          background: color-mix(in srgb, var(--bg-tertiary) 70%, transparent);
          backdrop-filter: blur(6px);
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
          display: flex; background: color-mix(in srgb, var(--bg-tertiary) 70%, transparent);
          backdrop-filter: blur(6px);
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
        /* Smooth slide + fade when switching Friends / Groups */
        @keyframes ml-in-from-left  { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes ml-in-from-right { from { opacity: 0; transform: translateX(28px); }  to { opacity: 1; transform: translateX(0); } }
        .ml-slide-left  { animation: ml-in-from-left  0.28s cubic-bezier(.22,1,.36,1); }
        .ml-slide-right { animation: ml-in-from-right 0.28s cubic-bezier(.22,1,.36,1); }
        .ml-home-tab { transition: background 0.25s, color 0.25s; }
        /* Server / group rows */
        .ml-server-list {
          flex: 1; overflow-y: auto; padding: 8px 14px 14px;
          display: flex; flex-direction: column; gap: 6px;
        }
        .ml-server-row {
          display: flex; align-items: stretch; gap: 4px;
          border-radius: 14px; background: color-mix(in srgb, var(--bg-secondary) 75%, transparent);
          backdrop-filter: blur(4px);
          overflow: hidden;
        }
        .ml-server-row-main {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px; border-radius: 14px; border: none;
          background: none; cursor: pointer; text-align: left;
          flex: 1; min-width: 0; transition: background 0.12s;
          -webkit-tap-highlight-color: transparent;
        }
        .ml-server-row-main:active { background: var(--bg-tertiary); }
        .ml-server-dots {
          flex-shrink: 0; width: 40px; border: none; background: none;
          color: var(--text-muted); font-size: 20px; font-weight: 900;
          cursor: pointer; -webkit-tap-highlight-color: transparent;
        }
        .ml-server-dots:active { color: var(--header-primary); }
        /* Leave/Disband action sheet */
        .ml-sheet-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.5);
          display: flex; align-items: flex-end;
        }
        .ml-sheet {
          width: 100%; background: var(--bg-tertiary);
          border-radius: 16px 16px 0 0; padding: 8px 12px max(16px, env(safe-area-inset-bottom));
          display: flex; flex-direction: column; gap: 4px;
        }
        .ml-sheet-title {
          text-align: center; font-size: 13px; font-weight: 700;
          color: var(--text-muted); padding: 10px 0 4px;
        }
        .ml-sheet-item {
          border: none; background: var(--bg-secondary); color: var(--header-primary);
          font-size: 15px; font-weight: 600; padding: 14px; border-radius: 10px;
          cursor: pointer; text-align: center; -webkit-tap-highlight-color: transparent;
        }
        .ml-sheet-item.leave, .ml-sheet-item.disband { color: var(--danger); }
        .ml-sheet-item.cancel { margin-top: 4px; color: var(--text-muted); }
        /* Friend remove button has no hover on touch — always show it */
        .ml-panel-full .friend-remove-btn { opacity: 1 !important; }
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
        /* Non-chat screens let the background image show through (chats stay solid) */
        .ml-panel-full .channel-sidebar,
        .ml-panel-full .discover-panel,
        .ml-panel-full .monitor-panel {
          background: color-mix(in srgb, var(--bg-primary) 45%, transparent) !important;
        }
        .ml-home-tab { background: rgba(14, 24, 14, 0.92); color: var(--text-normal); }
        .ml-home-tab.active { background: var(--accent); color: #fff; }
        /* Hide desktop-only sidebars */
        .ml-panel-full .user-panel { display: none !important; }
        .ml-panel-full .members-sidebar { display: none !important; }
        /* Sponsors list takes up too much space on mobile */
        .ml-panel-full .sponsor-banner { display: none !important; }
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

      <DinoDecorations />
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
            <div style={{display:'flex',gap:6}}>
              <button className="ml-icon-btn" onClick={() => setShowSettings(true)} title="Settings">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
                </svg>
              </button>
              <button className="ml-icon-btn" onClick={logout} title="Log out">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          ) : null}
        />
        {showSettings && <Settings onClose={() => setShowSettings(false)} />}

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
              {/* Both lists stay mounted so their data is already loaded when you switch */}
              <div className="ml-panel-full ml-slide-left" style={{ display: homeSubTab === 'friends' ? 'flex' : 'none' }}>
                <FriendsPanel onStartDM={handleStartDM} />
              </div>
              <div className="ml-panel-full ml-slide-right" style={{ display: homeSubTab === 'groups' ? 'flex' : 'none' }}>
                <MobileGroupList onSelectGroup={handleSelectGroup} onOpenMenu={(grp) => setActionSheet({ item: grp, isGroup: true })} />
              </div>
            </>
          )}
          {tab === 'home' && homeView === 'dm' && activeDmUid && (
            <div className="ml-panel-full">
              <DirectMessageView otherUid={activeDmUid} onClose={handleBackFromDM} />
            </div>
          )}
          {tab === 'home' && homeView === 'groupchat' && groupView === 'channels' && activeGroup && (
            <div className="ml-panel-full">
              <ChannelSidebar
                server={activeGroup}
                activeChannelId={activeGroupChannelId}
                onSelectChannel={handleSelectGroupChannel}
              />
            </div>
          )}
          {tab === 'home' && homeView === 'groupchat' && groupView === 'chat' && activeGroup && activeGroupChannelId && (
            <div className="ml-panel-full">
              <ChatArea server={activeGroup} channelId={activeGroupChannelId} onStartDM={handleStartDM} />
            </div>
          )}

          {/* ── SERVERS TAB ────────────────────────────────────────────── */}
          {tab === 'servers' && serverView === 'list' && (
            <MobileServerList onSelectServer={handleSelectServer} onOpenMenu={(srv) => setActionSheet({ item: srv, isGroup: false })} />
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

      {actionSheet && (
        <MobileActionSheet
          item={actionSheet.item}
          isGroup={actionSheet.isGroup}
          currentUser={currentUser}
          onClose={() => setActionSheet(null)}
          onLeave={handleLeaveServerOrGroup}
          onDisband={handleDisbandServerOrGroup}
        />
      )}
    </ProfileProvider>
  )
}
