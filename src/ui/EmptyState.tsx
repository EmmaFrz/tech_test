import type { ReactElement, ReactNode } from 'react';

import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps): ReactElement {
  return (
    <div role="status" className={styles.empty}>
      <p className={styles.title}>{title}</p>
      {description === undefined ? null : <p className={styles.description}>{description}</p>}
      {action === undefined ? null : <div className={styles.action}>{action}</div>}
    </div>
  );
}
