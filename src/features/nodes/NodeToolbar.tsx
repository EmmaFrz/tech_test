import type { ReactElement } from 'react';

import styles from './NodeToolbar.module.css';
import { SearchBox } from './SearchBox';
import { SortControl } from './SortControl';
import { StatusFilter } from './StatusFilter';

export function NodeToolbar(): ReactElement {
  return (
    <div role="toolbar" aria-label="Node filters" className={styles.toolbar}>
      <StatusFilter />
      <div className={styles.secondary}>
        <SearchBox />
        <SortControl />
      </div>
    </div>
  );
}
