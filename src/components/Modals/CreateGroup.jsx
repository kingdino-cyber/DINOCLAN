import { useState } from 'react'
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'

export default function CreateGroup({ onClose }) {
  const { currentUser } = useAuth()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim() || loading) return
    setLoading(true)
    try {
      // Groups are invite-only — no join code, unlike servers
      const ref = await addDoc(collection(db, 'servers'), {
        name: name.trim(),
        ownerId: currentUser.uid,
        createdAt: serverTimestamp(),
        members: [currentUser.uid],
        kind: 'group',
        type: 'editing',
        editors: [],
      })
      await setDoc(
        doc(db, 'servers', ref.id, 'channels', 'general'),
        { name: 'general', createdAt: serverTimestamp(), position: 0 }
      )
      onClose(ref.id)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Create a Group</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>
          Groups are invite-only — share the vibe with a smaller circle. 🦕
        </p>
        <form onSubmit={handleCreate}>
          <label>Group Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="My Cool Group"
            autoFocus
            maxLength={100}
          />
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => onClose()}>Back</button>
            <button type="submit" className="btn-confirm" disabled={!name.trim() || loading}>
              {loading ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
