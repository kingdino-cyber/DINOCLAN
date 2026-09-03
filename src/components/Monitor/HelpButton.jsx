import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useMonitor } from '../../contexts/MonitorContext'
import ReportForm from './ReportForm'

export default function HelpButton() {
  const { currentUser } = useAuth()
  const { isMonitor, isGlobalAdmin } = useMonitor()
  const [showForm, setShowForm] = useState(false)
  const [suspendedUntil, setSuspendedUntil] = useState(null)

  useEffect(() => {
    if (!currentUser?.uid) return
    const unsub = onSnapshot(
      doc(db, 'users', currentUser.uid),
      snap => setSuspendedUntil(snap.data()?.suspendedUntil ?? null),
      () => {}
    )
    return unsub
  }, [currentUser?.uid])

  // Hide for monitors, but admin can still report even though isMonitor is true for them
  if (isMonitor && !isGlobalAdmin) return null

  const isSuspended = suspendedUntil && suspendedUntil.toDate?.() > new Date()

  return (
    <>
      {isSuspended && (
        <div style={{
          position: 'fixed', bottom: 80, right: 24, zIndex: 8001,
          background: 'var(--danger)', color: '#fff',
          borderRadius: 10, padding: '8px 14px',
          fontSize: 12, fontWeight: 700, maxWidth: 220,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          🚫 Suspended until {suspendedUntil.toDate().toLocaleDateString()}
        </div>
      )}
      <button
        className="help-btn"
        onClick={() => setShowForm(true)}
        title="Request help from a monitor"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
          <path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66"/>
          <path d="m18 15-2-2"/>
          <path d="m15 18-2-2"/>
        </svg>
      </button>
      {showForm && <ReportForm onClose={() => setShowForm(false)} />}
    </>
  )
}
