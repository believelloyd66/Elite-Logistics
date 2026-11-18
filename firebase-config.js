
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyA1aC4qP3FMdV-tLgr0JejuP2LuZ2MEn44",
    authDomain: "elite-logistics-89f69.firebaseapp.com",
    projectId: "elite-logistics-89f69",
    storageBucket: "elite-logistics-89f69.firebasestorage.app",
    messagingSenderId: "828187286893",
    appId: "1:828187286893:web:6ba9ff48dd05630e598e64"
};

// Administrator Firebase app
const app = initializeApp(firebaseConfig);

// Separate customer Firebase app
const customerApp = initializeApp(
    firebaseConfig,
    "customer-support"
);

// Administrator database and authentication
export const db = getFirestore(app);
export const auth = getAuth(app);

// Customer database and authentication
export const customerDb = getFirestore(customerApp);
export const customerAuth = getAuth(customerApp);
