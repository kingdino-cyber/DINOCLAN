import { createContext, useContext, useEffect, useState } from 'react'
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

const AuthContext = createContext(null)

const ACTION_CODE_SETTINGS = {
  url: 'https://dinoclan.netlify.app/login',
  handleCodeInApp: true,
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [myProfile, setMyProfile] = useState(null) // Firestore users/{uid} doc — shared across all UserPanel instances

  async function register(email, password, displayName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName })
    // Email verification removed — accounts work immediately
    setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      displayName,
      email,
      photoURL: null,
      status: 'online',
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
    updateDoc(doc(db, 'users', cred.user.uid), { status: 'online' })
      .catch(err => console.warn('Firestore status update failed:', err.code))
    return cred
  }

  async function logout() {
    if (currentUser) {
      updateDoc(doc(db, 'users', currentUser.uid), { status: 'offline' }).catch(() => {})
    }
    return signOut(auth)
  }

  // Mark user offline when they close/leave the tab
  useEffect(() => {
    if (!currentUser) return
    const userRef = doc(db, 'users', currentUser.uid)
    const goOffline = () => updateDoc(userRef, { status: 'offline' }).catch(() => {})
    const goOnline  = () => updateDoc(userRef, { status: 'online'  }).catch(() => {})
    window.addEventListener('beforeunload', goOffline)
    const handleVisibility = () => document.hidden ? goOffline() : goOnline()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('beforeunload', goOffline)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [currentUser])

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
    const unsub = onSnapshot(doc(db, 'users', currentUser.uid), snap => {
      if (snap.exists()) {
        const data = { uid: snap.id, ...snap.data() }
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
