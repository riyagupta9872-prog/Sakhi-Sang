import React from 'react';
import { useAuth } from '../../context/AuthContext';

export default function PendingApproval() {
  const { logout, currentUser } = useAuth();

  return (
    <div className="auth-screen">
      <div className="auth-card pending-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">⏳</div>
          <h1 className="auth-title">Access Pending</h1>
        </div>
        <div className="pending-body">
          <p>Your account request for <strong>{currentUser?.email}</strong> is awaiting approval from a Super Admin.</p>
          <p className="pending-hint">You will be notified once your account is approved. Please check back later.</p>
          <button className="btn-outline btn-full mt-4" onClick={logout}>Sign Out</button>
        </div>
      </div>
    </div>
  );
}
