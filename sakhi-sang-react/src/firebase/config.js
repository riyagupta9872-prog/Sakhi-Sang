import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyB8LS1EUZSxpIktwxVVmYd6JZv4gU1Z2ok",
  authDomain: "sakhi-sang.firebaseapp.com",
  projectId: "sakhi-sang",
  storageBucket: "sakhi-sang.firebasestorage.app",
  messagingSenderId: "394737578227",
  appId: "1:394737578227:web:897b0aa7c041b0c5dcc786"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const TS = () => serverTimestamp();
export const INC = (n = 1) => increment(n);

export const TEAMS = [
  'Champaklata','Chitralekha','Indulekha','Lalita',
  'Nilachal','Other','Rangadevi','Sudevi','Tungavidya','Vishakha',
];

export default app;
