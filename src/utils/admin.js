const OPERATOR_EMAIL = 'bohlehsaurus7@gmail.com'
const OPERATOR_NAME  = 'KingDino'

export function isOperator(currentUser) {
  return (
    currentUser?.email === OPERATOR_EMAIL ||
    currentUser?.displayName === OPERATOR_NAME
  )
}

export function isAdmin(currentUser, server) {
  return isOperator(currentUser) || server?.ownerId === currentUser?.uid
}
