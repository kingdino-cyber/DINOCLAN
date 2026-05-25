import { useState } from 'react'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'

export default function InviteToServer({ serverId, serverName, onClose }) {
  const { currentUser } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  async function sendInvite(e) {
    e.preventDefault()
    setError('')
    setStatus('sending')
    try {
      const q = query(collection(db, 'users'), where('email', '==', email.trim().toLowerCase()))
      const snap = await getDocs(q)
      if (snap.empty) { setError('No user found with that email.'); setStatus(''); return }
      const toUid = snap.docs[0].id
      if (toUid === currentUser.uid) { setError("You can't invite yourself!"); setStatus(''); return }
      await addDoc(collection(db, 'serverInvites'), {
        toUid,
        fromUid: currentUser.uid,
        fromDisplayName: currentUser.displayName || currentUser.email,
        serverId,
        serverName,
        status: 'pending',
        createdAt: serverTimestamp(),
      })
      setStatus('sent')
    } catch (err) {
      setError('Something went wrong. Try again.')
      setStatus('')
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Invite to {serverName}</h2>
        {status === 'sent' ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 36 }}>🦕</div>
            <p style={{ color: 'var(--success)', marginTop: 8 }}>Invite sent!</p>
            <button className="btn-confirm" style={{ marginTop: 16 }} onClick={onClose}>Close</button>
          </div>
        ) : (
          <form onSubmit={sendInvite}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
              Enter the email of the person you want to invite.
            </p>
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="someone@email.com"
              autoFocus
            />
            {error && <div className="auth-error" style={{ marginTop: 8 }}>{error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-confirm" disabled={!email.trim() || status === 'sending'}>
                {status === 'sending' ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
