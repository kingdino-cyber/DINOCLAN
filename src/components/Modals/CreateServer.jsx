import { useState } from 'react'
import { collection, addDoc, serverTimestamp, doc, setDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { generateDinoCode } from '../../utils/dinoCode'

export default function CreateServer({ onClose }) {
  const { currentUser } = useAuth()
  const [name, setName] = useState('')
  const type = 'editing' // every new server starts editable — flip individual channels to viewing later
  const [loading, setLoading] = useState(false)
  const [createdCode, setCreatedCode] = useState(null)
  const [createdId, setCreatedId] = useState(null)
  const [copied, setCopied] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim() || loading) return
    setLoading(true)
    try {
      // Generate a unique dino code
      let joinCode
      let attempts = 0
      do {
        joinCode = generateDinoCode()
        const q = query(collection(db, 'servers'), where('joinCode', '==', joinCode))
        const snap = await getDocs(q)
        if (snap.empty) break
        attempts++
      } while (attempts < 10)

      const serverRef = await addDoc(collection(db, 'servers'), {
        name: name.trim(),
        ownerId: currentUser.uid,
        createdAt: serverTimestamp(),
        members: [currentUser.uid],
        kind: 'server',
        type,
        editors: [],
        joinCode,
      })
      await setDoc(
        doc(db, 'servers', serverRef.id, 'channels', 'general'),
        { name: 'general', createdAt: serverTimestamp(), position: 0 }
      )
      setCreatedCode(joinCode)
      setCreatedId(serverRef.id)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(createdCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Success screen ──────────────────────────────────────────────────────
  if (createdCode) {
    return (
      <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
          <h2>Server created!</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '8px 0 16px' }}>
            Share this join code so friends can join your server:
          </p>
          <div className="dino-code-display">
            {[...createdCode].map((em, i) => (
              <span key={i} className="dino-code-emoji">{em}</span>
            ))}
          </div>
          <button className="dino-code-copy-btn" onClick={copyCode}>
            {copied ? '✓ Copied!' : '📋 Copy code'}
          </button>
          <div className="modal-actions" style={{ justifyContent: 'center', marginTop: 16 }}>
            <button className="btn-confirm" onClick={() => onClose(createdId)}>
              Go to Server 🦕
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Create form ─────────────────────────────────────────────────────────
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

          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
            A unique 🦕 dino emoji code will be generated automatically for others to join.
          </p>

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
