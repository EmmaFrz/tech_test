import type { ServerConfig } from './config.js';
import type { Random } from './prng.js';
import type { NodeMetrics } from './status.js';

import type { NodeTelemetry } from '@shared/protocol.js';

import { clamp, createRandom, randomBetween } from './prng.js';
import { deriveStatus } from './status.js';

type MetricName = keyof NodeMetrics;

interface Bounds {
  readonly min: number;
  readonly max: number;
}

interface SimulatedNode {
  readonly nodeId: string;
  readonly baseline: NodeMetrics;
  readonly bounds: Readonly<Record<MetricName, Bounds>>;
  telemetry: NodeTelemetry;
  silentTicksLeft: number;
}

// Pulls a metric back toward its baseline so spikes decay over a few seconds instead of sticking.
const MEAN_REVERSION = 0.06;
const SPIKE_CHANCE_PER_UPDATE = 0.012;
const DROPOUT_MIN_MS = 12_000;
const DROPOUT_MAX_MS = 24_000;
const PINNED_CPU_FLOOR = 91;

const METRIC_NAMES: readonly MetricName[] = ['cpuLoad', 'memoryUsage', 'latencyMs'];

const STEP: Readonly<Record<MetricName, number>> = {
  cpuLoad: 4,
  memoryUsage: 3,
  latencyMs: 30,
};

const SPIKE_RANGE: Readonly<Record<MetricName, Bounds>> = {
  cpuLoad: { min: 25, max: 40 },
  memoryUsage: { min: 15, max: 30 },
  latencyMs: { min: 250, max: 700 },
};

const BASELINE_RANGE: Readonly<Record<MetricName, Bounds>> = {
  cpuLoad: { min: 25, max: 60 },
  memoryUsage: { min: 30, max: 65 },
  latencyMs: { min: 50, max: 200 },
};

const DEFAULT_BOUNDS: Readonly<Record<MetricName, Bounds>> = {
  cpuLoad: { min: 0, max: 100 },
  memoryUsage: { min: 0, max: 100 },
  latencyMs: { min: 1, max: 5_000 },
};

export interface FleetSimulation {
  /** Current telemetry of every node, including nodes that went silent. */
  readonly snapshot: () => readonly NodeTelemetry[];
  /** Advances one tick and returns the nodes that reported during it. */
  readonly tick: (now: number) => readonly NodeTelemetry[];
}

type SimulationConfig = Pick<
  ServerConfig,
  'nodeCount' | 'tickMs' | 'updateRatio' | 'seed' | 'forceCritical' | 'dropoutRatio'
>;

function formatNodeId(index: number, nodeCount: number): string {
  const width = Math.max(4, String(nodeCount).length);
  return `node-${String(index + 1).padStart(width, '0')}`;
}

function roundMetric(name: MetricName, value: number): number {
  return name === 'latencyMs' ? Math.round(value) : Math.round(value * 10) / 10;
}

function pinnedIndexes(nodeCount: number, forceCritical: number): ReadonlySet<number> {
  const indexes = new Set<number>();
  for (let slot = 0; slot < forceCritical; slot += 1) {
    indexes.add(Math.floor(((slot + 0.5) * nodeCount) / forceCritical));
  }
  return indexes;
}

function buildTelemetry(nodeId: string, metrics: NodeMetrics, timestamp: number): NodeTelemetry {
  return { nodeId, status: deriveStatus(metrics), ...metrics, timestamp };
}

