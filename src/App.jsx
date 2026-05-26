import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { CallProvider } from './contexts/CallContext'
import Login from './components/Auth/Login'
import Register from './components/Auth/Register'
import MainLayout from './components/Layout/MainLayout'

function PrivateRoute({ children }) {
  const { currentUser } = useAuth()
  return currentUser ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { currentUser } = useAuth()
  return !currentUser ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <CallProvider>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/*" element={<PrivateRoute><MainLayout /></PrivateRoute>} />
          </Routes>
        </CallProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}
