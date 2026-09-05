import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import DinoDecorations from '../DinoDecorations'

export default function Login() {
  const { login } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [mobileMode, setMobileMode] = useState(() => localStorage.getItem('mobileMode') === 'true')

  function toggleMobile() {
    const next = !mobileMode
    setMobileMode(next)
    localStorage.setItem('mobileMode', next ? 'true' : 'false')
  }
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <DinoDecorations />
      <div className="auth-box">
        <h1>🦕 Welcome back!</h1>
        <p className="auth-subtitle">The dinos missed you! 🦖</p>
        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            autoFocus
          />
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
          {error && <div className="auth-error">{error}</div>}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Logging in…' : 'Log In'}
          </button>
        </form>
        <p className="auth-switch">
          Need an account? <Link to="/register">Register</Link>
        </p>

        <button className="mobile-toggle-btn" onClick={toggleMobile} type="button">
          <span className={`mobile-toggle-track${mobileMode ? ' on' : ''}`}>
            <span className="mobile-toggle-thumb" />
          </span>
          <span className="mobile-toggle-label">
            📱 Mobile Mode{mobileMode ? ' — On' : ' — Off'}
          </span>
        </button>
      </div>
    </div>
  )
}

function friendlyError(code) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.'
    default:
      return 'Failed to sign in. Please try again.'
  }
}
