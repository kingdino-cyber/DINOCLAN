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
    window.dispatchEvent(new Event('mobileModeChanged'))
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
        <h1><img src="/dinoclan-logo.png" alt="DINOCLAN" style={{width:70,height:70,objectFit:'contain',verticalAlign:'middle',marginRight:4}} />Welcome back!</h1>
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
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <rect x="5" y="2" width="14" height="20" rx="2"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
            {' '}Mobile Mode{mobileMode ? ' — On' : ' — Off'}
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
