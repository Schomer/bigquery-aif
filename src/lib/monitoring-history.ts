// src/lib/monitoring-history.ts
// W3-19: Monitoring history persistence layer.
// Stores DQ check and freshness snapshots in Firestore to enable historical sparklines.

'use client';

export interface MonitoringSnapshot {
  id?: string;
  tableRef: string;              // fully qualified: project.dataset.table
  checkType: 'DQ' | 'FRESHNESS' | 'COST';
  timestamp: string;             // ISO 8601
  // DQ summary fields
  nullRate?: number;             // 0–100
  uniquenessRate?: number;       // 0–100
  passCount?: number;
  failCount?: number;
  // Freshness
  staleDays?: number;
  // Cost
  bytesProcessedMb?: number;
  estimatedCostUsd?: number;
  // Raw summary blob for extended data
  summary?: Record<string, unknown>;
}

export interface MonitoringHistoryEntry {
  tableRef: string;
  snapshots: MonitoringSnapshot[];
}

// ─── Firestore persistence ────────────────────────────────────────────────────

export async function saveMonitoringSnapshot(snapshot: MonitoringSnapshot): Promise<void> {
  if (typeof window === 'undefined') return; // server-side skip
  try {
    const { collection, addDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    const docRef = collection(db, 'monitoringHistory', snapshot.tableRef.replace(/\./g, '_'), 'snapshots');
    await addDoc(docRef, {
      ...snapshot,
      timestamp: snapshot.timestamp ?? new Date().toISOString(),
    });
  } catch (e) {
    // Non-critical: log and continue
    console.warn('[monitoring-history] Failed to save snapshot:', e);
  }
}

// Retrieve last N snapshots for a table
export async function getMonitoringHistory(
  tableRef: string,
  limit = 30
): Promise<MonitoringSnapshot[]> {
  if (typeof window === 'undefined') return [];
  try {
    const { collection, query, orderBy, limit: fsLimit, getDocs } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    const col = collection(db, 'monitoringHistory', tableRef.replace(/\./g, '_'), 'snapshots');
    const q = query(col, orderBy('timestamp', 'desc'), fsLimit(limit));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as MonitoringSnapshot).reverse();
  } catch {
    return [];
  }
}
