import type { ReactElement } from 'react';

import { Dashboard } from '@/shell/Dashboard';

/** Every path renders the dashboard, so links such as /nodes/node-0042 keep answering 200. */
export default function DashboardPage(): ReactElement {
  return <Dashboard />;
}
