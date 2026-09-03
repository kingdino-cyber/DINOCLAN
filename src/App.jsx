import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CallProvider } from './contexts/CallContext'
import { MonitorProvider } from './contexts/MonitorContext'
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

export default function App() {
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
            <Route path="/app/*"        element={<PrivateRoute><MainLayout /></PrivateRoute>} />
          </Routes>
          <div className="copyright-badge">© 2026 DINOCLAN. All rights reserved.</div>
          </MonitorProvider>
        </CallProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}
