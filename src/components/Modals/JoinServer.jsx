import { useState } from 'react'
import { updateDoc, doc, arrayUnion, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
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
      const input = code.trim()
      let serverRef = null
      let serverData = null

      // Try by custom address first
      const addrQ = query(collection(db, 'servers'), where('address', '==', input.toLowerCase()))
      const addrSnap = await getDocs(addrQ)
      if (!addrSnap.empty) {
        serverRef = addrSnap.docs[0].ref
        serverData = addrSnap.docs[0].data()
      } else {
        // Fall back to document ID
        serverRef = doc(db, 'servers', input)
        const snap = await getDoc(serverRef)
        if (!snap.exists()) { setError('Server not found. Check the address or ID.'); setLoading(false); return }
        serverData = snap.data()
      }

      if (serverData.banned?.includes(currentUser.uid)) {
        setError('You are banned from this server.')
        setLoading(false)
        return
      }

      await updateDoc(serverRef, { members: arrayUnion(currentUser.uid) })
      onClose(serverRef.id)
    } catch (err) {
      setError('Server not found. Check the address or ID.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Join a Server</h2>
        <p>Enter a server address (e.g. <strong>my-server</strong>) or paste a server ID.</p>
        <form onSubmit={handleJoin}>
          <label>Server Address or ID</label>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="my-server or paste ID"
            autoFocus
          />
          {error && <div className="auth-error" style={{ marginTop: 8 }}>{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => onClose()}>Cancel</button>
            <button type="submit" className="btn-confirm" disabled={!code.trim() || loading}>
              {loading ? 'Joining…' : 'Join Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
