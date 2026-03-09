/**
 * AttendanceIcon Component
 * Displays attendance status icon with smooth transitions
 */

import React from 'react';
import { AttendanceStatus } from '../services/attendanceService';

interface AttendanceIconProps {
  status: AttendanceStatus;
  onClick?: () => void;
  size?: number;
  className?: string;
}

const AttendanceIcon: React.FC<AttendanceIconProps> = ({ 
  status, 
  onClick, 
  size = 20,
  className = '' 
}) => {
  const getIconColor = () => {
    switch (status) {
      case 'present':
        return '#10b981'; // Green
      case 'excused':
        return '#f59e0b'; // Yellow/Amber
      case 'absent':
        return '#dc2626'; // Red
      default:
        return '#6b7280'; // Gray
    }
  };

  const getIcon = () => {
    const color = getIconColor();
    const iconStyle: React.CSSProperties = {
      color,
      transition: 'all 0.2s ease',
    };

    switch (status) {
      case 'present':
        return (
          <svg 
            width={size} 
            height={size} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            style={iconStyle}
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        );
      case 'excused':
        return (
          <svg 
            width={size} 
            height={size} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            style={{ ...iconStyle, fill: '#f59e0b', opacity: 0.2 }}
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        );
      case 'absent':
        return (
          <svg 
            width={size} 
            height={size} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            style={iconStyle}
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (status) {
      case 'present':
        return 'Có mặt';
      case 'excused':
        return 'Nghỉ có phép';
      case 'absent':
        return 'Vắng mặt';
      default:
        return 'Chưa xác định';
    }
  };

  const buttonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: onClick ? 'pointer' : 'default',
    padding: 'var(--spacing-1)',
    borderRadius: 'var(--radius)',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: `${size + 12}px`,
    height: `${size + 12}px`,
  };

  const content = (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.2s ease',
      }}
      className={onClick ? 'attendance-icon-interactive' : ''}
    >
      {getIcon()}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={`attendance-icon-btn attendance-status-${status} ${className}`}
        onClick={onClick}
        title={getTitle()}
        style={buttonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-hover)';
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'none';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <div 
      className={`attendance-icon attendance-status-${status} ${className}`}
      title={getTitle()}
      style={buttonStyle}
    >
      {content}
    </div>
  );
};

export default AttendanceIcon;

