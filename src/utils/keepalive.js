// Writes that can still go out while a tab is closing. The normal Firestore SDK cancels its writes on
// unload, so these use fetch({ keepalive }) against the Firestore REST API with the user's ID token.
import { auth } from '../firebase'

let token = null
auth.onIdTokenChanged(async u => { token = u ? await u.getIdToken() : null })

const PID = auth.app.options.projectId
const DB = `projects/${PID}/databases/(default)`
const BASE = `https://firestore.googleapis.com/v1/${DB}/documents`

function send(url, method, body) {
  if (!token) return
  try {
    fetch(url, {
      method,
      keepalive: true,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {})
  } catch (_) {}
}

export function keepaliveSetOffline(uid) {
  send(`${BASE}/users/${uid}?updateMask.fieldPaths=status`, 'PATCH', { fields: { status: { stringValue: 'offline' } } })
}

// Remove one participant ({ uid, name }) from a server/group voice call
export function keepaliveLeaveServerCall(callId, participant) {
  send(`${BASE}:commit`, 'POST', {
    writes: [{
      transform: {
        document: `${DB}/documents/calls/${callId}`,
        fieldTransforms: [{
          fieldPath: 'participants',
          removeAllFromArray: { values: [{ mapValue: { fields: {
            uid: { stringValue: participant.uid },
            name: { stringValue: participant.name || '' },
          } } }] },
        }],
      },
    }],
  })
}

// End a 1-to-1 call
export function keepaliveEndCall(callId) {
  send(`${BASE}/calls/${callId}?updateMask.fieldPaths=status`, 'PATCH', { fields: { status: { stringValue: 'ended' } } })
}
