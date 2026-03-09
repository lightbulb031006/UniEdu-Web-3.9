/**
 * Modal Component
 * Replicates old app's modal functionality
 * Migrated from backup/assets/js/ui.js openModal/closeModal
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  zIndex?: number;
  headerExtra?: React.ReactNode; // Extra content to display in header (e.g., tuition fee)
  closeOnBackdropClick?: boolean; // Whether to close modal when clicking on backdrop (default: false - không đóng khi bấm ra ngoài)
}

export default function Modal({ title, isOpen, onClose, children, size = 'md', zIndex, headerExtra, closeOnBackdropClick = false }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-5xl',
  };

  const backdropZIndex = zIndex || 1000;
  const modalZIndex = backdropZIndex + 1;

  return createPortal(
    <div 
      className="modal-backdrop" 
      onClick={closeOnBackdropClick ? onClose : undefined} 
      style={{ 
        display: 'flex !important', 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: backdropZIndex 
      }}
    >
      <div
        className={`modal ${sizeClasses[size]}`}
        onClick={(e) => e.stopPropagation()}
        style={{ zIndex: modalZIndex }}
      >
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, flex: 1, minWidth: 0 }}>{title}</h3>
            {headerExtra && (
              <div style={{ flexShrink: 0 }}>
                {headerExtra}
              </div>
            )}
          </div>
          <button
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label="Đóng"
            style={{ padding: 'var(--spacing-2)', flexShrink: 0 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

