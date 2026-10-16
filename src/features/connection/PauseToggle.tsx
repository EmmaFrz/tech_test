import type { ReactElement } from 'react';

import { useIsPaused, useTelemetryActions } from '@/store';
import { Button } from '@/ui';

/** Freezes the rendered data; the stream keeps buffering and catches up on resume. */
export function PauseToggle(): ReactElement {
  const isPaused = useIsPaused();
  const { pause, resume } = useTelemetryActions();

  return (
    <Button variant="secondary" onClick={isPaused ? resume : pause}>
      {isPaused ? 'Resume' : 'Pause'}
    </Button>
  );
}
