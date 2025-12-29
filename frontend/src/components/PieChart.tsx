/**
 * Pie Chart Component
 * Simple SVG-based pie chart
 */

import React from 'react';

export interface PieChartData {
  label: string;
  value: number;
  color?: string;
}

interface PieChartProps {
  data: PieChartData[];
  size?: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function PieChart({ data, size = 120 }: PieChartProps) {
  if (!data || data.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--muted)' }}>Không có dữ liệu</div>;
  }

  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
  if (total === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--muted)' }}>Không có dữ liệu</div>;
  }

  const center = size / 2;
  const radius = size / 2 - 10;
  let currentAngle = -90; // Start from top

  const paths = data.map((item, index) => {
    const value = item.value || 0;
    const percentage = (value / total) * 100;
    const angle = (value / total) * 360;

    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startAngleRad);
    const y1 = center + radius * Math.sin(startAngleRad);
    const x2 = center + radius * Math.cos(endAngleRad);
    const y2 = center + radius * Math.sin(endAngleRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    const pathData = [
      `M ${center} ${center}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z',
    ].join(' ');

    const color = item.color || COLORS[index % COLORS.length];

    return (
      <path
        key={index}
        d={pathData}
        fill={color}
        stroke="var(--surface)"
        strokeWidth="2"
        style={{ transition: 'opacity 0.2s' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.8';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
      />
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-3)' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {paths}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)', fontSize: 'var(--font-size-xs)' }}>
        {data.map((item, index) => {
          const value = item.value || 0;
          const percentage = ((value / total) * 100).toFixed(1);
          const color = item.color || COLORS[index % COLORS.length];
          return (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: color }} />
              <span>
                {item.label}: {percentage}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

