import { useAuth } from '../../contexts/AuthContext'
import Avatar from '../Chat/Avatar'

export default function UserPanel() {
  const { currentUser, logout } = useAuth()

  const user = {
    uid: currentUser?.uid,
    displayName: currentUser?.displayName || currentUser?.email,
    photoURL: currentUser?.photoURL,
    status: 'online',
  }

  return (
    <div className="user-panel">
      <Avatar user={user} size={32} showStatus />
      <div className="user-info">
        <div className="name">{user.displayName}</div>
        <div className="tag">Online</div>
      </div>
      <button
        className="panel-btn"
        onClick={logout}
        title="Log out"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
        </svg>
      </button>
    </div>
  )
}
