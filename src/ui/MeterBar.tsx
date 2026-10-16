import type { CSSProperties, ReactElement } from 'react';

import styles from './MeterBar.module.css';

export interface MeterThresholds {
  readonly warning: number;
  readonly critical: number;
}

export interface MeterBarProps {
  readonly label: string;
  readonly value: number;
  readonly thresholds: MeterThresholds;
}

type MeterLevel = 'ok' | 'warning' | 'critical';

function resolveLevel(value: number, thresholds: MeterThresholds): MeterLevel {
  if (value >= thresholds.critical) {
    return 'critical';
  }

  return value >= thresholds.warning ? 'warning' : 'ok';
}

/** Percent gauge colored by threshold; pair it with the numeric value so color is never the only cue. */
export function MeterBar({ label, value, thresholds }: MeterBarProps): ReactElement {
  const boundedValue = Math.min(100, Math.max(0, value));
  const level = resolveLevel(boundedValue, thresholds);

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={boundedValue}
      aria-valuetext={`${boundedValue.toFixed(1)}%`}
      className={`${styles.track} ${styles[level]}`}
      data-level={level}
      style={{ '--value': `${boundedValue}%` } as CSSProperties}
    >
      <div className={styles.fill} />
    </div>
  );
}
