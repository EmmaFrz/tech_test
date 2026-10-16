import type { ReactElement } from 'react';

import type { SortKey } from '@/domain/sorters';
import { SORT_KEYS } from '@/domain/sorters';
import { useSort, useUiActions } from '@/store';
import { Button, Select, VisuallyHidden } from '@/ui';

import styles from './SortControl.module.css';

const LABELS: Readonly<Record<SortKey, string>> = {
  status: 'Severity',
  latencyMs: 'Latency',
  cpuLoad: 'CPU load',
  memoryUsage: 'Memory usage',
  nodeId: 'Node ID',
};

export function SortControl(): ReactElement {
  const sort = useSort();
  const { setSort } = useUiActions();
  const isDescending = sort.direction === 'desc';

  return (
    <div className={styles.control}>
      <Select
        label="Sort by"
        options={SORT_KEYS.map((key) => ({ value: key, label: LABELS[key] }))}
        value={sort.key}
        onChange={(key) => setSort({ key, direction: sort.direction })}
      />
      <Button
        variant="secondary"
        onClick={() => setSort({ key: sort.key, direction: isDescending ? 'asc' : 'desc' })}
      >
        <span aria-hidden="true">{isDescending ? '↓' : '↑'}</span>
        <VisuallyHidden>{isDescending ? 'Descending' : 'Ascending'}</VisuallyHidden>
      </Button>
    </div>
  );
}
