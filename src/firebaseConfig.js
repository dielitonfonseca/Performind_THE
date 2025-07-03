// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app"; // Adicione getApps e getApp
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDjTGNuHfGTm8cA50l7m0WCxcrJ2hbrmUU",
  authDomain: "os-data-the.firebaseapp.com",
  projectId: "os-data-the",
  storageBucket: "os-data-the.firebasestorage.app",
  messagingSenderId: "523652131424",
  appId: "1:523652131424:web:e27986b4d0bd78aa363105",
  measurementId: "G-T8YEQBHN28"
};

// Initialize Firebase
// Verifica se já existe uma instância do app Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { db };
  