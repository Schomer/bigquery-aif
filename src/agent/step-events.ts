// src/agent/step-events.ts
// Unified step-event protocol for the agent loop.
// Every observable action in a turn emits a StepEvent.
// The UI, trace recorder, and eval runner all consume these.

import type { StatusCallback } from '../lib/types';

// ── StepEvent type ────────────────────────────────────────────────────────────

export type StepEventKind =
  | 'thinking'
  | 'tool_start'
  | 'tool_result'
  | 'confirmation_needed'
  | 'final'
  | 'stopped';

export type StepEventStatus = 'running' | 'ok' | 'error' | 'retrying';

export interface StepEvent {
  /** Unique event ID */
  id: string;
  /** ID of the turn this event belongs to */
  turn_id: string;
  /** What kind of event this is */
  kind: StepEventKind;
  /** Model-written, human-readable label (e.g. "Querying orders table") */
  label: string;
  /** Expandable detail: SQL text, endpoint URL, row count, etc. */
  detail?: string;
  /** Current status */
  status: StepEventStatus;
  /** Timestamp when the step started (ms since epoch) */
  t_start: number;
  /** Timestamp when the step ended (ms since epoch) */
  t_end?: number;
  /** BigQuery bytes billed, if applicable */
  bytes_billed?: number;
  /** Tool name, if this is a tool_start or tool_result event */
  tool_name?: string;
  /** Tool arguments, if this is a tool_start event */
  tool_args?: Record<string, unknown>;
}

// ── StepEventEmitter ──────────────────────────────────────────────────────────

export type StepEventListener = (event: StepEvent) => void;

let _nextEventId = 0;

function generateEventId(): string {
  return `evt_${Date.now()}_${_nextEventId++}`;
}

/**
 * Emitter for step events within a single turn.
 * Maintains an ordered log and notifies listeners in real time.
 */
export class StepEventEmitter {
  private listeners: StepEventListener[] = [];
  private log: StepEvent[] = [];
  readonly turnId: string;

  constructor(turnId?: string) {
    this.turnId = turnId ?? `turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /** Register a listener. Returns an unsubscribe function. */
  on(listener: StepEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /** Emit a new step event. */
  emit(partial: Omit<StepEvent, 'id' | 'turn_id'>): StepEvent {
    const event: StepEvent = {
      id: generateEventId(),
      turn_id: this.turnId,
      ...partial,
    };
    this.log.push(event);
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Listener errors are non-fatal
      }
    }
    return event;
  }

  /** Update an existing event (e.g. mark tool_start as completed). */
  update(eventId: string, patch: Partial<StepEvent>): void {
    const event = this.log.find(e => e.id === eventId);
    if (!event) return;
    Object.assign(event, patch);
    const updated = { ...event };
    for (const listener of this.listeners) {
      try {
        listener(updated);
      } catch {
        // Listener errors are non-fatal
      }
    }
  }

  /** Get the full ordered log for this turn. */
  getLog(): ReadonlyArray<StepEvent> {
    return this.log;
  }

  /** Clear all listeners and log. */
  dispose(): void {
    this.listeners = [];
    this.log = [];
  }
}

// ── Backward-compatible adapter ───────────────────────────────────────────────

/**
 * Creates a StatusCallback that emits StepEvents.
 * Bridges the old string-based progress system to the new protocol.
 * The current UI continues to work unchanged via the StatusCallback,
 * while the trace recorder and eval runner consume the richer StepEvent stream.
 */
export function createStatusBridge(
  emitter: StepEventEmitter,
  onStatus?: StatusCallback,
): StatusCallback {
  return (label: string | import('../lib/types').StepInfo) => {
    const labelStr = typeof label === 'string' ? label : label.text;

    // Emit a thinking event for status updates
    emitter.emit({
      kind: 'thinking',
      label: labelStr,
      status: 'running',
      t_start: Date.now(),
    });

    // Forward to the old callback
    onStatus?.(label);
  };
}

/**
 * Creates a StatusCallback from a StepEventEmitter, suitable for passing
 * to existing code that expects the old interface.
 */
export function stepEventsToStatusCallback(emitter: StepEventEmitter): StatusCallback {
  return createStatusBridge(emitter);
}
