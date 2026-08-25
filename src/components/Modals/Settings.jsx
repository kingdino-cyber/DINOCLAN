import { useState, useRef, useEffect } from 'react'
import { doc, updateDoc, getDoc } from 'firebase/firestore'
import { updateProfile } from 'firebase/auth'
import { db, auth } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'

async function saveRayMode(uid, enabled) {
  await updateDoc(doc(db, 'users', uid), { rayMode: enabled })
  if (enabled) document.body.setAttribute('data-ray', 'true')
  else         document.body.removeAttribute('data-ray')
}

async function savePandaMode(uid, enabled) {
  await updateDoc(doc(db, 'users', uid), { pandaMode: enabled })
  if (enabled) document.body.setAttribute('data-panda', 'true')
  else         document.body.removeAttribute('data-panda')
}

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
  const { currentUser, changePassword } = useAuth()
  const [tab, setTab] = useState('profile')
  const [rayMode, setRayMode] = useState(false)
  const [rayToggling, setRayToggling] = useState(false)
  const [pandaMode, setPandaMode] = useState(false)
  const [pandaToggling, setPandaToggling] = useState(false)

  // Profile state
  const [displayName,    setDisplayName]    = useState(currentUser?.displayName || '')
  const [aboutMe,        setAboutMe]        = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState(null)
  const [previewUrl,     setPreviewUrl]     = useState(null)
  const [uploading,      setUploading]      = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [saved,          setSaved]          = useState(false)
  const [profileError,   setProfileError]   = useState('')
  const fileInputRef = useRef(null)

  // Security state
  const [currentPw,   setCurrentPw]   = useState('')
  const [newPw,       setNewPw]       = useState('')
  const [confirmPw,   setConfirmPw]   = useState('')
  const [pwSaving,    setPwSaving]    = useState(false)
  const [pwSaved,     setPwSaved]     = useState(false)
  const [pwError,     setPwError]     = useState('')

  // Load existing About Me + Ray Mode on mount
  useEffect(() => {
    if (!currentUser?.uid) return
    getDoc(doc(db, 'users', currentUser.uid)).then(snap => {
      if (snap.exists()) {
        setAboutMe(snap.data().aboutMe || '')
        setRayMode(!!snap.data().rayMode)
        setPandaMode(!!snap.data().pandaMode)
      }
    })
  }, [currentUser?.uid])

  async function handleRayToggle() {
    setRayToggling(true)
    const next = !rayMode
    setRayMode(next)
    try { await saveRayMode(currentUser.uid, next) } catch (_) { setRayMode(!next) }
    setRayToggling(false)
  }

  async function handlePandaToggle() {
    setPandaToggling(true)
    const next = !pandaMode
    setPandaMode(next)
    try { await savePandaMode(currentUser.uid, next) } catch (_) { setPandaMode(!next) }
    setPandaToggling(false)
  }

  // ── Profile handlers ────────────────────────────────────────────────────────
  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setProfileError('Please select an image file.'); return }
    setUploading(true); setProfileError('')
    try {
      const dataUrl = await compressImage(file)
      setPreviewUrl(dataUrl); setSelectedAvatar(null)
    } catch { setProfileError('Failed to process image.') }
    finally  { setUploading(false) }
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    if (!displayName.trim()) return
    setSaving(true); setProfileError('')
    try {
      await updateProfile(auth.currentUser, { displayName: displayName.trim() })
      const updates = { displayName: displayName.trim(), aboutMe: aboutMe.slice(0, 500) }
      if (previewUrl) {
        updates.photoURL     = previewUrl
        updates.avatarEmoji  = null
        updates.avatarBg     = null
      } else if (selectedAvatar) {
        updates.avatarEmoji  = selectedAvatar.emoji
        updates.avatarBg     = selectedAvatar.bg
        updates.photoURL     = null
      }
      await updateDoc(doc(db, 'users', currentUser.uid), updates)
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch { setProfileError('Failed to save. Please try again.') }
    finally  { setSaving(false) }
  }

  async function handleStatus(statusId) {
    await updateDoc(doc(db, 'users', currentUser.uid), { status: statusId })
  }

  // ── Security handlers ───────────────────────────────────────────────────────
  async function handleChangePassword(e) {
    e.preventDefault()
    setPwError('')
    if (!currentPw)              { setPwError('Enter your current password.'); return }
    if (newPw.length < 6)        { setPwError('New password must be at least 6 characters.'); return }
    if (newPw !== confirmPw)     { setPwError('New passwords do not match.'); return }
    if (newPw === currentPw)     { setPwError('New password must be different from current.'); return }
    setPwSaving(true)
    try {
      await changePassword(currentPw, newPw)
      setPwSaved(true)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => setPwSaved(false), 3000)
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setPwError('Current password is incorrect.')
      } else if (err.code === 'auth/too-many-requests') {
        setPwError('Too many attempts. Try again later.')
      } else {
        setPwError('Failed to change password. Please try again.')
      }
    } finally { setPwSaving(false) }
  }

  const avatarDisplay = previewUrl
    ? <img src={previewUrl} alt="preview" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
    : selectedAvatar
      ? <span style={{ fontSize: 32 }}>{selectedAvatar.emoji}</span>
      : <span style={{ fontSize: 24, fontWeight: 700 }}>{(currentUser?.displayName?.[0] || '?').toUpperCase()}</span>

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="settings-modal">

        {/* ── Sidebar ── */}
        <div className="settings-sidebar">
          <div className="settings-category">User Settings</div>
          <div className={`settings-tab ${tab === 'profile'    ? 'active' : ''}`} onClick={() => setTab('profile')}>👤 My Account</div>
          <div className={`settings-tab ${tab === 'status'     ? 'active' : ''}`} onClick={() => setTab('status')}>🟢 Status</div>
          <div className={`settings-tab ${tab === 'security'   ? 'active' : ''}`} onClick={() => setTab('security')}>🔒 Security</div>
          <div className={`settings-tab ${tab === 'appearance' ? 'active' : ''}`} onClick={() => setTab('appearance')}>🎨 Appearance</div>
          <div className="settings-divider" />
          <div className="settings-tab danger" onClick={onClose}>✕ Close</div>
        </div>

        {/* ── Content ── */}
        <div className="settings-content">

          {/* Profile tab */}
          {tab === 'profile' && (
            <>
              <h2>My Account</h2>
              <div className="avatar-upload-section">
                <div
                  className="avatar-upload-circle"
                  style={{ background: selectedAvatar?.bg || '#5a9e44' }}
                  onClick={() => fileInputRef.current?.click()}
                  data-tooltip="Click to upload photo."
                >
                  {avatarDisplay}
                  <div className="avatar-upload-overlay">{uploading ? '⏳' : '📷 Upload'}</div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                <div className="avatar-upload-hint">
                  <strong>Click the circle</strong> to upload a photo.<br />
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Or pick a dino avatar below.</span>
                </div>
              </div>

              <form onSubmit={handleSaveProfile}>
                <label className="settings-label">Display Name</label>
                <input className="settings-input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" maxLength={32} />

                <label className="settings-label">About Me</label>
                <textarea
                  className="settings-input"
                  value={aboutMe}
                  onChange={e => setAboutMe(e.target.value)}
                  placeholder="Tell people about yourself… (500 characters max)"
                  maxLength={500}
                  rows={4}
                  style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginTop: 2 }}>
                  {aboutMe.length}/500
                </div>

                <label className="settings-label">Or choose a Dino Avatar 🦕</label>
                <div className="avatar-grid">
                  {PRESET_AVATARS.map(av => (
                    <div key={av.id} className={`avatar-option ${selectedAvatar?.id === av.id ? 'selected' : ''}`} style={{ background: av.bg }}
                      onClick={() => { setSelectedAvatar(av); setPreviewUrl(null) }}>
                      {av.emoji}
                    </div>
                  ))}
                </div>

                {profileError && <div className="auth-error" style={{ marginTop: 8 }}>{profileError}</div>}
                <button className="btn-confirm" type="submit" disabled={saving} style={{ marginTop: 16 }}>
                  {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Changes'}
                </button>
              </form>
            </>
          )}

          {/* Status tab */}
          {tab === 'status' && (
            <>
              <h2>Set Status</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>Choose how you appear to others.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {STATUSES.map(s => (
                  <div key={s.id} className="status-option" onClick={() => handleStatus(s.id)}>
                    <span className="status-dot-big" style={{ background: s.color }} />
                    {s.label}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Security tab */}
          {tab === 'security' && (
            <>
              <h2>Security</h2>


              {/* Change password form */}
              <h3 style={{ fontSize: 14, color: 'var(--header-primary)', marginBottom: 12 }}>Change Password</h3>
              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label className="settings-label">Current Password</label>
                  <input className="settings-input" type="password" value={currentPw}
                    onChange={e => setCurrentPw(e.target.value)} placeholder="Enter current password" autoComplete="current-password" />
                </div>
                <div>
                  <label className="settings-label">New Password</label>
                  <input className="settings-input" type="password" value={newPw}
                    onChange={e => setNewPw(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
                </div>
                <div>
                  <label className="settings-label">Confirm New Password</label>
                  <input className="settings-input" type="password" value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" autoComplete="new-password" />
                </div>
                {pwError  && <div className="auth-error">{pwError}</div>}
                {pwSaved  && <div style={{ color: 'var(--success)', fontWeight: 600, fontSize: 13 }}>✓ Password changed successfully!</div>}
                <button className="btn-confirm" type="submit" disabled={pwSaving} style={{ marginTop: 4 }}>
                  {pwSaving ? 'Changing…' : 'Change Password'}
                </button>
              </form>
            </>
          )}

          {/* Appearance tab */}
          {tab === 'appearance' && (
            <>
              <h2>Appearance</h2>

              {/* Ray's Improvements toggle */}
              <div style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--bg-modifier)',
                borderRadius: 10,
                padding: '18px 20px',
                marginBottom: 24,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--header-primary)', marginBottom: 6 }}>
                      ✨ Ray's Improvements
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                      Applies a suite of accessibility and readability enhancements:
                    </div>
                    <ul style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, margin: '8px 0 0 16px', padding: 0 }}>
                      <li>Higher text contrast across the entire app</li>
                      <li>Message separation with subtle row borders</li>
                      <li>Clearer active-channel indicators in the sidebar</li>
                      <li>Dimmed background decorations (dinos &amp; foliage)</li>
                      <li>Softer role badges (ADMIN / MOD)</li>
                      <li>Sponsor section hidden to reduce UI clutter</li>
                      <li>More padding in the message input bar</li>
                      <li>Balanced Discover grid layout</li>
                      <li>Better visible timestamps and member counts</li>
                    </ul>
                  </div>

                  {/* Toggle switch */}
                  <button
                    onClick={handleRayToggle}
                    disabled={rayToggling}
                    style={{
                      flexShrink: 0,
                      width: 52,
                      height: 28,
                      borderRadius: 14,
                      border: 'none',
                      background: rayMode ? 'var(--accent)' : 'var(--bg-modifier)',
                      cursor: rayToggling ? 'wait' : 'pointer',
                      position: 'relative',
                      transition: 'background .2s',
                    }}
                    title={rayMode ? 'Disable Ray\'s Improvements' : 'Enable Ray\'s Improvements'}
                  >
                    <span style={{
                      position: 'absolute',
                      top: 3, left: rayMode ? 27 : 3,
                      width: 22, height: 22,
                      borderRadius: '50%',
                      background: '#fff',
                      boxShadow: '0 1px 4px rgba(0,0,0,.4)',
                      transition: 'left .2s',
                      display: 'block',
                    }} />
                  </button>
                </div>

                {rayMode && (
                  <div style={{
                    marginTop: 14,
                    padding: '8px 12px',
                    background: 'rgba(88,101,242,.12)',
                    border: '1px solid rgba(88,101,242,.3)',
                    borderRadius: 6,
                    fontSize: 12,
                    color: 'var(--accent)',
                    fontWeight: 600,
                  }}>
                    ✓ Ray's Improvements are active — the UI has been updated.
                  </div>
                )}
              </div>

              {/* Panda Mode toggle */}
              <div style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--bg-modifier)',
                borderRadius: 10,
                padding: '18px 20px',
                marginBottom: 24,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--header-primary)', marginBottom: 6 }}>
                      🐼 Panda Mode
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                      Transforms DinoLAN into a panda-themed experience:
                    </div>
                    <ul style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, margin: '8px 0 0 16px', padding: 0 }}>
                      <li>Black &amp; white panda colour scheme throughout</li>
                      <li>Panda emoji watermark decorations</li>
                      <li>Bamboo-green accent colour</li>
                      <li>Rounded, soft UI corners</li>
                    </ul>
                  </div>
                  <button
                    onClick={handlePandaToggle}
                    disabled={pandaToggling}
                    style={{
                      flexShrink: 0,
                      width: 52,
                      height: 28,
                      borderRadius: 14,
                      border: 'none',
                      background: pandaMode ? '#4a7c59' : 'var(--bg-modifier)',
                      cursor: pandaToggling ? 'wait' : 'pointer',
                      position: 'relative',
                      transition: 'background .2s',
                    }}
                    title={pandaMode ? 'Disable Panda Mode' : 'Enable Panda Mode'}
                  >
                    <span style={{
                      position: 'absolute',
                      top: 3, left: pandaMode ? 27 : 3,
                      width: 22, height: 22,
                      borderRadius: '50%',
                      background: '#fff',
                      boxShadow: '0 1px 4px rgba(0,0,0,.4)',
                      transition: 'left .2s',
                      display: 'block',
                    }} />
                  </button>
                </div>
                {pandaMode && (
                  <div style={{
                    marginTop: 14,
                    padding: '8px 12px',
                    background: 'rgba(74,124,89,.15)',
                    border: '1px solid rgba(74,124,89,.4)',
                    borderRadius: 6,
                    fontSize: 12,
                    color: '#4a7c59',
                    fontWeight: 600,
                  }}>
                    🐼 Panda Mode is active — looking cute!
                  </div>
                )}
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                These settings are saved to your account and apply only to you.
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
