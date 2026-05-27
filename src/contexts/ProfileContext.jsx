import { createContext, useContext, useState } from 'react'

const ProfileContext = createContext(null)

export function ProfileProvider({ children }) {
  const [uid, setUid] = useState(null)
  return (
    <ProfileContext.Provider value={{ openProfile: setUid, closeProfile: () => setUid(null), profileUid: uid }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  return useContext(ProfileContext)
}
