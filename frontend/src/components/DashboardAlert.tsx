/**
 * Dashboard Alert Component
 * Reusable alert widget for dashboard
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';

interface DashboardAlertProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  headerBg: string;
  borderColor: string;
  badgeBg: string;
  badgeColor: string;
  items: Array<{
    id: string;
    name: string;
    teachers?: Array<{
      id: string;
      fullName: string;
    }>;
    onClick?: () => void;
  }>;
  emptyMessage?: string;
}

export function DashboardAlert({
  title,
  count,
  icon,
  iconColor,
  iconBg,
  headerBg,
  borderColor,
  badgeBg,
  badgeColor,
  items,
  emptyMessage = 'Không có mục nào',
}: DashboardAlertProps) {
  const navigate = useNavigate();

  const handleItemClick = (item: { id: string; onClick?: () => void }) => {
    if (item.onClick) {
      item.onClick();
    } else {
      navigate(`/classes/${item.id}`);
    }
  };

  return (
    <div
      className="alert-widget"
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        minWidth: 0,
      }}
    >
      <div
        className="alert-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: 'var(--spacing-2) var(--spacing-3)',
          background: headerBg,
          borderBottom: `2px solid ${borderColor}`,
          gap: 'var(--spacing-2)',
          minHeight: '48px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius)',
            background: iconBg,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: '600', fontSize: '12px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </span>
          <span
            className="badge badge-danger"
            style={{
              fontSize: '9px',
              padding: '1px 5px',
              borderRadius: 'var(--radius-full)',
              width: 'fit-content',
              background: badgeBg,
              color: badgeColor,
            }}
          >
            {count} mục
          </span>
        </div>
      </div>
      <div className="alert-body" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', minHeight: 0, maxHeight: '200px' }}>
        <ul className="alert-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items && items.length > 0 ? (
            items.map((item) => (
              <li
                key={item.id}
                style={{
                  padding: 'var(--spacing-2)',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-secondary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '';
                }}
              >
                <button
                  className="alert-link"
                  onClick={() => handleItemClick(item)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    fontWeight: '500',
                    textAlign: 'left',
                    padding: 0,
                    margin: 0,
                    fontSize: '12px',
                    lineHeight: '1.4',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <span style={{ fontWeight: '600' }}>{item.name}</span>
                  {item.teachers && item.teachers.length > 0 && (
                    <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: '400' }}>
                      {item.teachers.length === 1
                        ? item.teachers[0].fullName
                        : `${item.teachers[0].fullName} +${item.teachers.length - 1}`}
                    </span>
                  )}
                </button>
              </li>
            ))
          ) : (
            <li className="text-muted" style={{ padding: 'var(--spacing-2)', textAlign: 'center', fontSize: '12px' }}>
              {emptyMessage}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

