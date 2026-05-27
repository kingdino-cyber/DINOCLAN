import { createContext, useContext, useState } from 'react'
import UserProfileModal from '../components/Modals/UserProfileModal'

const ProfileContext = createContext(null)

export function ProfileProvider({ children }) {
  const [profileUid, setProfileUid] = useState(null)

  return (
    <ProfileContext.Provider value={{ openProfile: setProfileUid }}>
      {children}
      {profileUid && (
        <UserProfileModal uid={profileUid} onClose={() => setProfileUid(null)} />
      )}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  return useContext(ProfileContext)
}
