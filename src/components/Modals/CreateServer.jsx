import { useState } from 'react'
import { collection, addDoc, serverTimestamp, doc, setDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'

export default function CreateServer({ onClose }) {
  const { currentUser } = useAuth()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [type, setType] = useState('editing')
  const [loading, setLoading] = useState(false)
  const [addressError, setAddressError] = useState('')

  function sanitizeAddress(val) {
    return val.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setAddressError('')
    if (!name.trim() || loading) return
    const finalAddress = address.trim()
    if (finalAddress) {
      // Check uniqueness
      const q = query(collection(db, 'servers'), where('address', '==', finalAddress))
      const snap = await getDocs(q)
      if (!snap.empty) { setAddressError('That address is already taken. Try another.'); return }
    }
    setLoading(true)
    try {
      const serverRef = await addDoc(collection(db, 'servers'), {
        name: name.trim(),
        ownerId: currentUser.uid,
        createdAt: serverTimestamp(),
        members: [currentUser.uid],
        type,
        editors: [],
        address: finalAddress || null,
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

          <label style={{ marginTop: 14 }}>
            Server Address <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <div className="address-input-wrap">
            <span className="address-prefix">dinoclan://</span>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(sanitizeAddress(e.target.value))}
              placeholder="my-server"
              maxLength={32}
              style={{ paddingLeft: 4 }}
            />
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Lowercase letters, numbers, hyphens only. Others can join using this address.
          </p>
          {addressError && <div className="auth-error" style={{ marginTop: 4 }}>{addressError}</div>}

          <label style={{ marginTop: 14 }}>Server Type</label>
          <div className="server-type-picker">
            <div className={`server-type-option ${type === 'editing' ? 'selected' : ''}`} onClick={() => setType('editing')}>
              <div className="server-type-icon">✏️</div>
              <div>
                <div className="server-type-name">Editing</div>
                <div className="server-type-desc">Everyone can send messages and interact.</div>
              </div>
            </div>
            <div className={`server-type-option ${type === 'viewing' ? 'selected' : ''}`} onClick={() => setType('viewing')}>
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
