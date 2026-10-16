import type { ReactElement, ReactNode } from 'react';

import styles from './VisuallyHidden.module.css';

export interface VisuallyHiddenProps {
  readonly children: ReactNode;
}

/** Text for assistive technology that should not take up visual space. */
export function VisuallyHidden({ children }: VisuallyHiddenProps): ReactElement {
  return <span className={styles.hidden}>{children}</span>;
}
