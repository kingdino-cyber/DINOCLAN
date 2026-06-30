import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isSignInWithEmailLink } from 'firebase/auth'
import { auth } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import DinoDecorations from '../DinoDecorations'

export default function Login() {
  const { login, completeLoginWithLink } = useAuth()
  const navigate = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  // After password step — show "check your email"
  const [awaitingLink, setAwaitingLink] = useState(false)
  const [sentTo,       setSentTo]       = useState('')

  // When user opened the link on a different device (no localStorage email)
  const [needsEmailForLink, setNeedsEmailForLink] = useState(false)
  const [linkEmail,         setLinkEmail]         = useState('')

  // On mount: detect if this page load is a return from the email link
  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return
    const saved = window.localStorage.getItem('emailForSignIn')
    if (saved) {
      completeLoginWithLink(saved, window.location.href)
        .then(() => navigate('/app', { replace: true }))
        .catch(() => setError('Sign-in link failed or expired. Please log in again.'))
    } else {
      // Opened on a different device — ask for email
      setNeedsEmailForLink(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      setSentTo(email)
      setAwaitingLink(true)
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  async function handleLinkEmailSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await completeLoginWithLink(linkEmail, window.location.href)
      navigate('/app', { replace: true })
    } catch {
      setError('Sign-in link failed or expired. Please log in again.')
    } finally {
      setLoading(false)
    }
  }

  // State: link was opened on a different device — ask for email
  if (needsEmailForLink) {
    return (
      <div className="auth-page">
        <DinoDecorations />
        <div className="auth-box">
          <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 8 }}>🔗</div>
          <h1 style={{ textAlign: 'center', marginBottom: 6 }}>Confirm your email</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
            Enter the email address you used to log in.
          </p>
          <form onSubmit={handleLinkEmailSubmit}>
            <label>Email</label>
            <input
              type="email"
              value={linkEmail}
              onChange={e => setLinkEmail(e.target.value)}
              placeholder="Your email address"
              required
              autoFocus
            />
            {error && <div className="auth-error">{error}</div>}
            <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Signing in…' : 'Complete sign-in'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // State: password was correct, waiting for email link click
  if (awaitingLink) {
    return (
      <div className="auth-page">
        <DinoDecorations />
        <div className="auth-box">
          <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 8 }}>📧</div>
          <h1 style={{ textAlign: 'center', marginBottom: 6 }}>Check your email</h1>
          <p className="auth-subtitle" style={{ textAlign: 'center', marginBottom: 16 }}>
            We sent a login link to<br /><strong>{sentTo}</strong>
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginBottom: 24 }}>
            Click the link in the email to finish logging in.
            Check your spam folder if you don't see it.
          </p>
          {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
          <button
            className="btn-ghost"
            onClick={() => { setAwaitingLink(false); setError('') }}
            style={{ width: '100%' }}
          >
            ← Back to login
          </button>
        </div>
      </div>
    )
  }

  // Default: email + password form
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
            {loading ? 'Sending login link…' : 'Log In'}
          </button>
        </form>
        <p className="auth-switch">
          Need an account? <Link to="/register">Register</Link>
        </p>
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
