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
  sendSignInLinkToEmail,
  signInWithEmailLink,
  isSignInWithEmailLink,
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

const AuthContext = createContext(null)

const ACTION_CODE_SETTINGS = {
  url: 'https://dinoclan.netlify.app/login',
  handleCodeInApp: true,
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // True while the user has passed password check but hasn't clicked their login link yet
  const [twoFactorPending, setTwoFactorPending] = useState(false)

  async function register(email, password, displayName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName })
    sendEmailVerification(cred.user, ACTION_CODE_SETTINGS).catch(() => {})
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

  // Step 1 of login: verify password, then sign out and send email link
  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    setTwoFactorPending(true)
    try {
      await signOut(auth)
      window.localStorage.setItem('emailForSignIn', email)
      await sendSignInLinkToEmail(auth, email, ACTION_CODE_SETTINGS)
    } catch (err) {
      setTwoFactorPending(false)
      throw err
    }
    return cred
  }

  // Step 2 of login: complete sign-in from the emailed link
  async function completeLoginWithLink(email, href) {
    if (!isSignInWithEmailLink(auth, href)) throw new Error('Invalid sign-in link')
    const cred = await signInWithEmailLink(auth, email, href)
    window.localStorage.removeItem('emailForSignIn')
    setTwoFactorPending(false)
    updateDoc(doc(db, 'users', cred.user.uid), { status: 'online' }).catch(() => {})
    return cred
  }

  async function logout() {
    if (currentUser) {
      updateDoc(doc(db, 'users', currentUser.uid), { status: 'offline' }).catch(() => {})
    }
    setTwoFactorPending(false)
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

  return (
    <AuthContext.Provider value={{
      currentUser, twoFactorPending,
      register, login, completeLoginWithLink, logout,
      changePassword, resendVerificationEmail, loading,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
