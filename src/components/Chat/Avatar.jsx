export default function Avatar({ user, size = 32, showStatus = false }) {
  const initials = (user?.displayName || user?.email || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const colors = [
    '#5865f2','#eb459e','#ed4245','#faa61a',
    '#3ba55d','#00b0f4','#9c27b0','#ff5722',
  ]
  const colorIndex = (user?.displayName?.charCodeAt(0) || 0) % colors.length
  const bg = user?.avatarBg || (user?.photoURL ? 'transparent' : colors[colorIndex])

  return (
    <div
      className="avatar"
      style={{ width: size, height: size, fontSize: user?.avatarEmoji ? size * 0.55 : size * 0.4, background: bg, flexShrink: 0 }}
    >
      {user?.photoURL
        ? <img src={user.photoURL} alt={user.displayName} />
        : user?.avatarEmoji
          ? user.avatarEmoji
          : initials
      }
      {showStatus && (
        <span className={`status-dot ${user?.status || 'offline'}`} />
      )}
    </div>
  )
}
