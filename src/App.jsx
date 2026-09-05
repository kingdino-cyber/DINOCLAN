import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CallProvider } from './contexts/CallContext'
import { MonitorProvider } from './contexts/MonitorContext'
import Login from './components/Auth/Login'
import Register from './components/Auth/Register'
import VerifyEmail from './components/Auth/VerifyEmail'
import Terms from './components/Auth/Terms'
import MainLayout from './components/Layout/MainLayout'
import MobileLayout from './components/Layout/MobileLayout'
import WordCounter from './components/WordCounter/WordCounter'

function SuspendedScreen({ until, onLogout }) {
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', color: 'var(--text-normal)',
      textAlign: 'center', padding: '24px',
    }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🚫</div>
      <h2 style={{ color: 'var(--header-primary)', fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
        Your account is suspended
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 380, lineHeight: 1.6, marginBottom: 24 }}>
        You have been suspended until <strong style={{ color: 'var(--text-normal)' }}>{until.toLocaleString()}</strong>.<br />
        You cannot access DINOCLAN until then, or until a monitor unsuspends you.
      </p>
      <button onClick={onLogout} style={{
        padding: '10px 24px', borderRadius: 10, border: 'none',
        background: 'var(--danger)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
      }}>
        Log Out
      </button>
    </div>
  )
}

function PrivateRoute({ children }) {
  const { currentUser, myProfile, logout } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  const suspendedUntil = myProfile?.suspendedUntil?.toDate?.()
  if (suspendedUntil && suspendedUntil > new Date()) {
    return <SuspendedScreen until={suspendedUntil} onLogout={logout} />
  }
  return children
}

function PublicRoute({ children }) {
  const { currentUser } = useAuth()
  return !currentUser ? children : <Navigate to="/app" replace />
}

export default function App() {
  const [mobileMode, setMobileMode] = useState(() => localStorage.getItem('mobileMode') === 'true')

  useEffect(() => {
    function sync() { setMobileMode(localStorage.getItem('mobileMode') === 'true') }
    window.addEventListener('mobileModeChanged', sync)
    window.addEventListener('storage', sync)
    window.addEventListener('focus', sync)
    return () => {
      window.removeEventListener('mobileModeChanged', sync)
      window.removeEventListener('storage', sync)
      window.removeEventListener('focus', sync)
    }
  }, [])

  return (
    <AuthProvider>
      <BrowserRouter>
        <CallProvider>
          <MonitorProvider>
          <Routes>
            <Route path="/"             element={<WordCounter />} />
            <Route path="/login"        element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register"     element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/terms"        element={<Terms />} />
            <Route path="/app/*"        element={<PrivateRoute>{mobileMode ? <MobileLayout /> : <MainLayout />}</PrivateRoute>} />
          </Routes>
          <div className="copyright-badge">© 2026 DINOCLAN. All rights reserved.</div>
          </MonitorProvider>
        </CallProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}
