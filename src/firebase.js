import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuration de votre projet Firebase (visible aussi dans la console
// Firebase → Paramètres du projet → Vos applications).
const firebaseConfig = {
  apiKey: "AIzaSyDtWpm6gXx2DdTGbelkmIp8JQeJ9zqu0d8",
  authDomain: "kaeser-pole-expert.firebaseapp.com",
  projectId: "kaeser-pole-expert",
  storageBucket: "kaeser-pole-expert.firebasestorage.app",
  messagingSenderId: "364373944031",
  appId: "1:364373944031:web:8c8f8dc6c2689fc661eb6a",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
