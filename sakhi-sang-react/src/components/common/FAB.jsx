import React from 'react';

export default function FAB({ icon = '+', label, onClick, color = 'brand' }) {
  return (
    <button className={`fab fab-${color}`} onClick={onClick} aria-label={label} title={label}>
      <span className="fab-icon">{icon}</span>
      {label && <span className="fab-label">{label}</span>}
    </button>
  );
}
