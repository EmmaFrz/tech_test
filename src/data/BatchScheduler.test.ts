import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IngestBatch } from '@/domain/ingest';
import { makeNode } from '@/test/factories';

import { BatchScheduler } from './BatchScheduler';

function createFrameController(): {
  readonly requestFrame: (callback: () => void) => number;
  readonly cancelFrame: (handle: number) => void;
  readonly runFrame: () => void;
  readonly pendingFrames: () => number;
} {
  const callbacks = new Map<number, () => void>();
  let nextHandle = 1;

  return {
    requestFrame: (callback) => {
      const handle = nextHandle;
      nextHandle += 1;
      callbacks.set(handle, callback);
      return handle;
    },
    cancelFrame: (handle) => {
      callbacks.delete(handle);
    },
    runFrame: () => {
      const due = [...callbacks.values()];
      callbacks.clear();
      due.forEach((callback) => callback());
    },
    pendingFrames: () => callbacks.size,
  };
}

describe('BatchScheduler', () => {
  let frames: ReturnType<typeof createFrameController>;
  let flushed: IngestBatch[];
  let scheduler: BatchScheduler;

  beforeEach(() => {
    frames = createFrameController();
    flushed = [];
    scheduler = new BatchScheduler({
      onFlush: (batch) => flushed.push(batch),
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      now: () => 5_000,
    });
  });

  it('flushes nothing until the next animation frame', () => {
    scheduler.enqueueUpdates([makeNode()]);

    expect(flushed).toHaveLength(0);
    expect(frames.pendingFrames()).toBe(1);
  });

  it('coalesces many messages into a single flush per frame', () => {
    for (let message = 0; message < 50; message += 1) {
      scheduler.enqueueUpdates([makeNode({ nodeId: `node-${message}` })]);
    }
    scheduler.enqueueHeartbeat(10);

    frames.runFrame();

    expect(flushed).toHaveLength(1);
    expect(flushed[0]?.updates).toHaveLength(50);
    expect(frames.pendingFrames()).toBe(0);
  });

  it('keeps only the latest update of each node', () => {
    scheduler.enqueueUpdates([makeNode({ nodeId: 'node-1', latencyMs: 100 })]);
    scheduler.enqueueUpdates([makeNode({ nodeId: 'node-1', latencyMs: 250 })]);

    frames.runFrame();

    expect(flushed[0]?.updates).toEqual([makeNode({ nodeId: 'node-1', latencyMs: 250 })]);
  });

  it('keeps the newest server time and stamps the batch with the receive time', () => {
    scheduler.enqueueHeartbeat(2_000);
    scheduler.enqueueHeartbeat(1_000);

    frames.runFrame();

    expect(flushed[0]).toMatchObject({ serverTime: 2_000, receivedAt: 5_000, updates: [] });
  });

  it('schedules a new frame for messages that arrive after a flush', () => {
    scheduler.enqueueUpdates([makeNode()]);
    frames.runFrame();

    scheduler.enqueueUpdates([makeNode({ nodeId: 'node-2' })]);
    frames.runFrame();

    expect(flushed).toHaveLength(2);
    expect(flushed[1]?.updates.map((node) => node.nodeId)).toEqual(['node-2']);
  });

  it('discards pending data and cancels the frame when cleared', () => {
    scheduler.enqueueUpdates([makeNode()]);
    scheduler.enqueueHeartbeat(1);

    scheduler.clear();
    frames.runFrame();

    expect(flushed).toHaveLength(0);
    expect(frames.pendingFrames()).toBe(0);
  });

  it('runs scheduled tasks in the next frame, right after its flush', () => {
    const order: string[] = [];
    const scheduler = new BatchScheduler({
      onFlush: () => order.push('flush'),
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
    });
    scheduler.scheduleTask(() => order.push('task'));
    scheduler.enqueueUpdates([makeNode()]);
    expect(order).toEqual([]);
    expect(frames.pendingFrames()).toBe(1);

    frames.runFrame();

    expect(order).toEqual(['flush', 'task']);
  });

  it('runs a task in a frame without telemetry and does not flush an empty batch', () => {
    const task = vi.fn();

    scheduler.scheduleTask(task);
    scheduler.scheduleTask(task);
    frames.runFrame();

    expect(task).toHaveBeenCalledTimes(1);
    expect(flushed).toHaveLength(0);
  });

  it('drops scheduled tasks when cleared', () => {
    const task = vi.fn();
    scheduler.scheduleTask(task);

    scheduler.clear();
    frames.runFrame();

    expect(task).not.toHaveBeenCalled();
  });

  it('ignores messages after being disposed', () => {
    scheduler.dispose();

    scheduler.enqueueUpdates([makeNode()]);
    frames.runFrame();

    expect(flushed).toHaveLength(0);
  });

  it('uses requestAnimationFrame when no frame functions are provided', () => {
    const request = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    const defaultScheduler = new BatchScheduler({ onFlush: () => undefined });

    defaultScheduler.enqueueUpdates([makeNode()]);

    expect(request).toHaveBeenCalledTimes(1);
  });
});
