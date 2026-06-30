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
import { doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  async function register(email, password, displayName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName })
    // Send email verification so only real emails can be used
    sendEmailVerification(cred.user, {
      url: 'https://dinoclan.netlify.app/login',
    }).catch(() => {})
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
    if (auth.currentUser) await sendEmailVerification(auth.currentUser, {
      url: 'https://dinoclan.netlify.app/login',
    })
  }

  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    updateDoc(doc(db, 'users', cred.user.uid), { status: 'online' })
      .catch(err => console.warn('Firestore status update failed:', err.code))
    return cred
  }

  async function logout() {
    if (currentUser) {
      updateDoc(doc(db, 'users', currentUser.uid), { status: 'offline' })
        .catch(() => {})
    }
    return signOut(auth)
  }

  // Mark user offline the moment they close/leave the tab
  useEffect(() => {
    if (!currentUser) return

    const userRef = doc(db, 'users', currentUser.uid)

    const goOffline = () =>
      updateDoc(userRef, { status: 'offline' }).catch(() => {})

    const goOnline = () =>
      updateDoc(userRef, { status: 'online' }).catch(() => {})

    // Tab/window closed or navigated away
    window.addEventListener('beforeunload', goOffline)

    // Tab hidden (switched away) → offline; tab visible again → online
    const handleVisibility = () =>
      document.hidden ? goOffline() : goOnline()
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

  return (
    <AuthContext.Provider value={{ currentUser, register, login, logout, changePassword, resendVerificationEmail, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
