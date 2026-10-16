import type { ReactElement } from 'react';

import { formatElapsed } from '@/domain/format';
import { useConnectionState, useMillisecondsSinceLastMessage } from '@/store';

import styles from './ConnectionBanner.module.css';

const STALE_DATA_AFTER_MS = 3_000;
const REFRESH_MS = 500;

function Banner({ message }: { readonly message: string }): ReactElement {
  return (
    <div role="alert" className={styles.banner}>
      {message}
    </div>
  );
}

/** Warns when values on screen may be out of date: connection lost or the stream went quiet. */
export function ConnectionBanner(): ReactElement | null {
  const state = useConnectionState();
  const elapsedMs = useMillisecondsSinceLastMessage(REFRESH_MS);

  if (state === 'reconnecting' || state === 'offline') {
    return <Banner message="Connection lost. Showing the last known values while reconnecting." />;
  }

  if (state === 'live' && elapsedMs !== null && elapsedMs > STALE_DATA_AFTER_MS) {
    return (
      <Banner
        message={`No telemetry received for ${formatElapsed(elapsedMs)}. Values may be out of date.`}
      />
    );
  }

  return null;
}
