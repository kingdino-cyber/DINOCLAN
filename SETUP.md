# Chord — Setup Guide

## 1. Install Node.js
Download from https://nodejs.org (LTS version). Restart your terminal after.

## 2. Install dependencies
```
cd "C:\Bohleh experimenting\discord-clone"
npm install
```

## 3. Set up Firebase

1. Go to https://console.firebase.google.com
2. Click **Add project** → give it a name → Continue
3. On the project dashboard, click **< / >** (Web app) → Register app
4. Copy the `firebaseConfig` object shown

5. Open `src/firebase.js` and replace the placeholder values with your config

6. In the Firebase console, enable these services:
   - **Authentication** → Sign-in method → **Email/Password** → Enable
   - **Firestore Database** → Create database → Start in **test mode**

7. (Optional) Deploy security rules:
   - Install Firebase CLI: `npm install -g firebase-tools`
   - `firebase login`
   - `firebase init firestore` (select your project)
   - Copy `firestore.rules` content to the rules editor in the console

## 4. Run the app
```
npm run dev
```
Open http://localhost:5173

## 5. Share with friends
For others to join your server, share the **Server ID** (visible in the browser URL / Firestore console).
They can paste it into **Join a Server** inside the app.

## Features
- Register / Login with email & password
- Create servers (like Discord guilds)
- Create text channels inside servers
- Real-time messaging via Firestore
- Online / offline status
- Member list with live status
- Join servers by invite code (server ID)
