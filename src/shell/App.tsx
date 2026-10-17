import type { ReactElement } from 'react';

import { ConnectionBanner, ConnectionStatus, PauseToggle } from '@/features/connection';
import { NodeToolbar } from '@/features/nodes';
import { MetricsOverview } from '@/features/overview';

import styles from './App.module.css';
import { CoveredByDrawer } from './CoveredByDrawer';
import { DocumentTitle } from './DocumentTitle';
import { RegionBoundary } from './RegionBoundary';
import { Workspace } from './Workspace';

export function App(): ReactElement {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.title}>Fleet Ops</h1>
        <div className={styles.controls}>
          <ConnectionStatus />
          <PauseToggle />
        </div>
      </header>
      <ConnectionBanner />
      <main className={styles.main}>
        <CoveredByDrawer>
          <RegionBoundary region="the fleet overview">
            <MetricsOverview />
          </RegionBoundary>
          <RegionBoundary region="the node filters">
            <NodeToolbar />
          </RegionBoundary>
        </CoveredByDrawer>
        <Workspace />
      </main>
      <DocumentTitle />
    </div>
  );
}
