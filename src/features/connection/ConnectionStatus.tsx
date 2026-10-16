import type { ReactElement } from 'react';

import type { ConnectionState } from '@/domain/connection';
import { formatElapsed } from '@/domain/format';
import { useConnectionState, useMillisecondsSinceLastMessage } from '@/store';

import styles from './ConnectionStatus.module.css';

const REFRESH_MS = 250;

const STATE_LABELS: Readonly<Record<ConnectionState, string>> = {
  connecting: 'Connecting',
  live: 'Live',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
};

export function ConnectionStatus(): ReactElement {
  const state = useConnectionState();
  const elapsedMs = useMillisecondsSinceLastMessage(REFRESH_MS);

  return (
    <div className={styles.status} data-testid="connection-status" data-state={state}>
      <span className={styles.dot} aria-hidden="true" />
      <span role="status" className={styles.label}>
        {STATE_LABELS[state]}
      </span>
      <span className={styles.age}>
        {elapsedMs === null ? 'waiting for data' : `updated ${formatElapsed(elapsedMs)} ago`}
      </span>
    </div>
  );
}
