import { useEffect, useRef, useState } from 'react'
import {
  collection, query, where, orderBy, limit,
  onSnapshot, updateDoc, doc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export default function NotificationToast({
  activeDmUid, onStartDM,
  activeServerId, activeChannelId, onNavigateToServer,
}) {
  const { currentUser } = useAuth()
  const [toasts, setToasts] = useState([])

  // Keep refs so snapshot callbacks always see the latest values
  const activeDmRef       = useRef(activeDmUid)
  const activeServerRef   = useRef(activeServerId)
  const activeChannelRef  = useRef(activeChannelId)
  const onStartDMRef      = useRef(onStartDM)
  const onNavigateRef     = useRef(onNavigateToServer)

  useEffect(() => { activeDmRef.current      = activeDmUid      }, [activeDmUid])
  useEffect(() => { activeServerRef.current  = activeServerId   }, [activeServerId])
  useEffect(() => { activeChannelRef.current = activeChannelId  }, [activeChannelId])
  useEffect(() => { onStartDMRef.current     = onStartDM        }, [onStartDM])
  useEffect(() => { onNavigateRef.current    = onNavigateToServer }, [onNavigateToServer])

  const mountTimeRef = useRef(Date.now())

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

      snap.docChanges().forEach(change => {
        if (change.type !== 'added') return
        const data    = change.doc.data()
        const notifId = change.doc.id

        // Skip notifications created before this page loaded — these are a
        // backlog (e.g. from before a missing Firestore index was fixed),
        // not genuinely new messages. Just mark them read silently.
        const createdMs = data.createdAt?.toMillis?.() ?? 0
        if (createdMs && createdMs < mountTimeRef.current) {
          updateDoc(
            doc(db, 'users', currentUser.uid, 'notifications', notifId),
            { read: true }
          ).catch(() => {})
          return
        }

        const isServer = data.type === 'server'

        if (isServer) {
          // Skip if already viewing that exact channel
          if (
            data.serverId  === activeServerRef.current &&
            data.channelId === activeChannelRef.current
          ) {
            updateDoc(
              doc(db, 'users', currentUser.uid, 'notifications', notifId),
              { read: true }
            ).catch(() => {})
            return
          }
        } else {
          // DM: skip if already in that conversation
          if (data.fromUid === activeDmRef.current) {
            updateDoc(
              doc(db, 'users', currentUser.uid, 'notifications', notifId),
              { read: true }
            ).catch(() => {})
            return
          }
        }

        // In-app toast
        const toast = { id: notifId, ...data }
        setToasts(prev => [...prev, toast])
        setTimeout(() => dismiss(notifId), 6000)

        // Desktop notification
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            const title = isServer
              ? `🦕 ${data.fromName} in #${data.channelName}`
              : `🦕 ${data.fromName}`
            const body = data.preview || (isServer ? '💬 New message' : '📷 Image')
            const n = new Notification(title, {
              body,
              icon: '/favicon.svg',
              tag:  notifId,
              silent: false,
            })
            n.onclick = () => {
              window.focus()
              if (isServer) {
                onNavigateRef.current?.(data.serverId, data.channelId)
              } else {
                onStartDMRef.current?.(data.fromUid)
              }
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
    if (toast.type === 'server') {
      onNavigateToServer?.(toast.serverId, toast.channelId)
    } else {
      onStartDM?.(toast.fromUid)
    }
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
          {/* Icon */}
          <div style={{ fontSize: 30, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>🦕</div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: 'var(--header-primary)', fontSize: 14, marginBottom: 2 }}>
              {toast.fromName}
            </div>
            {toast.type === 'server' && (
              <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 3, fontWeight: 600 }}>
                #{toast.channelName} · {toast.serverName}
              </div>
            )}
            <div style={{
              color: 'var(--text-muted)', fontSize: 13,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {toast.preview || '💬 New message'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 5, fontWeight: 600 }}>
              Click to open →
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
