import { useId } from 'react';

import type { CardTone } from './Card';
import type { ReactElement, ReactNode } from 'react';

import { Card } from './Card';
import styles from './StatCard.module.css';
import { VisuallyHidden } from './VisuallyHidden';

export interface StatCardProps {
  readonly label: string;
  readonly value: ReactNode;
  readonly caption?: ReactNode;
  readonly tone?: CardTone;
}

const TONE_ANNOUNCEMENT: Readonly<Record<CardTone, string | null>> = {
  neutral: null,
  warning: 'Needs attention',
  alert: 'Alert',
};

export function StatCard({ label, value, caption, tone = 'neutral' }: StatCardProps): ReactElement {
  const labelId = useId();
  const announcement = TONE_ANNOUNCEMENT[tone];

  return (
    <Card tone={tone} role="group" aria-labelledby={labelId} className={styles.stat}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <span className={styles.value}>
        {value}
        {announcement === null ? null : <VisuallyHidden>{announcement}</VisuallyHidden>}
      </span>
      {caption === undefined ? null : <span className={styles.caption}>{caption}</span>}
    </Card>
  );
}
