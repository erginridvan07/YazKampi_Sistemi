// Yerel geliştirme için Firebase Console değerlerinizi buraya girin.
// Bu dosya .gitignore'da — GitHub'a yüklenmez.

// Firebase SDK modüllerini import ediyoruz
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

const firebaseConfig = {
  // Firebase ayarların buraya
  apiKey: window.env?.FIREBASE_API_KEY || "AIzaSyCAg1njBUDR9VB1WJrwTw_LUFO5CHL_K0A",
  authDomain: window.env?.FIREBASE_AUTH_DOMAIN || "yazkampi-sistem.firebaseapp.com",
  projectId: window.env?.FIREBASE_PROJECT_ID || "yazkampi-sistem",
  storageBucket: window.env?.FIREBASE_STORAGE_BUCKET || "yazkampi-sistem.firebasestorage.app",
  messagingSenderId: window.env?.FIREBASE_MESSAGING_SENDER_ID || "378376934951",
  appId: window.env?.FIREBASE_APP_ID || "1:378376934951:web:05d55f0b5be96473f86002"
};

const app = initializeApp(firebaseConfig);


// Şifreleri GitHub Actions ortamından veya yerel ayarlardan dinamik olarak çekiyoruz
const firebaseConfig = {
  apiKey: window.env?.FIREBASE_API_KEY || "AIzaSyCAg1njBUDR9VB1WJrwTw_LUFO5CHL_K0A",
  authDomain: window.env?.FIREBASE_AUTH_DOMAIN || "yazkampi-sistem.firebaseapp.com",
  projectId: window.env?.FIREBASE_PROJECT_ID || "yazkampi-sistem",
  storageBucket: window.env?.FIREBASE_STORAGE_BUCKET || "yazkampi-sistem.firebasestorage.app",
  messagingSenderId: window.env?.FIREBASE_MESSAGING_SENDER_ID || "378376934951",
  appId: window.env?.FIREBASE_APP_ID || "1:378376934951:web:05d55f0b5be96473f86002"
};

// Firebase'i başlat
const app = initializeApp(firebaseConfig);

// Uygulama içinde kullanmak üzere export et
export const auth = getAuth(app);
export const db = getFirestore(app);
