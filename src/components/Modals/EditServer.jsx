import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'

export default function EditServer({ server, onClose }) {
  const [name,    setName]    = useState(server.name || '')
  const [type,    setType]    = useState(server.type || 'editing')
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'servers', server.id), {
        name: name.trim(),
        type,
      })
      setSaved(true)
      setTimeout(() => { setSaved(false); onClose() }, 1200)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Server Settings</h2>
        <form onSubmit={handleSave}>
          <label>Server Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={100}
            autoFocus
          />

          <label style={{ marginTop: 14 }}>Server Type</label>
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
                <div className="server-type-desc">Only you (and editors you grant) can post.</div>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-confirm" disabled={!name.trim() || saving}>
              {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
