const ADMIN_EMAIL = 'bohlehsaurus7@gmail.com'

// ── Rank order maps (higher = more authority) ─────────────────────────────────
const GLOBAL_RANK_ORDER = { user: 0, operator: 1, moderator: 2, admin: 3 }
const SERVER_RANK_ORDER = { member: 0, operator: 1, moderator: 2, host: 3 }

// Tag display info for UI rendering
export const GLOBAL_RANK_TAGS = {
  admin:     { label: 'ADMIN', color: '#faa61a', bg: 'rgba(250,166,26,0.18)' },
  moderator: { label: 'MOD',   color: '#ed4245', bg: 'rgba(237,66,69,0.18)'  },
  operator:  { label: 'OP',    color: '#5865f2', bg: 'rgba(88,101,242,0.18)' },
}

export const SERVER_RANK_TAGS = {
  host:      { label: 'HOST',  color: '#faa61a', bg: 'rgba(250,166,26,0.18)' },
  moderator: { label: 'MOD',   color: '#ed4245', bg: 'rgba(237,66,69,0.18)'  },
  operator:  { label: 'OP',    color: '#5865f2', bg: 'rgba(88,101,242,0.18)' },
}

// ── Existing helpers (unchanged behaviour) ────────────────────────────────────
export function isOperator(currentUser) {
  return currentUser?.email === ADMIN_EMAIL
}

export function isAdmin(currentUser, server) {
  return isOperator(currentUser) || server?.ownerId === currentUser?.uid
}

// ── Server rank ───────────────────────────────────────────────────────────────
/** Returns 'host' | 'moderator' | 'operator' | 'member' for a uid in a server */
export function getServerRank(server, uid) {
  if (!server || !uid) return 'member'
  if (server.ownerId === uid) return 'host'
  return server.memberRanks?.[uid] || 'member'
}

// ── Global rank ───────────────────────────────────────────────────────────────
/**
 * Returns 'admin' | 'moderator' | 'operator' | 'user' from a Firestore user doc.
 * bohlehsaurus7@gmail.com is always 'admin' regardless of stored value.
 */
export function getGlobalRank(userData) {
  if (!userData) return 'user'
  if (userData.email === ADMIN_EMAIL) return 'admin'
  return userData.globalRank || 'user'
}

// ── Numeric level helpers ─────────────────────────────────────────────────────
export function serverRankLevel(rank) { return SERVER_RANK_ORDER[rank] ?? 0 }
export function globalRankLevel(rank) { return GLOBAL_RANK_ORDER[rank] ?? 0 }

/**
 * Returns true if the "manager" user can manage the "target" user.
 * Manager must have strictly higher combined authority (server + global) than target.
 */
export function canManage(myServerRank, myGlobalRank, theirServerRank, theirGlobalRank) {
  const myLevel    = Math.max(serverRankLevel(myServerRank),    globalRankLevel(myGlobalRank))
  const theirLevel = Math.max(serverRankLevel(theirServerRank), globalRankLevel(theirGlobalRank))
  return myLevel > theirLevel
}

// ── Swear jar ─────────────────────────────────────────────────────────────────
export const SWEAR_WORDS = [
  'fuck', 'fucking', 'fucked', 'fucker', 'fucks', 'motherfucker',
  'shit', 'shitting', 'shitty', 'bullshit', 'shits',
  'ass', 'asshole', 'asses', 'arse', 'arsehole',
  'bitch', 'bitching', 'bitchy', 'bitches',
  'cunt', 'cunts',
  'damn', 'damned', 'damnit',
  'bastard', 'bastards',
  'piss', 'pissed', 'pissing',
  'cock', 'cocks',
  'dick', 'dicks',
  'pussy', 'pussies',
  'crap', 'crappy',
  'wanker', 'wankers', 'wank',
  'twat', 'twats',
  'bollocks',
]

/** Counts how many swear words appear in a string (whole-word matches, case-insensitive) */
export function countSwears(text) {
  if (!text) return 0
  const lower = text.toLowerCase()
  let count = 0
  for (const word of SWEAR_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'g')
    const matches = lower.match(regex)
    if (matches) count += matches.length
  }
  return count
}
