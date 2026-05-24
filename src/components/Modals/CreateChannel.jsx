import { useState } from 'react'
import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'

export default function CreateChannel({ serverId, onClose }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim() || loading) return
    setLoading(true)
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    try {
      const snap = await getDocs(collection(db, 'servers', serverId, 'channels'))
      const ref = await addDoc(collection(db, 'servers', serverId, 'channels'), {
        name: slug,
        createdAt: serverTimestamp(),
        position: snap.size,
      })
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
        <h2>Create Channel</h2>
        <p>Channels are where conversations happen inside a server.</p>
        <form onSubmit={handleCreate}>
          <label>Channel Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="new-channel"
            autoFocus
            maxLength={80}
          />
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => onClose()}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-confirm"
              disabled={!name.trim() || loading}
            >
              {loading ? 'Creating…' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
