import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { DB } from '../firebase/db';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [authState, setAuthState] = useState('loading');
  const pendingUnsub = useRef(null); // ref — never stale in closures

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      // Cancel any active pending-approval listener
      if (pendingUnsub.current) {
        pendingUnsub.current();
        pendingUnsub.current = null;
      }

      if (!user) {
        setCurrentUser(null);
        setUserDoc(null);
        setAuthState('auth');
        return;
      }

      setCurrentUser(user);

      try {
        // Check for existing user doc first
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) {
          setUserDoc({ id: user.uid, ...userSnap.data() });
          setAuthState('approved');
          return;
        }

        // No user doc — if no superAdmin exists yet, this person becomes superAdmin
        const adminExists = await DB.hasSuperAdmin();
        if (!adminExists) {
          await DB.createFirstUser(user.uid, user.displayName || user.email.split('@')[0]);
          const snap = await getDoc(doc(db, 'users', user.uid));
          setUserDoc({ id: user.uid, ...snap.data() });
          setAuthState('approved');
          return;
        }

        // Check signup request status
        const reqSnap = await getDoc(doc(db, 'signupRequests', user.uid));
        if (reqSnap.exists()) {
          const status = reqSnap.data().status;
          if (status === 'rejected') {
            await signOut(auth);
            setAuthState('auth');
            return;
          }
          // Pending — subscribe for approval
          setAuthState('pending');
          pendingUnsub.current = onSnapshot(doc(db, 'signupRequests', user.uid), async (s) => {
            if (!s.exists()) return;
            if (s.data().status === 'approved') {
              const u2 = await getDoc(doc(db, 'users', user.uid));
              if (u2.exists()) {
                setUserDoc({ id: user.uid, ...u2.data() });
                setAuthState('approved');
              }
            } else if (s.data().status === 'rejected') {
              await signOut(auth);
              setAuthState('auth');
            }
          });
          return;
        }

        // No user doc and no request — create signup request
        await DB.createSignupRequest(user.uid, user.displayName || user.email.split('@')[0], user.email);
        setAuthState('pending');

        // Subscribe to this new request
        pendingUnsub.current = onSnapshot(doc(db, 'signupRequests', user.uid), async (s) => {
          if (!s.exists()) return;
          if (s.data().status === 'approved') {
            const u2 = await getDoc(doc(db, 'users', user.uid));
            if (u2.exists()) {
              setUserDoc({ id: user.uid, ...u2.data() });
              setAuthState('approved');
            }
          } else if (s.data().status === 'rejected') {
            await signOut(auth);
            setAuthState('auth');
          }
        });
      } catch (err) {
        console.error('Auth init error:', err);
        setAuthState('auth');
      }
    });

    return () => {
      unsub();
      if (pendingUnsub.current) pendingUnsub.current();
    };
  }, []);

  async function signup(email, password, displayName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    return cred.user;
  }

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    if (pendingUnsub.current) { pendingUnsub.current(); pendingUnsub.current = null; }
    // Clear session-only flags so next login starts fresh
    sessionStorage.removeItem('attSevaOnly');
    sessionStorage.removeItem('overrideRole');
    sessionStorage.removeItem('birthdayShown');
    await signOut(auth);
  }

  async function changePassword(currentPassword, newPassword) {
    if (newPassword.length < 6) throw new Error('Password must be at least 6 characters');
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, newPassword);
  }

  async function refreshUserDoc() {
    if (!currentUser) return;
    const snap = await getDoc(doc(db, 'users', currentUser.uid));
    if (snap.exists()) setUserDoc({ id: currentUser.uid, ...snap.data() });
  }

  // ── Service-devotee override (superAdmin can temporarily view as serviceDevotee) ──
  const [overrideRole, setOverrideRoleState] = useState(() => {
    return typeof window !== 'undefined' ? sessionStorage.getItem('overrideRole') || '' : '';
  });
  function setOverrideRole(role) {
    if (role) sessionStorage.setItem('overrideRole', role);
    else sessionStorage.removeItem('overrideRole');
    setOverrideRoleState(role);
  }
  const trueRole = userDoc?.role || '';
  const effectiveRole = (trueRole === 'superAdmin' && overrideRole) ? overrideRole : trueRole;

  const value = {
    currentUser,
    userDoc,
    authState,
    userId: currentUser?.uid,
    userName: userDoc?.displayName || currentUser?.email?.split('@')[0] || '',
    userRole: effectiveRole,
    trueRole,
    overrideRole,
    setOverrideRole,
    userTeam: userDoc?.teamName || userDoc?.team_name || '',
    userPosition: userDoc?.position || '',
    isSuper: effectiveRole === 'superAdmin' || effectiveRole === 'departmentAdmin',
    isDeptAdmin: effectiveRole === 'departmentAdmin',
    isTeamAdmin: effectiveRole === 'teamAdmin' || effectiveRole === 'departmentAdmin' || effectiveRole === 'superAdmin',
    // SuperAdmin and DepartmentAdmin always have live access; others need explicit isAttSevaDev flag
    isAttSevaDev: effectiveRole === 'superAdmin' || effectiveRole === 'departmentAdmin' || !!userDoc?.isAttSevaDev,
    signup,
    login,
    logout,
    changePassword,
    refreshUserDoc,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
