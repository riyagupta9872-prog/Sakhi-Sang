import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase/config';

export default function AuthScreen() {
  const { login, signup } = useAuth();
  const { showToast } = useApp();
  const [mode, setMode] = useState('login'); // login | signup | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ERR = {
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/email-already-in-use': 'Email already registered',
    'auth/weak-password': 'Password must be at least 6 characters',
    'auth/invalid-email': 'Invalid email address',
    'auth/invalid-credential': 'Invalid email or password',
    'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else if (mode === 'signup') {
        if (!displayName.trim()) { setError('Please enter your name'); setLoading(false); return; }
        await signup(email, password, displayName.trim());
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        showToast('Password reset email sent!', 'success');
        setMode('login');
      }
    } catch (err) {
      setError(ERR[err.code] || err.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">🌸</div>
          <h1 className="auth-title">Sakhi Sang</h1>
          <p className="auth-subtitle">Devotee Management System</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <h2 className="auth-form-title">
            {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Request Access' : 'Reset Password'}
          </h2>

          {mode === 'signup' && (
            <div className="form-group">
              <label className="form-label">Your Name</label>
              <input className="form-input" type="text" value={displayName}
                onChange={e => setDisplayName(e.target.value)} placeholder="Full name" required />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
              required autoComplete="email" />
          </div>

          {mode !== 'forgot' && (
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="pw-wrap">
                <input className="form-input" type={showPw ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                <button type="button" className="pw-toggle" onClick={() => setShowPw(s => !s)}>
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button className="btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Request Access' : 'Send Reset Email'}
          </button>
        </form>

        <div className="auth-links">
          {mode === 'login' && <>
            <button className="link-btn" onClick={() => { setMode('forgot'); setError(''); }}>Forgot password?</button>
            <span className="auth-sep">·</span>
            <button className="link-btn" onClick={() => { setMode('signup'); setError(''); }}>New? Request access</button>
          </>}
          {mode === 'signup' && <>
            <span>Already have access?</span>
            <button className="link-btn ml-2" onClick={() => { setMode('login'); setError(''); }}>Sign in</button>
          </>}
          {mode === 'forgot' && <>
            <button className="link-btn" onClick={() => { setMode('login'); setError(''); }}>← Back to Sign In</button>
          </>}
        </div>
      </div>
    </div>
  );
}
