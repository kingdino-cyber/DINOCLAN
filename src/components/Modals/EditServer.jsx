import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'

export default function EditServer({ server, onClose }) {
  const isGroup = server.kind === 'group'
  const label   = isGroup ? 'Group' : 'Server'
  const [name,    setName]    = useState(server.name || '')
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'servers', server.id), {
        name: name.trim(),
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
        <h2>{label} Settings</h2>
        <form onSubmit={handleSave}>
          <label>{label} Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={100}
            autoFocus
          />

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
