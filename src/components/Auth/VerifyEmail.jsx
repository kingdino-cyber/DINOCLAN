import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { auth } from '../../firebase'
import DinoDecorations from '../DinoDecorations'

export default function VerifyEmail() {
  const { currentUser, resendVerificationEmail, logout } = useAuth()
  const navigate = useNavigate()
  const [resent, setResent] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  // Redirect to login if not signed in at all
  useEffect(() => {
    if (!currentUser) navigate('/login', { replace: true })
  }, [currentUser, navigate])

  // Auto-poll every 4 seconds — as soon as they click the link we let them in
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!auth.currentUser) return
      await auth.currentUser.reload()
      if (auth.currentUser.emailVerified) {
        navigate('/app', { replace: true })
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [navigate])

  async function handleCheckNow() {
    setChecking(true)
    setError('')
    try {
      await auth.currentUser.reload()
      if (auth.currentUser.emailVerified) {
        navigate('/app', { replace: true })
      } else {
        setError("Email not verified yet. Check your inbox and click the link.")
      }
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setChecking(false)
    }
  }

  async function handleResend() {
    setError('')
    try {
      await resendVerificationEmail()
      setResent(true)
      setTimeout(() => setResent(false), 5000)
    } catch {
      setError('Failed to resend. Try again in a moment.')
    }
  }

  return (
    <div className="auth-page">
      <DinoDecorations />
      <div className="auth-box">
        <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 8 }}>📧</div>
        <h1 style={{ textAlign: 'center', marginBottom: 6 }}>Verify your email</h1>
        <p className="auth-subtitle" style={{ textAlign: 'center', marginBottom: 16 }}>
          We sent a link to<br />
          <strong>{currentUser?.email}</strong>
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
          Click the link in the email to activate your account.
          Check your spam folder if you don't see it.
        </p>

        {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
        {resent && (
          <div style={{ color: 'var(--success)', textAlign: 'center', marginBottom: 12, fontSize: 13 }}>
            ✓ Verification email resent!
          </div>
        )}

        <button
          className="btn-primary"
          onClick={handleCheckNow}
          disabled={checking}
          style={{ width: '100%', marginBottom: 10 }}
        >
          {checking ? 'Checking…' : "I've verified my email ✓"}
        </button>

        <button
          className="btn-ghost"
          onClick={handleResend}
          style={{ width: '100%', marginBottom: 16 }}
        >
          Resend verification email
        </button>

        <p style={{ textAlign: 'center' }}>
          <button
            onClick={logout}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}
          >
            Sign out
          </button>
        </p>
      </div>
    </div>
  )
}
