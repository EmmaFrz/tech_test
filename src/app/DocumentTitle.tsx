import { useEffect } from 'react';

import { formatDocumentTitle } from '@/domain/format';
import { useCriticalCount } from '@/store';

/** Puts the number of critical nodes in the browser tab, e.g. "(3) Fleet Ops". */
export function DocumentTitle(): null {
  const criticalCount = useCriticalCount();

  useEffect(() => {
    document.title = formatDocumentTitle(criticalCount);
  }, [criticalCount]);

  return null;
}
