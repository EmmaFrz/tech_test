import { describe, expect, it } from 'vitest';

import type { NodeTelemetry } from '@shared/protocol.js';

import { createFleetSimulation } from './simulation.js';
import { deriveStatus } from './status.js';

const START = 1_000_000;

const baseConfig = {
  nodeCount: 50,
  tickMs: 100,
  updateRatio: 0.3,
  seed: 42,
  forceCritical: 3,
  dropoutRatio: 0,
};

interface Run {
  readonly updates: readonly (readonly NodeTelemetry[])[];
  readonly final: readonly NodeTelemetry[];
}

function runTicks(config: typeof baseConfig, ticks: number): Run {
  const simulation = createFleetSimulation(config, START);
  const updates = Array.from({ length: ticks }, (_, index) =>
    simulation.tick(START + (index + 1) * config.tickMs),
  );
  return { updates, final: simulation.snapshot() };
}

describe('createFleetSimulation', () => {
  it('starts with one uniquely identified node per configured node', () => {
    const snapshot = createFleetSimulation(baseConfig, START).snapshot();

    expect(snapshot).toHaveLength(50);
    expect(new Set(snapshot.map((node) => node.nodeId)).size).toBe(50);
    expect(snapshot[0]?.nodeId).toBe('node-0001');
    expect(snapshot.every((node) => node.timestamp === START)).toBe(true);
  });

  it('pads node ids to fit large fleets', () => {
    const snapshot = createFleetSimulation({ ...baseConfig, nodeCount: 12_345 }, START).snapshot();

    expect(snapshot[0]?.nodeId).toBe('node-00001');
    expect(snapshot[12_344]?.nodeId).toBe('node-12345');
  });

  it('replays the same stream for the same seed', () => {
    expect(runTicks(baseConfig, 100)).toEqual(runTicks(baseConfig, 100));
  });

  it('produces a different stream for a different seed', () => {
    const other = runTicks({ ...baseConfig, seed: 43 }, 100);

    expect(other.final).not.toEqual(runTicks(baseConfig, 100).final);
  });

  it('keeps every metric inside its valid range and the status consistent with the metrics', () => {
    const { updates } = runTicks(baseConfig, 600);

    for (const node of updates.flat()) {
      expect(node.cpuLoad).toBeGreaterThanOrEqual(0);
      expect(node.cpuLoad).toBeLessThanOrEqual(100);
      expect(node.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(node.memoryUsage).toBeLessThanOrEqual(100);
      expect(node.latencyMs).toBeGreaterThan(0);
      expect(node.status).toBe(deriveStatus(node));
    }
  });

  it('updates roughly the configured fraction of nodes per tick', () => {
    const { updates } = runTicks({ ...baseConfig, nodeCount: 500 }, 200);

    const averageRatio = updates.reduce((sum, batch) => sum + batch.length, 0) / (200 * 500);

    expect(averageRatio).toBeGreaterThan(0.27);
    expect(averageRatio).toBeLessThan(0.33);
  });

  it('keeps the forced number of nodes critical at every tick', () => {
    const simulation = createFleetSimulation({ ...baseConfig, dropoutRatio: 0.5 }, START);

    for (let tick = 1; tick <= 400; tick += 1) {
      simulation.tick(START + tick * 100);
      const criticalCount = simulation
        .snapshot()
        .filter((node) => node.status === 'CRITICAL').length;
      expect(criticalCount).toBeGreaterThanOrEqual(3);
    }
  });

  it('lets natural status transitions happen without forced nodes', () => {
    const { updates } = runTicks({ ...baseConfig, nodeCount: 300, forceCritical: 0 }, 1_500);

    const statuses = new Set(updates.flat().map((node) => node.status));

    expect(statuses).toEqual(new Set(['OK', 'WARNING', 'CRITICAL']));
  });

  it('keeps silent nodes out of updates and leaves their timestamp untouched', () => {
    const config = { ...baseConfig, updateRatio: 1, dropoutRatio: 1 };
    const { updates, final } = runTicks(config, 10);

    expect(updates[9]?.length).toBeLessThan(config.nodeCount);
    expect(final.some((node) => node.timestamp === START)).toBe(true);
  });

  it('resumes reporting after a dropout ends', () => {
    const config = { ...baseConfig, tickMs: 10_000, updateRatio: 1, dropoutRatio: 1 };
    const { final } = runTicks(config, 60);

    expect(final.filter((node) => node.timestamp === START)).toHaveLength(0);
  });
});
