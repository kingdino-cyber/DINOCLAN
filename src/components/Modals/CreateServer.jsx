import { useState } from 'react'
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'

export default function CreateServer({ onClose }) {
  const { currentUser } = useAuth()
  const [name, setName] = useState('')
  const [type, setType] = useState('editing')
  const [loading, setLoading] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim() || loading) return
    setLoading(true)
    try {
      const serverRef = await addDoc(collection(db, 'servers'), {
        name: name.trim(),
        ownerId: currentUser.uid,
        createdAt: serverTimestamp(),
        members: [currentUser.uid],
        type,
        editors: [],
      })
      await setDoc(
        doc(db, 'servers', serverRef.id, 'channels', 'general'),
        { name: 'general', createdAt: serverTimestamp(), position: 0 }
      )
      onClose(serverRef.id)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Create a Server</h2>
        <p>Give your server a name and choose who can post.</p>
        <form onSubmit={handleCreate}>
          <label>Server Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="My Awesome Server"
            autoFocus
            maxLength={100}
          />

          <label style={{ marginTop: 16 }}>Server Type</label>
          <div className="server-type-picker">
            <div
              className={`server-type-option ${type === 'editing' ? 'selected' : ''}`}
              onClick={() => setType('editing')}
            >
              <div className="server-type-icon">✏️</div>
              <div>
                <div className="server-type-name">Editing</div>
                <div className="server-type-desc">Everyone can send messages and interact.</div>
              </div>
            </div>
            <div
              className={`server-type-option ${type === 'viewing' ? 'selected' : ''}`}
              onClick={() => setType('viewing')}
            >
              <div className="server-type-icon">👁️</div>
              <div>
                <div className="server-type-name">Viewing</div>
                <div className="server-type-desc">Only you (and people you grant access) can post.</div>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => onClose()}>Back</button>
            <button type="submit" className="btn-confirm" disabled={!name.trim() || loading}>
              {loading ? 'Creating…' : 'Create Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
