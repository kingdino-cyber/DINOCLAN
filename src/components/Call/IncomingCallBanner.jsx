import { useCall } from '../../contexts/CallContext'

export default function IncomingCallBanner() {
  const { incomingCall, acceptCall, declineCall } = useCall()
  if (!incomingCall) return null

  const { callId, creatorName } = incomingCall

  return (
    <div className="incoming-call-banner">
      <div className="incoming-call-avatar">📞</div>
      <div className="incoming-call-info">
        <div className="incoming-call-name">{creatorName || 'Someone'}</div>
        <div className="incoming-call-sub">Incoming voice call…</div>
      </div>
      <button
        className="call-accept-btn"
        onClick={() => acceptCall(incomingCall)}
        title="Accept"
      >
        ✅
      </button>
      <button
        className="call-decline-btn"
        onClick={() => declineCall(callId)}
        title="Decline"
      >
        ❌
      </button>
    </div>
  )
}
