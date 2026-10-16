import type { ReactElement } from 'react';

import type { StatusFilter as StatusFilterValue } from '@/domain/filters';
import { STATUS_FILTERS } from '@/domain/filters';
import { useStatusCounts, useStatusFilter, useUiActions } from '@/store';
import { SegmentedControl } from '@/ui';

const LABELS: Readonly<Record<StatusFilterValue, string>> = {
  ALL: 'All',
  OK: 'OK',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
};

export function StatusFilter(): ReactElement {
  const statusFilter = useStatusFilter();
  const counts = useStatusCounts();
  const { setStatusFilter } = useUiActions();

  return (
    <SegmentedControl
      label="Filter by status"
      options={STATUS_FILTERS.map((value) => ({
        value,
        label: LABELS[value],
        count: counts[value],
      }))}
      value={statusFilter}
      onChange={setStatusFilter}
    />
  );
}
