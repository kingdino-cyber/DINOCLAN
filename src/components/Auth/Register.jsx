import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import DinoDecorations from '../DinoDecorations'

export default function Register() {
  const { register } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [mobileMode, setMobileMode] = useState(() => localStorage.getItem('mobileMode') === 'true')

  function toggleMobile() {
    const next = !mobileMode
    setMobileMode(next)
    localStorage.setItem('mobileMode', next ? 'true' : 'false')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (!displayName.trim()) { setError('Please enter a display name.'); return }
    if (!agreedToTerms) { setError('You must agree to the Terms of Service to continue.'); return }
    setLoading(true)
    try {
      await register(email, password, displayName.trim())
    } catch (err) {
      console.error('Registration error:', err)
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <DinoDecorations />
      <div className="auth-box">
        <h1>🦖 Join the Herd!</h1>
        <p className="auth-subtitle">Create your dino account today! 🦕</p>
        <form onSubmit={handleSubmit}>
          <label>Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="What should we call you?"
            required
            autoFocus
          />
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Create a password"
            required
          />
          <label>Confirm Password</label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Confirm your password"
            required
          />
          <label className="terms-checkbox-label">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={e => setAgreedToTerms(e.target.checked)}
            />
            I agree to the{' '}
            <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</Link>
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Continue'}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Log In</Link>
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
    case 'auth/email-already-in-use':
      return 'That email address is already registered.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    default:
      return 'Failed to create account. Please try again.'
  }
}
