import { useState } from 'react'
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useMonitor } from '../../contexts/MonitorContext'
import { useAuth } from '../../contexts/AuthContext'
import UserPanel from '../Layout/UserPanel'

const ADMIN_EMAIL = 'bohlehsaurus7@gmail.com'

const MONITOR_SVG = (size = 18) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
  </svg>
)

const HEART_SVG = (size = 16) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
    <path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66"/>
    <path d="m18 15-2-2"/><path d="m15 18-2-2"/>
  </svg>
)

function formatDate(ts) {
  if (!ts) return ''
  try { return ts.toDate().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

function StatusBadge({ status }) {
  const isProgress = status === 'in_progress'
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
      background: isProgress ? 'rgba(90,158,68,0.18)' : 'rgba(255,200,0,0.15)',
      color: isProgress ? 'var(--success)' : '#ffcc00',
      letterSpacing: '0.02em',
    }}>
      {isProgress ? 'In Progress' : 'Pending'}
    </span>
  )
}

// ─── ADMIN PANEL ─────────────────────────────────────────────────────────────
function AdminPanel({ monitorDocs, pendingReports, setShowMonitorPanel, onStartDM }) {
  const { currentUser } = useAuth()
  const [suspendEmail, setSuspendEmail] = useState('')
  const [suspendDays, setSuspendDays]   = useState(1)
  const [suspendStatus, setSuspendStatus] = useState('')
  const [suspendLoading, setSuspendLoading] = useState(false)
  const [lightboxUrl, setLightboxUrl]   = useState(null)
  const [tab, setTab]                   = useState('reports')
  const [quizState, setQuizState]       = useState({}) // reportId → question text
  const [quizOpen, setQuizOpen]         = useState({}) // reportId → bool

  async function handleChatWith(report) {
    await updateDoc(doc(db, 'reports', report.id), { status: 'in_progress' })
    await addDoc(collection(db, 'notifications'), {
      toUid: report.reporterUid,
      fromUid: currentUser.uid,
      fromName: currentUser.displayName || currentUser.email,
      type: 'monitor_dm',
      read: false,
      createdAt: serverTimestamp(),
    })
    setShowMonitorPanel(false)
    onStartDM(report.reporterUid)
  }

  async function handleMarkDone(report) {
    await updateDoc(doc(db, 'reports', report.id), { status: 'resolved' })
  }

  async function handleSendQuestion(report) {
    const q = (quizState[report.id] || '').trim()
    if (!q) return
    await addDoc(collection(db, 'notifications'), {
      toUid: report.reporterUid,
      fromUid: currentUser.uid,
      fromName: currentUser.displayName || currentUser.email,
      type: 'monitor_question',
      question: q,
      read: false,
      createdAt: serverTimestamp(),
    })
    setQuizState(s => ({ ...s, [report.id]: '' }))
    setQuizOpen(s => ({ ...s, [report.id]: false }))
  }

  async function handleSuspend() {
    const email = suspendEmail.trim().toLowerCase()
    if (!email) return
    if (email === ADMIN_EMAIL) { setSuspendStatus('Cannot suspend the admin.'); return }
    setSuspendLoading(true); setSuspendStatus('')
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)))
      if (snap.empty) { setSuspendStatus('User not found.'); setSuspendLoading(false); return }
      const until = new Date(Date.now() + suspendDays * 86400000)
      await updateDoc(doc(db, 'users', snap.docs[0].id), { suspendedUntil: Timestamp.fromDate(until) })
      setSuspendStatus(`Suspended for ${suspendDays} day${suspendDays > 1 ? 's' : ''}.`)
      setSuspendEmail('')
    } catch { setSuspendStatus('Failed to suspend.') }
    setSuspendLoading(false)
  }

  return (
    <>
      <style>{`
        @keyframes mp-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        .mp-admin-layout { display:flex; flex:1; overflow:hidden; }
        .mp-sidebar {
          width:220px; flex-shrink:0; display:flex; flex-direction:column;
          background:var(--bg-primary); border-right:1px solid rgba(255,255,255,0.05);
        }
        .mp-sidebar-header {
          padding:18px 14px 10px; font-size:10px; font-weight:700;
          text-transform:uppercase; letter-spacing:0.1em; color:var(--text-muted);
        }
        .mp-sidebar-nav { display:flex; flex-direction:column; gap:2px; padding:0 8px; }
        .mp-nav-btn {
          display:flex; align-items:center; gap:9px;
          padding:9px 10px; border-radius:8px; border:none; background:none;
          color:var(--text-muted); font-size:13px; font-weight:600;
          cursor:pointer; text-align:left; transition:background 0.15s, color 0.15s; width:100%;
        }
        .mp-nav-btn:hover { background:rgba(255,255,255,0.06); color:var(--text-normal); }
        .mp-nav-btn.active { background:color-mix(in srgb,var(--accent) 15%,transparent); color:var(--accent); }
        .mp-nav-badge {
          margin-left:auto; background:var(--danger); color:#fff;
          border-radius:20px; padding:1px 7px; font-size:11px; font-weight:700;
        }
        .mp-monitor-row {
          display:flex; align-items:center; gap:8px;
          padding:6px 10px; border-radius:6px; font-size:13px;
          color:var(--text-normal); transition:background 0.15s;
        }
        .mp-monitor-row:hover { background:rgba(255,255,255,0.04); }
        .mp-content { flex:1; overflow-y:auto; }
        .mp-section { padding:28px 32px; animation:mp-in 0.2s ease; }
        .mp-section-label {
          font-size:11px; font-weight:700; text-transform:uppercase;
          letter-spacing:0.1em; color:var(--text-muted);
          margin-bottom:16px; display:flex; align-items:center; gap:7px;
          padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.06);
        }
        .mp-empty-card {
          background:var(--bg-tertiary); border-radius:14px;
          border:1px solid rgba(255,255,255,0.06);
          padding:48px 24px; text-align:center;
        }
        .mp-report-card {
          background:var(--bg-tertiary); border-radius:14px;
          border:1px solid rgba(255,255,255,0.07);
          padding:18px 20px; margin-bottom:12px;
          animation:mp-in 0.2s ease;
          transition:border-color 0.2s;
        }
        .mp-report-card:hover { border-color:rgba(255,255,255,0.14); }
        .mp-report-meta { display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap; }
        .mp-report-name { font-weight:700; color:var(--header-primary); font-size:14px; }
        .mp-report-time { font-size:11px; color:var(--text-muted); margin-left:auto; }
        .mp-report-desc { color:var(--text-normal); font-size:13px; line-height:1.6; margin:0 0 12px; }
        .mp-chat-btn {
          display:inline-flex; align-items:center; gap:6px;
          padding:7px 16px; border-radius:8px; border:none;
          background:var(--accent); color:#fff; font-size:12px; font-weight:700;
          cursor:pointer; transition:opacity 0.15s, transform 0.15s; flex-shrink:0;
        }
        .mp-chat-btn:hover { opacity:0.85; transform:translateY(-1px); }
        .mp-suspend-card {
          background:var(--bg-tertiary); border-radius:14px;
          border:1px solid rgba(255,255,255,0.06); padding:22px;
        }
        .mp-suspend-desc { color:var(--text-muted); font-size:13px; line-height:1.5; margin:0 0 16px; }
        .mp-suspend-row { display:flex; gap:8px; flex-wrap:wrap; }
        .mp-input {
          flex:1; min-width:180px;
          background:var(--bg-primary); border:1.5px solid rgba(255,255,255,0.08);
          border-radius:9px; padding:10px 14px; color:var(--text-normal);
          font-size:13px; font-family:inherit; outline:none;
          transition:border-color 0.2s;
        }
        .mp-input:focus { border-color:var(--accent); }
        .mp-select {
          background:var(--bg-primary); border:1.5px solid rgba(255,255,255,0.08);
          border-radius:9px; padding:10px 12px; color:var(--text-normal);
          font-size:13px; font-family:inherit; outline:none; cursor:pointer;
          transition:border-color 0.2s;
        }
        .mp-select:focus { border-color:var(--accent); }
        .mp-suspend-btn {
          padding:10px 20px; border-radius:9px; border:none;
          background:var(--danger); color:#fff; font-size:13px; font-weight:700;
          cursor:pointer; transition:opacity 0.15s;
        }
        .mp-suspend-btn:disabled { opacity:0.45; cursor:not-allowed; }
        .mp-suspend-btn:not(:disabled):hover { opacity:0.85; }
        .mp-status-ok { color:var(--success); font-size:13px; margin:10px 0 0; }
        .mp-status-err { color:var(--danger); font-size:13px; margin:10px 0 0; }
        .mp-done-btn {
          display:inline-flex; align-items:center; gap:6px;
          padding:7px 16px; border-radius:8px; border:none;
          background:color-mix(in srgb,var(--success,#3ba55c) 18%,transparent);
          color:var(--success,#3ba55c); font-size:12px; font-weight:700;
          cursor:pointer; transition:background 0.15s;
          border:1px solid color-mix(in srgb,var(--success,#3ba55c) 35%,transparent);
        }
        .mp-done-btn:hover { background:color-mix(in srgb,var(--success,#3ba55c) 28%,transparent); }
        .mp-quiz-btn {
          display:inline-flex; align-items:center; gap:6px;
          padding:7px 16px; border-radius:8px;
          border:1.5px solid rgba(255,255,255,0.1);
          background:none; color:var(--text-muted); font-size:12px; font-weight:700;
          cursor:pointer; transition:background 0.15s, color 0.15s;
        }
        .mp-quiz-btn:hover { background:rgba(255,255,255,0.06); color:var(--text-normal); }
        .mp-quiz-input-row { display:flex; gap:8px; margin-top:10px; }
        .mp-quiz-input {
          flex:1; background:var(--bg-primary); border:1.5px solid rgba(255,255,255,0.08);
          border-radius:8px; padding:8px 12px; color:var(--text-normal);
          font-size:13px; font-family:inherit; outline:none;
          transition:border-color 0.2s;
        }
        .mp-quiz-input:focus { border-color:var(--accent); }
        .mp-quiz-send {
          padding:8px 16px; border-radius:8px; border:none;
          background:var(--accent); color:#fff; font-size:12px; font-weight:700;
          cursor:pointer; transition:opacity 0.15s;
        }
        .mp-quiz-send:disabled { opacity:0.4; cursor:not-allowed; }
        .mp-quiz-send:not(:disabled):hover { opacity:0.85; }
        .mp-lightbox {
          position:fixed; inset:0; z-index:9999;
          background:rgba(0,0,0,0.92);
          display:flex; align-items:center; justify-content:center;
          cursor:zoom-out; backdrop-filter:blur(6px);
        }
        .mp-monitors-list { padding:0 8px 12px; overflow-y:auto; flex:1; }
        .mp-admin-badge {
          font-size:9px; font-weight:700; text-transform:uppercase;
          letter-spacing:0.08em; padding:2px 6px; border-radius:4px;
          background:color-mix(in srgb,var(--accent) 20%,transparent);
          color:var(--accent);
        }
      `}</style>

      {lightboxUrl && (
        <div className="mp-lightbox" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="evidence" style={{ maxWidth:'90vw', maxHeight:'90vh', borderRadius:12 }} />
        </div>
      )}

      <div className="mp-admin-layout">
        {/* Sidebar */}
        <div className="mp-sidebar">
          <div className="mp-sidebar-header">Admin Panel</div>

          <div className="mp-sidebar-nav">
            <button className={`mp-nav-btn${tab==='reports'?' active':''}`} onClick={()=>setTab('reports')}>
              {HEART_SVG(15)}
              Reports
              {pendingReports.length > 0 && <span className="mp-nav-badge">{pendingReports.length}</span>}
            </button>
            <button className={`mp-nav-btn${tab==='suspend'?' active':''}`} onClick={()=>setTab('suspend')}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
              </svg>
              Suspend User
            </button>
            <button className={`mp-nav-btn${tab==='monitors'?' active':''}`} onClick={()=>setTab('monitors')}>
              {MONITOR_SVG(15)}
              Monitors
              <span style={{marginLeft:'auto',fontSize:11,color:'var(--text-muted)',fontWeight:400}}>{monitorDocs.length}</span>
            </button>
          </div>

          <div style={{marginTop:'auto'}}>
            <UserPanel />
          </div>
        </div>

        {/* Main content */}
        <div className="mp-content">
          {tab === 'reports' && (
            <div className="mp-section">
              <div className="mp-section-label">
                {HEART_SVG(14)} Reports — All
              </div>
              {pendingReports.length === 0 ? (
                <div className="mp-empty-card">
                  <div style={{fontSize:40,marginBottom:12}}>✅</div>
                  <div style={{color:'var(--header-primary)',fontWeight:700,fontSize:15,marginBottom:4}}>All clear</div>
                  <div style={{color:'var(--text-muted)',fontSize:13}}>No pending reports.</div>
                </div>
              ) : pendingReports.map(r => (
                <div className="mp-report-card" key={r.id}>
                  <div className="mp-report-meta">
                    <span className="mp-report-name">{r.reporterName}</span>
                    <StatusBadge status={r.status} />
                    <span className="mp-report-time">{formatDate(r.createdAt)}</span>
                  </div>
                  <p className="mp-report-desc">{r.description}</p>
                  <div style={{display:'flex',gap:12,alignItems:'flex-end',flexWrap:'wrap'}}>
                    {r.evidenceBase64 && (
                      <img src={r.evidenceBase64} alt="evidence"
                        style={{maxWidth:160,maxHeight:110,borderRadius:8,objectFit:'cover',cursor:'zoom-in',border:'1px solid rgba(255,255,255,0.1)'}}
                        onClick={()=>setLightboxUrl(r.evidenceBase64)}
                      />
                    )}
                    <button className="mp-chat-btn" onClick={()=>handleChatWith(r)}>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      Chat
                    </button>
                    <button className="mp-quiz-btn" onClick={()=>setQuizOpen(s=>({...s,[r.id]:!s[r.id]}))}>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      Ask Question
                    </button>
                    <button className="mp-done-btn" onClick={()=>handleMarkDone(r)}>
                      ✓ Done
                    </button>
                  </div>
                  {quizOpen[r.id] && (
                    <div className="mp-quiz-input-row">
                      <input
                        className="mp-quiz-input"
                        placeholder="Type your question for the reporter…"
                        value={quizState[r.id] || ''}
                        onChange={e=>setQuizState(s=>({...s,[r.id]:e.target.value}))}
                        onKeyDown={e=>e.key==='Enter'&&handleSendQuestion(r)}
                        autoFocus
                      />
                      <button className="mp-quiz-send" onClick={()=>handleSendQuestion(r)} disabled={!(quizState[r.id]||'').trim()}>
                        Send
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'suspend' && (
            <div className="mp-section">
              <div className="mp-section-label">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                Suspend a User
              </div>
              <div className="mp-suspend-card">
                <p className="mp-suspend-desc">
                  Suspended users cannot send messages. Maximum 5 days. Admin cannot be suspended.
                </p>
                <div className="mp-suspend-row">
                  <input className="mp-input" placeholder="User email…"
                    value={suspendEmail}
                    onChange={e=>{setSuspendEmail(e.target.value);setSuspendStatus('')}}
                    onKeyDown={e=>e.key==='Enter'&&handleSuspend()}
                  />
                  <select className="mp-select" value={suspendDays} onChange={e=>setSuspendDays(Number(e.target.value))}>
                    {[1,2,3,4,5].map(d=><option key={d} value={d}>{d} day{d>1?'s':''}</option>)}
                  </select>
                  <button className="mp-suspend-btn" onClick={handleSuspend} disabled={suspendLoading||!suspendEmail.trim()}>
                    {suspendLoading ? '…' : 'Suspend'}
                  </button>
                </div>
                {suspendStatus && (
                  <p className={suspendStatus.startsWith('Suspended') ? 'mp-status-ok' : 'mp-status-err'}>
                    {suspendStatus.startsWith('Suspended') ? '✅ ' : '❌ '}{suspendStatus}
                  </p>
                )}
              </div>
            </div>
          )}

          {tab === 'monitors' && (
            <div className="mp-section">
              <div className="mp-section-label">
                {MONITOR_SVG(14)} Monitor Team ({monitorDocs.length})
              </div>
              {monitorDocs.length === 0 ? (
                <div className="mp-empty-card">
                  <div style={{color:'var(--text-muted)',fontSize:13}}>No monitors assigned yet.</div>
                </div>
              ) : (
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
                  {monitorDocs.map(m => (
                    <div key={m.uid} style={{
                      background:'var(--bg-tertiary)', borderRadius:12,
                      border:'1px solid rgba(255,255,255,0.07)',
                      padding:'16px 18px', display:'flex', alignItems:'center', gap:12,
                    }}>
                      <div style={{
                        width:38, height:38, borderRadius:'50%',
                        background:'color-mix(in srgb,var(--accent) 15%,transparent)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        color:'var(--accent)', flexShrink:0,
                      }}>
                        {MONITOR_SVG(18)}
                      </div>
                      <div style={{minWidth:0}}>
                        <div style={{fontWeight:700,color:'var(--header-primary)',fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {m.displayName || m.email}
                        </div>
                        <div style={{fontSize:11,color:'var(--text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── MONITOR PANEL ────────────────────────────────────────────────────────────
function MonitorView({ pendingReports, setShowMonitorPanel, onStartDM }) {
  const { currentUser } = useAuth()
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const [suspendEmail, setSuspendEmail] = useState('')
  const [suspendDays, setSuspendDays]   = useState(1)
  const [suspendStatus, setSuspendStatus] = useState('')
  const [suspendLoading, setSuspendLoading] = useState(false)
  const [quizState, setQuizState]       = useState({})
  const [quizOpen, setQuizOpen]         = useState({})

  async function handleChatWith(report) {
    await updateDoc(doc(db, 'reports', report.id), { status: 'in_progress' })
    await addDoc(collection(db, 'notifications'), {
      toUid: report.reporterUid,
      fromUid: currentUser.uid,
      fromName: currentUser.displayName || currentUser.email,
      type: 'monitor_dm',
      read: false,
      createdAt: serverTimestamp(),
    })
    setShowMonitorPanel(false)
    onStartDM(report.reporterUid)
  }

  async function handleMarkDone(report) {
    await updateDoc(doc(db, 'reports', report.id), { status: 'resolved' })
  }

  async function handleSendQuestion(report) {
    const q = (quizState[report.id] || '').trim()
    if (!q) return
    await addDoc(collection(db, 'notifications'), {
      toUid: report.reporterUid,
      fromUid: currentUser.uid,
      fromName: currentUser.displayName || currentUser.email,
      type: 'monitor_question',
      question: q,
      read: false,
      createdAt: serverTimestamp(),
    })
    setQuizState(s => ({ ...s, [report.id]: '' }))
    setQuizOpen(s => ({ ...s, [report.id]: false }))
  }

  async function handleSuspend() {
    const email = suspendEmail.trim().toLowerCase()
    if (!email) return
    if (email === ADMIN_EMAIL) { setSuspendStatus('err:Cannot suspend the admin.'); return }
    setSuspendLoading(true); setSuspendStatus('')
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)))
      if (snap.empty) { setSuspendStatus('err:User not found.'); setSuspendLoading(false); return }
      const until = new Date(Date.now() + suspendDays * 86400000)
      await updateDoc(doc(db, 'users', snap.docs[0].id), { suspendedUntil: Timestamp.fromDate(until) })
      setSuspendStatus(`ok:Suspended for ${suspendDays} day${suspendDays > 1 ? 's' : ''}.`)
      setSuspendEmail('')
    } catch { setSuspendStatus('err:Failed to suspend.') }
    setSuspendLoading(false)
  }

  return (
    <>
      <style>{`
        .mp-monitor-layout { display:flex; flex:1; overflow:hidden; }
        .mp-monitor-sidebar {
          width:230px; flex-shrink:0; display:flex; flex-direction:column;
          background:var(--bg-primary); border-right:1px solid rgba(255,255,255,0.05);
          padding:20px 14px 0;
        }
        .mp-monitor-role-card {
          border-radius:12px; padding:16px 14px; margin-bottom:16px;
          background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 18%,transparent),color-mix(in srgb,var(--accent) 6%,transparent));
          border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);
        }
        .mp-monitor-role-icon {
          width:40px; height:40px; border-radius:10px; margin-bottom:10px;
          background:color-mix(in srgb,var(--accent) 20%,transparent);
          display:flex; align-items:center; justify-content:center; color:var(--accent);
        }
        .mp-monitor-role-title { font-size:13px; font-weight:700; color:var(--header-primary); margin-bottom:4px; }
        .mp-monitor-role-desc { font-size:12px; color:var(--text-muted); line-height:1.5; }
        .mp-monitor-stats {
          display:flex; gap:8px; margin-bottom:16px;
        }
        .mp-monitor-stat {
          flex:1; background:var(--bg-secondary); border-radius:10px;
          padding:10px 12px; border:1px solid rgba(255,255,255,0.06);
          text-align:center;
        }
        .mp-monitor-stat-num { font-size:20px; font-weight:800; color:var(--header-primary); line-height:1; }
        .mp-monitor-stat-label { font-size:10px; color:var(--text-muted); margin-top:3px; text-transform:uppercase; letter-spacing:0.06em; }
        .mp-monitor-content { flex:1; overflow-y:auto; padding:28px 32px; }
        .mp-monitor-section-label {
          font-size:11px; font-weight:700; text-transform:uppercase;
          letter-spacing:0.1em; color:var(--text-muted);
          margin-bottom:16px; display:flex; align-items:center; gap:7px;
          padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.06);
        }
        .mp-monitor-report-card {
          background:var(--bg-tertiary); border-radius:14px;
          border:1px solid rgba(255,255,255,0.07);
          padding:20px 22px; margin-bottom:12px;
          animation:mp-in 0.2s ease; transition:border-color 0.2s, box-shadow 0.2s;
        }
        .mp-monitor-report-card:hover { border-color:rgba(255,255,255,0.15); box-shadow:0 4px 20px rgba(0,0,0,0.2); }
        .mp-monitor-reporter-row { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
        .mp-monitor-reporter-avatar {
          width:34px; height:34px; border-radius:50%; flex-shrink:0;
          background:color-mix(in srgb,var(--accent) 20%,transparent);
          display:flex; align-items:center; justify-content:center;
          color:var(--accent); font-size:14px; font-weight:700;
        }
        .mp-monitor-reporter-name { font-weight:700; color:var(--header-primary); font-size:14px; }
        .mp-monitor-reporter-time { font-size:11px; color:var(--text-muted); margin-left:auto; }
        .mp-monitor-desc {
          color:var(--text-normal); font-size:13px; line-height:1.6;
          margin:0 0 14px; padding:12px 14px;
          background:rgba(0,0,0,0.2); border-radius:8px;
          border-left:3px solid color-mix(in srgb,var(--accent) 50%,transparent);
        }
        .mp-monitor-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .mp-monitor-chat-btn {
          display:inline-flex; align-items:center; gap:7px;
          padding:9px 20px; border-radius:9px; border:none;
          background:var(--accent); color:#fff; font-size:13px; font-weight:700;
          cursor:pointer; transition:opacity 0.15s, transform 0.15s;
        }
        .mp-monitor-chat-btn:hover { opacity:0.85; transform:translateY(-1px); }
        .mp-suspend-section {
          background:var(--bg-tertiary); border-radius:14px;
          border:1px solid rgba(255,255,255,0.06); padding:24px;
        }
        .mp-suspend-title { font-size:14px; font-weight:700; color:var(--header-primary); margin:0 0 6px; }
        .mp-suspend-desc2 { color:var(--text-muted); font-size:13px; line-height:1.5; margin:0 0 18px; }
        .mp-done-btn {
          display:inline-flex; align-items:center; gap:6px;
          padding:9px 18px; border-radius:9px; border:none;
          background:color-mix(in srgb,var(--success,#3ba55c) 18%,transparent);
          color:var(--success,#3ba55c); font-size:13px; font-weight:700;
          cursor:pointer; transition:background 0.15s;
          border:1px solid color-mix(in srgb,var(--success,#3ba55c) 35%,transparent);
        }
        .mp-done-btn:hover { background:color-mix(in srgb,var(--success,#3ba55c) 28%,transparent); }
        .mp-quiz-btn {
          display:inline-flex; align-items:center; gap:7px;
          padding:9px 18px; border-radius:9px;
          border:1.5px solid rgba(255,255,255,0.1);
          background:none; color:var(--text-muted); font-size:13px; font-weight:700;
          cursor:pointer; transition:background 0.15s, color 0.15s;
        }
        .mp-quiz-btn:hover { background:rgba(255,255,255,0.06); color:var(--text-normal); }
        .mp-quiz-input-row { display:flex; gap:8px; margin-top:12px; }
        .mp-quiz-input {
          flex:1; background:var(--bg-primary); border:1.5px solid rgba(255,255,255,0.08);
          border-radius:8px; padding:9px 12px; color:var(--text-normal);
          font-size:13px; font-family:inherit; outline:none; transition:border-color 0.2s;
        }
        .mp-quiz-input:focus { border-color:var(--accent); }
        .mp-quiz-send {
          padding:9px 18px; border-radius:8px; border:none;
          background:var(--accent); color:#fff; font-size:13px; font-weight:700;
          cursor:pointer; transition:opacity 0.15s;
        }
        .mp-quiz-send:disabled { opacity:0.4; cursor:not-allowed; }
        .mp-quiz-send:not(:disabled):hover { opacity:0.85; }
      `}</style>

      {lightboxUrl && (
        <div className="mp-lightbox" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="evidence" style={{ maxWidth:'90vw', maxHeight:'90vh', borderRadius:12 }} />
        </div>
      )}

      <div className="mp-monitor-layout">
        {/* Sidebar */}
        <div className="mp-monitor-sidebar">
          <div className="mp-monitor-role-card">
            <div className="mp-monitor-role-icon">{MONITOR_SVG(20)}</div>
            <div className="mp-monitor-role-title">Community Monitor</div>
            <div className="mp-monitor-role-desc">Review member reports and keep the community safe.</div>
          </div>

          <div className="mp-monitor-stats">
            <div className="mp-monitor-stat">
              <div className="mp-monitor-stat-num">{pendingReports.length}</div>
              <div className="mp-monitor-stat-label">Open</div>
            </div>
            <div className="mp-monitor-stat">
              <div className="mp-monitor-stat-num">{pendingReports.filter(r=>r.status==='in_progress').length}</div>
              <div className="mp-monitor-stat-label">Active</div>
            </div>
          </div>

          <div style={{marginTop:'auto'}}>
            <UserPanel />
          </div>
        </div>

        {/* Content */}
        <div className="mp-monitor-content">
          {/* Reports */}
          <div style={{marginBottom:36}}>
            <div className="mp-monitor-section-label">
              {HEART_SVG(14)} Assigned Reports
              {pendingReports.length > 0 && (
                <span style={{marginLeft:'auto',background:'var(--danger)',color:'#fff',borderRadius:20,padding:'2px 9px',fontSize:11,fontWeight:700}}>
                  {pendingReports.length}
                </span>
              )}
            </div>
            {pendingReports.length === 0 ? (
              <div className="mp-empty-card">
                <div style={{fontSize:36,marginBottom:10}}>✅</div>
                <div style={{color:'var(--header-primary)',fontWeight:700,fontSize:15,marginBottom:4}}>All clear</div>
                <div style={{color:'var(--text-muted)',fontSize:13}}>No reports assigned to you right now.</div>
              </div>
            ) : pendingReports.map(r => (
              <div className="mp-monitor-report-card" key={r.id}>
                <div className="mp-monitor-reporter-row">
                  <div className="mp-monitor-reporter-avatar">
                    {(r.reporterName||'?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="mp-monitor-reporter-name">{r.reporterName}</div>
                    <StatusBadge status={r.status} />
                  </div>
                  <span className="mp-monitor-reporter-time">{formatDate(r.createdAt)}</span>
                </div>
                <p className="mp-monitor-desc">{r.description}</p>
                <div className="mp-monitor-actions">
                  {r.evidenceBase64 && (
                    <img src={r.evidenceBase64} alt="evidence"
                      style={{maxWidth:140,maxHeight:100,borderRadius:8,objectFit:'cover',cursor:'zoom-in',border:'1px solid rgba(255,255,255,0.1)'}}
                      onClick={()=>setLightboxUrl(r.evidenceBase64)}
                    />
                  )}
                  <button className="mp-monitor-chat-btn" onClick={()=>handleChatWith(r)}>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    Open Chat
                  </button>
                  <button className="mp-quiz-btn" onClick={()=>setQuizOpen(s=>({...s,[r.id]:!s[r.id]}))}>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    Ask Question
                  </button>
                  <button className="mp-done-btn" onClick={()=>handleMarkDone(r)}>
                    ✓ Done
                  </button>
                </div>
                {quizOpen[r.id] && (
                  <div className="mp-quiz-input-row">
                    <input
                      className="mp-quiz-input"
                      placeholder="Type your question for the reporter…"
                      value={quizState[r.id] || ''}
                      onChange={e=>setQuizState(s=>({...s,[r.id]:e.target.value}))}
                      onKeyDown={e=>e.key==='Enter'&&handleSendQuestion(r)}
                      autoFocus
                    />
                    <button className="mp-quiz-send" onClick={()=>handleSendQuestion(r)} disabled={!(quizState[r.id]||'').trim()}>
                      Send
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Suspend */}
          <div className="mp-suspend-section">
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--danger)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              <p className="mp-suspend-title">Suspend a User</p>
            </div>
            <p className="mp-suspend-desc2">Suspended users cannot send messages for up to 5 days.</p>
            <div className="mp-suspend-row">
              <input className="mp-input" placeholder="User email…"
                value={suspendEmail}
                onChange={e=>{setSuspendEmail(e.target.value);setSuspendStatus('')}}
                onKeyDown={e=>e.key==='Enter'&&handleSuspend()}
              />
              <select className="mp-select" value={suspendDays} onChange={e=>setSuspendDays(Number(e.target.value))}>
                {[1,2,3,4,5].map(d=><option key={d} value={d}>{d} day{d>1?'s':''}</option>)}
              </select>
              <button className="mp-suspend-btn" onClick={handleSuspend} disabled={suspendLoading||!suspendEmail.trim()}>
                {suspendLoading ? '…' : 'Suspend'}
              </button>
            </div>
            {suspendStatus && (
              <p className={suspendStatus.startsWith('ok:') ? 'mp-status-ok' : 'mp-status-err'} style={{marginTop:12}}>
                {suspendStatus.startsWith('ok:') ? '✅ ' : '❌ '}{suspendStatus.slice(3)}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function MonitorPanel({ onStartDM }) {
  const { isGlobalAdmin, monitorDocs, pendingReports, setShowMonitorPanel } = useMonitor()

  return (
    <div className="monitor-panel">
      <div className="monitor-panel-header" style={{
        background: isGlobalAdmin
          ? 'linear-gradient(135deg, color-mix(in srgb,var(--accent) 12%,var(--bg-tertiary)), var(--bg-tertiary))'
          : 'var(--bg-tertiary)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{
            width:34, height:34, borderRadius:9,
            background: isGlobalAdmin
              ? 'color-mix(in srgb,var(--accent) 22%,transparent)'
              : 'rgba(255,255,255,0.08)',
            display:'flex', alignItems:'center', justifyContent:'center',
            color: isGlobalAdmin ? 'var(--accent)' : 'var(--text-muted)',
          }}>
            {MONITOR_SVG(18)}
          </div>
          <div>
            <div style={{ color:'var(--header-primary)', fontSize:16, fontWeight:700, lineHeight:1.2 }}>
              Monitor Panel
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>
              {isGlobalAdmin ? 'Administrator — full access' : 'Monitor — assigned reports'}
            </div>
          </div>
          {pendingReports.length > 0 && (
            <span style={{
              background:'var(--danger)', color:'#fff',
              borderRadius:20, padding:'2px 9px', fontSize:12, fontWeight:700, marginLeft:4,
            }}>
              {pendingReports.length}
            </span>
          )}
        </div>
      </div>

      {isGlobalAdmin
        ? <AdminPanel monitorDocs={monitorDocs} pendingReports={pendingReports} setShowMonitorPanel={setShowMonitorPanel} onStartDM={onStartDM} />
        : <MonitorView pendingReports={pendingReports} setShowMonitorPanel={setShowMonitorPanel} onStartDM={onStartDM} />
      }
    </div>
  )
}
