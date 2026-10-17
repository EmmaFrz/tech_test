import { createDictionary } from '@/lib/dictionary';
import type { NodeTelemetry } from '@shared/protocol';

/** How long a node that has just entered CRITICAL is highlighted (FR-09). */
export const CRITICAL_PULSE_MS = 2_000;

/** Time each node entered CRITICAL, for nodes whose entry is younger than `CRITICAL_PULSE_MS`. */
export type CriticalEntries = Readonly<Record<string, number>>;

export interface CriticalEntriesChange {
  /** Every node shown before the change. */
  readonly previous: Readonly<Record<string, NodeTelemetry>>;
  /** Every node shown after the change. */
  readonly next: Readonly<Record<string, NodeTelemetry>>;
  /** Nodes whose values changed; only these can have entered CRITICAL. */
  readonly changed: readonly NodeTelemetry[];
  /** Clock of the change, also used to expire old entries. */
  readonly at: number;
}

function hasEnteredCritical(
  node: NodeTelemetry,
  previous: Readonly<Record<string, NodeTelemetry>>,
): boolean {
  const before = previous[node.nodeId];
  return node.status === 'CRITICAL' && before !== undefined && before.status !== 'CRITICAL';
}

/**
 * Records the nodes of a change that moved from another status into CRITICAL, and forgets entries
 * that expired or whose node left CRITICAL or the fleet. A node seen for the first time is not an
 * entry, so the first snapshot never pulses. Returns `entries` itself when nothing changed.
 */
export function trackCriticalEntries(
  entries: CriticalEntries,
  { previous, next, changed, at }: CriticalEntriesChange,
): CriticalEntries {
  let updated: Record<string, number> | null = null;

  for (const [nodeId, enteredAt] of Object.entries(entries)) {
    const node = next[nodeId];
    if (at - enteredAt >= CRITICAL_PULSE_MS || node === undefined || node.status !== 'CRITICAL') {
      updated ??= createDictionary(entries);
      delete updated[nodeId];
    }
  }

  for (const node of changed) {
    if (hasEnteredCritical(node, previous)) {
      updated ??= createDictionary(entries);
      updated[node.nodeId] = at;
    }
  }

  return updated ?? entries;
}
