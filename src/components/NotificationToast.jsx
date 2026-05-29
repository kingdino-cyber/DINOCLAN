import { useEffect, useRef, useState } from 'react'
import {
  collection, query, where, orderBy, limit,
  onSnapshot, updateDoc, doc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export default function NotificationToast({ activeDmUid, onStartDM }) {
  const { currentUser } = useAuth()
  const [toasts, setToasts] = useState([])

  // Keep refs so snapshot callbacks always see the latest values
  const activeDmRef  = useRef(activeDmUid)
  const onStartDMRef = useRef(onStartDM)
  useEffect(() => { activeDmRef.current  = activeDmUid }, [activeDmUid])
  useEffect(() => { onStartDMRef.current = onStartDM  }, [onStartDM])

  const initialized = useRef(false)

  // Ask for desktop notification permission once on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    if (!currentUser?.uid) return

    const q = query(
      collection(db, 'users', currentUser.uid, 'notifications'),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(20),
    )

    const unsub = onSnapshot(q, snap => {
      // Skip the very first snapshot — that's existing data, not new messages
      if (!initialized.current) {
        initialized.current = true
        return
      }

      snap.docChanges().forEach(change => {
        if (change.type !== 'added') return
        const data    = change.doc.data()
        const notifId = change.doc.id

        // If user is already looking at this DM, silently mark as read
        if (data.fromUid === activeDmRef.current) {
          updateDoc(
            doc(db, 'users', currentUser.uid, 'notifications', notifId),
            { read: true }
          ).catch(() => {})
          return
        }

        // In-app toast
        const toast = { id: notifId, ...data }
        setToasts(prev => [...prev, toast])
        setTimeout(() => dismiss(notifId), 6000)

        // Desktop notification — shows even when the browser is in the background
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            const n = new Notification(`🦕 ${data.fromName}`, {
              body: data.preview || '📷 Image',
              icon: '/favicon.svg',
              tag:  notifId,   // de-dupes if same message fires twice
              silent: false,
            })
            n.onclick = () => {
              window.focus()
              onStartDMRef.current?.(data.fromUid)
              n.close()
            }
          } catch (_) {}
        }
      })
    })

    return unsub
  }, [currentUser?.uid])

  function dismiss(id) {
    setToasts(prev => prev.filter(t => t.id !== id))
    updateDoc(
      doc(db, 'users', currentUser.uid, 'notifications', id),
      { read: true }
    ).catch(() => {})
  }

  function handleClick(toast) {
    onStartDM(toast.fromUid)
    dismiss(toast.id)
  }

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: 10,
      pointerEvents: 'none',
    }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          onClick={() => handleClick(toast)}
          style={{
            pointerEvents: 'all',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--bg-active)',
            borderLeft: '4px solid var(--accent)',
            borderRadius: 10,
            padding: '12px 14px 12px 14px',
            minWidth: 280,
            maxWidth: 340,
            cursor: 'pointer',
            boxShadow: '0 6px 28px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            animation: 'toastIn 0.22s cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          {/* Dino icon */}
          <div style={{ fontSize: 30, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>🦕</div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: 'var(--header-primary)', fontSize: 14, marginBottom: 3 }}>
              {toast.fromName}
            </div>
            <div style={{
              color: 'var(--text-muted)', fontSize: 13,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {toast.preview || '📷 Image'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 5, fontWeight: 600 }}>
              Click to open chat →
            </div>
          </div>

          {/* Dismiss */}
          <button
            onClick={e => { e.stopPropagation(); dismiss(toast.id) }}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-muted)', cursor: 'pointer',
              fontSize: 15, padding: '0 2px', flexShrink: 0, lineHeight: 1,
            }}
            title="Dismiss"
          >✕</button>
        </div>
      ))}
    </div>
  )
}
