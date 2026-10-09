// Presence = the status a user chose/was given + a "lastSeen" heartbeat written while their app is open.
// If the heartbeat stops (tab closed, crash, no internet) they count as offline, whatever their stored status says.

export const HEARTBEAT_MS = 45 * 1000
export const STALE_MS = 120 * 1000

// true when we have no recent sign of life from this user
export function isStale(user) {
  const ls = user?.lastSeen
  if (ls === null) return false        // our own just-written serverTimestamp, not confirmed yet
  if (ls === undefined) return true    // never sent a heartbeat (old client / stuck record)
  const ms = typeof ls.toMillis === 'function' ? ls.toMillis() : Number(ls)
  return !Number.isFinite(ms) || Date.now() - ms > STALE_MS
}

// The status to actually show: online / idle / dnd / offline
export function effectiveStatus(user) {
  const s = user?.status || 'offline'
  if (s === 'offline') return 'offline'
  return isStale(user) ? 'offline' : s
}
