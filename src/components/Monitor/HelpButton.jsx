import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useMonitor } from '../../contexts/MonitorContext'
import ReportForm from './ReportForm'

const HEART_SVG = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
    <path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66"/>
    <path d="m18 15-2-2"/><path d="m15 18-2-2"/>
  </svg>
)

function HowItWorksModal({ onNext, onClose }) {
  return (
    <>
      <style>{`
        @keyframes hiw-in {
          from { opacity:0; transform:scale(0.92) translateY(16px) }
          to   { opacity:1; transform:scale(1) translateY(0) }
        }
        .hiw-backdrop {
          position:fixed; inset:0; z-index:9100;
          background:rgba(0,0,0,0.72); backdrop-filter:blur(4px);
          display:flex; align-items:center; justify-content:center;
          animation: rf-backdrop-in 0.2s ease;
        }
        .hiw-modal {
          background:var(--bg-secondary); border-radius:18px;
          width:min(440px,95vw); overflow:hidden;
          box-shadow:0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06);
          animation:hiw-in 0.25s cubic-bezier(0.34,1.56,0.64,1);
        }
        .hiw-header {
          background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 18%,var(--bg-tertiary)),var(--bg-tertiary));
          padding:28px 28px 24px; border-bottom:1px solid rgba(255,255,255,0.06);
          display:flex; align-items:flex-start; justify-content:space-between;
        }
        .hiw-icon-wrap {
          width:48px; height:48px; border-radius:14px; flex-shrink:0;
          background:color-mix(in srgb,var(--accent) 22%,transparent);
          display:flex; align-items:center; justify-content:center; color:var(--accent);
        }
        .hiw-headline { font-size:18px; font-weight:800; color:var(--header-primary); margin:12px 0 4px; }
        .hiw-sub { font-size:13px; color:var(--text-muted); line-height:1.5; }
        .hiw-close {
          background:rgba(255,255,255,0.06); border:none; color:var(--text-muted);
          width:28px; height:28px; border-radius:7px; cursor:pointer; font-size:14px;
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
          transition:background 0.15s;
        }
        .hiw-close:hover { background:rgba(255,255,255,0.12); }
        .hiw-steps { padding:24px 28px; display:flex; flex-direction:column; gap:16px; }
        .hiw-step { display:flex; gap:14px; align-items:flex-start; }
        .hiw-step-num {
          width:30px; height:30px; border-radius:50%; flex-shrink:0;
          background:color-mix(in srgb,var(--accent) 16%,transparent);
          border:1.5px solid color-mix(in srgb,var(--accent) 35%,transparent);
          display:flex; align-items:center; justify-content:center;
          font-size:13px; font-weight:800; color:var(--accent);
        }
        .hiw-step-title { font-size:13px; font-weight:700; color:var(--header-primary); margin-bottom:2px; }
        .hiw-step-desc { font-size:12px; color:var(--text-muted); line-height:1.5; }
        .hiw-footer { padding:0 28px 24px; display:flex; gap:10px; }
        .hiw-btn-start {
          flex:1; padding:11px; border-radius:10px; border:none;
          background:var(--accent); color:#fff; font-size:14px; font-weight:700;
          cursor:pointer; transition:opacity 0.15s, transform 0.15s;
        }
        .hiw-btn-start:hover { opacity:0.88; transform:translateY(-1px); }
        .hiw-btn-cancel {
          padding:11px 20px; border-radius:10px;
          border:1.5px solid rgba(255,255,255,0.1);
          background:none; color:var(--text-muted); font-size:14px;
          cursor:pointer; transition:background 0.15s;
        }
        .hiw-btn-cancel:hover { background:rgba(255,255,255,0.06); }
      `}</style>
      <div className="hiw-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="hiw-modal">
          <div className="hiw-header">
            <div>
              <div className="hiw-icon-wrap">{HEART_SVG}</div>
              <div className="hiw-headline">Request Help</div>
              <div className="hiw-sub">A community monitor will privately assist you.</div>
            </div>
            <button className="hiw-close" onClick={onClose}>✕</button>
          </div>

          <div className="hiw-steps">
            <div className="hiw-step">
              <div className="hiw-step-num">1</div>
              <div>
                <div className="hiw-step-title">Describe the issue</div>
                <div className="hiw-step-desc">Write a short description of what happened and attach a screenshot as evidence.</div>
              </div>
            </div>
            <div className="hiw-step">
              <div className="hiw-step-num">2</div>
              <div>
                <div className="hiw-step-title">A monitor gets assigned</div>
                <div className="hiw-step-desc">Your report is sent to an available monitor. Admin never receives reports directly.</div>
              </div>
            </div>
            <div className="hiw-step">
              <div className="hiw-step-num">3</div>
              <div>
                <div className="hiw-step-title">You get notified</div>
                <div className="hiw-step-desc">When the monitor is ready, a notification pops up on your screen. Click "Chat Now" to open a private 1-on-1 conversation.</div>
              </div>
            </div>
          </div>

          <div className="hiw-footer">
            <button className="hiw-btn-cancel" onClick={onClose}>Cancel</button>
            <button className="hiw-btn-start" onClick={onNext}>Continue to Report →</button>
          </div>
        </div>
      </div>
    </>
  )
}

export default function HelpButton() {
  const { currentUser } = useAuth()
  const { isMonitor, isGlobalAdmin } = useMonitor()
  const [step, setStep] = useState(null) // null | 'howto' | 'form'
  const [suspendedUntil, setSuspendedUntil] = useState(null)

  useEffect(() => {
    if (!currentUser?.uid) return
    const unsub = onSnapshot(
      doc(db, 'users', currentUser.uid),
      snap => setSuspendedUntil(snap.data()?.suspendedUntil ?? null),
      () => {}
    )
    return unsub
  }, [currentUser?.uid])

  if (isMonitor && !isGlobalAdmin) return null

  const isSuspended = suspendedUntil && suspendedUntil.toDate?.() > new Date()

  return (
    <>
      {isSuspended && (
        <div style={{
          position: 'fixed', bottom: 80, right: 24, zIndex: 8001,
          background: 'var(--danger)', color: '#fff',
          borderRadius: 10, padding: '8px 14px',
          fontSize: 12, fontWeight: 700, maxWidth: 220,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          🚫 Suspended until {suspendedUntil.toDate().toLocaleDateString()}
        </div>
      )}
      <button
        className="help-btn"
        onClick={() => setStep('howto')}
        title="Request help from a monitor"
      >
        {HEART_SVG}
      </button>

      {step === 'howto' && (
        <HowItWorksModal
          onNext={() => setStep('form')}
          onClose={() => setStep(null)}
        />
      )}
      {step === 'form' && (
        <ReportForm onClose={() => setStep(null)} />
      )}
    </>
  )
}
