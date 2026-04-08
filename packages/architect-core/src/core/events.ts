/**
 * Architecture Event System
 *
 * Lightweight pub/sub for decoupling analysis events from handlers.
 * Enables the self-improving loop: violations emit events,
 * handlers persist constraints and suggest rules.
 *
 * @since v10.0.0 — Phase 2A (Self-Improving Loop)
 */

// ── Event types ──────────────────────────────────────────

export interface ViolationDetectedEvent {
  type: 'violation.detected';
  timestamp: string;
  projectPath: string;
  violation: {
    level: 'error' | 'warning';
    rule: string;
    message: string;
    actual?: number | string | string[];
    expected?: number | string | string[];
  };
  context: {
    score: number;
    antiPatternCount: number;
  };
}

export interface AnalysisCompletedEvent {
  type: 'analysis.completed';
  timestamp: string;
  projectPath: string;
  score: number;
  antiPatternCount: number;
  analysisId?: number;
}

export interface ScoreDegradedEvent {
  type: 'score.degraded';
  timestamp: string;
  projectPath: string;
  previousScore: number;
  currentScore: number;
  delta: number;
}

export interface ConstraintCreatedEvent {
  type: 'constraint.created';
  timestamp: string;
  projectPath: string;
  constraint: {
    ruleType: string;
    definition: string;
  };
}

export interface RuleSuggestedEvent {
  type: 'rule.suggested';
  timestamp: string;
  projectPath: string;
  rule: {
    type: string;
    yaml: string;
    reason: string;
  };
}

export type ArchitectEvent =
  | ViolationDetectedEvent
  | AnalysisCompletedEvent
  | ScoreDegradedEvent
  | ConstraintCreatedEvent
  | RuleSuggestedEvent;

export type EventType = ArchitectEvent['type'];

// ── Type-safe listener map ───────────────────────────────

type EventByType<T extends EventType> = Extract<ArchitectEvent, { type: T }>;

type ListenerFn<T extends EventType> = (event: EventByType<T>) => void | Promise<void>;

// ── Event Bus ────────────────────────────────────────────

export class EventBus {
  private listeners = new Map<EventType, Set<ListenerFn<any>>>();

  /**
   * Subscribe to an event type.
   * Returns an unsubscribe function.
   */
  on<T extends EventType>(type: T, listener: ListenerFn<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  /**
   * Subscribe to an event, but only fire once.
   */
  once<T extends EventType>(type: T, listener: ListenerFn<T>): () => void {
    const wrapper: ListenerFn<T> = (event) => {
      unsub();
      return listener(event);
    };
    const unsub = this.on(type, wrapper);
    return unsub;
  }

  /**
   * Emit an event to all listeners.
   * Async listeners are fired concurrently; errors are caught and logged.
   */
  async emit<T extends EventType>(event: EventByType<T>): Promise<void> {
    const listeners = this.listeners.get(event.type);
    if (!listeners || listeners.size === 0) return;

    const promises: Promise<void>[] = [];
    for (const listener of listeners) {
      try {
        const result = listener(event);
        if (result && typeof (result as Promise<void>).then === 'function') {
          promises.push(
            (result as Promise<void>).catch((err: Error) => {
              console.error(`[EventBus] Async listener error for "${event.type}":`, err.message);
            })
          );
        }
      } catch (err: any) {
        console.error(`[EventBus] Sync listener error for "${event.type}":`, err.message);
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /**
   * Remove all listeners for a specific event type, or all events.
   */
  clear(type?: EventType): void {
    if (type) {
      this.listeners.delete(type);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get count of listeners for a type (for diagnostics).
   */
  listenerCount(type: EventType): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

/**
 * Global singleton event bus.
 * Import and use this across the codebase.
 */
export const architectEvents = new EventBus();
