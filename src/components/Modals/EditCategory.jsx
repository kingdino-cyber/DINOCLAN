import { useState } from 'react'
import { addDoc, updateDoc, deleteDoc, doc, collection, serverTimestamp, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../firebase'

const CATEGORY_EMOJIS = ['✨', '🦕', '🎮', '🎨', '💬', '🔊', '📌', '🌴', '🔥', '⭐']

export default function EditCategory({ serverId, category, defaultType = 'text', onClose }) {
  const [name,  setName]  = useState(category?.name || '')
  const [emoji, setEmoji] = useState(category?.emoji ?? '✨')
  const [type,  setType]  = useState(category?.type || defaultType)
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      if (category) {
        await updateDoc(doc(db, 'servers', serverId, 'categories', category.id), {
          name: name.trim(), emoji, type,
        })
        // If the type changed, any channel of the old type assigned here would
        // get rendered with the wrong (text/voice) component — unassign them.
        if (type !== (category.type || 'text')) {
          const channelsSnap = await getDocs(
            query(collection(db, 'servers', serverId, 'channels'), where('categoryId', '==', category.id))
          )
          const mismatched = channelsSnap.docs.filter(d => (d.data().type || 'text') !== type)
          await Promise.all(mismatched.map(d =>
            updateDoc(doc(db, 'servers', serverId, 'channels', d.id), { categoryId: null })
          ))
        }
      } else {
        const snap = await getDocs(collection(db, 'servers', serverId, 'categories'))
        await addDoc(collection(db, 'servers', serverId, 'categories'), {
          name: name.trim(), emoji, type, position: snap.size, createdAt: serverTimestamp(),
        })
      }
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!category || !window.confirm(`Delete header "${category.name}"? Channels inside will become uncategorised.`)) return
    setSaving(true)
    try {
      // Clear categoryId off every channel pointing at this header first, or
      // they'd silently vanish from the sidebar (no header left to render them under).
      const channelsSnap = await getDocs(
        query(collection(db, 'servers', serverId, 'channels'), where('categoryId', '==', category.id))
      )
      await Promise.all(channelsSnap.docs.map(d =>
        updateDoc(doc(db, 'servers', serverId, 'channels', d.id), { categoryId: null })
      ))
      await deleteDoc(doc(db, 'servers', serverId, 'categories', category.id))
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 360 }}>
        <h2>{category ? 'Edit Header' : (defaultType === 'voice' ? 'New Voice Header' : 'New Text Header')}</h2>
        <form onSubmit={handleSave}>
          <label>Header Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Practice Map"
            autoFocus
            maxLength={50}
          />
          <label style={{ marginTop: 12 }}>Header Type</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {[
              { id: 'text',  label: '# Text',  desc: 'Holds text channels' },
              { id: 'voice', label: '🔊 Voice', desc: 'Holds voice channels' },
            ].map(opt => (
              <div
                key={opt.id}
                onClick={() => setType(opt.id)}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  border: `2px solid ${type === opt.id ? 'var(--accent)' : 'var(--bg-active)'}`,
                  background: type === opt.id ? 'rgba(88,101,242,0.12)' : 'var(--bg-tertiary)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--header-primary)' }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opt.desc}</div>
              </div>
            ))}
          </div>
          <label style={{ marginTop: 12 }}>Decoration Emoji</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            <button
              type="button"
              onClick={() => setEmoji('')}
              title="No emoji"
              style={{
                fontSize: 12, fontWeight: 700, padding: '6px 10px', borderRadius: 8,
                border: `2px solid ${emoji === '' ? 'var(--accent)' : 'var(--bg-active)'}`,
                background: emoji === '' ? 'rgba(88,101,242,0.15)' : 'var(--bg-tertiary)',
                color: 'var(--text-muted)', cursor: 'pointer',
              }}
            >None</button>
            {CATEGORY_EMOJIS.map(em => (
              <button
                key={em}
                type="button"
                onClick={() => setEmoji(em)}
                style={{
                  fontSize: 18, padding: '6px 10px', borderRadius: 8,
                  border: `2px solid ${emoji === em ? 'var(--accent)' : 'var(--bg-active)'}`,
                  background: emoji === em ? 'rgba(88,101,242,0.15)' : 'var(--bg-tertiary)',
                  cursor: 'pointer',
                }}
              >{em}</button>
            ))}
          </div>
          <div className="modal-actions" style={{ marginTop: 18 }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            {category && (
              <button type="button" className="btn-danger" onClick={handleDelete} disabled={saving}>Delete</button>
            )}
            <button type="submit" className="btn-confirm" disabled={!name.trim() || saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
