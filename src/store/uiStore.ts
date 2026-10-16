import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { StoreApi, UseBoundStore } from 'zustand';

import type { StatusFilter } from '@/domain/filters';
import type { SortSpec } from '@/domain/sorters';
import { DEFAULT_SORT } from '@/domain/sorters';
import { IS_DEVELOPMENT } from '@/lib/env';

export interface UiActions {
  readonly setStatusFilter: (statusFilter: StatusFilter) => void;
  readonly setSort: (sort: SortSpec) => void;
  readonly setSearch: (search: string) => void;
  readonly selectNode: (nodeId: string | null) => void;
}

export interface UiState {
  readonly statusFilter: StatusFilter;
  readonly sort: SortSpec;
  readonly search: string;
  readonly selectedNodeId: string | null;
  readonly actions: UiActions;
}

export type UiStore = UseBoundStore<StoreApi<UiState>>;

export function createUiStore(): UiStore {
  return create<UiState>()(
    devtools(
      (set) => ({
        statusFilter: 'ALL',
        sort: DEFAULT_SORT,
        search: '',
        selectedNodeId: null,
        actions: {
          setStatusFilter: (statusFilter) => set({ statusFilter }, false, 'setStatusFilter'),
          setSort: (sort) => set({ sort }, false, 'setSort'),
          setSearch: (search) => set({ search }, false, 'setSearch'),
          selectNode: (selectedNodeId) => set({ selectedNodeId }, false, 'selectNode'),
        },
      }),
      { name: 'uiStore', enabled: IS_DEVELOPMENT },
    ),
  );
}

export const useUiStore = createUiStore();
