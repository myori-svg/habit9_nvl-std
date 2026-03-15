import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBHNRMVjZ1AXz2H2zcMVcYgB_TquA3oQrE",
  authDomain: "nvl-std.firebaseapp.com",
  projectId: "nvl-std",
  storageBucket: "nvl-std.firebasestorage.app",
  messagingSenderId: "425869626329",
  appId: "1:425869626329:web:e0b3f05da646769de967c8",
};

// Prevent duplicate initialization in Next.js dev mode
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);
export const storage = getStorage(app);
