import type { ReactElement } from 'react';

import { assertNever } from '@/lib/assertNever';
import type { NodeStatus } from '@shared/protocol';

import styles from './Badge.module.css';

export interface BadgeProps {
  readonly status: NodeStatus;
}

const STATUS_CLASS: Readonly<Record<NodeStatus, string>> = {
  OK: styles.ok ?? '',
  WARNING: styles.warning ?? '',
  CRITICAL: styles.critical ?? '',
};

function StatusIcon({ status }: BadgeProps): ReactElement {
  return (
    <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <StatusShape status={status} />
    </svg>
  );
}

function StatusShape({ status }: BadgeProps): ReactElement {
  switch (status) {
    case 'OK':
      return <path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="2" />;
    case 'WARNING':
      return (
        <path
          d="M8 2l7 12H1L8 2zm0 4v4m0 2v.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      );
    case 'CRITICAL':
      return (
        <path
          d="M5 1.5h6L14.5 5v6L11 14.5H5L1.5 11V5L5 1.5zM8 4.5v4m0 2v.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      );
    default:
      return assertNever(status);
  }
}

/** Status is always shown as icon plus text so it never depends on color alone. */
export function Badge({ status }: BadgeProps): ReactElement {
  return (
    <span className={`${styles.badge} ${STATUS_CLASS[status]}`} data-status={status}>
      <StatusIcon status={status} />
      {status}
    </span>
  );
}
