import type { ReactElement, ReactNode } from 'react';

import styles from './CoveredByDrawer.module.css';
import { useIsDetailDrawerOpen } from './useIsDetailDrawerOpen';

export interface CoveredByDrawerProps {
  readonly children: ReactNode;
}

/**
 * Regions the narrow-screen detail drawer and its backdrop cover. They turn inert while it is
 * open, so keyboard focus cannot reach controls hidden behind it; the header stays usable.
 */
export function CoveredByDrawer({ children }: CoveredByDrawerProps): ReactElement {
  const isCovered = useIsDetailDrawerOpen();

  return (
    <div className={styles.covered} inert={isCovered}>
      {children}
    </div>
  );
}
