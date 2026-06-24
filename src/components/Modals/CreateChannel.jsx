import { useEffect, useState } from 'react'
import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'

export default function CreateChannel({ serverId, defaultType = 'text', isGroup, onClose }) {
  const [name,       setName]       = useState('')
  const [type,       setType]       = useState(defaultType)
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]    = useState(false)

  useEffect(() => {
    // Headers are a server-only feature — skip the query entirely for groups
    if (isGroup) return
    getDocs(collection(db, 'servers', serverId, 'categories')).then(snap => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [serverId, isGroup])

  // A text channel can only go in a text category, voice in a voice category
  const matchingCategories = categories.filter(c => (c.type || 'text') === type)

  useEffect(() => {
    if (categoryId && !matchingCategories.some(c => c.id === categoryId)) setCategoryId('')
  }, [type]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim() || loading) return
    setLoading(true)
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    try {
      const snap = await getDocs(collection(db, 'servers', serverId, 'channels'))
      const ref = await addDoc(collection(db, 'servers', serverId, 'channels'), {
        name: slug,
        type,
        // Text channels default to editing — hosts/mods can flip individual
        // channels to viewing-only later. Voice channels ignore this field.
        viewType: 'editing',
        categoryId: categoryId || null,
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
        <p>Choose a type, give it a name, and start talking!</p>

        {/* Channel type — locked to whatever + button was pressed */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          {[
            { id: 'text',  icon: '#',  label: 'Text Channel',  desc: 'Chat with text, images and GIFs' },
            { id: 'voice', icon: '🔊', label: 'Voice Channel', desc: 'Hang out with voice & video' },
          ].map(opt => (
            <div
              key={opt.id}
              style={{
                flex: 1, padding: '12px 14px', borderRadius: 8,
                border: `2px solid ${type === opt.id ? 'var(--accent)' : 'var(--bg-active)'}`,
                background: type === opt.id ? 'rgba(90,158,68,0.12)' : 'var(--bg-tertiary)',
                opacity: type === opt.id ? 1 : 0.45,
                cursor: 'default',
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 6 }}>{opt.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--header-primary)', marginBottom: 3 }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opt.desc}</div>
            </div>
          ))}
        </div>

        <form onSubmit={handleCreate}>
          <label>Channel Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={type === 'voice' ? 'lounge' : 'new-channel'}
            autoFocus
            maxLength={80}
          />
          {matchingCategories.length > 0 && (
            <>
              <label style={{ marginTop: 12 }}>Header (optional)</label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                style={{
                  width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--bg-modifier)',
                  borderRadius: 6, color: 'var(--text-normal)', padding: '8px 10px', fontFamily: 'inherit',
                }}
              >
                <option value="">No header</option>
                {matchingCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                ))}
              </select>
            </>
          )}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => onClose()}>Cancel</button>
            <button type="submit" className="btn-confirm" disabled={!name.trim() || loading}>
              {loading ? 'Creating…' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
