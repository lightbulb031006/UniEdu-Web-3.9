/**
 * Bar Chart Component
 * Simple SVG-based bar chart
 */

import React from 'react';
import { formatCurrencyVND } from '../utils/formatters';

export interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartData[];
  height?: number;
  showValues?: boolean;
}

const DEFAULT_COLOR = '#3b82f6';

export default function BarChart({ data, height = 200, showValues = true }: BarChartProps) {
  if (!data || data.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 'var(--spacing-4)' }}>Không có dữ liệu</div>;
  }

  const maxValue = Math.max(...data.map((item) => item.value || 0), 1);
  const barWidth = 100 / data.length;
  const chartHeight = height - 40; // Reserve space for labels

  return (
    <div style={{ width: '100%', padding: 'var(--spacing-4)' }}>
      <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        {data.map((item, index) => {
          const value = item.value || 0;
          const barHeight = (value / maxValue) * chartHeight;
          const x = (index * barWidth) + (barWidth * 0.1);
          const width = barWidth * 0.8;
          const y = chartHeight - barHeight;
          const color = item.color || DEFAULT_COLOR;

          return (
            <g key={index}>
              <rect
                x={x}
                y={y}
                width={width}
                height={barHeight}
                fill={color}
                rx="2"
                style={{ transition: 'opacity 0.2s' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              />
              {showValues && value > 0 && (
                <text
                  x={x + width / 2}
                  y={y - 4}
                  textAnchor="middle"
                  fontSize="8"
                  fill="var(--text)"
                  style={{ fontWeight: '500' }}
                >
                  {formatCurrencyVND(value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 'var(--spacing-2)', fontSize: 'var(--font-size-xs)', color: 'var(--muted)' }}>
        {data.map((item, index) => (
          <div key={index} style={{ textAlign: 'center', maxWidth: `${barWidth}%`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

