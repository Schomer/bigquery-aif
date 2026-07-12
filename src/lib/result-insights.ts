// src/lib/result-insights.ts
// Client-side statistical engine. Computes per-chart-type insights from query results.
// Called after query execution. Zero API calls — pure computation.

export type InsightType = 'ANOMALY' | 'TREND' | 'CORRELATION' | 'CONCENTRATION' | 'DROP_OFF' | 'LEADER_LAGGARD';
export type InsightSeverity = 'high' | 'medium' | 'low';

export interface StatInsight {
  type: InsightType;
  severity: InsightSeverity;
  message: string;          // Human-readable insight
  drillPrompt?: string;     // Suggested follow-up prompt
  periodLabel?: string;     // For anomaly: which period had the spike
  value?: number;           // The relevant value
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mean(vals: number[]): number {
  if (vals.length === 0) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function stddev(vals: number[], mu?: number): number {
  if (vals.length < 2) return 0;
  const m = mu ?? mean(vals);
  const variance = vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length;
  return Math.sqrt(variance);
}

function zScore(v: number, mu: number, sd: number): number {
  return sd === 0 ? 0 : (v - mu) / sd;
}

function pearsonR(xs: number[], ys: number[]): number {
  if (xs.length < 10) return 0;
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

function formatNum(n: number): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(Math.abs(n) < 10 ? 2 : 0);
}

// ─── TIME SERIES ─────────────────────────────────────────────────────────────

function timeSeriesInsights(
  data: Record<string, unknown>[],
  xKey: string,
  yKey: string,
): StatInsight[] {
  const ys = data.map(r => Number(r[yKey])).filter(v => !isNaN(v));
  if (ys.length < 3) return [];

  const insights: StatInsight[] = [];
  const mu = mean(ys);
  const sd = stddev(ys, mu);

  // Anomaly detection (|z| > 2.0, min n=8)
  if (ys.length >= 8) {
    let maxZ = 0, maxIdx = -1;
    for (let i = 0; i < ys.length; i++) {
      const z = Math.abs(zScore(ys[i], mu, sd));
      if (z > maxZ) { maxZ = z; maxIdx = i; }
    }
    if (maxZ > 2.0 && maxIdx >= 0) {
      const periodLabel = String(data[maxIdx][xKey]);
      const val = ys[maxIdx];
      const pct = mu === 0 ? 0 : Math.round(((val - mu) / mu) * 100);
      const dir = val > mu ? 'spike' : 'drop';
      insights.push({
        type: 'ANOMALY',
        severity: maxZ > 3 ? 'high' : 'medium',
        message: `Unusual ${dir} in ${periodLabel}: ${formatNum(val)} (${pct > 0 ? '+' : ''}${pct}% vs avg ${formatNum(mu)})`,
        drillPrompt: `What caused the ${dir} in ${periodLabel}?`,
        periodLabel,
        value: val,
      });
    }
  }

  // Linear trend (slope sign + period-over-period %)
  if (ys.length >= 3) {
    const xs = ys.map((_, i) => i);
    const mx = mean(xs);
    let num = 0, denom = 0;
    for (let i = 0; i < xs.length; i++) {
      num += (xs[i] - mx) * (ys[i] - mu);
      denom += (xs[i] - mx) ** 2;
    }
    const slope = denom === 0 ? 0 : num / denom;
    const pctChange = mu === 0 ? 0 : Math.round((slope * (ys.length - 1) / mu) * 100);
    if (Math.abs(pctChange) >= 10) {
      const dir = slope > 0 ? 'increasing' : 'declining';
      insights.push({
        type: 'TREND',
        severity: Math.abs(pctChange) >= 30 ? 'high' : 'medium',
        message: `${xKey.replace(/_/g, ' ')} is ${dir} overall (${pctChange > 0 ? '+' : ''}${pctChange}% across period)`,
        drillPrompt: slope < 0 ? `What is driving the ${yKey.replace(/_/g, ' ')} decline?` : undefined,
      });
    }
  }

  return insights.slice(0, 3);
}

// ─── BAR / COLUMN ─────────────────────────────────────────────────────────────

function barInsights(
  data: Record<string, unknown>[],
  xKey: string,
  yKey: string,
): StatInsight[] {
  const ys = data.map(r => Number(r[yKey])).filter(v => !isNaN(v));
  if (ys.length < 2) return [];

  const insights: StatInsight[] = [];
  const total = ys.reduce((s, v) => s + v, 0);
  const mu = mean(ys);
  const sd = stddev(ys, mu);

  // Top share > 50%
  const maxIdx = ys.indexOf(Math.max(...ys));
  const topLabel = String(data[maxIdx]?.[xKey] ?? '');
  const topShare = total === 0 ? 0 : Math.round((ys[maxIdx] / total) * 100);
  if (topShare >= 40) {
    insights.push({
      type: 'CONCENTRATION',
      severity: topShare >= 60 ? 'high' : 'medium',
      message: `${topLabel} accounts for ${topShare}% of total ${yKey.replace(/_/g, ' ')}`,
      drillPrompt: `Break down ${topLabel} further`,
      value: ys[maxIdx],
    });
  }

  // Outlier (|z| > 1.5, min n=5)
  if (ys.length >= 5) {
    let maxZ = 0, outlierIdx = -1;
    for (let i = 0; i < ys.length; i++) {
      const z = Math.abs(zScore(ys[i], mu, sd));
      if (z > maxZ && i !== maxIdx) { maxZ = z; outlierIdx = i; }
    }
    if (maxZ > 1.5 && outlierIdx >= 0) {
      const label = String(data[outlierIdx]?.[xKey] ?? '');
      const minIdx = ys.indexOf(Math.min(...ys));
      const minLabel = String(data[minIdx]?.[xKey] ?? '');
      const gap = ys[maxIdx] - ys[minIdx];
      if (maxIdx !== minIdx) {
        insights.push({
          type: 'LEADER_LAGGARD',
          severity: 'low',
          message: `${topLabel} leads ${minLabel} by ${formatNum(gap)} in ${yKey.replace(/_/g, ' ')}`,
          drillPrompt: `Why is ${minLabel} underperforming?`,
        });
      }
    }
  }

  return insights.slice(0, 3);
}

// ─── SCATTER ──────────────────────────────────────────────────────────────────

function scatterInsights(
  data: Record<string, unknown>[],
  xKey: string,
  yKey: string,
): StatInsight[] {
  const xs = data.map(r => Number(r[xKey])).filter(v => !isNaN(v));
  const ys = data.map(r => Number(r[yKey])).filter(v => !isNaN(v));
  if (xs.length < 10 || xs.length !== ys.length) return [];

  const r = pearsonR(xs, ys);
  if (Math.abs(r) < 0.40) return [];

  const strength = Math.abs(r) >= 0.80 ? 'strong' : Math.abs(r) >= 0.60 ? 'moderate' : 'weak';
  const dir = r > 0 ? 'positive' : 'negative';
  return [{
    type: 'CORRELATION',
    severity: Math.abs(r) >= 0.80 ? 'high' : 'medium',
    message: `${strength} ${dir} correlation between ${xKey.replace(/_/g, ' ')} and ${yKey.replace(/_/g, ' ')} (r=${r.toFixed(2)})`,
    drillPrompt: `Does ${xKey.replace(/_/g, ' ')} predict ${yKey.replace(/_/g, ' ')}?`,
    value: r,
  }];
}

// ─── PIE / DONUT ──────────────────────────────────────────────────────────────

function pieInsights(
  data: Record<string, unknown>[],
  xKey: string,
  yKey: string,
): StatInsight[] {
  const ys = data.map(r => Number(r[yKey])).filter(v => !isNaN(v));
  if (ys.length < 2) return [];

  const total = ys.reduce((s, v) => s + v, 0);
  if (total === 0) return [];

  // HHI concentration
  const shares = ys.map(v => v / total);
  const hhi = shares.reduce((s, p) => s + p * p, 0);

  // Dominant share
  const maxIdx = ys.indexOf(Math.max(...ys));
  const topLabel = String(data[maxIdx]?.[xKey] ?? '');
  const topShare = Math.round(shares[maxIdx] * 100);

  const insights: StatInsight[] = [];
  if (topShare >= 50) {
    insights.push({
      type: 'CONCENTRATION',
      severity: topShare >= 70 ? 'high' : 'medium',
      message: `${topLabel} dominates at ${topShare}% — highly concentrated distribution (HHI: ${hhi.toFixed(2)})`,
      drillPrompt: `Break down ${topLabel} further`,
      value: topShare,
    });
  } else if (hhi > 0.25) {
    insights.push({
      type: 'CONCENTRATION',
      severity: 'low',
      message: `Moderately concentrated distribution — top category is ${topLabel} at ${topShare}%`,
      value: topShare,
    });
  }

  return insights;
}

// ─── FUNNEL ───────────────────────────────────────────────────────────────────

function funnelInsights(
  data: Record<string, unknown>[],
  xKey: string,
  yKey: string,
): StatInsight[] {
  const ys = data.map(r => Number(r[yKey])).filter(v => !isNaN(v));
  if (ys.length < 2) return [];

  const insights: StatInsight[] = [];
  let maxDrop = 0, maxDropIdx = -1;

  for (let i = 1; i < ys.length; i++) {
    if (ys[i - 1] === 0) continue;
    const dropPct = (ys[i - 1] - ys[i]) / ys[i - 1];
    if (dropPct > maxDrop) { maxDrop = dropPct; maxDropIdx = i; }
  }

  if (maxDropIdx >= 1) {
    const fromLabel = String(data[maxDropIdx - 1]?.[xKey] ?? `Step ${maxDropIdx}`);
    const toLabel = String(data[maxDropIdx]?.[xKey] ?? `Step ${maxDropIdx + 1}`);
    insights.push({
      type: 'DROP_OFF',
      severity: maxDrop >= 0.5 ? 'high' : 'medium',
      message: `Biggest drop-off: ${fromLabel} → ${toLabel} (${Math.round(maxDrop * 100)}% loss)`,
      drillPrompt: `What causes the drop-off from ${fromLabel} to ${toLabel}?`,
      value: maxDrop,
    });
  }

  // Overall conversion
  if (ys[0] > 0) {
    const overall = Math.round((ys[ys.length - 1] / ys[0]) * 100);
    insights.push({
      type: 'TREND',
      severity: overall < 20 ? 'high' : 'low',
      message: `Overall funnel conversion: ${overall}% (${formatNum(ys[ys.length - 1])} of ${formatNum(ys[0])})`,
      value: overall,
    });
  }

  return insights.slice(0, 3);
}

// ─── Main export ─────────────────────────────────────────────────────────────

type ChartType =
  | 'LINE_CHART' | 'AREA_CHART'
  | 'BAR_CHART' | 'COLUMN_CHART' | 'HISTOGRAM'
  | 'SCATTER_CHART'
  | 'PIE_CHART' | 'DONUT_CHART'
  | 'FUNNEL_CHART'
  | string;

export function computeInsights(
  chartType: ChartType,
  data: Record<string, unknown>[],
  xKey: string,
  yKey: string,
): StatInsight[] {
  if (!data || data.length < 2) return [];

  let raw: StatInsight[] = [];

  if (chartType === 'LINE_CHART' || chartType === 'AREA_CHART') {
    raw = timeSeriesInsights(data, xKey, yKey);
  } else if (chartType === 'BAR_CHART' || chartType === 'COLUMN_CHART' || chartType === 'HISTOGRAM') {
    raw = barInsights(data, xKey, yKey);
  } else if (chartType === 'SCATTER_CHART') {
    raw = scatterInsights(data, xKey, yKey);
  } else if (chartType === 'PIE_CHART' || chartType === 'DONUT_CHART') {
    raw = pieInsights(data, xKey, yKey);
  } else if (chartType === 'FUNNEL_CHART') {
    raw = funnelInsights(data, xKey, yKey);
  } else {
    // Generic bar insight for unknown chart types
    raw = barInsights(data, xKey, yKey);
  }

  // Sort: ANOMALY > TREND > others; cap at 3
  const order: InsightType[] = ['ANOMALY', 'DROP_OFF', 'TREND', 'CORRELATION', 'CONCENTRATION', 'LEADER_LAGGARD'];
  return raw
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
    .slice(0, 3);
}
