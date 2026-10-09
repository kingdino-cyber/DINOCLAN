import { createContext, useContext, useEffect, useRef, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendEmailVerification,
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp, updateDoc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { HEARTBEAT_MS } from '../utils/presence'
import { keepaliveSetOffline } from '../utils/keepalive'

const AuthContext = createContext(null)

const ACTION_CODE_SETTINGS = {
  url: 'https://dinoclan.netlify.app/login',
  handleCodeInApp: true,
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [myProfile, setMyProfile] = useState(null) // Firestore users/{uid} doc — shared across all UserPanel instances

  async function register(email, password, displayName, birthday) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName })
    setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      displayName,
      email,
      photoURL: null,
      status: 'online',
      birthday: birthday || null,
      createdAt: serverTimestamp(),
    }).catch(err => console.warn('Firestore profile write failed:', err.code, err.message))
    return cred
  }

  async function changePassword(currentPassword, newPassword) {
    const user = auth.currentUser
    if (!user) throw new Error('Not logged in')
    const credential = EmailAuthProvider.credential(user.email, currentPassword)
    await reauthenticateWithCredential(user, credential)
    await updatePassword(user, newPassword)
  }

  async function resendVerificationEmail() {
    if (auth.currentUser) await sendEmailVerification(auth.currentUser, ACTION_CODE_SETTINGS)
  }

  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    updateDoc(doc(db, 'users', cred.user.uid), { status: 'online', invisible: false, lastSeen: serverTimestamp() })
      .catch(err => console.warn('Firestore status update failed:', err.code))
    return cred
  }

  async function logout() {
    if (currentUser) {
      updateDoc(doc(db, 'users', currentUser.uid), { status: 'offline' }).catch(() => {})
    }
    return signOut(auth)
  }

  // Latest status, readable from event handlers without re-subscribing them
  const statusRef = useRef(null)
  const autoIdleRef = useRef(false)
  useEffect(() => { statusRef.current = myProfile?.status }, [myProfile])

  // Closing the tab/browser => offline. Minimizing / switching away => idle (only if they were
  // online, so a manually chosen Do Not Disturb / Invisible is left alone), and back to online on return.
  useEffect(() => {
    if (!currentUser) return
    const userRef = doc(db, 'users', currentUser.uid)
    const setStatus = status => updateDoc(userRef, { status }).catch(() => {})
    const beat = () => {
      // Invisible/offline users don't send heartbeats (they already show offline)
      if (statusRef.current && statusRef.current !== 'offline') {
        updateDoc(userRef, { lastSeen: serverTimestamp() }).catch(() => {})
      }
    }
    // The SDK's own write is cancelled when a tab closes, so also send a keepalive request
    const goOffline = () => {
      setStatus('offline')
      keepaliveSetOffline(currentUser.uid)
    }
    const handleVisibility = () => {
      if (document.hidden) {
        if (statusRef.current === 'online') {
          autoIdleRef.current = true
          setStatus('idle')
        }
      } else {
        beat()
        if (autoIdleRef.current) {
          autoIdleRef.current = false
          setStatus('online')
        }
      }
    }
    window.addEventListener('pagehide', goOffline)
    window.addEventListener('beforeunload', goOffline)
    document.addEventListener('visibilitychange', handleVisibility)
    const timer = setInterval(beat, HEARTBEAT_MS)
    return () => {
      clearInterval(timer)
      window.removeEventListener('pagehide', goOffline)
      window.removeEventListener('beforeunload', goOffline)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [currentUser])

  // Send the first heartbeat as soon as our profile loads, so we show online straight away
  const firstBeatSentRef = useRef(false)
  useEffect(() => {
    if (!currentUser) { firstBeatSentRef.current = false; return }
    if (myProfile && !firstBeatSentRef.current && myProfile.status && myProfile.status !== 'offline') {
      firstBeatSentRef.current = true
      updateDoc(doc(db, 'users', currentUser.uid), { lastSeen: serverTimestamp() }).catch(() => {})
    }
  }, [currentUser, myProfile])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setCurrentUser(user)
      setLoading(false)
    })
    return unsub
  }, [])

  // Keep a single, shared copy of the Firestore profile doc so components
  // that show the user's avatar/name (UserPanel appears in multiple places)
  // don't each mount their own listener and flash stale data on remount.
  useEffect(() => {
    if (!currentUser?.uid) { setMyProfile(null); return }
    let firstSnapshot = true
    const unsub = onSnapshot(doc(db, 'users', currentUser.uid), snap => {
      if (snap.exists()) {
        const data = { uid: snap.id, ...snap.data() }
        // Reopening the app while still signed in: closing the tab marked us offline,
        // so come back online (unless the user deliberately chose Invisible).
        if (firstSnapshot) {
          firstSnapshot = false
          if (data.status === 'offline' && !data.invisible) {
            updateDoc(doc(db, 'users', currentUser.uid), { status: 'online', lastSeen: serverTimestamp() }).catch(() => {})
            data.status = 'online'
          }
        }
        setMyProfile(data)
        // Apply Ray's improvements mode as a body attribute
        if (data.rayMode) {
          document.body.setAttribute('data-ray', 'true')
        } else {
          document.body.removeAttribute('data-ray')
        }
        if (data.pandaMode) {
          document.body.setAttribute('data-panda', 'true')
        } else {
          document.body.removeAttribute('data-panda')
        }
      }
    })
    return () => { unsub(); document.body.removeAttribute('data-ray'); document.body.removeAttribute('data-panda') }
  }, [currentUser?.uid])

  return (
    <AuthContext.Provider value={{ currentUser, myProfile, register, login, logout, changePassword, resendVerificationEmail, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
