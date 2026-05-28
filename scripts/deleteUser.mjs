/**
 * DINOCLAN — Admin user deletion script
 *
 * Completely erases a user from Firebase Auth + Firestore.
 * Use this to free up an email address so it can be re-registered.
 *
 * HOW TO RUN:
 *   1. Go to https://console.firebase.google.com/project/cloning-clone/settings/serviceaccounts/adminsdk
 *   2. Click "Generate new private key" → save the JSON file
 *   3. Set the path below (SERVICE_ACCOUNT_PATH) to that file
 *   4. Set TARGET_EMAIL to the email you want to delete
 *   5. Run:  node scripts/deleteUser.mjs
 */

import { readFileSync } from 'fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

// ─── CONFIG ────────────────────────────────────────────────────────────────
const SERVICE_ACCOUNT_PATH = './serviceAccountKey.json'  // <-- change if needed
const TARGET_EMAIL         = 'felix.small@icloud.com'
// ────────────────────────────────────────────────────────────────────────────

let serviceAccount
try {
  serviceAccount = JSON.parse(readFileSync(new URL(SERVICE_ACCOUNT_PATH, import.meta.url)))
} catch {
  console.error('\n❌  Could not read service account key.')
  console.error('    Download it from Firebase Console → Project Settings → Service Accounts')
  console.error(`    and save it as:  scripts/serviceAccountKey.json\n`)
  process.exit(1)
}

const admin = require('firebase-admin')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'cloning-clone',
})

const auth = admin.auth()
const db   = admin.firestore()

// ── Helpers ──────────────────────────────────────────────────────────────────

async function deleteCollection(colRef, batchSize = 100) {
  const snap = await colRef.limit(batchSize).get()
  if (snap.empty) return
  const batch = db.batch()
  snap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
  if (snap.size === batchSize) await deleteCollection(colRef, batchSize) // more docs remain
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n🦕  DINOCLAN — deleting user: ${TARGET_EMAIL}\n`)

  // 1. Find the user in Firebase Auth
  let userRecord
  try {
    userRecord = await auth.getUserByEmail(TARGET_EMAIL)
    console.log(`✅  Found Auth account — UID: ${userRecord.uid}`)
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log(`ℹ️   No Firebase Auth account found for ${TARGET_EMAIL}`)
      console.log('    (It may have already been deleted — continuing Firestore cleanup)\n')
      // Try to find UID in Firestore anyway
      const snap = await db.collection('users').where('email', '==', TARGET_EMAIL).limit(1).get()
      if (snap.empty) {
        console.log('ℹ️   No Firestore user found either. Nothing to delete.')
        process.exit(0)
      }
      userRecord = { uid: snap.docs[0].id }
      console.log(`✅  Found Firestore doc — UID: ${userRecord.uid}`)
    } else throw err
  }

  const uid = userRecord.uid

  // 2. Delete Firebase Auth account (frees the email for re-registration)
  try {
    await auth.deleteUser(uid)
    console.log(`✅  Firebase Auth account deleted — ${TARGET_EMAIL} is now free to register again`)
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log('ℹ️   Auth account already gone — skipping')
    } else throw err
  }

  // 3. Delete Firestore user profile + notifications subcollection
  const userRef = db.doc(`users/${uid}`)
  await deleteCollection(userRef.collection('notifications'))
  await userRef.delete()
  console.log(`✅  Deleted users/${uid} (profile + notifications)`)

  // 4. Remove Felix from every other user's friends array
  const usersWithFelixSnap = await db.collection('users')
    .where('friends', 'array-contains', uid)
    .get()
  if (!usersWithFelixSnap.empty) {
    const batch = db.batch()
    usersWithFelixSnap.docs.forEach(d => {
      batch.update(d.ref, {
        friends: admin.firestore.FieldValue.arrayRemove(uid),
      })
    })
    await batch.commit()
    console.log(`✅  Removed from ${usersWithFelixSnap.size} users' friends list`)
  } else {
    console.log('ℹ️   Not in any friends lists — skipping')
  }

  // 5. Delete all friend requests involving Felix
  const [sentSnap, receivedSnap] = await Promise.all([
    db.collection('friendRequests').where('fromUid', '==', uid).get(),
    db.collection('friendRequests').where('toUid',   '==', uid).get(),
  ])
  const allRequests = [...sentSnap.docs, ...receivedSnap.docs]
  if (allRequests.length > 0) {
    const batch = db.batch()
    allRequests.forEach(d => batch.delete(d.ref))
    await batch.commit()
    console.log(`✅  Deleted ${allRequests.length} friend request(s)`)
  } else {
    console.log('ℹ️   No friend requests — skipping')
  }

  // 6. Delete all DM conversations involving Felix
  //    DM IDs are formatted as "[uid1]_[uid2]" (sorted), so we list all dms
  //    and filter for ones that include Felix's UID segment.
  const dmsSnap = await db.collection('dms').get()
  const felixDms = dmsSnap.docs.filter(d => d.id.split('_').includes(uid))
  if (felixDms.length > 0) {
    for (const dmDoc of felixDms) {
      await deleteCollection(dmDoc.ref.collection('messages'))
      await dmDoc.ref.delete()
    }
    console.log(`✅  Deleted ${felixDms.length} DM conversation(s) and their messages`)
  } else {
    console.log('ℹ️   No DM conversations — skipping')
  }

  // 7. Delete server invites sent by or to Felix
  try {
    const [invSentSnap, invRecSnap] = await Promise.all([
      db.collection('serverInvites').where('fromUid', '==', uid).get(),
      db.collection('serverInvites').where('toUid',   '==', uid).get(),
    ])
    const allInvites = [...invSentSnap.docs, ...invRecSnap.docs]
    if (allInvites.length > 0) {
      const batch = db.batch()
      allInvites.forEach(d => batch.delete(d.ref))
      await batch.commit()
      console.log(`✅  Deleted ${allInvites.length} server invite(s)`)
    }
  } catch {
    // serverInvites collection may not exist — safe to ignore
  }

  console.log(`\n🎉  Done! Felix (${TARGET_EMAIL}) has been fully erased.`)
  console.log(`    The email is now free — anyone can register with it again.\n`)
  process.exit(0)
}

run().catch(err => {
  console.error('\n❌  Script failed:', err.message)
  process.exit(1)
})