function createNode(
  index: number,
  isPinned: boolean,
  config: SimulationConfig,
  random: Random,
  now: number,
): SimulatedNode {
  const baseline: NodeMetrics = {
    cpuLoad: isPinned
      ? randomBetween(random, 93, 97)
      : randomBetween(random, BASELINE_RANGE.cpuLoad.min, BASELINE_RANGE.cpuLoad.max),
    memoryUsage: randomBetween(
      random,
      BASELINE_RANGE.memoryUsage.min,
      BASELINE_RANGE.memoryUsage.max,
    ),
    latencyMs: randomBetween(random, BASELINE_RANGE.latencyMs.min, BASELINE_RANGE.latencyMs.max),
  };
  const nodeId = formatNodeId(index, config.nodeCount);
  const initial: NodeMetrics = {
    cpuLoad: roundMetric('cpuLoad', baseline.cpuLoad),
    memoryUsage: roundMetric('memoryUsage', baseline.memoryUsage),
    latencyMs: roundMetric('latencyMs', baseline.latencyMs),
  };

  return {
    nodeId,
    baseline,
    bounds: isPinned
      ? { ...DEFAULT_BOUNDS, cpuLoad: { min: PINNED_CPU_FLOOR, max: 100 } }
      : DEFAULT_BOUNDS,
    telemetry: buildTelemetry(nodeId, initial, now),
    silentTicksLeft: 0,
  };
}

function advanceMetric(node: SimulatedNode, name: MetricName, random: Random): number {
  const current = node.telemetry[name];
  const pulled = current + (node.baseline[name] - current) * MEAN_REVERSION;
  const drifted = pulled + randomBetween(random, -STEP[name], STEP[name]);
  const { min, max } = node.bounds[name];
  return roundMetric(name, clamp(drifted, min, max));
}

function applySpike(node: SimulatedNode, metrics: NodeMetrics, random: Random): NodeMetrics {
  if (random() >= SPIKE_CHANCE_PER_UPDATE) {
    return metrics;
  }

  const index = Math.floor(random() * METRIC_NAMES.length);
  const name = METRIC_NAMES[index];
  if (name === undefined) {
    return metrics;
  }

  const { min, max } = node.bounds[name];
  const spiked =
    metrics[name] + randomBetween(random, SPIKE_RANGE[name].min, SPIKE_RANGE[name].max);
  return { ...metrics, [name]: roundMetric(name, clamp(spiked, min, max)) };
}

/**
 * Deterministic for a given config: node values depend on the seed and tick count, never on the
 * wall clock, so an issue can be replayed with the same SEED. `now` only stamps updates.
 */
export function createFleetSimulation(config: SimulationConfig, now: number): FleetSimulation {
  const random = createRandom(config.seed);
  const pinned = pinnedIndexes(config.nodeCount, config.forceCritical);
  const nodes: SimulatedNode[] = [];
  for (let index = 0; index < config.nodeCount; index += 1) {
    nodes.push(createNode(index, pinned.has(index), config, random, now));
  }
  const pinnedNodeIds = new Set(
    nodes.filter((_, index) => pinned.has(index)).map((node) => node.nodeId),
  );
  const dropoutMinTicks = Math.ceil(DROPOUT_MIN_MS / config.tickMs);
  const dropoutMaxTicks = Math.ceil(DROPOUT_MAX_MS / config.tickMs);

  function maybeStartDropout(): void {
    if (random() >= config.dropoutRatio) {
      return;
    }

    const node = nodes[Math.floor(random() * nodes.length)];
    if (node === undefined || node.silentTicksLeft > 0 || pinnedNodeIds.has(node.nodeId)) {
      return;
    }

    node.silentTicksLeft = Math.round(randomBetween(random, dropoutMinTicks, dropoutMaxTicks));
  }

  function report(node: SimulatedNode, reportedAt: number): NodeTelemetry {
    const walked: NodeMetrics = {
      cpuLoad: advanceMetric(node, 'cpuLoad', random),
      memoryUsage: advanceMetric(node, 'memoryUsage', random),
      latencyMs: advanceMetric(node, 'latencyMs', random),
    };
    node.telemetry = buildTelemetry(node.nodeId, applySpike(node, walked, random), reportedAt);
    return node.telemetry;
  }

  return {
    snapshot: () => nodes.map((node) => node.telemetry),
    tick: (tickTime) => {
      maybeStartDropout();
      const updates: NodeTelemetry[] = [];
      for (const node of nodes) {
        if (node.silentTicksLeft > 0) {
          node.silentTicksLeft -= 1;
        } else if (random() < config.updateRatio) {
          updates.push(report(node, tickTime));
        }
      }
      return updates;
    },
  };
}
