import type { IngestBatch } from '@/domain/ingest';
import type { NodeTelemetry } from '@shared/protocol';

export interface BatchSchedulerOptions {
  readonly onFlush: (batch: IngestBatch) => void;
  readonly requestFrame?: (callback: () => void) => number;
  readonly cancelFrame?: (handle: number) => void;
  readonly now?: () => number;
}

/**
 * Coalesces incoming telemetry so the store sees at most one batch per animation frame.
 * Per node only the latest sample survives, and rAF pauses in background tabs, so the buffer
 * stays bounded by the node count.
 */
export class BatchScheduler {
  private readonly pending = new Map<string, NodeTelemetry>();
  private readonly tasks = new Set<() => void>();
  private readonly onFlush: (batch: IngestBatch) => void;
  private readonly requestFrame: (callback: () => void) => number;
  private readonly cancelFrame: (handle: number) => void;
  private readonly now: () => number;
  private latestServerTime: number | null = null;
  private frameHandle: number | null = null;
  private isDisposed = false;

  constructor(options: BatchSchedulerOptions) {
    this.onFlush = options.onFlush;
    this.requestFrame = options.requestFrame ?? ((callback) => requestAnimationFrame(callback));
    this.cancelFrame = options.cancelFrame ?? ((handle) => cancelAnimationFrame(handle));
    this.now = options.now ?? Date.now;
  }

  enqueueUpdates(updates: readonly NodeTelemetry[]): void {
    for (const update of updates) {
      this.pending.set(update.nodeId, update);
    }
    this.scheduleFlush();
  }

  enqueueHeartbeat(serverTime: number): void {
    this.latestServerTime = Math.max(this.latestServerTime ?? serverTime, serverTime);
    this.scheduleFlush();
  }

  /**
   * Runs `task` right after the next flush, in the same animation frame, so whatever it writes to
   * the stores lands in that frame's single commit instead of a commit of its own.
   */
  scheduleTask(task: () => void): void {
    this.tasks.add(task);
    this.scheduleFlush();
  }

  /** Drops everything not yet flushed, e.g. when a snapshot supersedes it. */
  clear(): void {
    this.pending.clear();
    this.tasks.clear();
    this.latestServerTime = null;
    if (this.frameHandle !== null) {
      this.cancelFrame(this.frameHandle);
      this.frameHandle = null;
    }
  }

  dispose(): void {
    this.clear();
    this.isDisposed = true;
  }

  private scheduleFlush(): void {
    if (this.isDisposed || this.frameHandle !== null) {
      return;
    }
    this.frameHandle = this.requestFrame(this.flush);
  }

  private readonly flush = (): void => {
    this.frameHandle = null;
    if (this.pending.size > 0 || this.latestServerTime !== null) {
      const batch: IngestBatch = {
        updates: [...this.pending.values()],
        serverTime: this.latestServerTime,
        receivedAt: this.now(),
      };
      this.pending.clear();
      this.latestServerTime = null;
      this.onFlush(batch);
    }

    const tasks = [...this.tasks];
    this.tasks.clear();
    for (const task of tasks) {
      task();
    }
  };
}
