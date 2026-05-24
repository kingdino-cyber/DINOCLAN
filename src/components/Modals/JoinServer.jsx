import { useState } from 'react'
import {
  collection, query, where, getDocs, updateDoc, doc, arrayUnion,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'

export default function JoinServer({ onClose }) {
  const { currentUser } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleJoin(e) {
    e.preventDefault()
    setError('')
    if (!code.trim() || loading) return
    setLoading(true)
    try {
      // Invite code = server ID for simplicity
      const serverId = code.trim()
      const serverRef = doc(db, 'servers', serverId)
      await updateDoc(serverRef, { members: arrayUnion(currentUser.uid) })
      onClose(serverId)
    } catch (err) {
      setError('Invalid invite code or server not found.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Join a Server</h2>
        <p>Enter a server invite code to join an existing server. The invite code is the server ID (shown in the URL).</p>
        <form onSubmit={handleJoin}>
          <label>Invite Code</label>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Paste server ID here"
            autoFocus
          />
          {error && <div className="auth-error" style={{ marginTop: 8 }}>{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => onClose()}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-confirm"
              disabled={!code.trim() || loading}
            >
              {loading ? 'Joining…' : 'Join Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
