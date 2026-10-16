import type { ReactElement } from 'react';

import styles from './App.module.css';

export function App(): ReactElement {
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.wordmark}>Fleet Ops</span>
        <span className={styles.caption}>Operations dashboard</span>
      </header>
      <section className={styles.placeholder} aria-labelledby="dashboard-heading">
        <p className={styles.eyebrow}>Fleet monitoring</p>
        <h1 id="dashboard-heading">A clear view of your fleet.</h1>
        <p className={styles.description}>
          This dashboard is being prepared. Live telemetry and node monitoring will appear here.
        </p>
        <p className={styles.status}>Telemetry is not connected yet.</p>
      </section>
    </main>
  );
}
