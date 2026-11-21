import { useState, useRef } from 'react';
import type { ForecastPoint } from '../../types';

interface ForecastRiskChartProps {
  points: ForecastPoint[];
}

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function formatMoney(n: number): string {
  return currency.format(n);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

export default function ForecastRiskChart({ points }: ForecastRiskChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  if (!points || points.length === 0) return null;

  const width = 940;
  const height = 360;
  const paddingLeft = 75;
  const paddingRight = 45;
  const paddingTop = 30;
  const paddingBottom = 45;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  // Calculate value bounds
  const allValues = points.flatMap((p) => [p.likely, p.cautious, p.safetyBuffer, p.zeroLine]);
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);

  // Buffer range slightly
  const margin = Math.max(10000, (rawMax - rawMin) * 0.1);
  const minY = Math.min(0, rawMin - margin);
  const maxY = rawMax + margin;
  const yRange = maxY - minY || 1;

  function getX(index: number): number {
    return paddingLeft + (index / (points.length - 1 || 1)) * plotWidth;
  }

  function getY(val: number): number {
    return paddingTop + plotHeight - ((val - minY) / yRange) * plotHeight;
  }

  // Construct polygon for the Risk Zone between Likely and Cautious lines
  const likelyPoints = points.map((p, i) => `${getX(i).toFixed(1)},${getY(p.likely).toFixed(1)}`);
  const cautiousPointsReversed = points
    .slice()
    .reverse()
    .map((p, i) => {
      const origIndex = points.length - 1 - i;
      return `${getX(origIndex).toFixed(1)},${getY(p.cautious).toFixed(1)}`;
    });

  const riskZonePath = `M ${likelyPoints.join(' L ')} L ${cautiousPointsReversed.join(' L ')} Z`;
  const likelyLinePath = `M ${likelyPoints.join(' L ')}`;
  const cautiousLinePath = `M ${points
    .map((p, i) => `${getX(i).toFixed(1)},${getY(p.cautious).toFixed(1)}`)
    .join(' L ')}`;

  const safetyBufferY = getY(points[0].safetyBuffer);
  const zeroLineY = getY(0);

  // Y-axis tick values (5 ticks)
  const yTicks = [
    minY,
    minY + yRange * 0.25,
    minY + yRange * 0.5,
    minY + yRange * 0.75,
    maxY,
  ];

  // X-axis tick step (about 5-6 date labels)
  const xStep = Math.max(1, Math.floor(points.length / 5));

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const relativeX = (mouseX / rect.width) * width;

    if (relativeX < paddingLeft || relativeX > paddingLeft + plotWidth) {
      setHoverIndex(null);
      return;
    }

    const ratio = (relativeX - paddingLeft) / plotWidth;
    const index = Math.round(ratio * (points.length - 1));
    const clamped = Math.max(0, Math.min(points.length - 1, index));
    setHoverIndex(clamped);
  }

  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-base font-bold text-text">Projected Cash Balance & Risk Zone</h2>
          <p className="text-xs text-text/60 mt-0.5">
            Likely vs cautious scenarios. The shaded band shows your exposure risk.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-teal-600 dark:bg-teal-400" />
            <span className="text-text">Likely line</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t-2 border-dashed border-amber-500" />
            <span className="text-text">Cautious line</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-amber-500/25 border border-amber-500/50" />
            <span className="text-text font-semibold">Risk zone (variance band)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t-2 border-dashed border-red-500" />
            <span className="text-red-600 dark:text-red-400">Safety buffer</span>
          </div>
        </div>
      </div>

      <div className="relative mt-4 overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            {/* Risk Zone shaded gradient fill */}
            <linearGradient id="riskZoneGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0.10" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((val, idx) => {
            const y = getY(val);
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={paddingLeft + plotWidth}
                  y2={y}
                  stroke="currentColor"
                  className="text-border/40"
                  strokeDasharray="3 3"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-text/50 text-[10px] font-mono"
                >
                  ₹{(val / 1000).toFixed(0)}k
                </text>
              </g>
            );
          })}

          {/* Zero Line */}
          {zeroLineY >= paddingTop && zeroLineY <= paddingTop + plotHeight && (
            <g>
              <line
                x1={paddingLeft}
                y1={zeroLineY}
                x2={paddingLeft + plotWidth}
                y2={zeroLineY}
                stroke="#64748b"
                strokeWidth="1.2"
              />
              <text
                x={paddingLeft + plotWidth + 6}
                y={zeroLineY + 3}
                className="fill-slate-500 text-[10px] font-mono"
              >
                ₹0
              </text>
            </g>
          )}

          {/* Safety Buffer Line */}
          {safetyBufferY >= paddingTop && safetyBufferY <= paddingTop + plotHeight && (
            <g>
              <line
                x1={paddingLeft}
                y1={safetyBufferY}
                x2={paddingLeft + plotWidth}
                y2={safetyBufferY}
                stroke="#ef4444"
                strokeWidth="1.5"
                strokeDasharray="5 4"
              />
              <text
                x={paddingLeft + plotWidth + 6}
                y={safetyBufferY + 3}
                className="fill-red-500 text-[10px] font-semibold font-mono"
              >
                Buffer
              </text>
            </g>
          )}

          {/* The Risk Zone (shaded band between likely and cautious lines) */}
          <path d={riskZonePath} fill="url(#riskZoneGradient)" />

          {/* Cautious Line (dashed amber) */}
          <path
            d={cautiousLinePath}
            fill="none"
            stroke="#d97706"
            strokeWidth="2.2"
            strokeDasharray="6 4"
            strokeLinecap="round"
          />

          {/* Likely Line (solid teal) */}
          <path
            d={likelyLinePath}
            fill="none"
            stroke="#0d9488"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* X-axis date labels */}
          {points.map((p, idx) => {
            if (idx % xStep !== 0 && idx !== points.length - 1) return null;
            const x = getX(idx);
            return (
              <g key={idx}>
                <line
                  x1={x}
                  y1={paddingTop + plotHeight}
                  x2={x}
                  y2={paddingTop + plotHeight + 6}
                  stroke="currentColor"
                  className="text-border"
                />
                <text
                  x={x}
                  y={paddingTop + plotHeight + 20}
                  textAnchor="middle"
                  className="fill-text/60 text-[11px]"
                >
                  {formatDate(p.date)}
                </text>
              </g>
            );
          })}

          {/* Interactive hover indicator */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={paddingTop}
                x2={getX(hoverIndex)}
                y2={paddingTop + plotHeight}
                stroke="#0d9488"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              {/* Point on Likely curve */}
              <circle
                cx={getX(hoverIndex)}
                cy={getY(points[hoverIndex].likely)}
                r="5"
                fill="#0d9488"
                stroke="#ffffff"
                strokeWidth="2"
              />
              {/* Point on Cautious curve */}
              <circle
                cx={getX(hoverIndex)}
                cy={getY(points[hoverIndex].cautious)}
                r="4.5"
                fill="#d97706"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Floating Tooltip */}
        {activePoint && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-4 z-20 rounded-xl border border-border bg-card/95 p-3.5 shadow-xl backdrop-blur-sm text-xs sm:text-sm"
            style={{
              left: Math.min(
                Math.max(10, getX(hoverIndex) * (window.innerWidth < 640 ? 0.7 : 0.85)),
                window.innerWidth < 640 ? 120 : 600,
              ),
            }}
          >
            <div className="font-bold text-text mb-1.5">{formatDate(activePoint.date)}</div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400 font-medium">
                  <span className="h-2 w-2 rounded-full bg-teal-500" />
                  Likely Balance:
                </span>
                <span className="font-bold text-text">{formatMoney(activePoint.likely)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Cautious Balance:
                </span>
                <span className="font-bold text-text">{formatMoney(activePoint.cautious)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 pt-1 border-t border-border/60 text-xs">
                <span className="text-text/70">Risk Zone Exposure:</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {formatMoney(Math.abs(activePoint.likely - activePoint.cautious))}
                </span>
              </div>
              <div className="mt-1 pt-1 border-t border-border/40 text-[11px]">
                {activePoint.cautious < 0 ? (
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    🚨 Projected Cash Deficit
                  </span>
                ) : activePoint.cautious < activePoint.safetyBuffer ? (
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    ⚠️ In Risk Zone (Below safety buffer)
                  </span>
                ) : (
                  <span className="font-semibold text-teal-600 dark:text-teal-400">
                    ✅ Healthy Buffer Reserve
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
