import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD_ElIi04z8kOVErLMKXi2_nNz0jMvRFYk",
  authDomain: "cloning-clone.firebaseapp.com",
  projectId: "cloning-clone",
  storageBucket: "cloning-clone.firebasestorage.app",
  messagingSenderId: "532553986771",
  appId: "1:532553986771:web:9e37e0a200d415e0089a26"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services and export them for your app to use
export const auth = getAuth(app);
export const db = getFirestore(app);