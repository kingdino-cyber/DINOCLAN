import { createContext, useContext, useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from './AuthContext'

const ADMIN_EMAIL = 'bohlehsaurus7@gmail.com'

const MonitorCtx = createContext(null)

export function MonitorProvider({ children }) {
  const { currentUser } = useAuth()
  const [monitorDocs, setMonitorDocs]       = useState([])
  const [monitorUids, setMonitorUids]       = useState(new Set())
  const [pendingReports, setPendingReports] = useState([])
  const [showMonitorPanel, setShowMonitorPanel] = useState(false)

  const isGlobalAdmin = currentUser?.email === ADMIN_EMAIL
  const isMonitor = monitorUids.has(currentUser?.uid) || isGlobalAdmin

  // Subscribe to monitors collection — only once authenticated
  useEffect(() => {
    if (!currentUser) return
    const unsub = onSnapshot(
      collection(db, 'monitors'),
      snap => {
        const docs = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
        setMonitorDocs(docs)
        setMonitorUids(new Set(docs.map(d => d.uid)))
      },
      err => console.warn('monitors subscription:', err.code)
    )
    return unsub
  }, [currentUser?.uid])

  // Subscribe to reports
  useEffect(() => {
    if (!currentUser?.uid) return
    if (!isMonitor && !isGlobalAdmin) return

    let q
    if (isGlobalAdmin) {
      q = query(
        collection(db, 'reports'),
        where('status', 'in', ['pending', 'in_progress']),
        orderBy('createdAt', 'desc')
      )
    } else {
      q = query(
        collection(db, 'reports'),
        where('assignedMonitorUid', '==', currentUser.uid),
        where('status', 'in', ['pending', 'in_progress']),
        orderBy('createdAt', 'desc')
      )
    }

    const unsub = onSnapshot(q, snap => {
      setPendingReports(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, () => {
      // Fallback if composite index doesn't exist yet — fetch without orderBy
      const fallbackQ = isGlobalAdmin
        ? query(collection(db, 'reports'), where('status', 'in', ['pending', 'in_progress']))
        : query(collection(db, 'reports'), where('assignedMonitorUid', '==', currentUser.uid))
      onSnapshot(fallbackQ, snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
        setPendingReports(docs)
      }, () => {})
    })

    return unsub
  }, [currentUser?.uid, isMonitor, isGlobalAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MonitorCtx.Provider value={{
      isGlobalAdmin,
      isMonitor,
      monitorUids,
      monitorDocs,
      pendingReports,
      showMonitorPanel,
      setShowMonitorPanel,
    }}>
      {children}
    </MonitorCtx.Provider>
  )
}

export function useMonitor() {
  return useContext(MonitorCtx)
}
