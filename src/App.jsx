import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CallProvider } from './contexts/CallContext'
import Login from './components/Auth/Login'
import Register from './components/Auth/Register'
import VerifyEmail from './components/Auth/VerifyEmail'
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
          <Routes>
            <Route path="/"             element={<WordCounter />} />
            <Route path="/login"        element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register"     element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/app/*"        element={<PrivateRoute><MainLayout /></PrivateRoute>} />
          </Routes>
        </CallProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}
