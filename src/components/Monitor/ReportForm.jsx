import { useState } from 'react'
import { collection, getDocs, getDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'

const ADMIN_EMAIL = 'bohlehsaurus7@gmail.com'

const HEART_ICON = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
    <path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66"/>
    <path d="m18 15-2-2"/><path d="m15 18-2-2"/>
  </svg>
)

export default function ReportForm({ onClose }) {
  const { currentUser } = useAuth()
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  function handleFile(f) {
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f?.type.startsWith('image/')) handleFile(f)
  }

  async function submit() {
    if (!description.trim() || !file) return
    setLoading(true)
    setError('')
    try {
      let evidenceUrl = null
      try {
        const storageRef = ref(storage, `reports/${Date.now()}_${file.name}`)
        await uploadBytes(storageRef, file)
        evidenceUrl = await getDownloadURL(storageRef)
      } catch { /* upload failed (CORS) — report still submits */ }

      const monitorSnap = await getDocs(collection(db, 'monitors'))
      const monitors = monitorSnap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter(m => m.email !== ADMIN_EMAIL)

      if (monitors.length === 0) {
        setError('No monitors available right now. Please try again later.')
        setLoading(false)
        return
      }

      const statusChecks = await Promise.all(monitors.map(m => getDoc(doc(db, 'users', m.uid))))
      const onlineMonitors = monitors.filter((m, i) => statusChecks[i].data()?.status === 'online')
      const chosen = onlineMonitors.length > 0
        ? onlineMonitors[0]
        : monitors[Math.floor(Math.random() * monitors.length)]

      await addDoc(collection(db, 'reports'), {
        reporterUid: currentUser.uid,
        reporterName: currentUser.displayName || currentUser.email,
        description: description.trim(),
        evidenceUrl,
        assignedMonitorUid: chosen.uid,
        status: 'pending',
        createdAt: serverTimestamp(),
      })

      setSuccess(true)
      setTimeout(onClose, 2500)
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  return (
    <>
      <style>{`
        @keyframes rf-backdrop-in {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        @keyframes rf-modal-in {
          from { opacity: 0; transform: scale(0.92) translateY(16px) }
          to   { opacity: 1; transform: scale(1) translateY(0) }
        }
        @keyframes rf-success-in {
          from { opacity: 0; transform: scale(0.8) }
          to   { opacity: 1; transform: scale(1) }
        }
        @keyframes rf-spin {
          to { transform: rotate(360deg) }
        }
        .rf-backdrop {
          position: fixed; inset: 0; z-index: 9100;
          background: rgba(0,0,0,0.72);
          display: flex; align-items: center; justify-content: center;
          animation: rf-backdrop-in 0.2s ease;
          backdrop-filter: blur(4px);
        }
        .rf-modal {
          background: var(--bg-secondary);
          border-radius: 18px;
          width: min(500px, 95vw);
          box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06);
          overflow: hidden;
          animation: rf-modal-in 0.25s cubic-bezier(0.34,1.56,0.64,1);
        }
        .rf-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 22px 24px 18px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: var(--bg-tertiary);
        }
        .rf-title {
          display: flex; align-items: center; gap: 10px;
          margin: 0; font-size: 17px; font-weight: 700;
          color: var(--header-primary);
        }
        .rf-icon-wrap {
          width: 36px; height: 36px; border-radius: 10px;
          background: color-mix(in srgb, var(--accent) 20%, transparent);
          display: flex; align-items: center; justify-content: center;
          color: var(--accent);
        }
        .rf-close {
          background: rgba(255,255,255,0.06); border: none;
          color: var(--text-muted); width: 30px; height: 30px;
          border-radius: 8px; cursor: pointer; font-size: 16px;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s;
        }
        .rf-close:hover { background: rgba(255,255,255,0.12); color: var(--header-primary); }
        .rf-body { padding: 22px 24px 24px; }
        .rf-label {
          display: block; font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.08em;
          color: var(--text-muted); margin-bottom: 7px;
        }
        .rf-textarea {
          width: 100%; box-sizing: border-box;
          background: var(--bg-primary); border: 1.5px solid rgba(255,255,255,0.08);
          border-radius: 10px; padding: 12px 14px;
          color: var(--text-normal); font-size: 14px; line-height: 1.5;
          resize: vertical; min-height: 110px;
          font-family: inherit; outline: none;
          transition: border-color 0.2s;
        }
        .rf-textarea:focus { border-color: var(--accent); }
        .rf-drop-zone {
          border: 2px dashed rgba(255,255,255,0.12); border-radius: 12px;
          background: var(--bg-primary); padding: 20px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 8px; cursor: pointer; transition: border-color 0.2s, background 0.2s;
          min-height: 90px; position: relative;
        }
        .rf-drop-zone:hover {
          border-color: color-mix(in srgb, var(--accent) 60%, transparent);
          background: color-mix(in srgb, var(--accent) 5%, var(--bg-primary));
        }
        .rf-drop-zone.over {
          border-color: var(--accent);
          background: color-mix(in srgb, var(--accent) 12%, var(--bg-primary));
        }
        .rf-drop-zone input[type=file] {
          position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%;
        }
        .rf-drop-label { font-size: 13px; color: var(--text-muted); text-align: center; }
        .rf-drop-label span { color: var(--accent); font-weight: 600; }
        .rf-preview {
          width: 100%; max-height: 160px; object-fit: cover;
          border-radius: 10px; margin-top: 12px;
          border: 1px solid rgba(255,255,255,0.08);
          animation: rf-success-in 0.2s ease;
        }
        .rf-error {
          background: color-mix(in srgb, var(--danger) 15%, transparent);
          border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
          border-radius: 8px; padding: 10px 14px;
          color: var(--danger); font-size: 13px; margin-bottom: 16px;
        }
        .rf-actions { display: flex; gap: 10px; justify-content: flex-end; padding-top: 4px; }
        .rf-btn-cancel {
          padding: 10px 20px; border-radius: 10px; border: 1.5px solid rgba(255,255,255,0.12);
          background: transparent; color: var(--text-normal); font-size: 14px;
          font-weight: 600; cursor: pointer; transition: background 0.15s;
        }
        .rf-btn-cancel:hover { background: rgba(255,255,255,0.06); }
        .rf-btn-submit {
          padding: 10px 22px; border-radius: 10px; border: none;
          background: var(--accent); color: #fff; font-size: 14px;
          font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px;
          transition: opacity 0.15s, transform 0.15s;
        }
        .rf-btn-submit:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        .rf-btn-submit:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
        .rf-spinner {
          width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%;
          animation: rf-spin 0.7s linear infinite;
        }
        .rf-success {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 14px; padding: 32px 24px;
          animation: rf-success-in 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        .rf-success-icon {
          width: 64px; height: 64px; border-radius: 50%;
          background: color-mix(in srgb, var(--success, #3ba55c) 18%, transparent);
          display: flex; align-items: center; justify-content: center;
          color: var(--success, #3ba55c); font-size: 32px;
        }
        .rf-success-text { font-size: 16px; font-weight: 700; color: var(--header-primary); text-align: center; }
        .rf-success-sub { font-size: 13px; color: var(--text-muted); text-align: center; }
      `}</style>

      <div className="rf-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="rf-modal">
          <div className="rf-header">
            <h2 className="rf-title">
              <div className="rf-icon-wrap">{HEART_ICON}</div>
              Request Help
            </h2>
            <button className="rf-close" onClick={onClose}>✕</button>
          </div>

          {success ? (
            <div className="rf-success">
              <div className="rf-success-icon">✓</div>
              <div className="rf-success-text">Report submitted!</div>
              <div className="rf-success-sub">A monitor will review your report shortly.</div>
            </div>
          ) : (
            <div className="rf-body">
              <div style={{ marginBottom: 18 }}>
                <label className="rf-label">What's happening? *</label>
                <textarea
                  className="rf-textarea"
                  placeholder="Describe the situation…"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label className="rf-label">Evidence (screenshot required) *</label>
                <div
                  className={`rf-drop-zone${dragOver ? ' over' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                >
                  <input type="file" accept="image/*" onChange={e => handleFile(e.target.files[0])} />
                  {preview ? (
                    <img src={preview} alt="preview" className="rf-preview" />
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                        <path d="m21 15-5-5L5 21"/>
                      </svg>
                      <p className="rf-drop-label">
                        Drag & drop or <span>browse</span>
                      </p>
                    </>
                  )}
                </div>
              </div>

              {error && <div className="rf-error">{error}</div>}

              <div className="rf-actions">
                <button className="rf-btn-cancel" onClick={onClose} disabled={loading}>Cancel</button>
                <button
                  className="rf-btn-submit"
                  onClick={submit}
                  disabled={loading || !description.trim() || !file}
                >
                  {loading && <div className="rf-spinner" />}
                  {loading ? 'Submitting…' : 'Submit Report'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
