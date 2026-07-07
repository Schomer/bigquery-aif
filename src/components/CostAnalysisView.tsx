'use client';

import type { CostAnalysisResult, CostBucket } from '@/lib/types';
import { useState, useMemo } from 'react';
import { formatBytes, truncateEmail } from '@/lib/format';
import { StatCard } from '@/components/ui/StatCard';

interface Props {
  result: CostAnalysisResult;
  onSendMessage?: (msg: string) => void;
}

const PALETTE = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16'];

function formatUsd(n: number): string {
  return '$' + n.toFixed(2);
}



function costColor(n: number): string {
  if (n < 1) return '#22c55e';
  if (n < 10) return '#f59e0b';
  return '#ef4444';
}

interface UserStats {
  user: string;
  totalCost: number;
  totalJobs: number;
  totalBytes: number;
}

interface HoverInfo {
  x: number;
  y: number;
  period: string;
  user: string;
  cost: number;
  bytes: number;
  jobs: number;
}

export function CostAnalysisView({ result, onSendMessage }: Props) {
  const send = onSendMessage ?? (() => {});
  const { buckets, totalEstimatedCostUsd } = result;

  const [hover, setHover] = useState<HoverInfo | null>(null);

  // Aggregate per-user stats
  const userStats = useMemo<UserStats[]>(() => {
    const map = new Map<string, UserStats>();
    for (const b of buckets) {
      const s = map.get(b.user);
      if (s) {
        s.totalCost += b.estimatedCostUsd;
        s.totalJobs += b.jobCount;
        s.totalBytes += b.bytesProcessed;
      } else {
        map.set(b.user, {
          user: b.user,
          totalCost: b.estimatedCostUsd,
          totalJobs: b.jobCount,
          totalBytes: b.bytesProcessed,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalCost - a.totalCost);
  }, [buckets]);

  // Unique sorted periods and user->color mapping
  const periods = useMemo(() => {
    const set = new Set<string>();
    for (const b of buckets) set.add(b.period);
    return Array.from(set).sort();
  }, [buckets]);

  const users = useMemo(() => userStats.map((s) => s.user), [userStats]);

  const userColor = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u, i) => map.set(u, PALETTE[i % PALETTE.length]));
    return map;
  }, [users]);

  // Stacked bar data: for each period, ordered user segments
  const chartData = useMemo(() => {
    const byPeriod = new Map<string, Map<string, CostBucket>>();
    for (const b of buckets) {
      if (!byPeriod.has(b.period)) byPeriod.set(b.period, new Map());
      byPeriod.get(b.period)!.set(b.user, b);
    }
    return { byPeriod };
  }, [buckets]);

  // Max stacked cost per period (for Y scale)
  const maxCost = useMemo(() => {
    let max = 0;
    for (const period of periods) {
      let sum = 0;
      const pData = chartData.byPeriod.get(period);
      if (pData) {
        for (const b of pData.values()) sum += b.estimatedCostUsd;
      }
      if (sum > max) max = sum;
    }
    return max || 1;
  }, [periods, chartData]);

  // KPI values
  const totalJobs = useMemo(() => buckets.reduce((s, b) => s + b.jobCount, 0), [buckets]);
  const avgDailyCost = periods.length > 0 ? totalEstimatedCostUsd / periods.length : 0;
  const topSpender = userStats.length > 0 ? userStats[0].user : 'N/A';

  if (buckets.length === 0) {
    return (
      <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
        No cost data available for this time range.
      </div>
    );
  }

  // Chart layout constants
  const svgW = 800;
  const svgH = 300;
  const padL = 60;
  const padR = 16;
  const padT = 16;
  const padB = 48;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  // Y-axis: nice ticks
  const yTicks = niceYTicks(maxCost, 5);
  const yMax = yTicks[yTicks.length - 1];

  // Bar sizing
  const barGap = Math.max(2, Math.min(8, chartW / periods.length * 0.15));
  const barW = Math.max(4, (chartW - barGap * (periods.length + 1)) / periods.length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard label="Total Estimated Cost" value={formatUsd(totalEstimatedCostUsd)} color={costColor(totalEstimatedCostUsd)} />
        <StatCard label="Avg Daily Cost" value={formatUsd(avgDailyCost)} color={costColor(avgDailyCost)} />
        <StatCard label="Top Spender" value={truncateEmail(topSpender)} />
        <StatCard label="Total Jobs" value={totalJobs.toLocaleString()} />
      </div>

      {/* Stacked bar chart */}
      <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ width: '100%', height: 300, display: 'block' }}
        >
          {/* Grid lines */}
          {yTicks.map((tick) => {
            const y = padT + chartH - (tick / yMax) * chartH;
            return (
              <g key={tick}>
                <line
                  x1={padL}
                  x2={svgW - padR}
                  y1={y}
                  y2={y}
                  stroke="var(--border-subtle)"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
                <text
                  x={padL - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="var(--text-dim)"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                >
                  {formatUsd(tick)}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {periods.map((period, pi) => {
            const x = padL + barGap + pi * (barW + barGap);
            const pData = chartData.byPeriod.get(period);
            let cumY = 0;

            return (
              <g key={period}>
                {/* X-axis label */}
                <text
                  x={x + barW / 2}
                  y={svgH - padB + 14}
                  textAnchor={periods.length > 14 ? 'end' : 'middle'}
                  fill="var(--text-dim)"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                  transform={
                    periods.length > 14
                      ? `rotate(-45, ${x + barW / 2}, ${svgH - padB + 14})`
                      : undefined
                  }
                >
                  {formatDateLabel(period)}
                </text>

                {/* Stacked segments */}
                {users.map((user) => {
                  const bucket = pData?.get(user);
                  if (!bucket || bucket.estimatedCostUsd === 0) return null;
                  const segH = (bucket.estimatedCostUsd / yMax) * chartH;
                  const segY = padT + chartH - cumY - segH;
                  cumY += segH;
                  return (
                    <rect
                      key={user}
                      x={x}
                      y={segY}
                      width={barW}
                      height={Math.max(segH, 0.5)}
                      fill={userColor.get(user) ?? PALETTE[0]}
                      rx={2}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={(e) => {
                        const svg = e.currentTarget.ownerSVGElement;
                        if (!svg) return;
                        const pt = svg.createSVGPoint();
                        pt.x = e.clientX;
                        pt.y = e.clientY;
                        const svgPt = pt.matrixTransform(svg.getScreenCTM()?.inverse());
                        setHover({
                          x: svgPt.x,
                          y: svgPt.y,
                          period,
                          user,
                          cost: bucket.estimatedCostUsd,
                          bytes: bucket.bytesProcessed,
                          jobs: bucket.jobCount,
                        });
                      }}
                      onMouseLeave={() => setHover(null)}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Tooltip (rendered inside SVG as foreignObject) */}
          {hover && (
            <foreignObject
              x={Math.min(hover.x + 8, svgW - 180)}
              y={Math.max(hover.y - 80, 4)}
              width={170}
              height={90}
              style={{ pointerEvents: 'none' }}
            >
              <div
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 11,
                  color: 'var(--text)',
                  lineHeight: 1.5,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
              >
                <div style={{ fontWeight: 600 }}>{formatDateLabel(hover.period)}</div>
                <div style={{ color: 'var(--text-muted)' }}>{truncateEmail(hover.user)}</div>
                <div>Cost: <span style={{ color: costColor(hover.cost), fontWeight: 500 }}>{formatUsd(hover.cost)}</span></div>
                <div>Data: {formatBytes(hover.bytes)} / {hover.jobs} job{hover.jobs !== 1 ? 's' : ''}</div>
              </div>
            </foreignObject>
          )}
        </svg>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4, paddingLeft: padL }}>
          {users.map((u) => (
            <div key={u} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: userColor.get(u), display: 'inline-block', flexShrink: 0 }} />
              {truncateEmail(u)}
            </div>
          ))}
        </div>
      </div>

      {/* Per-user breakdown table */}
      <div style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['User', 'Total Cost', 'Total Jobs', 'Avg Cost/Job', 'Data Processed'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '7px 12px',
                    textAlign: 'left',
                    color: 'var(--text-dim)',
                    fontWeight: 500,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 0.3,
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {userStats.map((s, i) => (
              <UserRow key={s.user} stats={s} index={i} color={userColor.get(s.user) ?? PALETTE[0]} onSendMessage={send} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────────── */



function UserRow({ stats: s, index, color, onSendMessage }: {
  stats: UserStats;
  index: number;
  color: string;
  onSendMessage: (msg: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const avgCost = s.totalJobs > 0 ? s.totalCost / s.totalJobs : 0;

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSendMessage(`Show me recent jobs by ${s.user}`)}
      style={{
        background: hovered ? 'var(--accent-dim)' : index % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.1s',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <td style={{ padding: '6px 12px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)' }}>{truncateEmail(s.user)}</span>
      </td>
      <td style={{ padding: '6px 12px', fontFamily: 'var(--font-mono)', color: costColor(s.totalCost), fontWeight: 500 }}>
        {formatUsd(s.totalCost)}
      </td>
      <td style={{ padding: '6px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
        {s.totalJobs.toLocaleString()}
      </td>
      <td style={{ padding: '6px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
        {formatUsd(avgCost)}
      </td>
      <td style={{ padding: '6px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
        {formatBytes(s.totalBytes)}
      </td>
    </tr>
  );
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */



function formatDateLabel(period: string): string {
  const d = new Date(period);
  if (isNaN(d.getTime())) return period;
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function niceYTicks(maxVal: number, count: number): number[] {
  if (maxVal <= 0) return [0, 1];
  const rough = maxVal / (count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / mag;
  let step: number;
  if (residual <= 1) step = mag;
  else if (residual <= 2) step = 2 * mag;
  else if (residual <= 5) step = 5 * mag;
  else step = 10 * mag;
  const ticks: number[] = [];
  for (let v = 0; v <= maxVal + step * 0.01; v += step) {
    ticks.push(Math.round(v * 1000) / 1000);
  }
  if (ticks.length < 2) ticks.push(step);
  return ticks;
}
