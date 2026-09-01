import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CallProvider } from './contexts/CallContext'
import Login from './components/Auth/Login'
import Register from './components/Auth/Register'
import VerifyEmail from './components/Auth/VerifyEmail'
import Terms from './components/Auth/Terms'
import MainLayout from './components/Layout/MainLayout'
import WordCounter from './components/WordCounter/WordCounter'

function PrivateRoute({ children }) {
  const { currentUser } = useAuth()
  return currentUser ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { currentUser } = useAuth()
  return !currentUser ? children : <Navigate to="/app" replace />
}

function MobileToggle() {
  const [mobile, setMobile] = useState(() => localStorage.getItem('dinoclan_mobile') === 'true')
  function toggle() {
    const next = !mobile
    setMobile(next)
    localStorage.setItem('dinoclan_mobile', String(next))
    window.location.reload()
  }
  return (
    <div className="global-mobile-toggle" onClick={toggle} title={mobile ? 'Disable mobile mode' : 'Enable mobile mode'}>
      <span className="global-mobile-icon">📱</span>
      <div className={`mobile-toggle-btn${mobile ? ' active' : ''}`}>
        <span className="mobile-toggle-knob" />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <CallProvider>
          <Routes>
            <Route path="/"             element={<WordCounter />} />
            <Route path="/login"        element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register"     element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/terms"        element={<Terms />} />
            <Route path="/app/*"        element={<PrivateRoute><MainLayout /></PrivateRoute>} />
          </Routes>
          <MobileToggle />
          <div className="copyright-badge">© 2026 DINOCLAN. All rights reserved.</div>
        </CallProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}
