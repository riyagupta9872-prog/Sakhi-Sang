import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Switched to the original Sakhi-Sang-Attendence Firebase project so the React
// app shares the same database as the original deployment (devotees, sessions,
// calling status, users — everything).  Old 'sakhi-sang' project config archived
// in git history for reference.
const firebaseConfig = {
  apiKey: "AIzaSyCxxLIiOy0bGus2NkkSod7_LBVHah5-sz0",
  authDomain: "sakhi-sang-attendence-tracker.firebaseapp.com",
  projectId: "sakhi-sang-attendence-tracker",
  storageBucket: "sakhi-sang-attendence-tracker.firebasestorage.app",
  messagingSenderId: "975645795932",
  appId: "1:975645795932:web:10123086717198940b2899"
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
