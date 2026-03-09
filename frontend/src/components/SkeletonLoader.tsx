/**
 * Skeleton Loader Component
 * Provides loading placeholders for better UX
 */

import React from 'react';

interface SkeletonLoaderProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function SkeletonLoader({ 
  width = '100%', 
  height = '1rem', 
  borderRadius = 'var(--radius)',
  className = '',
  style = {}
}: SkeletonLoaderProps) {
  return (
    <div
      className={`skeleton-loader ${className}`}
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg) 50%, var(--bg-secondary) 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-loading 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

/**
 * Table Skeleton Loader
 * Shows skeleton rows for table loading state
 */
interface TableSkeletonProps {
  rows?: number;
  columns: number;
  showHeader?: boolean;
}

export function TableSkeleton({ rows = 5, columns, showHeader = true }: TableSkeletonProps) {
  return (
    <div style={{ overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        {showHeader && (
          <thead>
            <tr style={{ background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.03) 100%)' }}>
              {Array.from({ length: columns }).map((_, idx) => (
                <th key={idx} style={{ padding: 'var(--spacing-3)' }}>
                  <SkeletonLoader height="1rem" width="80%" />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx} style={{ borderBottom: '1px solid var(--border)' }}>
              {Array.from({ length: columns }).map((_, colIdx) => (
                <td key={colIdx} style={{ padding: 'var(--spacing-3)' }}>
                  <SkeletonLoader height="1rem" width={colIdx === 0 ? '60%' : '80%'} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Add CSS animation for skeleton loading
const style = document.createElement('style');
style.textContent = `
  @keyframes skeleton-loading {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
`;
if (!document.head.querySelector('style[data-skeleton]')) {
  style.setAttribute('data-skeleton', 'true');
  document.head.appendChild(style);
}

