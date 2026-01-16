// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// 🌟 スクリーンショットにあった config をここに貼り付け
const firebaseConfig = {
  apiKey: 'AIzaSyCNAraTHevKexKTCnHwbfp_0LnPTNvYmKc',
  authDomain: 'vue-monelog.firebaseapp.com',
  projectId: 'vue-monelog',
  storageBucket: 'vue-monelog.firebasestorage.app',
  messagingSenderId: '26827846029',
  appId: '1:26827846029:web:416d3f6dd57557121e4dc4',
};

const app = initializeApp(firebaseConfig);

// 他のファイルで使えるようにエクスポート
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
