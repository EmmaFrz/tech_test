import type { StatusFilter } from './filters';
import type { SortSpec } from './sorters';

import type { NodeTelemetry } from '@shared/protocol';

import { matchesSearch, matchesStatusFilter } from './filters';
import { sortNodes } from './sorters';

export interface VisibilityQuery {
  readonly statusFilter: StatusFilter;
  readonly search: string;
  readonly sort: SortSpec;
}

export function selectVisibleNodeIds(
  nodes: readonly NodeTelemetry[],
  query: VisibilityQuery,
): readonly string[] {
  const matching = nodes.filter(
    (node) => matchesStatusFilter(node, query.statusFilter) && matchesSearch(node, query.search),
  );
  return sortNodes(matching, query.sort).map((node) => node.nodeId);
}
