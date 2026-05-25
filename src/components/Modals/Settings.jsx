import { useState } from 'react'
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
  { id: 'online',  label: 'Online',           color: '#3ba55d' },
  { id: 'idle',    label: 'Idle',              color: '#faa61a' },
  { id: 'dnd',     label: 'Do Not Disturb',    color: '#ed4245' },
  { id: 'offline', label: 'Invisible',         color: '#747f8d' },
]

export default function Settings({ onClose }) {
  const { currentUser } = useAuth()
  const [tab, setTab] = useState('profile')
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '')
  const [customUrl, setCustomUrl] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSaveProfile(e) {
    e.preventDefault()
    if (!displayName.trim()) return
    setSaving(true)
    setError('')
    try {
      const updates = { displayName: displayName.trim() }
      if (customUrl.trim()) {
        updates.photoURL = customUrl.trim()
        updates.avatarEmoji = null
        updates.avatarBg = null
        await updateProfile(auth.currentUser, { displayName: displayName.trim(), photoURL: customUrl.trim() })
      } else if (selectedAvatar) {
        updates.avatarEmoji = selectedAvatar.emoji
        updates.avatarBg = selectedAvatar.bg
        updates.photoURL = null
        await updateProfile(auth.currentUser, { displayName: displayName.trim(), photoURL: null })
      } else {
        await updateProfile(auth.currentUser, { displayName: displayName.trim() })
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

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="settings-modal">
        {/* Sidebar */}
        <div className="settings-sidebar">
          <div className="settings-category">User Settings</div>
          <div
            className={`settings-tab ${tab === 'profile' ? 'active' : ''}`}
            onClick={() => setTab('profile')}
          >
            👤 My Account
          </div>
          <div
            className={`settings-tab ${tab === 'status' ? 'active' : ''}`}
            onClick={() => setTab('status')}
          >
            🟢 Status
          </div>
          <div className="settings-divider" />
          <div className="settings-tab danger" onClick={onClose}>
            ✕ Close
          </div>
        </div>

        {/* Content */}
        <div className="settings-content">
          {tab === 'profile' && (
            <>
              <h2>My Account</h2>

              {/* Current avatar preview */}
              <div className="avatar-preview-row">
                <div className="avatar-preview-big" style={{ background: selectedAvatar?.bg || '#5a9e44' }}>
                  {selectedAvatar ? selectedAvatar.emoji : (currentUser?.displayName?.[0] || '?').toUpperCase()}
                </div>
                <div>
                  <div style={{ color: 'var(--header-primary)', fontWeight: 700 }}>{displayName}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{currentUser?.email}</div>
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

                <label className="settings-label">Choose a Dino Avatar 🦕</label>
                <div className="avatar-grid">
                  {PRESET_AVATARS.map(av => (
                    <div
                      key={av.id}
                      className={`avatar-option ${selectedAvatar?.id === av.id ? 'selected' : ''}`}
                      style={{ background: av.bg }}
                      onClick={() => { setSelectedAvatar(av); setCustomUrl('') }}
                    >
                      {av.emoji}
                    </div>
                  ))}
                </div>

                <label className="settings-label">Or paste a custom image URL</label>
                <input
                  className="settings-input"
                  value={customUrl}
                  onChange={e => { setCustomUrl(e.target.value); setSelectedAvatar(null) }}
                  placeholder="https://example.com/my-image.png"
                />

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
                  <div
                    key={s.id}
                    className="status-option"
                    onClick={() => handleStatus(s.id)}
                  >
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
