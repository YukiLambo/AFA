import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyArZZDniGw4tromow4bVLj2efh8NJWYieE",
  authDomain: "afaapp-3cba6.firebaseapp.com",
  projectId: "afaapp-3cba6",
  storageBucket: "afaapp-3cba6.firebasestorage.app",
  messagingSenderId: "507543217731",
  appId: "1:507543217731:web:e4050797a3903bbb9f56f6",
  measurementId: "G-Y1MCZW9FZZ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);