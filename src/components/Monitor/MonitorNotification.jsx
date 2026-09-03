import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'

export default function MonitorNotification({ onOpenDM }) {
  const { currentUser } = useAuth()
  const [notif, setNotif] = useState(null)

  useEffect(() => {
    if (!currentUser?.uid) return
    const q = query(
      collection(db, 'notifications'),
      where('toUid', '==', currentUser.uid),
      where('read', '==', false),
      where('type', 'in', ['monitor_dm', 'monitor_question'])
    )
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setNotif(docs.length > 0 ? docs[0] : null)
    }, () => {})
    return unsub
  }, [currentUser?.uid])

  async function handleChat() {
    if (!notif) return
    await updateDoc(doc(db, 'notifications', notif.id), { read: true })
    onOpenDM(notif.fromUid)
    setNotif(null)
  }

  async function handleDismiss() {
    if (!notif) return
    await updateDoc(doc(db, 'notifications', notif.id), { read: true })
    setNotif(null)
  }

  if (!notif) return null

  return (
    <>
      <style>{`
        @keyframes mn-slide-in {
          from { opacity:0; transform:translateY(20px) scale(0.95) }
          to   { opacity:1; transform:translateY(0) scale(1) }
        }
        .mn-banner {
          position: fixed; bottom: 80px; right: 24px; z-index: 8500;
          background: var(--bg-secondary);
          border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
          border-radius: 16px; padding: 18px 20px;
          width: 300px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06);
          animation: mn-slide-in 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        .mn-header { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
        .mn-icon {
          width:36px; height:36px; border-radius:10px; flex-shrink:0;
          background:color-mix(in srgb,var(--accent) 20%,transparent);
          display:flex; align-items:center; justify-content:center;
          color:var(--accent);
        }
        .mn-title { font-size:14px; font-weight:700; color:var(--header-primary); }
        .mn-sub { font-size:12px; color:var(--text-muted); margin-top:1px; }
        .mn-body { font-size:13px; color:var(--text-normal); margin-bottom:14px; line-height:1.5; }
        .mn-actions { display:flex; gap:8px; }
        .mn-btn-chat {
          flex:1; padding:9px; border-radius:9px; border:none;
          background:var(--accent); color:#fff; font-size:13px; font-weight:700;
          cursor:pointer; transition:opacity 0.15s;
        }
        .mn-btn-chat:hover { opacity:0.85; }
        .mn-btn-dismiss {
          padding:9px 14px; border-radius:9px;
          border:1.5px solid rgba(255,255,255,0.1);
          background:none; color:var(--text-muted); font-size:13px;
          cursor:pointer; transition:background 0.15s;
        }
        .mn-btn-dismiss:hover { background:rgba(255,255,255,0.06); }
      `}</style>

      <div className="mn-banner">
        <div className="mn-header">
          <div className="mn-icon">
            {notif.type === 'monitor_question' ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
            )}
          </div>
          <div>
            <div className="mn-title">{notif.type === 'monitor_question' ? 'Monitor has a question' : 'Monitor is ready'}</div>
            <div className="mn-sub">{notif.fromName}</div>
          </div>
        </div>
        <p className="mn-body">
          {notif.type === 'monitor_question'
            ? `"${notif.question}"`
            : 'A community monitor has picked up your report and is ready to chat with you privately.'}
        </p>
        <div className="mn-actions">
          <button className="mn-btn-chat" onClick={handleChat}>
            {notif.type === 'monitor_question' ? 'Reply in DM' : 'Chat Now'}
          </button>
          <button className="mn-btn-dismiss" onClick={handleDismiss}>Dismiss</button>
        </div>
      </div>
    </>
  )
}
