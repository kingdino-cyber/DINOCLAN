import { useState } from 'react'
import { updateDoc, doc, arrayUnion, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { DINO_EMOJIS, CODE_LENGTH } from '../../utils/dinoCode'

export default function JoinServer({ onClose }) {
  const { currentUser } = useAuth()
  const [code, setCode] = useState([])   // array of emoji strings, max CODE_LENGTH
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function addEmoji(em) {
    if (code.length >= CODE_LENGTH) return
    setCode(prev => [...prev, em])
    setError('')
  }

  function removeLastEmoji() {
    setCode(prev => prev.slice(0, -1))
    setError('')
  }

  function clearCode() {
    setCode([])
    setError('')
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (code.length !== CODE_LENGTH || loading) return
    setError('')
    setLoading(true)
    try {
      const joinCode = code.join('')
      const q = query(collection(db, 'servers'), where('joinCode', '==', joinCode))
      const snap = await getDocs(q)

      if (snap.empty) {
        setError("No server found with that code. Try again! 🦕")
        setLoading(false)
        return
      }

      const serverDoc = snap.docs[0]
      const serverData = serverDoc.data()

      if (serverData.kind === 'group') {
        setError("Groups can't be joined by code — ask for an invite!")
        setLoading(false)
        return
      }

      if (serverData.banned?.includes(currentUser.uid)) {
        setError("You've been banned from this server.")
        setLoading(false)
        return
      }

      if (serverData.members?.includes(currentUser.uid)) {
        // Already a member — just go there
        onClose(serverDoc.id)
        return
      }

      await updateDoc(serverDoc.ref, { members: arrayUnion(currentUser.uid) })
      onClose(serverDoc.id)
    } catch (err) {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const slots = Array.from({ length: CODE_LENGTH })

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal join-server-modal">
        <h2>Join a Server</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
          Enter the 4-dino emoji code to join a server!
        </p>

        {/* Code display slots */}
        <div className="dino-code-slots">
          {slots.map((_, i) => (
            <div key={i} className={`dino-code-slot ${code[i] ? 'filled' : ''} ${i === code.length ? 'active' : ''}`}>
              {code[i] || ''}
            </div>
          ))}
          {code.length > 0 && (
            <button className="dino-slot-back" onClick={removeLastEmoji} title="Delete last">
              ⌫
            </button>
          )}
        </div>

        {/* Emoji picker */}
        <div className="dino-emoji-picker">
          {DINO_EMOJIS.map(em => (
            <button
              key={em}
              className={`dino-pick-btn ${code.length >= CODE_LENGTH ? 'disabled' : ''}`}
              onClick={() => addEmoji(em)}
              disabled={code.length >= CODE_LENGTH}
              title={em}
            >
              {em}
            </button>
          ))}
        </div>

        {error && (
          <div className="auth-error" style={{ marginTop: 10 }}>{error}</div>
        )}

        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn-ghost" onClick={() => onClose()}>Cancel</button>
          {code.length > 0 && (
            <button type="button" className="btn-ghost" onClick={clearCode}>Clear</button>
          )}
          <button
            className="btn-confirm"
            onClick={handleJoin}
            disabled={code.length !== CODE_LENGTH || loading}
          >
            {loading ? 'Joining…' : `Join 🦕`}
          </button>
        </div>
      </div>
    </div>
  )
}
