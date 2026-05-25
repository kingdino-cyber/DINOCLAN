import { useState, useRef } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { updateProfile } from 'firebase/auth'
import { db, auth } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'

const PRESET_AVATARS = [
  { id: 'dino1',  emoji: '🦕', bg: '#5a9e44' },
  { id: 'dino2',  emoji: '🦖', bg: '#c0392b' },
  { id: 'dino3',  emoji: '🦎', bg: '#8e44ad' },
  { id: 'dino4',  emoji: '🐊', bg: '#2980b9' },
  { id: 'dino5',  emoji: '🥚', bg: '#f39c12' },
  { id: 'dino6',  emoji: '🌋', bg: '#7f3b08' },
  { id: 'dino7',  emoji: '🌿', bg: '#1e8449' },
  { id: 'dino8',  emoji: '🦴', bg: '#717d7e' },
  { id: 'dino9',  emoji: '🐾', bg: '#d35400' },
  { id: 'dino10', emoji: '⚡', bg: '#b7950b' },
  { id: 'dino11', emoji: '🔥', bg: '#e74c3c' },
  { id: 'dino12', emoji: '💎', bg: '#148f77' },
]

const STATUSES = [
  { id: 'online',  label: 'Online',        color: '#3ba55d' },
  { id: 'idle',    label: 'Idle',           color: '#faa61a' },
  { id: 'dnd',     label: 'Do Not Disturb', color: '#ed4245' },
  { id: 'offline', label: 'Invisible',      color: '#747f8d' },
]

function compressImage(file, maxSize = 128) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.75))
    }
    img.onerror = reject
    img.src = url
  })
}

export default function Settings({ onClose }) {
  const { currentUser } = useAuth()
  const [tab, setTab] = useState('profile')
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '')
  const [selectedAvatar, setSelectedAvatar] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return }
    setUploading(true)
    setError('')
    try {
      const dataUrl = await compressImage(file)
      setPreviewUrl(dataUrl)
      setSelectedAvatar(null)
    } catch {
      setError('Failed to process image.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    if (!displayName.trim()) return
    setSaving(true)
    setError('')
    try {
      // Only update displayName in Firebase Auth (photoURL is stored in Firestore only)
      await updateProfile(auth.currentUser, { displayName: displayName.trim() })

      const updates = { displayName: displayName.trim() }
      if (previewUrl) {
        updates.photoURL = previewUrl
        updates.avatarEmoji = null
        updates.avatarBg = null
      } else if (selectedAvatar) {
        updates.avatarEmoji = selectedAvatar.emoji
        updates.avatarBg = selectedAvatar.bg
        updates.photoURL = null
      }
      await updateDoc(doc(db, 'users', currentUser.uid), updates)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatus(statusId) {
    await updateDoc(doc(db, 'users', currentUser.uid), { status: statusId })
  }

  const avatarDisplay = previewUrl
    ? <img src={previewUrl} alt="preview" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
    : selectedAvatar
      ? <span style={{ fontSize: 32 }}>{selectedAvatar.emoji}</span>
      : <span style={{ fontSize: 24, fontWeight: 700 }}>{(currentUser?.displayName?.[0] || '?').toUpperCase()}</span>

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="settings-modal">
        {/* Sidebar */}
        <div className="settings-sidebar">
          <div className="settings-category">User Settings</div>
          <div className={`settings-tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')} data-tooltip="Edit your profile.">
            👤 My Account
          </div>
          <div className={`settings-tab ${tab === 'status' ? 'active' : ''}`} onClick={() => setTab('status')} data-tooltip="Set your status.">
            🟢 Status
          </div>
          <div className="settings-divider" />
          <div className="settings-tab danger" onClick={onClose} data-tooltip="Close settings.">
            ✕ Close
          </div>
        </div>

        {/* Content */}
        <div className="settings-content">
          {tab === 'profile' && (
            <>
              <h2>My Account</h2>

              {/* Avatar upload area */}
              <div className="avatar-upload-section">
                <div
                  className="avatar-upload-circle"
                  style={{ background: selectedAvatar?.bg || '#5a9e44' }}
                  onClick={() => fileInputRef.current?.click()}
                  data-tooltip="Click to upload photo."
                >
                  {avatarDisplay}
                  <div className="avatar-upload-overlay">
                    {uploading ? '⏳' : '📷 Upload'}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <div className="avatar-upload-hint">
                  <strong>Click the circle</strong> to upload a photo from your computer.<br />
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Or pick a dino avatar below.</span>
                </div>
              </div>

              <form onSubmit={handleSaveProfile}>
                <label className="settings-label">Display Name</label>
                <input
                  className="settings-input"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  maxLength={32}
                />

                <label className="settings-label">Or choose a Dino Avatar 🦕</label>
                <div className="avatar-grid">
                  {PRESET_AVATARS.map(av => (
                    <div
                      key={av.id}
                      className={`avatar-option ${selectedAvatar?.id === av.id ? 'selected' : ''}`}
                      style={{ background: av.bg }}
                      onClick={() => { setSelectedAvatar(av); setPreviewUrl(null) }}
                      data-tooltip={av.emoji}
                    >
                      {av.emoji}
                    </div>
                  ))}
                </div>

                {error && <div className="auth-error" style={{ marginTop: 8 }}>{error}</div>}

                <button className="btn-confirm" type="submit" disabled={saving} style={{ marginTop: 16 }}>
                  {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Changes'}
                </button>
              </form>
            </>
          )}

          {tab === 'status' && (
            <>
              <h2>Set Status</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
                Choose how you appear to other members.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {STATUSES.map(s => (
                  <div key={s.id} className="status-option" onClick={() => handleStatus(s.id)} data-tooltip={`Set as ${s.label}.`}>
                    <span className="status-dot-big" style={{ background: s.color }} />
                    {s.label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
