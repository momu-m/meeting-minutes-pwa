import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  projectId: "asetronics-meeting-ai",
  appId: "1:1040278404317:web:3011954008d18d34bb6f34",
  storageBucket: "asetronics-meeting-ai.firebasestorage.app",
  apiKey: "AIzaSyABqlc-2wv2sOM4VU02yQHKDnmroJiqK4c",
  authDomain: "asetronics-meeting-ai.firebaseapp.com",
  messagingSenderId: "1040278404317"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth, collection, addDoc, getDocs, doc, setDoc, deleteDoc, query, orderBy, onSnapshot, serverTimestamp, signInAnonymously, onAuthStateChanged };
