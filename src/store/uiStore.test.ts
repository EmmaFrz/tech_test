import { describe, expect, it } from 'vitest';

import { DEFAULT_SORT } from '@/domain/sorters';

import { createUiStore } from './uiStore';

describe('uiStore', () => {
  it('starts with all nodes, most severe first, no search and no selection', () => {
    expect(createUiStore().getState()).toMatchObject({
      statusFilter: 'ALL',
      sort: DEFAULT_SORT,
      search: '',
      selectedNodeId: null,
    });
  });

  it('updates each concern independently', () => {
    const store = createUiStore();
    const { actions } = store.getState();

    actions.setStatusFilter('CRITICAL');
    actions.setSort({ key: 'latencyMs', direction: 'desc' });
    actions.setSearch('0042');
    actions.selectNode('node-0042');

    expect(store.getState()).toMatchObject({
      statusFilter: 'CRITICAL',
      sort: { key: 'latencyMs', direction: 'desc' },
      search: '0042',
      selectedNodeId: 'node-0042',
    });
  });

  it('clears the selection', () => {
    const store = createUiStore();
    store.getState().actions.selectNode('node-0001');

    store.getState().actions.selectNode(null);

    expect(store.getState().selectedNodeId).toBeNull();
  });

  it('keeps the actions object stable across updates', () => {
    const store = createUiStore();
    const before = store.getState().actions;

    store.getState().actions.setSearch('x');

    expect(store.getState().actions).toBe(before);
  });
});
