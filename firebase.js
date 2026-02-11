import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 這是你剛剛提供的設定檔
const firebaseConfig = {
  apiKey: "AIzaSyDireIv0wWjFr6UuQBkqkJABNzKMRxUHgA",
  authDomain: "cleaning-3f3f0.firebaseapp.com",
  projectId: "cleaning-3f3f0",
  storageBucket: "cleaning-3f3f0.firebasestorage.app",
  messagingSenderId: "473145281115",
  appId: "1:473145281115:web:88696bc6657c1fa051cd7e",
  measurementId: "G-FN74X5YY0P"
};

// 1. 初始化 Firebase 應用程式
const app = initializeApp(firebaseConfig);

// 2. 匯出資料庫實例，讓 App.js 可以使用
export const db = getFirestore(app);
