import React, { useEffect, useRef } from 'react';

export default function Modal({ id, open, onClose, title, children, size = 'md', noPad = false }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape' && open) onClose?.(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose?.(); }}
    >
      <div className={`modal-box modal-${size}`}>
        {title && (
          <div className="modal-header">
            <h3 className="modal-title">{title}</h3>
            <button className="modal-close btn-icon" onClick={onClose} aria-label="Close">✕</button>
          </div>
        )}
        <div className={noPad ? '' : 'modal-body'}>
          {children}
        </div>
      </div>
    </div>
  );
}
