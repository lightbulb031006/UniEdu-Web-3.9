/**
 * Dual Line Chart Component
 * Renders revenue and profit line chart
 */

import React, { useState, useRef, useEffect } from 'react';
import { formatCurrencyVND, formatShortCurrency } from '../utils/formatters';

interface ChartDataPoint {
  label: string;
  displayLabel: string;
  revenue: number;
  profit: number;
}

interface DualLineChartProps {
  data: ChartDataPoint[];
}

export function DualLineChart({ data }: DualLineChartProps) {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    title: string;
    value: string;
    label: string;
  }>({
    visible: false,
    x: 0,
    y: 0,
    title: '',
    value: '',
    label: '',
  });

  const chartRef = useRef<HTMLDivElement>(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ padding: 'var(--spacing-8)', textAlign: 'center', color: 'var(--muted)' }}>
        Chưa có dữ liệu
      </div>
    );
  }

  const VIEWBOX_WIDTH = 500;
  const VIEWBOX_HEIGHT = 220;
  const xPadding = 50;
  const yPaddingTop = 20;
  const yPaddingBottom = 50;
  const chartWidth = VIEWBOX_WIDTH - xPadding * 2;
  const chartHeight = VIEWBOX_HEIGHT - yPaddingTop - yPaddingBottom;

  const maxValue = Math.max(...data.map((item) => Math.max(item.revenue || 0, item.profit || 0))) || 1;

  const resolveX = (index: number) => {
    if (data.length <= 1) {
      return xPadding + chartWidth / 2;
    }
    return xPadding + (index / (data.length - 1)) * chartWidth;
  };

  const toPoint = (item: ChartDataPoint, index: number, key: 'revenue' | 'profit') => {
    const x = resolveX(index);
    const value = Number(item[key] || 0);
    const y = VIEWBOX_HEIGHT - yPaddingBottom - (maxValue > 0 ? (value / maxValue) * chartHeight : 0);
    return { x, y, value };
  };

  const buildPath = (key: 'revenue' | 'profit') => {
    return data.map((item, index) => {
      const point = toPoint(item, index, key);
      return `${point.x},${point.y}`;
    }).join(' ');
  };

  const yTicks = [];
  const divisions = 4;
  for (let i = 0; i <= divisions; i += 1) {
    const value = (maxValue / divisions) * i;
    const y = VIEWBOX_HEIGHT - yPaddingBottom - ((value / (maxValue || 1)) * chartHeight);
    yTicks.push({ value, y });
  }

  const handleDotMouseEnter = (event: React.MouseEvent<SVGCircleElement>, series: string, value: number, label: string) => {
    if (!chartRef.current) return;
    const chartRect = chartRef.current.getBoundingClientRect();
    const dotRect = event.currentTarget.getBoundingClientRect();
    const left = dotRect.left - chartRect.left;
    const top = dotRect.top - chartRect.top - 8;

    setTooltip({
      visible: true,
      x: left,
      y: top,
      title: series,
      value: formatCurrencyVND(value),
      label,
    });
  };

  const handleDotMouseLeave = () => {
    setTooltip({ ...tooltip, visible: false });
  };

  return (
    <div className="dual-line-chart" ref={chartRef} style={{ position: 'relative' }}>
      <div className="chart-scroll-wrapper" style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <svg
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          className="chart"
          preserveAspectRatio="none"
          style={{ width: '100%', height: '220px', minWidth: '500px' }}
        >
          {/* Y-axis labels */}
          {yTicks.map((tick, idx) => (
            <text
              key={idx}
              x={xPadding - 8}
              y={tick.y + 5}
              className="chart-y-label"
              style={{ fontSize: '10px', fill: 'var(--muted)' }}
            >
              {formatShortCurrency(tick.value)}
            </text>
          ))}

          {/* Revenue line */}
          <polyline
            className="chart-line chart-line-revenue"
            fill="none"
            strokeWidth="3"
            stroke="#3b82f6"
            points={buildPath('revenue')}
          />

          {/* Profit line */}
          <polyline
            className="chart-line chart-line-profit"
            fill="none"
            strokeWidth="3"
            stroke="#10b981"
            points={buildPath('profit')}
          />

          {/* Revenue dots */}
          {data.map((item, index) => {
            const point = toPoint(item, index, 'revenue');
            return (
              <circle
                key={`revenue-${index}`}
                className="chart-dot chart-dot-revenue"
                cx={point.x}
                cy={point.y}
                r="4"
                fill="#3b82f6"
                onMouseEnter={(e) => handleDotMouseEnter(e, 'Doanh thu', point.value, item.displayLabel || item.label)}
                onMouseLeave={handleDotMouseLeave}
                style={{ cursor: 'pointer' }}
              />
            );
          })}

          {/* Profit dots */}
          {data.map((item, index) => {
            const point = toPoint(item, index, 'profit');
            return (
              <circle
                key={`profit-${index}`}
                className="chart-dot chart-dot-profit"
                cx={point.x}
                cy={point.y}
                r="4"
                fill="#10b981"
                onMouseEnter={(e) => handleDotMouseEnter(e, 'Lợi nhuận', point.value, item.displayLabel || item.label)}
                onMouseLeave={handleDotMouseLeave}
                style={{ cursor: 'pointer' }}
              />
            );
          })}

          {/* X-axis labels */}
          {data.map((item, index) => {
            const shouldShow = data.length <= 6 || index % 2 === 0;
            if (!shouldShow) return null;
            const x = resolveX(index);
            const labelY = VIEWBOX_HEIGHT - yPaddingBottom + 22;
            return (
              <text
                key={`label-${index}`}
                x={x}
                y={labelY}
                textAnchor="middle"
                className="chart-x-label"
                style={{ fontSize: '10px', fill: 'var(--muted)' }}
              >
                {item.displayLabel || item.label}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Tooltip */}
      <div
        className="chart-tooltip"
        role="tooltip"
        style={{
          position: 'absolute',
          left: `${tooltip.x}px`,
          top: `${tooltip.y}px`,
          transform: 'translate(-50%, -100%)',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 'var(--spacing-2)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          pointerEvents: 'none',
          opacity: tooltip.visible ? 1 : 0,
          transition: 'opacity 0.2s',
          zIndex: 1000,
          minWidth: '120px',
        }}
      >
        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--text)', marginBottom: '2px' }}>
          {tooltip.title}
        </div>
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: '700', color: 'var(--text)', marginBottom: '2px' }}>
          {tooltip.value}
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)' }}>
          {tooltip.label}
        </div>
      </div>

      {/* Legend */}
      <div className="chart-inline-legend" style={{ display: 'flex', gap: 'var(--spacing-4)', marginTop: 'var(--spacing-3)', justifyContent: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)' }}>
          <span
            className="legend-dot legend-revenue"
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#3b82f6',
              display: 'inline-block',
            }}
          />
          Doanh thu
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)' }}>
          <span
            className="legend-dot legend-profit"
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#10b981',
              display: 'inline-block',
            }}
          />
          Lợi nhuận
        </span>
      </div>
    </div>
  );
}

